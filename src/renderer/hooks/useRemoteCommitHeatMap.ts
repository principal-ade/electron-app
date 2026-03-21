import { useState, useEffect, useCallback } from 'react';
import { GithubService } from '../main-process-api/GithubService';
import type { CommitDay } from '../components/CommitHeatMap';

/**
 * Hook to fetch commit history data for heat map visualization from GitHub API
 * Used for repositories that aren't cloned locally
 * @param owner - GitHub repository owner
 * @param repo - GitHub repository name
 * @param days - Number of days to look back (default: 365)
 * @returns Commit data, loading state, error, and refresh function
 */
export function useRemoteCommitHeatMap(
  owner: string | null,
  repo: string | null,
  days = 365,
) {
  const [commits, setCommits] = useState<CommitDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCommitData = useCallback(async () => {
    if (!owner || !repo) {
      setCommits([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const commitDates = await GithubService.getCommitDatesForHeatMap(
        owner,
        repo,
        days,
      );
      setCommits(commitDates);
    } catch (err) {
      console.error('[useRemoteCommitHeatMap] Error loading commit data:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load commit history',
      );
      setCommits([]);
    } finally {
      setLoading(false);
    }
  }, [owner, repo, days]);

  // Load on mount and when owner/repo changes
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
