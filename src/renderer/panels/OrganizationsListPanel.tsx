/**
 * OrganizationsListPanel
 *
 * Displays a list of all organizations the user is a member of.
 * Clicking on an organization opens its profile.
 */

import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Building2 } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { useOrganizationsAndCoworkers } from '../hooks/useOrganizationsAndCoworkers';

export interface OrganizationsListPanelProps {
  events: PanelEventEmitter;
}

export const OrganizationsListPanel: React.FC<OrganizationsListPanelProps> = ({ events }) => {
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
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: theme.colors.background,
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
        <h2
          style={{
            margin: 0,
            fontSize: theme.fontSizes[2],
            fontFamily: theme.fonts.monospace,
            fontWeight: 600,
            color: theme.colors.text,
          }}
        >
          Organizations ({organizations.length})
        </h2>
      </div>

      {/* Organizations List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: spacing.sm,
        }}
      >
        {organizations.map((org) => (
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
              src={org.avatar_url}
              alt={org.login}
              style={{
                width: 40,
                height: 40,
                borderRadius: theme.radii?.[1] || 4,
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

            {/* Icon */}
            <Building2
              size={16}
              style={{
                color: theme.colors.textSecondary,
                flexShrink: 0,
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
};
