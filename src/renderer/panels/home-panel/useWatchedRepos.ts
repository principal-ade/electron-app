/**
 * useWatchedRepos
 *
 * The set of repository paths the monitoring worker is currently watching.
 *
 * Watching is pull-based — the worker exposes it through
 * `getMonitoringStatus().repositories[].isWatching`, and there is no push event
 * for a watch starting or stopping. So this refreshes on mount, when the
 * Alexandria registry changes, and when the window regains focus.
 *
 * The Home panel uses it to mark which repos have live data (a watcher exists,
 * so git-status-changed events flow) as opposed to repos that are only queried
 * on demand and can therefore show a cached value.
 */

import { useEffect, useState } from 'react';
import { RepositoryMonitoringService } from '../../main-process-api/RepositoryMonitoringService';
import { AlexandriaService } from '../../main-process-api/AlexandriaService';
import { REPO_WATCH_CHANGED_EVENT } from './useRepoWatch';

export function useWatchedRepos(): Set<string> {
  const [watchedPaths, setWatchedPaths] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const status = await RepositoryMonitoringService.getMonitoringStatus();
        if (cancelled) return;
        setWatchedPaths(
          new Set(
            status.repositories.filter((r) => r.isWatching).map((r) => r.path),
          ),
        );
      } catch (err) {
        console.warn('[useWatchedRepos] Failed to read monitoring status:', err);
      }
    };

    const handleWatchChanged = () => {
      void load();
    };
    const handleFocus = () => {
      void load();
    };

    void load();

    // Registration changes can add/remove watchable repos.
    const unsubscribe = AlexandriaService.onRepositoryChange(() => {
      void load();
    });
    // A mounted consumer acquired/released a watch (profile opened/closed).
    window.addEventListener(REPO_WATCH_CHANGED_EVENT, handleWatchChanged);
    // Watch state also changes from main-process features (workspace open,
    // skills sync) with no renderer signal — refresh on focus.
    window.addEventListener('focus', handleFocus);

    // Watches are also acquired in the main process (terminal sessions,
    // workspaces) with no renderer signal, so poll as a backstop. Kept short:
    // the poll is the only way a main-initiated watch becomes visible, and a
    // terminal opening right after a push is exactly when this matters.
    const interval = window.setInterval(() => {
      void load();
    }, 3000);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener(REPO_WATCH_CHANGED_EVENT, handleWatchChanged);
      window.removeEventListener('focus', handleFocus);
      window.clearInterval(interval);
    };
  }, []);

  return watchedPaths;
}

export default useWatchedRepos;
