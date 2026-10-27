/**
 * Express routes for registering / listing Alexandria repositories over HTTP.
 * Mounted on the Principal MCP Bridge so a briefed terminal (agent, CLI, skill)
 * can register a repo with the running app instead of relying on the in-app UI
 * or the renderer-only TIPC handlers (alexandria_registerRepository).
 *
 * Registration is the programmatic analogue of the "Add repository" UI
 * affordance: it derives the display name + remote from the repo's git config,
 * consistently with the window-manager repository registration path.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { Application, Request, Response } from 'express';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';
import type { AlexandriaRegistryService } from '../stores/AlexandriaRegistryService';
import { UserPreferencesHandler } from '../stores/userPreferencesHandler';
import { repoPurlFromEntry } from '../../shared/topics/repoPurl';
import { joinClonePath } from '../../shared/utils/clonePath';
import { MAX_CLONE_BATCH } from '../principal-mcp/routeCatalog';
import { parseCloneTarget } from './cloneTarget';
import { cloneRepositoryToPath } from './cloneRepository';

/**
 * Injectables for tests. Production callers pass nothing and get the real git
 * clone plus the app's saved base directory.
 */
export interface RepoRouteDependencies {
  cloneRepository?: (
    url: string,
    targetPath: string,
    options: { depth?: number },
  ) => Promise<void>;
  getBaseDefaultDirectory?: () => Promise<string | undefined>;
}

/**
 * Trimmed, JSON-safe view of a registry entry. The full AlexandriaEntry
 * carries CodebaseView summaries and a branded path type; callers only need
 * the identity + provenance fields to confirm a register/list succeeded.
 */
interface RepoSummary {
  path: string;
  name: string;
  remoteUrl?: string;
  /**
   * Canonical repo PURL (`pkg:github/owner/repo`, or `pkg:generic/local/...`
   * for a local-only clone). Derived via the same helper the workspace↔topic
   * sync uses, so this is exactly the value a caller should write into a
   * topic's `repos` to scope it to this repo.
   */
  purl?: string;
  registeredAt: string;
  hasViews: boolean;
  viewCount: number;
  github?: { owner?: string; name?: string };
}

/**
 * Even leaner view for the list route. GET /api/repos can return many entries,
 * so it carries only the fields a caller needs to identify a clone: the
 * canonical path, its name, when it was registered, its remote, and its PURL
 * (so a caller can resolve a repo to the string it writes into a topic's
 * `repos` without a second call). Single-entry responses (register/delete/clone)
 * keep the fuller RepoSummary so the caller can confirm views/provenance.
 */
interface RepoListItem {
  path: string;
  name: string;
  remoteUrl?: string;
  purl?: string;
  registeredAt: string;
}

function listEntry(entry: AlexandriaEntry): RepoListItem {
  return {
    path: String(entry.path),
    name: entry.name,
    remoteUrl: entry.remoteUrl,
    purl: repoPurlFromEntry(entry) ?? undefined,
    registeredAt: entry.registeredAt,
  };
}

function summarizeEntry(entry: AlexandriaEntry): RepoSummary {
  return {
    path: String(entry.path),
    name: entry.name,
    remoteUrl: entry.remoteUrl,
    purl: repoPurlFromEntry(entry) ?? undefined,
    registeredAt: entry.registeredAt,
    hasViews: entry.hasViews,
    viewCount: entry.viewCount,
    github: entry.github
      ? { owner: entry.github.owner, name: entry.github.name }
      : undefined,
  };
}

/**
 * Per-entry outcome of POST /api/repos/clone. Batch semantics: one bad
 * identifier or one failing clone doesn't abort the rest, so callers can retry
 * only the entries with `ok: false`.
 */
