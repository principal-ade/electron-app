/**
 * useWatchedActivityFeed Hook
 *
 * React hook for fetching and managing watched activity feed data from web-ade.
 * Transforms web-ade API data into format compatible with ActivityFeedPanel.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { WebAdeService } from '../main-process-api/WebAdeService';
import type { CommitActivityCard } from '../../shared/tipc/webAdeRouterTypes';

/**
 * Watched activity commit (transformed from web-ade format)
 */
export interface WatchedActivityCommit {
  repoName: string;
  repoOwner: string;
  repoPath: string; // Empty for watched repos (no local path)
  hash: string;
  message: string;
  author: string;
  authorEmail: string; // May be empty
  authorAvatarUrl?: string;
  date: string; // ISO date string
  url: string;
}

/**
 * Watched repository group (similar to RepoActivitySummary in ActivityFeedPanel)
 */
export interface WatchedRepoGroup {
  repoPath: string; // Empty (no local path)
  repoName: string;
  repoOwner: string;
  commits: WatchedActivityCommit[];
  latestCommitAt: Date;
  commitCount: number;
  githubOwner: string;
  githubRepoName: string;
}

/**
 * Hook to fetch watched activity feed from web-ade
 */
export function useWatchedActivityFeed(
  enabled: boolean,
  maxCards = 20
) {
  const [repoGroups, setRepoGroups] = useState<WatchedRepoGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const abortRef = useRef(false);

  const loadWatchedActivityFeed = useCallback(async () => {
    if (!enabled) {
      setRepoGroups([]);
      return;
    }

    setLoading(true);
    setError(null);
    abortRef.current = false;

    try {
      // Check authentication first
      const isAuth = await WebAdeService.isAuthenticated();
      setAuthenticated(isAuth);

      if (!isAuth) {
        console.info('[useWatchedActivityFeed] User not authenticated');
        setRepoGroups([]);
        setLoading(false);
        return;
      }

      // Fetch commit queue from web-ade
      console.info('[useWatchedActivityFeed] Fetching commit queue with limit:', maxCards);
      const cards: CommitActivityCard[] = await WebAdeService.getCommitQueue(maxCards);

      if (abortRef.current) return;

      // Transform web-ade format to ActivityFeedPanel format
      const groups: WatchedRepoGroup[] = [];

      for (const card of cards) {
        // Check if we already have a group for this repo
        let group = groups.find(
          (g) => g.repoOwner === card.repo.owner && g.repoName === card.repo.name
        );

        if (!group) {
          // Create new group for this repo
          group = {
            repoPath: '', // No local path for watched repos
            repoName: card.repo.name,
            repoOwner: card.repo.owner,
            commits: [],
            latestCommitAt: new Date(card.latestCommitAt),
            commitCount: 0,
            githubOwner: card.repo.owner,
            githubRepoName: card.repo.name,
          };
          groups.push(group);
        }

        // Add commits from this card to the group
        for (const commit of card.commits) {
          const transformedCommit: WatchedActivityCommit = {
            repoName: card.repo.name,
            repoOwner: card.repo.owner,
            repoPath: '', // No local path
            hash: commit.sha,
            message: commit.message,
            author: commit.author.login,
            authorEmail: '', // Not provided by web-ade
            authorAvatarUrl: commit.author.avatarUrl,
            date: commit.committedAt,
            url: commit.url,
          };

          group.commits.push(transformedCommit);
          group.commitCount++;

          // Update latest commit time if this commit is newer
          const commitDate = new Date(commit.committedAt);
          if (commitDate > group.latestCommitAt) {
            group.latestCommitAt = commitDate;
          }
        }
      }

      // Sort groups by latest commit (most recent first)
      groups.sort((a, b) => b.latestCommitAt.getTime() - a.latestCommitAt.getTime());

      // Sort commits within each group by date (most recent first)
      for (const group of groups) {
        group.commits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }

      console.info('[useWatchedActivityFeed] Transformed', cards.length, 'cards into', groups.length, 'repo groups');
      setRepoGroups(groups);
    } catch (err) {
      console.error('[useWatchedActivityFeed] Error loading watched activity feed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load watched activity feed');
      setRepoGroups([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, maxCards]);

  // Load on mount and when enabled/maxCards change
  useEffect(() => {
    loadWatchedActivityFeed();

    return () => {
      abortRef.current = true;
    };
  }, [loadWatchedActivityFeed]);

  const refresh = useCallback(() => {
    return loadWatchedActivityFeed();
  }, [loadWatchedActivityFeed]);

  return {
    repoGroups,
    loading,
    error,
    authenticated,
    refresh,
  };
}
