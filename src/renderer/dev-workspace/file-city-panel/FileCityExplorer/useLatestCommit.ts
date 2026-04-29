import * as React from 'react';
import { GitService } from '../../../main-process-api/GitService';
import type { RecentCommit } from './RecentCommitCard';

interface UseLatestCommitResult {
  commit: RecentCommit | null;
  loading: boolean;
  refresh: () => void;
}

export function useLatestCommit(
  repositoryPath: string | null,
): UseLatestCommitResult {
  const [commit, setCommit] = React.useState<RecentCommit | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (!repositoryPath) {
      setCommit(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    GitService.getLatestCommitWithStats(repositoryPath)
      .then((info) => {
        if (cancelled) return;
        if (!info) {
          setCommit(null);
          return;
        }
        setCommit({
          sha: info.hash,
          subject: info.subject,
          author: info.author,
          authoredAt: new Date(info.authoredAt),
          filesChanged: info.filesChanged,
          additions: info.additions,
          deletions: info.deletions,
          files: info.files,
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repositoryPath, tick]);

  const refresh = React.useCallback(() => setTick((t) => t + 1), []);

  return { commit, loading, refresh };
}
