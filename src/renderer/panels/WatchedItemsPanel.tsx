/**
 * WatchedItemsPanel
 *
 * Panel for managing watched GitHub users and repositories.
 * Displays current watches and provides GitHub search to add new ones.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { User, FolderGit2, X, Plus, Loader2 } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { WebAdeService } from '../main-process-api/WebAdeService';
import type { WatchedUser, WatchedRepo } from '../../shared/tipc/webAdeRouterTypes';

export interface WatchedItemsPanelProps {
  /** Event emitter for panel communication */
  events: PanelEventEmitter;
}

type AddTab = 'users' | 'repos';

export const WatchedItemsPanel: React.FC<WatchedItemsPanelProps> = ({ events }) => {
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
  const [inputValue, setInputValue] = useState('');
  const [addTab, setAddTab] = useState<AddTab>('repos');
  const [operationInProgress, setOperationInProgress] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);

  // Load watched items on mount
  const loadWatches = useCallback(async () => {
    try {
      setLoading(true);
      const watches = await WebAdeService.getWatches();
      setWatchedUsers(watches.watchedUsers || []);
      setWatchedRepos(watches.watchedRepos || []);
    } catch (error) {
      console.error('[WatchedItemsPanel] Failed to load watches:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWatches();
  }, [loadWatches]);

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
        console.error('[WatchedItemsPanel] Failed to watch user:', error);
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
        console.error('[WatchedItemsPanel] Failed to watch repo:', error);
      } finally {
        setOperationInProgress(null);
      }
    },
    [events]
  );

  // Handle adding item from input
  const handleAddItem = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setInputError('Please enter a value');
      return;
    }

    setInputError(null);

    if (addTab === 'users') {
      // Add user - just the username
      await handleWatchUser(trimmed);
      setInputValue('');
    } else {
      // Add repo - expect "owner/repo" format
      const parts = trimmed.split('/');
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        setInputError('Repository format should be: owner/repo');
        return;
      }
      await handleWatchRepo(parts[0], parts[1]);
      setInputValue('');
    }
  }, [inputValue, addTab, handleWatchUser, handleWatchRepo]);

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
        console.error('[WatchedItemsPanel] Failed to unwatch user:', error);
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
        console.error('[WatchedItemsPanel] Failed to unwatch repo:', error);
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

  // Validate input
  const inputIsValid = useMemo(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return false;

    if (addTab === 'users') {
      return !isUserWatched(trimmed);
    } else {
      const parts = trimmed.split('/');
      return parts.length === 2 && parts[0] && parts[1] && !isRepoWatched(parts[0], parts[1]);
    }
  }, [inputValue, addTab, isUserWatched, isRepoWatched]);

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
      {/* Header */}
      <div
        style={{
          padding: spacing.md,
          borderBottom: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: theme.fontSizes[2],
            fontWeight: 600,
            color: theme.colors.text,
          }}
        >
          Watched Items
        </h3>
      </div>

      {/* Add Item Section */}
      <div
        style={{
          padding: spacing.md,
          borderBottom: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
        }}
      >
        {/* Add Tabs */}
        <div
          style={{
            display: 'flex',
            gap: spacing.xs,
            marginBottom: spacing.sm,
          }}
        >
          <button
            onClick={() => {
              setAddTab('repos');
              setInputValue('');
              setInputError(null);
            }}
            style={{
              flex: 1,
              padding: `${spacing.xs}px ${spacing.sm}px`,
              fontSize: theme.fontSizes[1],
              fontWeight: addTab === 'repos' ? 600 : 400,
              color: addTab === 'repos' ? theme.colors.primary : theme.colors.textSecondary,
              backgroundColor:
                addTab === 'repos' ? `${theme.colors.primary}15` : 'transparent',
              border: `1px solid ${addTab === 'repos' ? theme.colors.primary : theme.colors.border}`,
              borderRadius: theme.radii?.[1] || 4,
              cursor: 'pointer',
            }}
          >
            <FolderGit2 size={14} style={{ marginRight: spacing.xs, verticalAlign: 'middle' }} />
            Repositories
          </button>
          <button
            onClick={() => {
              setAddTab('users');
              setInputValue('');
              setInputError(null);
            }}
            style={{
              flex: 1,
              padding: `${spacing.xs}px ${spacing.sm}px`,
              fontSize: theme.fontSizes[1],
              fontWeight: addTab === 'users' ? 600 : 400,
              color: addTab === 'users' ? theme.colors.primary : theme.colors.textSecondary,
              backgroundColor:
                addTab === 'users' ? `${theme.colors.primary}15` : 'transparent',
              border: `1px solid ${addTab === 'users' ? theme.colors.primary : theme.colors.border}`,
              borderRadius: theme.radii?.[1] || 4,
              cursor: 'pointer',
            }}
          >
            <User size={14} style={{ marginRight: spacing.xs, verticalAlign: 'middle' }} />
            Users
          </button>
        </div>

        {/* Add Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
          <div
            style={{
              display: 'flex',
              gap: spacing.sm,
            }}
          >
            <input
              type="text"
              placeholder={addTab === 'users' ? 'Enter username' : 'Enter owner/repo'}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setInputError(null);
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && inputIsValid) {
                  handleAddItem();
                }
              }}
              style={{
                flex: 1,
                padding: `${spacing.sm}px`,
                fontSize: theme.fontSizes[1],
                color: theme.colors.text,
                backgroundColor: theme.colors.background,
                border: `1px solid ${inputError ? theme.colors.error : theme.colors.border}`,
                borderRadius: theme.radii?.[1] || 4,
                outline: 'none',
              }}
            />
            <button
              onClick={handleAddItem}
              disabled={!inputIsValid || operationInProgress !== null}
              style={{
                padding: `${spacing.sm}px ${spacing.md}px`,
                fontSize: theme.fontSizes[1],
                fontWeight: 600,
                color: inputIsValid ? theme.colors.background : theme.colors.textSecondary,
                backgroundColor: inputIsValid ? theme.colors.primary : theme.colors.border,
                border: 'none',
                borderRadius: theme.radii?.[1] || 4,
                cursor: inputIsValid ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: spacing.xs,
              }}
            >
              {operationInProgress !== null ? (
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Plus size={14} />
              )}
              Add
            </button>
          </div>
          {inputError && (
            <div
              style={{
                fontSize: theme.fontSizes[0],
                color: theme.colors.error,
              }}
            >
              {inputError}
            </div>
          )}
          <div
            style={{
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
            }}
          >
            {addTab === 'users' ? 'Enter a GitHub username' : 'Format: owner/repository'}
          </div>
        </div>
      </div>

      {/* Content - Scrollable list */}
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
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
            {/* Watched Repositories Section */}
            <div>
              <div
                style={{
                  fontSize: theme.fontSizes[1],
                  fontWeight: 600,
                  color: theme.colors.textSecondary,
                  marginBottom: spacing.sm,
                }}
              >
                Watched Repositories ({watchedRepos.length})
              </div>

              {watchedRepos.length === 0 ? (
                <div
                  style={{
                    padding: spacing.md,
                    fontSize: theme.fontSizes[1],
                    color: theme.colors.textSecondary,
                    textAlign: 'center',
                  }}
                >
                  No watched repositories
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                  {watchedRepos.map((repo) => (
                    <div
                      key={`${repo.owner}/${repo.repo}`}
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
                        <FolderGit2 size={20} />
                        <span style={{ fontSize: theme.fontSizes[1], color: theme.colors.text }}>
                          {repo.owner}/{repo.repo}
                        </span>
                      </div>
                      <button
                        onClick={() => handleUnwatchRepo(repo.owner, repo.repo)}
                        disabled={operationInProgress === `repo:${repo.owner}/${repo.repo}`}
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
                        }}
                      >
                        {operationInProgress === `repo:${repo.owner}/${repo.repo}` ? (
                          <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                        ) : (
                          <X size={12} />
                        )}
                        Unwatch
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Watched Users Section */}
            <div>
              <div
                style={{
                  fontSize: theme.fontSizes[1],
                  fontWeight: 600,
                  color: theme.colors.textSecondary,
                  marginBottom: spacing.sm,
                }}
              >
                Watched Users ({watchedUsers.length})
              </div>

              {watchedUsers.length === 0 ? (
                <div
                  style={{
                    padding: spacing.md,
                    fontSize: theme.fontSizes[1],
                    color: theme.colors.textSecondary,
                    textAlign: 'center',
                  }}
                >
                  No watched users
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                  {watchedUsers.map((user) => (
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
                        <User size={20} />
                        <span style={{ fontSize: theme.fontSizes[1], color: theme.colors.text }}>
                          {user.login}
                        </span>
                      </div>
                      <button
                        onClick={() => handleUnwatchUser(user.login)}
                        disabled={operationInProgress === `user:${user.login}`}
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
                        }}
                      >
                        {operationInProgress === `user:${user.login}` ? (
                          <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                        ) : (
                          <X size={12} />
                        )}
                        Unwatch
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

export default WatchedItemsPanel;
