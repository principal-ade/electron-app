/**
 * CoworkersList
 *
 * Displays a list of all organization members (coworkers) from the user's organizations.
 * Shows which organizations each person belongs to.
 * Clicking on a coworker opens their activity feed.
 */

import React, { useCallback, useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Users } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { useOrganizationsAndCoworkers } from '../hooks/useOrganizationsAndCoworkers';
import { GithubService } from '../main-process-api/GithubService';
import type { GitHubUser } from '../../shared/main-process-api-interfaces/GitHubAPI';
import { CoworkerCard } from './cards/CoworkerCard';

export interface CoworkersListProps {
  events: PanelEventEmitter;
  /** Set of GitHub usernames with recent activity */
  activeUsers?: Set<string>;
}

export const CoworkersList: React.FC<CoworkersListProps> = ({
  events,
  activeUsers = new Set(),
}) => {
  const { theme } = useTheme();
  const { coworkers, loading, error } = useOrganizationsAndCoworkers();
  const [currentUser, setCurrentUser] = useState<GitHubUser | null>(null);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = await GithubService.getCurrentUser();
        setCurrentUser(user);
      } catch (err) {
        console.error('Failed to fetch current user:', err);
      }
    };

    fetchCurrentUser();
  }, []);

  const handleCoworkerClick = (username: string) => {
    events.emit({
      type: 'feed:watched-owner-activity-requested',
      source: 'coworkers-list-panel',
      timestamp: Date.now(),
      payload: { login: username, accountType: 'User' },
    });
  };

  const handleShowAllActivity = useCallback(() => {
    events.emit({
      type: 'live-activity:open',
      source: 'coworkers-list-panel',
      timestamp: Date.now(),
      payload: null,
    });
  }, [events]);

  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
    md: theme.space?.[3] || 12,
    lg: theme.space?.[4] || 16,
  };

  if (loading) {
    return (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.textSecondary,
          fontFamily: theme.fonts.monospace,
          fontSize: theme.fontSizes[1],
        }}
      >
        Loading coworkers...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.error,
          fontFamily: theme.fonts.monospace,
          fontSize: theme.fontSizes[1],
          padding: spacing.md,
          textAlign: 'center',
        }}
      >
        Failed to load coworkers: {error}
      </div>
    );
  }

  if (coworkers.length === 0) {
    return (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.textSecondary,
          fontFamily: theme.fonts.monospace,
          fontSize: theme.fontSizes[1],
          padding: spacing.md,
          textAlign: 'center',
        }}
      >
        <Users size={48} style={{ marginBottom: spacing.md, opacity: 0.3 }} />
        <div>No coworkers found</div>
        <div style={{ fontSize: theme.fontSizes[0], marginTop: spacing.xs }}>
          Join an organization to see your coworkers
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: spacing.md,
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: theme.fontSizes[2],
            fontFamily: theme.fonts.monospace,
            fontWeight: 600,
            color: theme.colors.text,
          }}
        >
          Team Members
        </h2>
        <button
          onClick={handleShowAllActivity}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.xs,
            padding: `${spacing.xs}px ${spacing.sm}px`,
            backgroundColor: 'transparent',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radii?.[1] || 4,
            color: theme.colors.textSecondary,
            fontSize: theme.fontSizes[0],
            fontFamily: theme.fonts.monospace,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
            e.currentTarget.style.color = theme.colors.text;
            e.currentTarget.style.borderColor = theme.colors.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = theme.colors.textSecondary;
            e.currentTarget.style.borderColor = theme.colors.border;
          }}
        >
          <Users size={12} />
          <span>Show All</span>
        </button>
      </div>

      {/* Coworkers List */}
      <div
        style={{
          padding: spacing.md,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.sm,
        }}
      >
        {coworkers
          .filter((coworker) => !currentUser || coworker.login !== currentUser.login)
          .map((coworker) => (
            <CoworkerCard
              key={coworker.id}
              coworker={{
                login: coworker.login,
                avatarUrl: coworker.avatar_url,
                organizations: coworker.organizations,
                hasActivity: activeUsers.has(coworker.login),
              }}
              onClick={() => handleCoworkerClick(coworker.login)}
            />
          ))}
      </div>
    </div>
  );
};
