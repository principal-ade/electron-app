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
import { repoPurlFromEntry } from '../../shared/topics/repoPurl';

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
 * canonical path, its remote, and its PURL (so a caller can resolve a repo to
 * the string it writes into a topic's `repos` without a second call). Single-
 * entry responses (register/delete) keep the fuller RepoSummary so the caller
 * can confirm name/views/provenance.
 */
interface RepoListItem {
  path: string;
  remoteUrl?: string;
  purl?: string;
}

function listEntry(entry: AlexandriaEntry): RepoListItem {
  return {
    path: String(entry.path),
    remoteUrl: entry.remoteUrl,
    purl: repoPurlFromEntry(entry) ?? undefined,
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
): void {
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

  // De-register a repository. This ONLY drops the registry entry — local files
  // are never touched (removeRepository's deleteLocal flag is intentionally not
  // exposed over HTTP, so the bridge can't be used to wipe a working tree).
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

    if (!repoPath) {
      res.status(400).json({
        success: false,
        error: 'path is required (query ?path= or body.path)',
      });
      return;
    }

    try {
      const existing = await registry.getRepositoryByPath(repoPath);
      if (!existing) {
        res
          .status(404)
          .json({ success: false, error: `no repo registered at ${repoPath}` });
        return;
      }
      // deleteLocal defaults to false — registry entry only.
      const removed = await registry.removeRepository(repoPath);
      if (!removed) {
        res.status(500).json({
          success: false,
          error: `failed to de-register repo at ${repoPath}`,
        });
        return;
      }
      res.json({ success: true, removed: summarizeEntry(existing) });
    } catch (err) {
      console.error('[repoRoutes] remove failed', err);
      res.status(500).json({
        success: false,
        error: `failed to de-register repo: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });
}
