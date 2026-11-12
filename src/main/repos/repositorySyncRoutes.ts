import type { Application, Request, Response } from 'express';
import type { AlexandriaRegistryService } from '../stores/AlexandriaRegistryService';
import { MAX_CLONE_BATCH } from '../principal-mcp/routeCatalog';
import {
  syncRepository,
  type RepositorySyncResult,
  type RunGit,
} from './repositorySync';

export interface RepositorySyncRouteDependencies {
  runGit?: RunGit;
  syncRepository?: (
    repoPath: string,
    options: { apply: boolean },
    runGit?: RunGit,
  ) => Promise<RepositorySyncResult>;
}

const activeRepositories = new Set<string>();

export function registerRepositorySyncRoutes(
  app: Application,
  registry: AlexandriaRegistryService,
  deps: RepositorySyncRouteDependencies = {},
): void {
  const runSync = deps.syncRepository ?? syncRepository;

  app.post('/api/repos/sync', async (req: Request, res: Response) => {
    const body =
      req.body && typeof req.body === 'object'
        ? (req.body as Record<string, unknown>)
        : {};

    if (body.apply !== undefined && typeof body.apply !== 'boolean') {
      res.status(400).json({
        success: false,
        error: 'body.apply must be a boolean when supplied',
      });
      return;
    }
    const apply = body.apply === true;

    let requestedPaths: string[] | undefined;
    if (body.paths !== undefined) {
      if (
        !Array.isArray(body.paths) ||
        body.paths.length === 0 ||
        body.paths.length > MAX_CLONE_BATCH ||
        body.paths.some(
          (repoPath) => typeof repoPath !== 'string' || !repoPath.trim(),
        )
      ) {
        res.status(400).json({
          success: false,
          error: `body.paths must be a non-empty array of up to ${MAX_CLONE_BATCH} registered absolute repository paths`,
        });
        return;
      }
      requestedPaths = [
        ...new Set((body.paths as string[]).map((p) => p.trim())),
      ];
    }

    try {
      const registered = await registry.getRepositories();
      const byPath = new Map(
        registered.map((entry) => [String(entry.path), entry]),
      );
      if (requestedPaths) {
        const unknown = requestedPaths.filter(
          (repoPath) => !byPath.has(repoPath),
        );
        if (unknown.length > 0) {
          res.status(400).json({
            success: false,
            error: `only registered repository paths can be synced; unknown: ${unknown.join(', ')}`,
          });
          return;
        }
      }

      const selected = requestedPaths
        ? requestedPaths
            .map((repoPath) => byPath.get(repoPath))
            .filter((entry) => entry !== undefined)
        : registered;
      const results: RepositorySyncResult[] = [];
      for (const entry of selected) {
        const repoPath = String(entry.path);
        if (activeRepositories.has(repoPath)) {
          results.push({
            path: repoPath,
            status: 'busy',
            remotes: [],
            error: 'another repository sync operation is already running',
          });
          continue;
        }

        activeRepositories.add(repoPath);
        try {
          results.push(await runSync(repoPath, { apply }, deps.runGit));
        } catch (error) {
          results.push({
            path: repoPath,
            status: 'fetch-failed',
            remotes: [],
            error: error instanceof Error ? error.message : String(error),
          });
        } finally {
          activeRepositories.delete(repoPath);
        }
      }

      res.json({
        success: true,
        apply,
        results,
        summary: {
          requested: results.length,
          fastForwarded: results.filter((r) => r.status === 'fast-forwarded')
            .length,
          fastForwardable: results.filter(
            (r) => r.status === 'fast-forwardable',
          ).length,
          upToDate: results.filter((r) => r.status === 'up-to-date').length,
          skipped: results.filter(
            (r) =>
              !['fast-forwarded', 'fast-forwardable', 'up-to-date'].includes(
                r.status,
              ),
          ).length,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `failed to sync registered repositories: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  });
}
