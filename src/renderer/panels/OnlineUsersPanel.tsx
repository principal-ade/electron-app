/**
 * OnlineUsersPanel
 *
 * Displays currently online users with time since their last change.
 * Updates in real-time as users come online/offline and make changes.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { User, Circle, Clock } from 'lucide-react';
import { PresenceService } from '../main-process-api/PresenceService';
import type { UserPresence } from '../../shared/main-process-api-interfaces/PresenceAPI';
import type { SharedGitStatus } from '@principal-ai/control-tower-core';
import { SecureAuthService } from '../services/SecureAuthService';

interface UserWithLastChange extends UserPresence {
  lastChangeTimestamp?: number;
  lastChangeRepoId?: string;
}

/**
 * Format relative time for display
 */
function formatTimeSinceChange(timestamp?: number): string {
  if (!timestamp) return 'No recent changes';

  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${diffDays} days ago`;
}

/**
 * Extract last change timestamp from user's git status
 */
function getLastChangeTimestamp(user: UserPresence): number | undefined {
  const extendedUser = user as { extended?: { openRepositories?: Record<string, { gitStatus?: SharedGitStatus; lastStatusUpdate?: number }> } };
  const rawRepos = user.openRepositories || extendedUser.extended?.openRepositories;

  if (!rawRepos || typeof rawRepos !== 'object') return undefined;

  let lastTimestamp: number | undefined;

  // Check all repositories for the most recent change
  const repos = Array.isArray(rawRepos) ? rawRepos : Object.values(rawRepos);
  for (const repo of repos) {
    if (!repo || typeof repo !== 'object') continue;
    const repoData = repo as { gitStatus?: SharedGitStatus; lastStatusUpdate?: number };

    // Use lastStatusUpdate if available, otherwise use current time if dirty
    if (repoData.lastStatusUpdate) {
      if (!lastTimestamp || repoData.lastStatusUpdate > lastTimestamp) {
        lastTimestamp = repoData.lastStatusUpdate;
      }
    } else if (repoData.gitStatus?.isDirty) {
      // If no timestamp but is dirty, assume recent
      const now = Date.now();
      if (!lastTimestamp || now > lastTimestamp) {
        lastTimestamp = now;
      }
    }
  }

  return lastTimestamp;
}

export const OnlineUsersPanel: React.FC = () => {
  const { theme } = useTheme();
  const [users, setUsers] = useState<UserWithLastChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update current time every 30 seconds to refresh "time ago" displays
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Fetch users from presence service
   */
  const fetchUsers = useCallback(async () => {
    try {
      // Check auth first
      const authService = SecureAuthService.getInstance();
      const authResult = await authService.checkAuth();

      if (!authResult.authenticated || !authResult.token) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      setIsAuthenticated(true);

      // Connect to presence if needed
      await PresenceService.connectToPresence(authResult.token);

      // Fetch users
      const presenceData = await PresenceService.getUsers();

      // Filter to only online users and add last change timestamp
      const onlineUsers = presenceData.users
        .filter(user => user.status === 'online')
        .map(user => ({
          ...user,
          lastChangeTimestamp: getLastChangeTimestamp(user),
        }))
        .sort((a, b) => {
          // Sort by most recent change first
          const aTime = a.lastChangeTimestamp || 0;
          const bTime = b.lastChangeTimestamp || 0;
          return bTime - aTime;
        });

      setUsers(onlineUsers);
      setError(null);
    } catch (err) {
      console.error('[OnlineUsersPanel] Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Handle presence events for real-time updates
   */
  useEffect(() => {
    // Initial fetch
    void fetchUsers();

    // Subscribe to presence events
    const unsubscribe = PresenceService.onPresenceEvent((event) => {
      console.log('[OnlineUsersPanel] Presence event:', event.type);

      // Refresh on user online/offline events
      if (
        event.type === 'presence:user_online' ||
        event.type === 'presence:user_offline'
      ) {
        void fetchUsers();
      }

      // Handle status changes incrementally
      if (event.type === 'presence:repo_status_changed') {
        const payload = event.payload as {
          userId: string;
          repoId: string;
          gitStatus: SharedGitStatus;
        };

        setUsers(prev =>
          prev.map(user => {
            if (user.userId !== payload.userId) return user;

            // Update last change timestamp if dirty
            if (payload.gitStatus.isDirty) {
              return {
                ...user,
                lastChangeTimestamp: Date.now(),
                lastChangeRepoId: payload.repoId,
              };
            }

            return user;
          }).sort((a, b) => {
            // Re-sort after update
            const aTime = a.lastChangeTimestamp || 0;
            const bTime = b.lastChangeTimestamp || 0;
            return bTime - aTime;
          })
        );
      }

      // Handle repo opened/closed
      if (
        event.type === 'presence:repo_opened' ||
        event.type === 'presence:repo_closed'
      ) {
        void fetchUsers();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [fetchUsers]);

  const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.colors.background,
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    padding: spacing.md,
    borderBottom: `1px solid ${theme.colors.border}`,
    flexShrink: 0,
  };

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: theme.fontSizes[2],
    fontWeight: 600,
    color: theme.colors.text,
    fontFamily: theme.fonts.monospace,
  };

  const countStyle: React.CSSProperties = {
    marginTop: spacing.xs,
    fontSize: theme.fontSizes[1],
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.monospace,
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: spacing.md,
  };

  const userItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    backgroundColor: theme.colors.backgroundSecondary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radii?.[1] || 4,
    marginBottom: spacing.sm,
    fontFamily: theme.fonts.monospace,
  };

  const avatarStyle: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: '50%',
    backgroundColor: theme.colors.background,
    border: `1px solid ${theme.colors.border}`,
    overflow: 'hidden',
    flexShrink: 0,
  };

  const emptyStateStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.monospace,
    fontSize: theme.fontSizes[1],
    textAlign: 'center',
    gap: spacing.sm,
  };

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>Online Users</h2>
        </div>
        <div style={contentStyle}>
          <div style={emptyStateStyle}>
            <User size={48} style={{ opacity: 0.5 }} />
            <div>Sign in to see online users</div>
          </div>
        </div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>Online Users</h2>
        </div>
        <div style={contentStyle}>
          <div style={emptyStateStyle}>
            <div>Loading users...</div>
          </div>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>Online Users</h2>
        </div>
        <div style={contentStyle}>
          <div style={{...emptyStateStyle, color: theme.colors.error}}>
            <div>Failed to load users</div>
            <div style={{ fontSize: theme.fontSizes[0] }}>{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h2 style={titleStyle}>Online Users</h2>
        <div style={countStyle}>
          {users.length} {users.length === 1 ? 'user' : 'users'} online
        </div>
      </div>

      <div style={contentStyle}>
        {users.length === 0 ? (
          <div style={emptyStateStyle}>
            <User size={48} style={{ opacity: 0.5 }} />
            <div>No users online</div>
          </div>
        ) : (
          <div>
            {users.map((user) => (
              <div key={user.userId} style={userItemStyle}>
                {/* Avatar */}
                <div style={avatarStyle}>
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.login}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <User size={20} color={theme.colors.textSecondary} />
                    </div>
                  )}
                </div>

                {/* User info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: theme.fontSizes[1],
                      fontWeight: 600,
                      color: theme.colors.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {user.name || user.login}
                  </div>
                  <div
                    style={{
                      fontSize: theme.fontSizes[0],
                      color: theme.colors.textSecondary,
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.xs,
                      marginTop: 2,
                    }}
                  >
                    <Clock size={10} />
                    <span>{formatTimeSinceChange(user.lastChangeTimestamp)}</span>
                  </div>
                </div>

                {/* Online indicator */}
                <Circle
                  size={8}
                  fill={theme.colors.success}
                  color={theme.colors.success}
                  style={{ flexShrink: 0 }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
