import { useCallback, useEffect, useRef, useState } from 'react';
import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { useRepoWatch } from '../panels/home-panel/useRepoWatch';

/** Share monitored branch and file status without a separate Git query per view. */
export function useRepositoryStatuses(repoPaths: string[]) {
  useRepoWatch(repoPaths);
  const pathKey = JSON.stringify([...new Set(repoPaths)].sort());
  const [statuses, setStatuses] = useState<Map<string, GitStatusWithFiles>>(
    new Map(),
  );
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const revisions = useRef(new Map<string, number>());

  useEffect(() => {
    const paths = JSON.parse(pathKey) as string[];
    const pathSet = new Set(paths);
    const current = ++generation.current;
    let cancelled = false;
    revisions.current = new Map();
    setStatuses(new Map());
    setLoading(paths.length > 0);
    if (paths.length === 0) return;

    const off = RepositoryMonitoringService.onGitStatusChanged((status) => {
      if (cancelled || !pathSet.has(status.repoPath)) return;
      revisions.current.set(
        status.repoPath,
        (revisions.current.get(status.repoPath) ?? 0) + 1,
      );
      setStatuses((previous) => new Map(previous).set(status.repoPath, status));
    });
    void Promise.all(
      paths.map(async (path) => {
        try {
          const status =
            await RepositoryMonitoringService.getGitStatusWithFiles(path);
          if (
            cancelled ||
            !status ||
            status.repoPath !== path ||
            revisions.current.has(path)
          )
            return;
          setStatuses((previous) => new Map(previous).set(path, status));
        } catch (error) {
          console.warn(
            '[useRepositoryStatuses] Status unavailable:',
            path,
            error,
          );
        }
      }),
    ).finally(() => {
      if (!cancelled && generation.current === current) setLoading(false);
    });
    return () => {
      cancelled = true;
      generation.current = current + 1;
      off();
    };
  }, [pathKey]);

  const refresh = useCallback(
    async (path: string) => {
      if (!(JSON.parse(pathKey) as string[]).includes(path)) return;
      const current = generation.current;
      const revision = revisions.current.get(path) ?? 0;
      const status = await RepositoryMonitoringService.refreshGitStatus(path);
      if (
        generation.current !== current ||
        status.repoPath !== path ||
        (revisions.current.get(path) ?? 0) !== revision
      )
        return;
      revisions.current.set(path, revision + 1);
      setStatuses((previous) => new Map(previous).set(path, status));
    },
    [pathKey],
  );

  return { statuses, loading, refresh };
}
