import { useState, useEffect, useCallback, useRef } from 'react';
import { GitService } from '../main-process-api/GitService';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';

export interface ActivityCommit {
  repoName: string;
  repoPath: string;
  hash: string;
  message: string;
  author: string;
  authorEmail: string;
  date: string; // ISO date string
}

/**
 * Hook to fetch recent commits across multiple repositories for an activity feed
 * @param repositories - List of Alexandria entries
 * @param maxRepos - Maximum number of repos to fetch from (default: 10)
 * @param commitsPerRepo - Number of commits to fetch per repo (default: 5)
 * @param totalLimit - Maximum total commits to return (default: 20)
 */
export function useActivityFeed(
  repositories: AlexandriaEntry[],
  maxRepos = 10,
  commitsPerRepo = 5,
  totalLimit = 20
) {
  const [commits, setCommits] = useState<ActivityCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const loadActivityFeed = useCallback(async () => {
    if (repositories.length === 0) {
      setCommits([]);
      return;
    }

    setLoading(true);
    setError(null);
    abortRef.current = false;

    try {
      // Repositories are already sorted by lastOpenedAt from the provider
      // Just take the top N repos with valid paths
      const topRepos = repositories.filter((entry) => entry.path).slice(0, maxRepos);

      // Fetch recent commits from each repo in parallel
      const allCommits: ActivityCommit[] = [];

      await Promise.all(
        topRepos.map(async (entry) => {
          if (!entry.path) return;
          try {
            // Get commits from the last 30 days
            const endDate = new Date().toISOString().split('T')[0];
            const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0];

            const repoCommits = await GitService.getCommitsInDateRange(
              entry.path,
              startDate,
              endDate
            );

            // Take only the most recent N commits per repo
            // Note: getCommitsInDateRange returns oldest first, so we reverse
            const recentCommits = repoCommits.reverse().slice(0, commitsPerRepo);

            for (const commit of recentCommits) {
              allCommits.push({
                repoName: entry.name,
                repoPath: entry.path,
                hash: commit.hash,
                message: commit.message,
                author: commit.author,
                authorEmail: commit.authorEmail,
                date: commit.date,
              });
            }
          } catch (err) {
            console.warn(`[useActivityFeed] Failed to fetch commits for ${entry.name}:`, err);
          }
        })
      );

      if (abortRef.current) return;

      // Sort all commits by date descending and limit
      allCommits.sort((a, b) => b.date.localeCompare(a.date));
      const limitedCommits = allCommits.slice(0, totalLimit);
      console.info('[useActivityFeed] Loaded commits:', {
        totalCommits: allCommits.length,
        limitedCommits: limitedCommits.length,
        repositories: repositories.length,
      });
      setCommits(limitedCommits);
    } catch (err) {
      console.error('[useActivityFeed] Error loading activity feed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load activity feed');
      setCommits([]);
    } finally {
      setLoading(false);
    }
  }, [repositories, maxRepos, commitsPerRepo, totalLimit]);

  // Load on mount and when repositories change
  useEffect(() => {
    loadActivityFeed();

    return () => {
      abortRef.current = true;
    };
  }, [loadActivityFeed]);

  const refresh = useCallback(() => {
    return loadActivityFeed();
  }, [loadActivityFeed]);

  return {
    commits,
    loading,
    error,
    refresh,
  };
}
