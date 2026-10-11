/**
 * useInProgressCount
 *
 * Number of repositories with uncommitted working-tree changes (or unpushed
 * commits) — the same filter the In Progress panel applies. Loads once for the
 * given repositories, then tracks `git-status-changed` events so the count stays
 * live while those repos are watched.
 */

import { useEffect, useMemo, useState } from 'react';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';
import { RepositoryMonitoringService } from '../../main-process-api/RepositoryMonitoringService';

function isInProgress(status: GitStatusWithFiles | null): boolean {
  return !!status && (status.isDirty || status.ahead > 0);
}

export function useInProgressCount(repositories: AlexandriaEntry[]): number {
  const paths = useMemo(
    () => repositories.filter((r) => r.path).map((r) => String(r.path)),
    [repositories],
  );
  const pathSet = useMemo(() => new Set(paths), [paths]);

  const [inProgressByPath, setInProgressByPath] = useState<Map<string, boolean>>(
    () => new Map(),
  );

  // Initial load: query each repository's status directly (works whether or not
  // the repo is being watched).
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const results = await Promise.all(
        paths.map(async (path) => {
          const status =
            await RepositoryMonitoringService.getGitStatusWithFiles(path);
          return [path, isInProgress(status)] as const;
        }),
      );
      if (cancelled) return;
      setInProgressByPath(new Map(results));
    };

    load().catch((err) => {
      console.error('[useInProgressCount] Failed to load git statuses:', err);
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
        setInProgressByPath((prev) => {
          const next = new Map(prev);
          next.set(repoPath, isInProgress(status));
          return next;
        });
      },
    );
    return () => {
      unsubscribe();
    };
  }, [pathSet]);

  let count = 0;
  for (const inProgress of inProgressByPath.values()) {
    if (inProgress) count += 1;
  }
  return count;
}
