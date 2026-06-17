/**
 * StarredReposList
 *
 * Component for displaying user's GitHub starred repositories.
 * Read-only list with local search filtering.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Star, Loader2, AlertCircle, Search } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { GithubService } from '../main-process-api/GithubService';
import type { GitHubRepository } from '../../shared/main-process-api-interfaces/GitHubAPI';
import { StarredRepoCard } from './cards/StarredRepoCard';
import { payloadFromGithub } from '../events/repositorySelected';

export interface StarredReposListProps {
  /** Event emitter for panel communication */
  events: PanelEventEmitter;
}

export const StarredReposList: React.FC<StarredReposListProps> = ({ events }) => {
  const { theme } = useTheme();

  const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
  };

  // State
  const [starredRepos, setStarredRepos] = useState<GitHubRepository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load starred repos on mount
  const loadStarredRepos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const repos = await GithubService.getUserStarredRepositories({ perPage: 100 });
      setStarredRepos(repos);
    } catch (err) {
      console.error('[StarredReposList] Failed to load starred repos:', err);
      setError('Failed to load starred repositories. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStarredRepos();
  }, [loadStarredRepos]);

  // Keep list in sync when a repo is starred/unstarred from the profile panel
  useEffect(() => {
    const unsubscribe = events.on('star:repo-toggled', (event) => {
      const { owner, repo, starred } = event.payload as { owner: string; repo: string; starred: boolean };
      if (starred) {
        loadStarredRepos();
      } else {
        setStarredRepos((prev) => prev.filter((r) => r.full_name !== `${owner}/${repo}`));
      }
    });
    return unsubscribe;
  }, [events, loadStarredRepos]);

  // Handle repo click - emit event to open repo profile
  const handleRepoClick = useCallback(
    (repo: GitHubRepository) => {
      if (!repo.full_name || !repo.full_name.includes('/')) {
        console.warn('[StarredReposList] Invalid repo full_name:', repo);
        return;
      }
      const [owner, name] = repo.full_name.split('/');

      // Emit event to open repository profile
      events.emit({
        type: 'repository:selected',
        source: 'starred-repos-list',
        timestamp: Date.now(),
        payload: payloadFromGithub({
          owner,
          name,
          stars: repo.stargazers_count ?? 0,
          lastUpdated: repo.updated_at,
        }),
      });
    },
    [events]
  );

  // Loading state
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: spacing.lg,
          color: theme.colors.textSecondary,
        }}
      >
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
        <div style={{ marginTop: spacing.md, fontSize: theme.fontSizes[0] }}>
          Loading starred repositories...
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: spacing.lg,
          color: theme.colors.textSecondary,
        }}
      >
        <AlertCircle size={32} color={theme.colors.error} />
        <div style={{ marginTop: spacing.md, fontSize: theme.fontSizes[0], textAlign: 'center' }}>
          {error}
        </div>
        <button
          onClick={loadStarredRepos}
          style={{
            marginTop: spacing.md,
            padding: `${spacing.xs}px ${spacing.md}px`,
            backgroundColor: theme.colors.primary,
            color: theme.colors.background,
            border: 'none',
            borderRadius: theme.radii?.[1] || 4,
            fontSize: theme.fontSizes[0],
            cursor: 'pointer',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          Retry
        </button>
      </div>
    );
  }

  // Empty state
  if (starredRepos.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: spacing.lg,
          color: theme.colors.textSecondary,
        }}
      >
        <Star size={48} />
        <div style={{ marginTop: spacing.md, fontSize: theme.fontSizes[1], fontWeight: 600 }}>
          No starred repositories
        </div>
        <div style={{ marginTop: spacing.xs, fontSize: theme.fontSizes[0], textAlign: 'center' }}>
          Star repositories on GitHub to see them here
        </div>
      </div>
    );
  }

  const filteredRepos = starredRepos.filter((repo) => {
    if (!repo.full_name || !repo.full_name.includes('/')) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      repo.full_name.toLowerCase().includes(q) ||
      repo.description?.toLowerCase().includes(q)
    );
  });

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Search bar */}
      <div
        style={{
          padding: `${spacing.xs}px ${spacing.md}px`,
          borderBottom: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.xs,
            backgroundColor: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radii?.[1] || 4,
            padding: `${spacing.xs}px ${spacing.sm}px`,
          }}
        >
          <Search size={13} color={theme.colors.textSecondary} style={{ flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Filter starred repos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: theme.fontSizes[1],
              color: theme.colors.text,
              caretColor: theme.colors.primary,
            }}
          />
        </div>
      </div>

      {/* Repos list */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: spacing.md,
        }}
      >
        {filteredRepos.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes[1],
              textAlign: 'center',
              padding: spacing.lg,
            }}
          >
            <Star size={32} style={{ marginBottom: spacing.sm, opacity: 0.3 }} />
            <span>No results for "{searchQuery}"</span>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
          {filteredRepos.map((repo) => {
            const [owner, name] = repo.full_name.split('/');
            return (
              <StarredRepoCard
                key={repo.id}
                repo={{
                  owner,
                  name,
                  ownerAvatarUrl: repo.owner.avatar_url,
                  description: repo.description,
                  language: repo.language,
                  stargazersCount: repo.stargazers_count,
                }}
                onClick={() => handleRepoClick(repo)}
              />
            );
          })}
        </div>
      </div>

      {/* Add spin animation */}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default StarredReposList;
