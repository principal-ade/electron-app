/**
 * useWatchedPullRequests
 *
 * The main-process watch list, live-synced over `pr-watch:changed`. Open PRs
 * come first, then merged/closed ones, each group newest-update first.
 */

import { useEffect, useMemo, useState } from 'react';
import type { WatchedPullRequest } from '../../shared/main-process-api-interfaces/PullRequestWatchAPI';
import { PullRequestWatchService } from '../main-process-api/PullRequestWatchService';

export function sortWatchedPullRequests(
  pullRequests: WatchedPullRequest[],
): WatchedPullRequest[] {
  return [...pullRequests].sort((a, b) => {
    const aOpen = a.state === 'open' ? 0 : 1;
    const bOpen = b.state === 'open' ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;
    return b.updatedAt - a.updatedAt;
  });
}

export function useWatchedPullRequests(): {
  pullRequests: WatchedPullRequest[];
  error: string | null;
} {
  const [pullRequests, setPullRequests] = useState<WatchedPullRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    PullRequestWatchService.list()
      .then((list) => {
        if (!cancelled) {
          setPullRequests(list);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      });
    const unsubscribe = PullRequestWatchService.onChanged((list) => {
      if (!cancelled) setPullRequests(list);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const sorted = useMemo(
    () => sortWatchedPullRequests(pullRequests),
    [pullRequests],
  );
  return { pullRequests: sorted, error };
}