interface CloneBatchEntry {
  /** The identifier from the request, echoed back in request order. */
  request: string;
  ok: boolean;
  action?: 'cloned' | 'alreadyRegistered';
  path?: string;
  cloneUrl?: string;
  repo?: RepoSummary;
  /** Set when the clone succeeded but the registry write did not. */
  registerError?: string;
  error?: string;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.stat(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * Is there a git repo at `repoPath`? `.git` is a directory for a normal
 * clone and a file for worktrees / submodules — accept either. Mirrors the
 * repository registration's guard so all callers agree on what counts.
 */
async function hasGitDir(repoPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(path.join(repoPath, '.git'));
    return stat.isDirectory() || stat.isFile();
  } catch {
    return false;
  }
}

export function registerRepoRoutes(
  app: Application,
  registry: AlexandriaRegistryService,
  deps: RepoRouteDependencies = {},
): void {
  const cloneRepository =
    deps.cloneRepository ??
    ((url, targetPath, options) =>
      cloneRepositoryToPath(url, targetPath, options));
  const getBaseDefaultDirectory =
    deps.getBaseDefaultDirectory ??
    (async () => {
      const preferences = await UserPreferencesHandler.getInstance()
        .getUserPreferences();
      return preferences.baseDefaultDirectory;
    });
  // List registered repositories. Cheap discovery affordance so an agent can
  // check whether a path is already registered before POSTing.
  app.get('/api/repos', async (_req: Request, res: Response) => {
    try {
      const entries = await registry.getRepositories();
      res.json({ success: true, repos: entries.map(listEntry) });
    } catch (err) {
      console.error('[repoRoutes] list failed', err);
      res.status(500).json({
        success: false,
        error: `failed to list repos: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });

  // Clone one or more repos into the conventional `<base>/<owner>/<repo>`
  // layout and register each clone. Accepts repo PURLs, owner/repo slugs, and
  // clone URLs; per-entry failures don't abort the batch.
  app.post('/api/repos/clone', async (req: Request, res: Response) => {
    const body =
      req.body && typeof req.body === 'object'
        ? (req.body as Record<string, unknown>)
        : null;

    const listed = Array.isArray(body?.repos)
      ? (body?.repos as unknown[])
      : typeof body?.repo === 'string'
        ? [body.repo]
        : [];
    const entries = listed
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean);

    if (entries.length === 0) {
      res.status(400).json({
        success: false,
        error:
          'body.repos is required: a non-empty array of repo PURLs, owner/repo slugs, or clone URLs (body.repo accepts a single identifier)',
      });
      return;
    }
    if (entries.length > MAX_CLONE_BATCH) {
      res.status(400).json({
        success: false,
        error: `body.repos accepts at most ${MAX_CLONE_BATCH} entries per request (got ${entries.length})`,
      });
      return;
    }

    const rawDepth = body?.depth;
    const depthNumber =
      typeof rawDepth === 'number' ? rawDepth : Number(rawDepth);
    const depth =
      Number.isFinite(depthNumber) && depthNumber > 0
        ? Math.floor(depthNumber)
        : undefined;
    const shouldRegister = body?.register !== false;

    let baseDirectory: string | undefined;
    try {
      baseDirectory = await getBaseDefaultDirectory();
    } catch (err) {
      res.status(500).json({
        success: false,
        error: `failed to read the base directory: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }
    if (!baseDirectory) {
      res.status(400).json({
        success: false,
        error:
          'No base directory configured. Set one in Settings → General (baseDefaultDirectory), then retry.',
      });
      return;
    }

    const results: CloneBatchEntry[] = [];

    for (const entry of entries) {
      const parsed = parseCloneTarget(entry);
      if (!parsed.ok) {
        results.push({ request: entry, ok: false, error: parsed.error });
        continue;
      }

      const { owner, repo: repoName, cloneUrl } = parsed.target;
      const targetPath = joinClonePath(baseDirectory, owner, repoName);

      try {
        const existing = await registry.getRepositoryByPath(targetPath);
        if (existing) {
          results.push({
            request: entry,
            ok: true,
            action: 'alreadyRegistered',
            path: targetPath,
            cloneUrl,
            repo: summarizeEntry(existing),
          });
          continue;
        }

        if (await pathExists(targetPath)) {
          results.push({
            request: entry,
            ok: false,
            path: targetPath,
            error: `target path already exists and is not registered: ${targetPath} (clone it away with an explicit git clone or remove the directory)`,
          });
          continue;
        }

        await cloneRepository(cloneUrl, targetPath, { depth });

        let repo: RepoSummary | undefined;
        let registerError: string | undefined;
        if (shouldRegister) {
          try {
            repo = summarizeEntry(
              await registry.registerRepository(targetPath, cloneUrl),
            );
          } catch (err) {
            // The clone is on disk; surfacing registration failure separately
            // keeps the caller from re-cloning into an existing directory.
            registerError = `cloned, but registration failed: ${
              err instanceof Error ? err.message : String(err)
            }`;
          }
        }

        results.push({
          request: entry,
          ok: true,
          action: 'cloned',
          path: targetPath,
          cloneUrl,
          repo,
          ...(registerError ? { registerError } : {}),
        });
      } catch (err) {
        console.error('[repoRoutes] clone failed', entry, err);
        results.push({
          request: entry,
          ok: false,
          path: targetPath,
          error: `clone failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    const failed = results.filter((result) => !result.ok).length;
    res.status(200).json({
      success: failed === 0,
      baseDirectory,
      results,
      summary: {
        requested: results.length,
        cloned: results.filter((result) => result.action === 'cloned').length,
        alreadyRegistered: results.filter(
          (result) => result.action === 'alreadyRegistered',
        ).length,
        failed,
      },
    });
  });

  // Register a repository at `path`. The name + remote are derived from the
  // repo's git config when `remoteUrl` is omitted. Re-registering an existing
  // path is a no-op that returns the existing entry (200), so callers can POST
  // idempotently.
  app.post('/api/repos', async (req: Request, res: Response) => {
    const body =
      req.body && typeof req.body === 'object'
        ? (req.body as Record<string, unknown>)
        : null;
    const repoPath =
      body && typeof body.path === 'string' ? body.path.trim() : '';
    const remoteUrl =
      body && typeof body.remoteUrl === 'string' && body.remoteUrl.trim()
        ? body.remoteUrl.trim()
        : undefined;

    if (!repoPath) {
      res
        .status(400)
        .json({ success: false, error: 'body.path is required (non-empty string)' });
      return;
    }
    // The registry keys repos by absolute path; a relative path would register
    // a different entry than the caller intends (resolved against the app's cwd).
    if (!path.isAbsolute(repoPath)) {
      res
        .status(400)
        .json({ success: false, error: 'body.path must be an absolute path' });
      return;
    }
    if (!(await hasGitDir(repoPath))) {
      res.status(400).json({
        success: false,
        error: `no git repository found at ${repoPath} (missing .git)`,
      });
      return;
    }

    try {
      const existing = await registry.getRepositoryByPath(repoPath);
      const entry = await registry.registerRepository(repoPath, remoteUrl);
      res.status(existing ? 200 : 201).json({
        success: true,
        alreadyRegistered: !!existing,
        repo: summarizeEntry(entry),
      });
    } catch (err) {
      console.error('[repoRoutes] register failed', err);
      res.status(500).json({
        success: false,
        error: `failed to register repo: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });

  // De-register a repository. By default this ONLY drops the registry entry —
  // the checkout stays on disk. `deleteLocal=true` opts into deleting the
  // working tree as well, guarded so a typo can't wipe an unrelated directory:
  // the path must be registered, absolute, a git working tree, and not a
  // filesystem root or the base directory itself.
  // The path comes from the query (`?path=`) or a JSON body; DELETE bodies are
  // unreliable across HTTP clients, so the query form is the safer default.
  app.delete('/api/repos', async (req: Request, res: Response) => {
    const body =
      req.body && typeof req.body === 'object'
        ? (req.body as Record<string, unknown>)
        : null;
    const fromQuery =
      typeof req.query.path === 'string' ? req.query.path.trim() : '';
    const fromBody =
      body && typeof body.path === 'string' ? body.path.trim() : '';
    const repoPath = fromQuery || fromBody;

    const rawDeleteLocal = req.query.deleteLocal ?? body?.deleteLocal;
    const deleteLocal =
      rawDeleteLocal === true || rawDeleteLocal === 'true';

    if (!repoPath) {
      res.status(400).json({
        success: false,
        error: 'path is required (query ?path= or body.path)',
      });
      return;
    }

    if (deleteLocal) {
      if (!path.isAbsolute(repoPath)) {
        res.status(400).json({
          success: false,
          error: 'deleteLocal=true requires body.path/query path to be absolute',
        });
        return;
      }
      const baseDirectory = await getBaseDefaultDirectory().catch(() => undefined);
      if (
        repoPath === '/' ||
        repoPath === path.sep ||
        repoPath === process.env.HOME ||
        (baseDirectory && repoPath === baseDirectory)
      ) {
        res.status(400).json({
          success: false,
          error: `refusing to delete ${repoPath}: not a repository checkout`,
        });
        return;
      }
      if (!(await hasGitDir(repoPath))) {
        res.status(400).json({
          success: false,
          error: `refusing to delete ${repoPath}: no git repository found (missing .git)`,
        });
        return;
      }
    }

    try {
      const existing = await registry.getRepositoryByPath(repoPath);
      if (!existing) {
        res
          .status(404)
          .json({ success: false, error: `no repo registered at ${repoPath}` });
        return;
      }
      const removed = await registry.removeRepository(repoPath, deleteLocal);
      if (!removed) {
        res.status(500).json({
          success: false,
          error: `failed to de-register repo at ${repoPath}`,
        });
        return;
      }
      res.json({
        success: true,
        deleteLocal,
        removed: summarizeEntry(existing),
      });
    } catch (err) {
      console.error('[repoRoutes] remove failed', err);
      res.status(500).json({
        success: false,
        error: `failed to de-register repo: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });
}
