import { useEffect, useMemo, useState } from 'react';
import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';
import { RepositoryMonitoringService } from '../../main-process-api/RepositoryMonitoringService';

/** Register interest, not timers: the main process owns the shared queue. */
export function useHomeRepositoryStatuses(
  repoPaths: string[],
): Map<string, GitStatusWithFiles> {
  const pathKey = JSON.stringify([...new Set(repoPaths)].sort());
  const [statuses, setStatuses] = useState<Map<string, GitStatusWithFiles>>(
    () => new Map(),
  );

  useEffect(() => {
    const paths = JSON.parse(pathKey) as string[];
    const pathSet = new Set(paths);
    const consumerId = `home:${Math.random().toString(36).slice(2)}`;
    let cancelled = false;
    let eventRevision = 0;
    const revisions = new Map<string, number>();
    const off = RepositoryMonitoringService.onGitStatusChanged((status) => {
      const path = String(status.repoPath);
      if (!pathSet.has(path)) return;
      revisions.set(path, ++eventRevision);
      setStatuses((previous) => new Map(previous).set(path, status));
    });
    const updateInterest = () => {
      const requestedAtRevision = eventRevision;
      void RepositoryMonitoringService.setHomeRefreshInterest({
        consumerId,
        repoPaths: paths,
        visible: document.visibilityState !== 'hidden',
      })
        .then((snapshot) => {
          if (cancelled) return;
          setStatuses((previous) => {
            const next = new Map(previous);
            for (const status of snapshot) {
              const path = String(status.repoPath);
              if ((revisions.get(path) ?? 0) <= requestedAtRevision) {
                next.set(path, status);
              }
            }
            return next;
          });
        })
        .catch((error: unknown) =>
          console.warn(
            '[HomeRepositoryRefresh] Could not update interest:',
            error,
          ),
        );
    };
    updateInterest();
    document.addEventListener('visibilitychange', updateInterest);
    window.addEventListener('focus', updateInterest);
    return () => {
      cancelled = true;
      off();
      document.removeEventListener('visibilitychange', updateInterest);
      window.removeEventListener('focus', updateInterest);
      void RepositoryMonitoringService.setHomeRefreshInterest({
        consumerId,
        repoPaths: [],
        visible: false,
      }).catch((error: unknown) =>
        console.warn(
          '[HomeRepositoryRefresh] Could not release interest:',
          error,
        ),
      );
    };
  }, [pathKey]);

  return useMemo(() => {
    const paths = new Set(JSON.parse(pathKey) as string[]);
    return new Map([...statuses].filter(([path]) => paths.has(path)));
  }, [statuses, pathKey]);
}
