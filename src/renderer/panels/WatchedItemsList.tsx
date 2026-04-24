/**
 * WatchedItemsList
 *
 * Component for managing watched GitHub users and repositories.
 * Displays current watches and provides GitHub search to add new ones.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { User, Loader2 } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { WebAdeService } from '../main-process-api/WebAdeService';
import type { WatchedUser, WatchedRepo } from '../../shared/tipc/webAdeRouterTypes';
import { WatchedUserCard } from './cards/WatchedUserCard';
import { WatchedRepoCard } from './cards/WatchedRepoCard';

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
              {watchedUsers.map((user) => (
                <WatchedUserCard
                  key={`user:${user.login}`}
                  user={{
                    login: user.login,
                    isOrganization: user.type === 'Organization',
                  }}
                  onClick={() => {
                    events.emit({
                      type: 'feed:watched-owner-activity-requested',
                      source: 'watched-items-panel',
                      timestamp: Date.now(),
                      payload: { login: user.login, accountType: user.type ?? 'User' },
                    });
                  }}
                />
              ))}

              {watchedRepos.map((repo) => (
                <WatchedRepoCard
                  key={`repo:${repo.owner}/${repo.repo}`}
                  repo={{ owner: repo.owner, repo: repo.repo }}
                  onClick={() => {
                    events.emit({
                      type: 'feed:watched-repo-activity-requested',
                      source: 'watched-items-panel',
                      timestamp: Date.now(),
                      payload: { owner: repo.owner, repo: repo.repo },
                    });
                  }}
                />
              ))}
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
