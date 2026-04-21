/**
 * OrganizationsList
 *
 * Displays a list of all organizations the user is a member of.
 * Clicking on an organization opens its profile.
 */

import React, { useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Building2, Users } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { useOrganizationsAndCoworkers } from '../hooks/useOrganizationsAndCoworkers';

export interface OrganizationsListProps {
  events: PanelEventEmitter;
  /** Set of organization logins with recent activity */
  activeOrganizations?: Set<string>;
}

export const OrganizationsList: React.FC<OrganizationsListProps> = ({
  events,
  activeOrganizations = new Set(),
}) => {
  const { theme } = useTheme();
  const { organizations, loading, error } = useOrganizationsAndCoworkers();

  const handleOrgClick = (orgLogin: string) => {
    events.emit({
      type: 'feed:owner-selected',
      source: 'organizations-list-panel',
      timestamp: Date.now(),
      payload: { owner: orgLogin, isOrg: true },
    });
  };

  const handleShowAllActivity = useCallback(() => {
    events.emit({
      type: 'live-activity:open',
      source: 'organizations-list-panel',
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
        Loading organizations...
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
        Failed to load organizations: {error}
      </div>
    );
  }

  if (organizations.length === 0) {
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
        <Building2 size={48} style={{ marginBottom: spacing.md, opacity: 0.3 }} />
        <div>No organizations found</div>
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
          Orgs
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

      {/* Organizations List */}
      <div
        style={{
          padding: spacing.sm,
        }}
      >
        {organizations.map((org) => {
          const hasActivity = activeOrganizations.has(org.login);

          return (
            <button
              key={org.id}
              onClick={() => handleOrgClick(org.login)}
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
                position: 'relative',
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
              {/* Avatar with activity indicator */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <img
                  src={org.avatar_url}
                  alt={org.login}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: theme.radii?.[1] || 4,
                  }}
                />
                {hasActivity && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: theme.colors.success,
                      border: `2px solid ${theme.colors.background}`,
                    }}
                    title="Recent activity"
                  />
                )}
              </div>

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
                  {org.login}
                </div>
                {org.description && (
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
                    {org.description}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
