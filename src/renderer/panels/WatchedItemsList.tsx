/**
 * WatchedItemsList
 *
 * Component for managing watched GitHub users and repositories.
 * Displays current watches and provides GitHub search to add new ones.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { User, FolderGit2, X, Plus, Loader2, Search } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { WebAdeService } from '../main-process-api/WebAdeService';
import { GithubService } from '../main-process-api/GithubService';
import type { WatchedUser, WatchedRepo } from '../../shared/tipc/webAdeRouterTypes';
import type { GitHubUser, GitHubRepository } from '../../shared/main-process-api-interfaces/GitHubAPI';

export interface WatchedItemsListProps {
  /** Event emitter for panel communication */
  events: PanelEventEmitter;
}

type ResultTab = 'users' | 'repos';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [resultTab, setResultTab] = useState<ResultTab>('repos');
  const [operationInProgress, setOperationInProgress] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [userResults, setUserResults] = useState<GitHubUser[]>([]);
  const [repoResults, setRepoResults] = useState<GitHubRepository[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

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

  // Debounced search effect (300ms delay like mobile app)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setUserResults([]);
      setRepoResults([]);
      setHasSearched(false);
      setSearchError(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);

      try {
        // Search both users and repos in parallel
        const [usersResponse, reposResponse] = await Promise.allSettled([
          GithubService.searchUsers(searchQuery, { perPage: 15 }),
          GithubService.searchRepos(searchQuery, { perPage: 15 }),
        ]);

        let hasError = false;
        if (usersResponse.status === 'fulfilled') {
          setUserResults(usersResponse.value.users);
        } else {
          setUserResults([]);
          hasError = true;
        }

        if (reposResponse.status === 'fulfilled') {
          setRepoResults(reposResponse.value.repos);
        } else {
          setRepoResults([]);
          hasError = true;
        }

        if (hasError) {
          setSearchError('Search encountered errors. Some results may be missing.');
        }

        setHasSearched(true);
      } catch (error) {
        console.error('[WatchedItemsList] Search failed:', error);
        setSearchError('Search failed. Please try again.');
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Watch user
  const handleWatchUser = useCallback(
    async (login: string) => {
      setOperationInProgress(`user:${login}`);
      try {
        const response = await WebAdeService.watchUser(login);
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
        console.error('[WatchedItemsList] Failed to watch user:', error);
      } finally {
        setOperationInProgress(null);
      }
    },
    [events]
  );

  // Watch repo
  const handleWatchRepo = useCallback(
    async (owner: string, repo: string) => {
      setOperationInProgress(`repo:${owner}/${repo}`);
      try {
        const response = await WebAdeService.watchRepo(owner, repo);
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
        console.error('[WatchedItemsList] Failed to watch repo:', error);
      } finally {
        setOperationInProgress(null);
      }
    },
    [events]
  );

  // Check if user is already watched
  const isUserWatched = useCallback(
    (login: string) => {
      return watchedUsers.some((u) => u.login === login);
    },
    [watchedUsers]
  );

  // Check if repo is already watched
  const isRepoWatched = useCallback(
    (owner: string, repo: string) => {
      return watchedRepos.some((r) => r.owner === owner && r.repo === repo);
    },
    [watchedRepos]
  );

  // Handle adding user from search results
  const handleAddUser = useCallback(
    async (user: GitHubUser) => {
      if (isUserWatched(user.login)) {
        return;
      }
      await handleWatchUser(user.login);
      // Clear search after adding
      setSearchQuery('');
    },
    [handleWatchUser, isUserWatched]
  );

  // Handle adding repo from search results
  const handleAddRepo = useCallback(
    async (repo: GitHubRepository) => {
      const owner = repo.owner.login;
      const name = repo.name;
      if (isRepoWatched(owner, name)) {
        return;
      }
      await handleWatchRepo(owner, name);
      // Clear search after adding
      setSearchQuery('');
    },
    [handleWatchRepo, isRepoWatched]
  );

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
      {/* Search Section */}
      <div
        style={{
          borderBottom: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
        }}
      >
        {/* Search Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: spacing.sm,
                color: theme.colors.textSecondary,
              }}
            />
            <input
              type="text"
              placeholder="Search users and repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                padding: `${spacing.sm}px ${spacing.sm}px ${spacing.sm}px ${spacing.lg + spacing.md}px`,
                fontSize: theme.fontSizes[1],
                color: theme.colors.text,
                backgroundColor: theme.colors.background,
                border: 'none',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: spacing.sm,
                  padding: spacing.xs,
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: theme.colors.textSecondary,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          {searchError && (
            <div
              style={{
                fontSize: theme.fontSizes[0],
                color: theme.colors.error,
              }}
            >
              {searchError}
            </div>
          )}
        </div>
      </div>

      {/* Search Results or Watched Items */}
      {searchQuery.trim() && hasSearched ? (
        // Search Results Section
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {isSearching ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: theme.colors.textSecondary,
                gap: spacing.sm,
              }}
            >
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
              Searching...
            </div>
          ) : (
            <>
              {/* Result Tabs */}
              <div
                style={{
                  display: 'flex',
                  gap: spacing.xs,
                  padding: spacing.md,
                  paddingBottom: spacing.sm,
                  borderBottom: `1px solid ${theme.colors.border}`,
                  flexShrink: 0,
                }}
              >
                <button
                  onClick={() => setResultTab('repos')}
                  style={{
                    flex: 1,
                    padding: `${spacing.xs}px ${spacing.sm}px`,
                    fontSize: theme.fontSizes[1],
                    fontWeight: resultTab === 'repos' ? 600 : 400,
                    color: resultTab === 'repos' ? theme.colors.primary : theme.colors.textSecondary,
                    backgroundColor:
                      resultTab === 'repos' ? `${theme.colors.primary}15` : 'transparent',
                    border: `1px solid ${resultTab === 'repos' ? theme.colors.primary : theme.colors.border}`,
                    borderRadius: theme.radii?.[1] || 4,
                    cursor: 'pointer',
                  }}
                >
                  <FolderGit2 size={14} style={{ marginRight: spacing.xs, verticalAlign: 'middle' }} />
                  Repositories ({repoResults.length})
                </button>
                <button
                  onClick={() => setResultTab('users')}
                  style={{
                    flex: 1,
                    padding: `${spacing.xs}px ${spacing.sm}px`,
                    fontSize: theme.fontSizes[1],
                    fontWeight: resultTab === 'users' ? 600 : 400,
                    color: resultTab === 'users' ? theme.colors.primary : theme.colors.textSecondary,
                    backgroundColor:
                      resultTab === 'users' ? `${theme.colors.primary}15` : 'transparent',
                    border: `1px solid ${resultTab === 'users' ? theme.colors.primary : theme.colors.border}`,
                    borderRadius: theme.radii?.[1] || 4,
                    cursor: 'pointer',
                  }}
                >
                  <User size={14} style={{ marginRight: spacing.xs, verticalAlign: 'middle' }} />
                  Users ({userResults.length})
                </button>
              </div>

              {/* Results List */}
              <div
                style={{
                  flex: 1,
                  overflow: 'auto',
                  padding: spacing.md,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                  {resultTab === 'users' ? (
                    userResults.length === 0 ? (
                      <div
                        style={{
                          padding: spacing.md,
                          fontSize: theme.fontSizes[1],
                          color: theme.colors.textSecondary,
                          textAlign: 'center',
                        }}
                      >
                        No users found
                      </div>
                    ) : (
                      userResults.map((user) => {
                        const alreadyWatched = isUserWatched(user.login);
                        const isAdding = operationInProgress === `user:${user.login}`;
                        return (
                          <div
                            key={user.login}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: spacing.sm,
                              backgroundColor: theme.colors.backgroundSecondary,
                              border: `1px solid ${theme.colors.border}`,
                              borderRadius: theme.radii?.[1] || 4,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                              {user.avatar_url ? (
                                <img
                                  src={user.avatar_url}
                                  alt={user.login}
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                  }}
                                />
                              ) : (
                                <User size={32} />
                              )}
                              <div>
                                <div style={{ fontSize: theme.fontSizes[1], color: theme.colors.text }}>
                                  {user.login}
                                </div>
                                {user.name && (
                                  <div
                                    style={{
                                      fontSize: theme.fontSizes[0],
                                      color: theme.colors.textSecondary,
                                    }}
                                  >
                                    {user.name}
                                  </div>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleAddUser(user)}
                              disabled={alreadyWatched || isAdding}
                              style={{
                                padding: `${spacing.xs}px ${spacing.sm}px`,
                                fontSize: theme.fontSizes[0],
                                fontWeight: 600,
                                color: alreadyWatched
                                  ? theme.colors.textSecondary
                                  : theme.colors.background,
                                backgroundColor: alreadyWatched
                                  ? theme.colors.border
                                  : theme.colors.primary,
                                border: 'none',
                                borderRadius: theme.radii?.[1] || 4,
                                cursor: alreadyWatched ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: spacing.xs,
                              }}
                            >
                              {isAdding ? (
                                <>
                                  <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                                  Adding...
                                </>
                              ) : alreadyWatched ? (
                                'Watching'
                              ) : (
                                <>
                                  <Plus size={12} />
                                  Watch
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })
                    )
                  ) : (
                    repoResults.length === 0 ? (
                      <div
                        style={{
                          padding: spacing.md,
                          fontSize: theme.fontSizes[1],
                          color: theme.colors.textSecondary,
                          textAlign: 'center',
                        }}
                      >
                        No repositories found
                      </div>
                    ) : (
                      repoResults.map((repo) => {
                        const alreadyWatched = isRepoWatched(repo.owner.login, repo.name);
                        const isAdding = operationInProgress === `repo:${repo.owner.login}/${repo.name}`;
                        return (
                          <div
                            key={repo.full_name}
                            style={{
                              display: 'flex',
                              gap: spacing.sm,
                              padding: spacing.sm,
                              backgroundColor: theme.colors.backgroundSecondary,
                              border: `1px solid ${theme.colors.border}`,
                              borderRadius: theme.radii?.[1] || 4,
                            }}
                          >
                            <div style={{ display: 'flex', gap: spacing.sm, flex: 1, minWidth: 0 }}>
                              {repo.owner.avatar_url ? (
                                <img
                                  src={repo.owner.avatar_url}
                                  alt={repo.owner.login}
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    flexShrink: 0,
                                  }}
                                />
                              ) : (
                                <User size={32} style={{ flexShrink: 0 }} />
                              )}
                              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <div style={{ fontSize: theme.fontSizes[1], fontWeight: 600, color: theme.colors.text }}>
                                  {repo.name}
                                </div>
                                <div
                                  style={{
                                    fontSize: theme.fontSizes[0],
                                    color: theme.colors.textSecondary,
                                  }}
                                >
                                  {repo.owner.login}
                                </div>
                                {repo.description && (
                                  <div
                                    style={{
                                      fontSize: theme.fontSizes[0],
                                      color: theme.colors.textSecondary,
                                      marginTop: spacing.xs,
                                    }}
                                  >
                                    {repo.description}
                                  </div>
                                )}
                                <div
                                  style={{
                                    fontSize: theme.fontSizes[0],
                                    color: theme.colors.textSecondary,
                                    marginTop: spacing.xs,
                                  }}
                                >
                                  {repo.language && `${repo.language} • `}
                                  {repo.stargazers_count !== undefined && `⭐ ${repo.stargazers_count.toLocaleString()}`}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleAddRepo(repo)}
                              disabled={alreadyWatched || isAdding}
                              style={{
                                padding: `${spacing.xs}px ${spacing.sm}px`,
                                fontSize: theme.fontSizes[0],
                                fontWeight: 600,
                                color: alreadyWatched
                                  ? theme.colors.textSecondary
                                  : theme.colors.background,
                                backgroundColor: alreadyWatched
                                  ? theme.colors.border
                                  : theme.colors.primary,
                                border: 'none',
                                borderRadius: theme.radii?.[1] || 4,
                                cursor: alreadyWatched ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: spacing.xs,
                                flexShrink: 0,
                              }}
                            >
                              {isAdding ? (
                                <>
                                  <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                                  Adding...
                                </>
                              ) : alreadyWatched ? (
                                'Watching'
                              ) : (
                                <>
                                  <Plus size={12} />
                                  Watch
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })
                    )
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        // Watched Items List
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
                      // Emit event to open user profile tab
                      events.emit({
                        type: 'user:profile-selected',
                        source: 'watched-items-panel',
                        timestamp: Date.now(),
                        payload: { username: user.login },
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
                        User
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
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.sm,
                      width: '100%',
                      padding: spacing.sm,
                      backgroundColor: 'transparent',
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.radii?.[1] || 4,
                      cursor: 'default',
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
                      onClick={() => handleUnwatchRepo(repo.owner, repo.repo)}
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
      )}

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
