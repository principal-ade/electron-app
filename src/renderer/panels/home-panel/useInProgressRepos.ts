/**
 * useInProgressRepos
 *
 * Repositories with a dirty working tree (uncommitted changes) or unpushed
 * commits — the same filter the In Progress panel applies. Loads once for the
 * given repositories, then tracks `git-status-changed` events so the list stays
 * live while those repos are watched.
 *
 * The Home left panel renders these as items under the search bar; the In
 * Progress tab renders the same set as File City cards.
 */

import { useEffect, useMemo, useState } from 'react';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';
import { RepositoryMonitoringService } from '../../main-process-api/RepositoryMonitoringService';

export interface InProgressRepo {
  entry: AlexandriaEntry;
  status: GitStatusWithFiles;
}

function isInProgress(status: GitStatusWithFiles | null): boolean {
  return !!status && (status.isDirty || status.ahead > 0);
}

/** Stable display name for sorting — GitHub name when known, else the entry name. */
function displayName(repo: InProgressRepo): string {
  return repo.entry.github?.name ?? repo.entry.name ?? '';
}

export function useInProgressRepos(
  repositories: AlexandriaEntry[],
): InProgressRepo[] {
  const paths = useMemo(
    () => repositories.filter((r) => r.path).map((r) => String(r.path)),
    [repositories],
  );
  const pathSet = useMemo(() => new Set(paths), [paths]);

  const entryByPath = useMemo(() => {
    const map = new Map<string, AlexandriaEntry>();
    for (const repo of repositories) {
      if (repo.path) map.set(String(repo.path), repo);
    }
    return map;
  }, [repositories]);

  const [statusByPath, setStatusByPath] = useState<
    Map<string, GitStatusWithFiles>
  >(() => new Map());

  // Initial load: query each repository's status directly (works whether or not
  // the repo is being watched).
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const results = await Promise.all(
        paths.map(async (path) => {
          const status =
            await RepositoryMonitoringService.getGitStatusWithFiles(path);
          return [path, status] as const;
        }),
      );
      if (cancelled) return;
      const next = new Map<string, GitStatusWithFiles>();
      for (const [path, status] of results) {
        if (status) next.set(path, status);
      }
      setStatusByPath(next);
    };

    load().catch((err) => {
      console.error('[useInProgressRepos] Failed to load git statuses:', err);
    });

    return () => {
      cancelled = true;
    };
  }, [paths]);

  // Live updates for repos in our set.
  useEffect(() => {
    const unsubscribe = RepositoryMonitoringService.onGitStatusChanged(
      (status) => {
        const repoPath = String(status.repoPath);
        if (!pathSet.has(repoPath)) return;
        setStatusByPath((prev) => {
          const next = new Map(prev);
          next.set(repoPath, status);
          return next;
        });
      },
    );
    return () => {
      unsubscribe();
    };
  }, [pathSet]);

  return useMemo(() => {
    const rows: InProgressRepo[] = [];
    for (const [path, status] of statusByPath.entries()) {
      if (!isInProgress(status)) continue;
      const entry = entryByPath.get(path);
      if (!entry) continue;
      rows.push({ entry, status });
    }
    rows.sort((a, b) =>
      displayName(a).localeCompare(displayName(b), undefined, {
        sensitivity: 'base',
      }),
    );
    return rows;
  }, [statusByPath, entryByPath]);
}
