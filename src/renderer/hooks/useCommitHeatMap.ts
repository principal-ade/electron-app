import { useState, useEffect, useCallback } from 'react';
import { GitService } from '../main-process-api/GitService';
import type { CommitDay } from '../components/CommitHeatMap';

/**
 * Hook to fetch commit history data for heat map visualization
 * @param repoPath - Path to the repository
 * @param days - Number of days to look back (default: 365)
 * @returns Commit data, loading state, error, and refresh function
 */
export function useCommitHeatMap(repoPath: string | null, days = 365) {
  const [commits, setCommits] = useState<CommitDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCommitData = useCallback(async () => {
    if (!repoPath) {
      setCommits([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const commitDates = await GitService.getCommitDatesForHeatMap(repoPath, days);
      setCommits(commitDates);
    } catch (err) {
      console.error('[useCommitHeatMap] Error loading commit data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load commit history');
      setCommits([]);
    } finally {
      setLoading(false);
    }
  }, [repoPath, days]);

  // Load on mount and when repo path changes
  useEffect(() => {
    loadCommitData();
  }, [loadCommitData]);

  const refresh = useCallback(() => {
    return loadCommitData();
  }, [loadCommitData]);

  return {
    commits,
    loading,
    error,
    refresh,
  };
}
