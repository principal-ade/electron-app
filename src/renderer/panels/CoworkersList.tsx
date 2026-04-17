/**
 * CoworkersList
 *
 * Displays a list of all organization members (coworkers) from the user's organizations.
 * Shows which organizations each person belongs to.
 * Clicking on a coworker opens their profile.
 */

import React, { useState, useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Users, Search } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { useOrganizationsAndCoworkers } from '../hooks/useOrganizationsAndCoworkers';

export interface CoworkersListProps {
  events: PanelEventEmitter;
}

export const CoworkersList: React.FC<CoworkersListProps> = ({ events }) => {
  const { theme } = useTheme();
  const { coworkers, loading, error } = useOrganizationsAndCoworkers();
  const [searchQuery, setSearchQuery] = useState('');

  const handleCoworkerClick = (username: string) => {
    events.emit({
      type: 'user:profile-selected',
      source: 'coworkers-list-panel',
      timestamp: Date.now(),
      payload: { username },
    });
  };

  const filteredCoworkers = useMemo(() => {
    if (!searchQuery.trim()) {
      return coworkers;
    }
    const query = searchQuery.toLowerCase();
    return coworkers.filter((coworker) =>
      coworker.login.toLowerCase().includes(query)
    );
  }, [coworkers, searchQuery]);

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
            marginBottom: spacing.sm,
            fontSize: theme.fontSizes[2],
            fontFamily: theme.fonts.monospace,
            fontWeight: 600,
            color: theme.colors.text,
          }}
        >
          Coworkers ({filteredCoworkers.length})
        </h2>

        {/* Search Input */}
        <div style={{ position: 'relative' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: spacing.sm,
              top: '50%',
              transform: 'translateY(-50%)',
              color: theme.colors.textSecondary,
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Search coworkers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: `${spacing.xs}px ${spacing.sm}px ${spacing.xs}px ${spacing.md + spacing.sm}px`,
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radii?.[1] || 4,
              color: theme.colors.text,
              fontSize: theme.fontSizes[0],
              fontFamily: theme.fonts.monospace,
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = theme.colors.primary;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = theme.colors.border;
            }}
          />
        </div>
      </div>

      {/* Coworkers List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: spacing.sm,
        }}
      >
        {filteredCoworkers.map((coworker) => (
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

            {/* Badge for number of shared orgs */}
            {coworker.organizations.length > 1 && (
              <div
                style={{
                  padding: `2px ${spacing.xs}px`,
                  backgroundColor: theme.colors.primary,
                  borderRadius: theme.radii?.[1] || 4,
                  color: theme.colors.background,
                  fontSize: theme.fontSizes[0],
                  fontFamily: theme.fonts.monospace,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {coworker.organizations.length}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
