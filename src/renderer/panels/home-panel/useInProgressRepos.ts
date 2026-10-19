/**
 * useInProgressRepos
 *
 * Repositories with a dirty working tree (uncommitted changes) or unpushed
 * commits. Home registers every local repository with the shared main-process
 * refresh queue, and receives both scheduled refreshes and live watcher events.
 */

import { useMemo } from 'react';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';
import { useHomeRepositoryStatuses } from './useHomeRepositoryStatuses';

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

  const entryByPath = useMemo(() => {
    const map = new Map<string, AlexandriaEntry>();
    for (const repo of repositories) {
      if (repo.path) map.set(String(repo.path), repo);
    }
    return map;
  }, [repositories]);

  const statusByPath = useHomeRepositoryStatuses(paths);

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
