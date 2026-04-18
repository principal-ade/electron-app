/**
 * CoworkersList
 *
 * Displays a list of all organization members (coworkers) from the user's organizations.
 * Shows which organizations each person belongs to.
 * Clicking on a coworker opens their profile.
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Users } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { useOrganizationsAndCoworkers } from '../hooks/useOrganizationsAndCoworkers';
import { GithubService } from '../main-process-api/GithubService';
import type { GitHubUser } from '../../shared/main-process-api-interfaces/GitHubAPI';

export interface CoworkersListProps {
  events: PanelEventEmitter;
}

export const CoworkersList: React.FC<CoworkersListProps> = ({ events }) => {
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
      type: 'user:profile-selected',
      source: 'coworkers-list-panel',
      timestamp: Date.now(),
      payload: { username },
    });
  };

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
      {/* Current User */}
      {currentUser && (
        <div
          style={{
            padding: spacing.sm,
          }}
        >
          <button
            onClick={() => handleCoworkerClick(currentUser.login)}
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
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
              e.currentTarget.style.borderColor = theme.colors.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = theme.colors.border;
            }}
          >
            {/* Avatar */}
            <img
              src={currentUser.avatar_url}
              alt={currentUser.login}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                flexShrink: 0,
              }}
            />

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: theme.fonts.monospace,
                  fontSize: theme.fontSizes[1],
                  fontWeight: 600,
                  color: theme.colors.text,
                  marginBottom: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {currentUser.login}
              </div>
              <div
                style={{
                  fontFamily: theme.fonts.monospace,
                  fontSize: theme.fontSizes[0],
                  color: theme.colors.textSecondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                You
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          padding: spacing.md,
          borderBottom: `1px solid ${theme.colors.border}`,
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
      </div>

      {/* Coworkers List */}
      <div
        style={{
          padding: spacing.sm,
        }}
      >
        {coworkers
          .filter((coworker) => currentUser && coworker.login !== currentUser.login)
          .map((coworker) => (
          <button
            key={coworker.id}
            onClick={() => handleCoworkerClick(coworker.login)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
              width: '100%',
              padding: spacing.sm,
              marginBottom: spacing.xs,
              backgroundColor: 'transparent',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radii?.[1] || 4,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
              e.currentTarget.style.borderColor = theme.colors.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = theme.colors.border;
            }}
          >
            {/* Avatar */}
            <img
              src={coworker.avatar_url}
              alt={coworker.login}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                flexShrink: 0,
              }}
            />

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: theme.fonts.monospace,
                  fontSize: theme.fontSizes[1],
                  fontWeight: 600,
                  color: theme.colors.text,
                  marginBottom: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {coworker.login}
              </div>
              {coworker.organizations.length > 0 && (
                <div
                  style={{
                    fontFamily: theme.fonts.monospace,
                    fontSize: theme.fontSizes[0],
                    color: theme.colors.textSecondary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {coworker.organizations.join(', ')}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
