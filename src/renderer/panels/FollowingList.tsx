/**
 * FollowingList
 *
 * Displays the GitHub users that the authenticated user is following.
 * Read-only list with local search filtering. Clicking opens the user profile.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Users, Loader2, AlertCircle, Search } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { GithubService } from '../main-process-api/GithubService';
import type { GitHubUser } from '../../shared/main-process-api-interfaces/GitHubAPI';

export interface FollowingListProps {
  events: PanelEventEmitter;
}

export const FollowingList: React.FC<FollowingListProps> = ({ events }) => {
  const { theme } = useTheme();

  const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
  };

  const [users, setUsers] = useState<GitHubUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadFollowing = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await GithubService.getUserFollowing();
      setUsers(result);
    } catch (err) {
      console.error('[FollowingList] Failed to load following:', err);
      setError('Failed to load following list. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFollowing();
  }, [loadFollowing]);

  // Stay in sync with follow toggles from the user profile panel
  useEffect(() => {
    const unsubscribe = events.on('follow:user-toggled', (event) => {
      const { username, following } = event.payload as { username: string; following: boolean };
      if (following) {
        loadFollowing();
      } else {
        setUsers((prev) => prev.filter((u) => u.login !== username));
      }
    });
    return unsubscribe;
  }, [events, loadFollowing]);

  const handleUserClick = useCallback(
    (login: string) => {
      events.emit({
        type: 'feed:owner-selected',
        source: 'following-list',
        timestamp: Date.now(),
        payload: { owner: login, isOrg: false },
      });
    },
    [events]
  );

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
          Loading following...
        </div>
      </div>
    );
  }

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
          onClick={loadFollowing}
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

  if (users.length === 0) {
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
        <Users size={48} />
        <div style={{ marginTop: spacing.md, fontSize: theme.fontSizes[1], fontWeight: 600 }}>
          Not following anyone
        </div>
        <div style={{ marginTop: spacing.xs, fontSize: theme.fontSizes[0], textAlign: 'center' }}>
          Follow users on GitHub to see them here
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      u.login.toLowerCase().includes(q) ||
      (u.name?.toLowerCase().includes(q) ?? false)
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
            placeholder="Filter following..."
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

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: spacing.md,
        }}
      >
        {filteredUsers.length === 0 && (
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
            <Users size={32} style={{ marginBottom: spacing.sm, opacity: 0.3 }} />
            <span>No results for "{searchQuery}"</span>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
          {filteredUsers.map((user) => (
            <FollowingUserCard
              key={user.id}
              user={user}
              onClick={() => handleUserClick(user.login)}
            />
          ))}
        </div>
      </div>

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

interface FollowingUserCardProps {
  user: GitHubUser;
  onClick: () => void;
}

const FollowingUserCard: React.FC<FollowingUserCardProps> = ({ user, onClick }) => {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: 8,
        background: hovered ? theme.colors.backgroundSecondary : 'transparent',
        border: `1px solid ${hovered ? theme.colors.primary : theme.colors.border}`,
        borderRadius: theme.radii?.[1] || 4,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s ease',
      }}
    >
      <img
        src={user.avatar_url}
        alt={user.login}
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          flexShrink: 0,
          objectFit: 'cover',
        }}
      />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            fontSize: theme.fontSizes[1],
            fontWeight: 600,
            fontFamily: theme.fonts?.body,
            color: theme.colors.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {user.name || user.login}
        </div>
        {user.name && (
          <div
            style={{
              fontSize: theme.fontSizes[0],
              fontFamily: theme.fonts?.body,
              color: theme.colors.textSecondary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            @{user.login}
          </div>
        )}
      </div>
    </button>
  );
};

export default FollowingList;
