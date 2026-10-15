/**
 * useRepoWatch
 *
 * Hold a monitoring watch reference for a repository while the caller is
 * mounted.
 *
 * Opening a repository's profile is the signal that the user is now working on
 * that repo, so the profile is what asks the worker to watch it. Watching is
 * reference-counted (`acquireWatch` / `releaseWatch`): the worker starts on the
 * first reference and stops on the last, so several mounted consumers of the
 * same repo are fine.
 *
 * Why it matters: without a watch there is no filesystem watcher, and therefore
 * no git-state events at all — the repo's `ahead`/`behind` sits in a cache that
 * only a watcher (or its 5-minute TTL) can invalidate. With a watch, a push
 * clears the "ahead" indicator within a debounce instead of minutes.
 */

import { useEffect, useMemo } from 'react';
import { RepositoryMonitoringService } from '../../main-process-api/RepositoryMonitoringService';

export function useRepoWatch(repoPath: string | null | undefined): void {
  // A fresh reference id per mount: two mounted profiles of the same repo must
  // be two references, so unmounting one doesn't stop watching for the other.
  const referenceId = useMemo(
    () => `repo-profile:${Math.random().toString(36).slice(2)}`,
    [],
  );

  useEffect(() => {
    if (!repoPath) return;
    let cancelled = false;

    void RepositoryMonitoringService.acquireWatch(repoPath, referenceId)
      .then(() => {
        // Watch state has no push notification — tell mounted panels to re-pull.
        if (!cancelled) notifyWatchChanged();
      })
      .catch((err) => {
        console.warn('[useRepoWatch] Failed to acquire watch:', repoPath, err);
      });

    return () => {
      cancelled = true;
      void RepositoryMonitoringService.releaseWatch(repoPath, referenceId)
        .then(() => notifyWatchChanged())
        .catch((err) => {
          console.warn('[useRepoWatch] Failed to release watch:', repoPath, err);
        });
    };
  }, [repoPath, referenceId]);
}

/**
 * Watch state lives in the worker with no push event, so a component that
 * acquires or releases a watch announces it for any mounted observer (see
 * {@link useWatchedRepos}).
 */
export const REPO_WATCH_CHANGED_EVENT = 'repo-watch:changed';

function notifyWatchChanged(): void {
  window.dispatchEvent(new Event(REPO_WATCH_CHANGED_EVENT));
}

export default useRepoWatch;
