/**
 * useRepoWatch
 *
 * Hold monitoring watch references for repositories while the caller is
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

import { useEffect } from 'react';
import { RepositoryMonitoringService } from '../../main-process-api/RepositoryMonitoringService';

export function useRepoWatch(
  repoPaths: string | string[] | null | undefined,
): void {
  const pathKey = JSON.stringify(
    [
      ...new Set(
        Array.isArray(repoPaths) ? repoPaths : repoPaths ? [repoPaths] : [],
      ),
    ].sort(),
  );

  useEffect(() => {
    const paths = JSON.parse(pathKey) as string[];
    if (paths.length === 0) return;
    // Each effect lifetime owns a distinct reference, including Strict Mode
    // remounts. A late cleanup must never release a newer effect's reference.
    const referenceId = `repo-profile:${Math.random().toString(36).slice(2)}`;
    let cancelled = false;

    const acquisitions = paths.map((repoPath) =>
      RepositoryMonitoringService.acquireWatch(repoPath, referenceId)
        .then(() => {
          // Watch state has no push notification — tell mounted panels to re-pull.
          if (!cancelled) notifyWatchChanged();
        })
        .catch((err) => {
          console.warn(
            '[useRepoWatch] Failed to acquire watch:',
            repoPath,
            err,
          );
        }),
    );

    return () => {
      cancelled = true;
      paths.forEach((repoPath, index) => {
        // Wait for an in-flight acquisition before releasing its reference.
        void acquisitions[index]
          .then(() =>
            RepositoryMonitoringService.releaseWatch(repoPath, referenceId),
          )
          .then(() => notifyWatchChanged())
          .catch((err) => {
            console.warn(
              '[useRepoWatch] Failed to release watch:',
              repoPath,
              err,
            );
          });
      });
    };
  }, [pathKey]);
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
