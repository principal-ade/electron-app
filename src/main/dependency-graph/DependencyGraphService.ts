/**
 * Cross-repo dependency graph for blast-radius queries.
 *
 * Builds an inverted index over the packages published by the user's *cloned*
 * registry repos: for a package P that declares a dependency on package D, the
 * index records P as a dependent of D. A blast-radius query then answers "which
 * cloned repos depend on a package that repo X publishes" by looking up X's
 * published purls in that index.
 *
 * Phase 1 returns DIRECT dependents only (one hop) — transitive reachability is
 * deferred. Package identity is the purl already stamped onto
 * `PackageLayer.packageData.purl` by codebase-composition (with a derive
 * fallback for packages discovered by an older worker that predates purl). The
 * per-repo `PackageLayer[]` comes from the repository-monitoring worker via
 * `getManager().getPackages` — this service never scans the filesystem itself.
 *
 * The index is built lazily on first query and memoized in-process;
 * `invalidate()` drops it so the next query rebuilds.
 */

import { promises as fs } from 'fs';
import type { PackageLayer } from '@principal-ai/codebase-composition';
import { derivePurl } from '@principal-ai/codebase-composition';
import { AlexandriaRegistryService } from '../stores/AlexandriaRegistryService';
import { getManager } from '../repository-monitoring/ipcHandlers';

export type BlastRadiusSelector =
  | { kind: 'path'; value: string }
  | { kind: 'repo'; value: string }
  | { kind: 'purl'; value: string };

export interface BlastRadiusDependent {
  /** purl of the package that depends on the target. */
  purl: string;
  /**
   * Local path of the repo publishing the dependent. Always set in v1 (we only
   * know packages from cloned repos); nullable for the future
   * accessible-but-uncloned phase.
   */
  repoPath: string | null;
  /** Display name of the dependent package. */
  name: string;
  /** Which of the target's published purls this dependent directly declares. */
  dependsOn: string[];
}

export interface BlastRadiusResult {
  target: { repoPath: string; repoName?: string; purls: string[] };
  impacted: BlastRadiusDependent[];
  /** Registered repos that were skipped (no local clone, or no packages found). */
  unanalyzedCount: number;
}

interface DependentEdge {
  purl: string;
  repoPath: string;
  name: string;
}

interface GraphIndex {
  /** depended-on purl -> packages that directly declare it. */
  dependents: Map<string, DependentEdge[]>;
  /** repoPath -> purls that repo publishes. */
  reposToPurls: Map<string, Set<string>>;
  /** published purl -> publishing repoPath (resolves the ?purl= selector). */
  purlToRepo: Map<string, string>;
  unanalyzedCount: number;
}

const DEP_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
] as const;

export class DependencyGraphService {
  private static instance: DependencyGraphService;
  private index: GraphIndex | null = null;
  private building: Promise<GraphIndex> | null = null;

  static getInstance(): DependencyGraphService {
    if (!DependencyGraphService.instance) {
      DependencyGraphService.instance = new DependencyGraphService();
    }
    return DependencyGraphService.instance;
  }

  /** Drop the cached index so the next query rebuilds. */
  invalidate(): void {
    this.index = null;
  }

  private purlForLayer(layer: PackageLayer): string | undefined {
    return (
      layer.packageData?.purl ?? derivePurl(layer.type, layer.packageData?.name)
    );
  }

  private async getIndex(forceRebuild = false): Promise<GraphIndex> {
    if (forceRebuild) this.index = null;
    if (this.index) return this.index;
    // Coalesce concurrent first-queries onto a single build.
    if (!this.building) {
      this.building = this.buildIndex().finally(() => {
        this.building = null;
      });
    }
    this.index = await this.building;
    return this.index;
  }

