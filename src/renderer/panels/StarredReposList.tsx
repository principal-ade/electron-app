/**
 * StarredReposList
 *
 * Component for displaying user's GitHub starred repositories.
 * Read-only list with local search filtering.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Star, FolderGit2, Loader2, Search, AlertCircle } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { GithubService } from '../main-process-api/GithubService';
import type { GitHubRepository } from '../../shared/main-process-api-interfaces/GitHubAPI';

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

  // Filter repos based on search query (client-side filtering)
  const filteredRepos = useMemo(() => {
    if (!searchQuery.trim()) return starredRepos;

    const query = searchQuery.toLowerCase();
    return starredRepos.filter((repo) => {
      const fullName = repo.full_name?.toLowerCase() || '';
      const description = repo.description?.toLowerCase() || '';
      const language = repo.language?.toLowerCase() || '';
      return fullName.includes(query) || description.includes(query) || language.includes(query);
    });
  }, [starredRepos, searchQuery]);

  // Handle repo click - emit event to open repo profile
  const handleRepoClick = useCallback(
    (repo: GitHubRepository) => {
      if (!repo.full_name || !repo.full_name.includes('/')) {
        console.warn('[StarredReposList] Invalid repo full_name:', repo);
        return;
      }
      const [owner, name] = repo.full_name.split('/');

      // Emit event to open repository profile (following WatchedItemsList pattern)
      events.emit({
        type: 'feed:repository-selected',
        source: 'starred-repos-list',
        timestamp: Date.now(),
        payload: {
          repository: {
            path: '',
            name: name,
            remoteUrl: `https://github.com/${owner}/${name}.git`,
            registeredAt: new Date().toISOString(),
            hasViews: false,
            viewCount: 0,
            views: [],
            github: {
              id: repo.full_name,
              owner: owner,
              name: name,
              stars: repo.stargazers_count || 0,
              lastUpdated: repo.updated_at,
            },
          },
        },
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

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Search header */}
      <div
        style={{
          padding: spacing.sm,
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.background,
          flexShrink: 0,
        }}
      >
        <div style={{ position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: spacing.sm,
              top: '50%',
              transform: 'translateY(-50%)',
              color: theme.colors.textSecondary,
            }}
          />
          <input
            type="text"
            placeholder="Search starred repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: `${spacing.xs}px ${spacing.sm}px ${spacing.xs}px ${spacing.lg + spacing.md}px`,
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radii?.[1] || 4,
              color: theme.colors.text,
              fontSize: theme.fontSizes[0],
              fontFamily: theme.fonts.body,
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = theme.colors.primary)}
            onBlur={(e) => (e.currentTarget.style.borderColor = theme.colors.border)}
          />
        </div>
        <div
          style={{
            marginTop: spacing.xs,
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
          }}
        >
          {filteredRepos.length} {filteredRepos.length === 1 ? 'repository' : 'repositories'}
        </div>
      </div>

      {/* Repos list */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: spacing.sm,
        }}
      >
        {filteredRepos.length === 0 && searchQuery ? (
          <div
            style={{
              textAlign: 'center',
              padding: spacing.lg,
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes[0],
            }}
          >
            No repositories match your search
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            {filteredRepos
              .filter((repo) => repo.full_name && repo.full_name.includes('/'))
              .map((repo) => {
                const [owner, name] = repo.full_name.split('/');
                return (
                <div
                  key={repo.id}
                  onClick={() => handleRepoClick(repo)}
                  style={{
                    padding: spacing.md,
                    backgroundColor: theme.colors.backgroundSecondary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.radii?.[1] || 4,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                    e.currentTarget.style.borderColor = theme.colors.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                    e.currentTarget.style.borderColor = theme.colors.border;
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.md }}>
                    <FolderGit2 size={20} color={theme.colors.primary} style={{ marginTop: 2 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: theme.fontSizes[1], fontWeight: 600, color: theme.colors.text }}>
                        {name}
                      </div>
                      <div style={{ fontSize: theme.fontSizes[0], color: theme.colors.textSecondary, marginTop: 2 }}>
                        {owner}
                      </div>
                      {repo.description && (
                        <div
                          style={{
                            fontSize: theme.fontSizes[0],
                            color: theme.colors.textSecondary,
                            marginTop: spacing.xs,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {repo.description}
                        </div>
                      )}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.md,
                          marginTop: spacing.xs,
                          fontSize: theme.fontSizes[0],
                          color: theme.colors.textSecondary,
                        }}
                      >
                        {repo.language && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                            <div
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                backgroundColor: theme.colors.primary,
                              }}
                            />
                            <span>{repo.language}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                          <Star size={12} />
                          <span>{repo.stargazers_count?.toLocaleString() || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
