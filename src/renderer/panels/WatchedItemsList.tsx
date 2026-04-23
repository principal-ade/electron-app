/**
 * WatchedItemsList
 *
 * Component for managing watched GitHub users and repositories.
 * Displays current watches and provides GitHub search to add new ones.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { User, X, Loader2 } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { WebAdeService } from '../main-process-api/WebAdeService';
import type { WatchedUser, WatchedRepo } from '../../shared/tipc/webAdeRouterTypes';

export interface WatchedItemsListProps {
  /** Event emitter for panel communication */
  events: PanelEventEmitter;
}

export const WatchedItemsList: React.FC<WatchedItemsListProps> = ({ events }) => {
  const { theme } = useTheme();

  const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
  };

  // State
  const [watchedUsers, setWatchedUsers] = useState<WatchedUser[]>([]);
  const [watchedRepos, setWatchedRepos] = useState<WatchedRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [operationInProgress, setOperationInProgress] = useState<string | null>(null);

  // Load watched items on mount
  const loadWatches = useCallback(async () => {
    try {
      setLoading(true);
      const watches = await WebAdeService.getWatches();
      setWatchedUsers(watches.watchedUsers || []);
      setWatchedRepos(watches.watchedRepos || []);
    } catch (error) {
      console.error('[WatchedItemsList] Failed to load watches:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWatches();
  }, [loadWatches]);

  // Listen for watch toggle events from profile panels
  useEffect(() => {
    const handleUserToggle = (event: { payload: { username: string; watched: boolean; accountType?: 'User' | 'Organization' } }) => {
      const { username, watched, accountType } = event.payload;
      if (watched) {
        // Add to watched users (optimistic update)
        setWatchedUsers((prev) => {
          if (prev.some((u) => u.login === username)) return prev;
          return [...prev, { login: username, watchedAt: new Date().toISOString(), type: accountType }];
        });
      } else {
        // Remove from watched users
        setWatchedUsers((prev) => prev.filter((u) => u.login !== username));
      }
    };

    const handleRepoToggle = (event: { payload: { owner: string; repo: string; watched: boolean } }) => {
      const { owner, repo, watched } = event.payload;
      if (watched) {
        // Add to watched repos (optimistic update)
        setWatchedRepos((prev) => {
          if (prev.some((r) => r.owner === owner && r.repo === repo)) return prev;
          return [...prev, { owner, repo, watchedAt: new Date().toISOString() }];
        });
      } else {
        // Remove from watched repos
        setWatchedRepos((prev) => prev.filter((r) => !(r.owner === owner && r.repo === repo)));
      }
    };

    events.on('watch:user-toggled', handleUserToggle);
    events.on('watch:repo-toggled', handleRepoToggle);

    return () => {
      events.off('watch:user-toggled', handleUserToggle);
      events.off('watch:repo-toggled', handleRepoToggle);
    };
  }, [events]);

  // Unwatch user
  const handleUnwatchUser = useCallback(
    async (login: string) => {
      setOperationInProgress(`user:${login}`);
      try {
        const response = await WebAdeService.unwatchUser(login);
        if (response.success) {
          setWatchedUsers(response.watchedUsers);
          // Emit event to refresh activity feed
          events.emit({
            type: 'feed:activity-refresh-requested',
            source: 'watched-items-panel',
            timestamp: Date.now(),
            payload: {},
          });
        }
      } catch (error) {
        console.error('[WatchedItemsList] Failed to unwatch user:', error);
      } finally {
        setOperationInProgress(null);
      }
    },
    [events]
  );

  // Unwatch repo
  const handleUnwatchRepo = useCallback(
    async (owner: string, repo: string) => {
      setOperationInProgress(`repo:${owner}/${repo}`);
      try {
        const response = await WebAdeService.unwatchRepo(owner, repo);
        if (response.success) {
          setWatchedRepos(response.watchedRepos);
          // Emit event to refresh activity feed
          events.emit({
            type: 'feed:activity-refresh-requested',
            source: 'watched-items-panel',
            timestamp: Date.now(),
            payload: {},
          });
        }
      } catch (error) {
        console.error('[WatchedItemsList] Failed to unwatch repo:', error);
      } finally {
        setOperationInProgress(null);
      }
    },
    [events]
  );

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        overflow: 'hidden',
      }}
    >
      {/* Watched Items List */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: spacing.md,
        }}
      >
          {loading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: theme.colors.textSecondary,
              }}
            >
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : watchedRepos.length === 0 && watchedUsers.length === 0 ? (
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
              }}
            >
              <User size={32} style={{ marginBottom: spacing.sm, opacity: 0.3 }} />
              <span>No watched items</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
              {/* Watched Users */}
              {watchedUsers.map((user) => {
                const isInProgress = operationInProgress === `user:${user.login}`;
                return (
                  <div
                    key={`user:${user.login}`}
                    onClick={() => {
                      events.emit({
                        type: 'feed:owner-selected',
                        source: 'watched-items-panel',
                        timestamp: Date.now(),
                        payload: { owner: user.login, isOrg: user.type === 'Organization' },
                      });
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.sm,
                      width: '100%',
                      padding: spacing.sm,
                      backgroundColor: 'transparent',
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.radii?.[1] || 4,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {/* Avatar */}
                    <div
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: user.type === 'Organization' ? theme.radii?.[5] || 12 : '50%',
                        backgroundColor: theme.colors.background,
                        border: `1px solid ${theme.colors.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        overflow: 'hidden',
                      }}
                    >
                      <img
                        src={`https://github.com/${user.login}.png?size=120`}
                        alt={user.login}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>

                    {/* Text content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: theme.fontSizes[1],
                          fontWeight: 600,
                          color: theme.colors.text,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginBottom: 2,
                        }}
                      >
                        {user.login}
                      </div>
                      <div
                        style={{
                          fontSize: theme.fontSizes[0],
                          color: theme.colors.textSecondary,
                        }}
                      >
                        {user.type === 'Organization' ? 'Organization' : 'User'}
                      </div>
                    </div>

                    {/* Unwatch button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent card click
                        handleUnwatchUser(user.login);
                      }}
                      disabled={isInProgress}
                      style={{
                        padding: `${spacing.xs}px ${spacing.sm}px`,
                        fontSize: theme.fontSizes[0],
                        color: theme.colors.textSecondary,
                        backgroundColor: 'transparent',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.radii?.[1] || 4,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing.xs,
                        flexShrink: 0,
                      }}
                    >
                      {isInProgress ? (
                        <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <X size={12} />
                      )}
                      Unwatch
                    </button>
                  </div>
                );
              })}

              {/* Watched Repositories */}
              {watchedRepos.map((repo) => {
                const isInProgress = operationInProgress === `repo:${repo.owner}/${repo.repo}`;
                return (
                  <div
                    key={`repo:${repo.owner}/${repo.repo}`}
                    onClick={() => {
                      // Emit event to open repository profile
                      events.emit({
                        type: 'feed:repository-selected',
                        source: 'watched-items-panel',
                        timestamp: Date.now(),
                        payload: {
                          repository: {
                            path: '',
                            name: repo.repo,
                            remoteUrl: `https://github.com/${repo.owner}/${repo.repo}.git`,
                            registeredAt: new Date().toISOString(),
                            hasViews: false,
                            viewCount: 0,
                            views: [],
                            github: {
                              id: `${repo.owner}/${repo.repo}`,
                              owner: repo.owner,
                              name: repo.repo,
                              stars: 0,
                              lastUpdated: new Date().toISOString(),
                            },
                          },
                        },
                      });
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.sm,
                      width: '100%',
                      padding: spacing.sm,
                      backgroundColor: 'transparent',
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.radii?.[1] || 4,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {/* Avatar */}
                    <div
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: '50%',
                        backgroundColor: theme.colors.background,
                        border: `1px solid ${theme.colors.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        overflow: 'hidden',
                      }}
                    >
                      <img
                        src={`https://github.com/${repo.owner}.png?size=120`}
                        alt={repo.owner}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>

                    {/* Text content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: theme.fontSizes[1],
                          fontWeight: 600,
                          color: theme.colors.text,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginBottom: 2,
                        }}
                      >
                        {repo.repo}
                      </div>
                      <div
                        style={{
                          fontSize: theme.fontSizes[0],
                          color: theme.colors.textSecondary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginBottom: 4,
                        }}
                      >
                        {repo.owner}
                      </div>
                      <div
                        style={{
                          fontSize: theme.fontSizes[0],
                          color: theme.colors.textTertiary,
                        }}
                      >
                        Repository
                      </div>
                    </div>

                    {/* Unwatch button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent card click
                        handleUnwatchRepo(repo.owner, repo.repo);
                      }}
                      disabled={isInProgress}
                      style={{
                        padding: `${spacing.xs}px ${spacing.sm}px`,
                        fontSize: theme.fontSizes[0],
                        color: theme.colors.textSecondary,
                        backgroundColor: 'transparent',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.radii?.[1] || 4,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing.xs,
                        flexShrink: 0,
                      }}
                    >
                      {isInProgress ? (
                        <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <X size={12} />
                      )}
                      Unwatch
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      {/* Add CSS for spinning animation */}
      <style>
        {`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );
};

export default WatchedItemsList;