  private async buildIndex(): Promise<GraphIndex> {
    const registry = AlexandriaRegistryService.getInstance();
    const manager = getManager();
    const entries = await registry.getRepositories();

    const dependents = new Map<string, DependentEdge[]>();
    const reposToPurls = new Map<string, Set<string>>();
    const purlToRepo = new Map<string, string>();
    let unanalyzedCount = 0;

    for (const entry of entries) {
      const repoPath = entry.path ? String(entry.path) : '';
      if (!repoPath || !(await pathExists(repoPath))) {
        unanalyzedCount += 1;
        continue;
      }

      let result;
      try {
        result = await manager.getPackages(repoPath);
      } catch (err) {
        console.error(
          '[dependencyGraph] getPackages failed for',
          repoPath,
          err,
        );
      }
      if (!result || result.packages.length === 0) {
        unanalyzedCount += 1;
        continue;
      }

      const published = reposToPurls.get(repoPath) ?? new Set<string>();
      for (const layer of result.packages) {
        const selfPurl = this.purlForLayer(layer);
        if (!selfPurl) continue;
        published.add(selfPurl);
        purlToRepo.set(selfPurl, repoPath);

        for (const field of DEP_FIELDS) {
          const deps = layer.packageData?.[field];
          if (!deps) continue;
          for (const depName of Object.keys(deps)) {
            // A dependency is in the same ecosystem as the manifest declaring
            // it, so the host layer's type drives the dependency's purl.
            const depPurl = derivePurl(layer.type, depName);
            if (!depPurl) continue;
            const list = dependents.get(depPurl) ?? [];
            list.push({
              purl: selfPurl,
              repoPath,
              name: layer.packageData.name,
            });
            dependents.set(depPurl, list);
          }
        }
      }
      reposToPurls.set(repoPath, published);
    }

    return { dependents, reposToPurls, purlToRepo, unanalyzedCount };
  }

  async blastRadius(
    selector: BlastRadiusSelector,
    opts: { includeSelf?: boolean; forceRebuild?: boolean } = {},
  ): Promise<BlastRadiusResult | null> {
    const index = await this.getIndex(opts.forceRebuild);
    const target = await this.resolveTarget(selector, index);
    if (!target) return null;

    const myPurls = [...(index.reposToPurls.get(target.repoPath) ?? [])];

    // Aggregate dependents across all of the target's published purls, deduped
    // by (dependent purl, dependent repo) so a repo that imports two of the
    // target's packages appears once with both purls in `dependsOn`.
    const byKey = new Map<string, BlastRadiusDependent>();
    for (const myPurl of myPurls) {
      for (const edge of index.dependents.get(myPurl) ?? []) {
        if (!opts.includeSelf && edge.repoPath === target.repoPath) continue;
        const key = `${edge.purl}@@${edge.repoPath}`;
        const existing = byKey.get(key);
        if (existing) {
          if (!existing.dependsOn.includes(myPurl)) {
            existing.dependsOn.push(myPurl);
          }
        } else {
          byKey.set(key, {
            purl: edge.purl,
            repoPath: edge.repoPath,
            name: edge.name,
            dependsOn: [myPurl],
          });
        }
      }
    }

    return {
      target: {
        repoPath: target.repoPath,
        repoName: target.repoName,
        purls: myPurls,
      },
      impacted: [...byKey.values()],
      unanalyzedCount: index.unanalyzedCount,
    };
  }

  private async resolveTarget(
    selector: BlastRadiusSelector,
    index: GraphIndex,
  ): Promise<{ repoPath: string; repoName?: string } | null> {
    const registry = AlexandriaRegistryService.getInstance();

    if (selector.kind === 'purl') {
      const repoPath = index.purlToRepo.get(selector.value);
      return repoPath ? { repoPath } : null;
    }

    if (selector.kind === 'path') {
      const entry = await registry.getRepositoryByPath(selector.value);
      if (entry?.path) {
        return { repoPath: String(entry.path), repoName: entry.name };
      }
      // Accept a raw path that was analyzed even if the registry lookup misses.
      return index.reposToPurls.has(selector.value)
        ? { repoPath: selector.value }
        : null;
    }

    // kind === 'repo': match `owner/name`, `name`, or the entry display name.
    const wanted = selector.value.toLowerCase();
    const entries = await registry.getRepositories();
    for (const entry of entries) {
      const owner = entry.github?.owner?.toLowerCase();
      const name = entry.github?.name?.toLowerCase();
      const ownerName = owner && name ? `${owner}/${name}` : undefined;
      if (
        ownerName === wanted ||
        name === wanted ||
        entry.name?.toLowerCase() === wanted
      ) {
        return entry.path
          ? { repoPath: String(entry.path), repoName: entry.name }
          : null;
      }
    }
    return null;
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}
