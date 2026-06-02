/**
 * Builds an in-memory index of the files in a workspace's member repositories,
 * so markdown doc links (which are repo-root-relative and, in topic notes, have
 * no single "current repo") can be resolved to a concrete file + repository.
 *
 * The index is sourced from the repository-monitoring server's cached file
 * trees (path lists, no content reads) and kept fresh via `onCacheSync` — when
 * a repo's tree changes, only that repo's entry is rebuilt.
 *
 * The file set is both the resolver and the existence check: a path that
 * matches exactly one repo's tree resolves and is known to exist; zero matches
 * is "missing"; multiple matches is "ambiguous" (the enrichment/disambiguation
 * case for topics that span several projects).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { WorkspaceService } from '../main-process-api/WorkspaceService';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';

export interface ResolvedDocLink {
  /**
   * - `resolved`: exactly one member repo contains the path
   * - `missing`: no member repo's tree contains it
   * - `ambiguous`: more than one repo contains it
   * - `no-index`: the workspace index is empty / not loaded yet — callers
   *   should fall back to any other context they have rather than treat the
   *   link as missing
   */
  status: 'resolved' | 'missing' | 'ambiguous' | 'no-index';
  /** Repo-root-relative path that was looked up (normalized). */
  path: string;
  /** Absolute file path — present when `status === 'resolved'`. */
  filePath?: string;
  /** Owning repository root — present when `status === 'resolved'`. */
  repositoryPath?: string;
  /** Candidate repos — present when `status === 'ambiguous'`. */
  candidates?: { filePath: string; repositoryPath: string; repoName: string }[];
}

interface RepoFileIndex {
  path: string;
  name: string;
  files: Set<string>;
}

/**
 * Collapse `.` / `..` segments and strip a leading `./` or `/` so a link href
 * becomes a repo-root-relative key comparable to `FileInfo.relativePath`.
 */
export const toRepoRelative = (p: string): string => {
  const parts: string[] = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      parts.pop();
      continue;
    }
    parts.push(seg);
  }
  return parts.join('/');
};

export const useWorkspaceFileIndex = (workspaceId?: string) => {
  const [indexes, setIndexes] = useState<RepoFileIndex[]>([]);

  // Mirror of `indexes` for use inside the cache-sync callback without making
  // the subscription depend on (and re-subscribe to) state changes.
  const indexRef = useRef<RepoFileIndex[]>([]);
  indexRef.current = indexes;

  const loadRepo = useCallback(
    async (path: string, name: string): Promise<RepoFileIndex> => {
      const tree = await RepositoryMonitoringService.getFileTree(path);
      const files = new Set<string>(
        (tree?.allFiles ?? []).map((f) => f.relativePath),
      );
      return { path, name, files };
    },
    [],
  );

  const loadAll = useCallback(async () => {
    if (!workspaceId) {
      setIndexes([]);
      return;
    }
    try {
      const entries =
        await WorkspaceService.getRepositoriesInWorkspace(workspaceId);
      const built = await Promise.all(
        entries.map((e) => loadRepo(e.path as string, e.name)),
      );
      setIndexes(built);
    } catch (err) {
      console.error('[useWorkspaceFileIndex] failed to load file index', err);
      setIndexes([]);
    }
  }, [workspaceId, loadRepo]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Rebuild a single repo's file set when its cached tree syncs.
  useEffect(() => {
    const off = RepositoryMonitoringService.onCacheSync((event) => {
      const existing = indexRef.current.find((r) => r.path === event.repoPath);
      if (!existing) return;
      void loadRepo(existing.path, existing.name).then((updated) => {
        setIndexes((cur) =>
          cur.map((r) => (r.path === updated.path ? updated : r)),
        );
      });
    });
    return off;
  }, [loadRepo]);

  const resolve = useCallback(
    (rawPath: string): ResolvedDocLink => {
      const path = toRepoRelative(rawPath);
      if (indexes.length === 0) return { status: 'no-index', path };

      const hits = indexes.filter((r) => r.files.has(path));
      if (hits.length === 1) {
        return {
          status: 'resolved',
          path,
          filePath: `${hits[0].path}/${path}`,
          repositoryPath: hits[0].path,
        };
      }
      if (hits.length === 0) return { status: 'missing', path };
      return {
        status: 'ambiguous',
        path,
        candidates: hits.map((h) => ({
          filePath: `${h.path}/${path}`,
          repositoryPath: h.path,
          repoName: h.name,
        })),
      };
    },
    [indexes],
  );

  return { resolve, repoCount: indexes.length };
};
