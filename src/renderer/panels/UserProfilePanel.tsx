/**
 * UserProfilePanel
 *
 * Displays a user's profile with GitHub-style activity and information.
 * Features a Facebook-style layout with an avatar overlapping an activity heatmap banner.
 */

import React, { useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type {
  PanelContextValue,
  PanelActions,
  PanelEventEmitter,
} from '@principal-ade/panel-framework-core';
import {
  User,
  MapPin,
  Building2,
  Link as LinkIcon,
  Twitter,
  Calendar,
} from 'lucide-react';

export interface UserProfileData {
  username: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  company?: string;
  twitterHandle?: string;
  websiteUrl?: string;
  activityData: Map<string, number>; // date -> commit count
  totalCommits: number;
  totalRepos: number;
  followers: number;
  following: number;
  joinedDate: string; // ISO date string
}

interface UserProfilePanelProps {
  context: PanelContextValue;
  actions: PanelActions;
  events: PanelEventEmitter;
  userData?: UserProfileData;
  loading?: boolean;
  error?: string;
}

/**
 * Activity Heatmap Banner Component
 * Height-driven: calculates square size based on container height
 */
const ActivityHeatmap: React.FC<{
  activityData: Map<string, number>;
  theme: ReturnType<typeof useTheme>['theme'];
  bannerHeight?: number; // Height of the banner in pixels
}> = ({ activityData, theme, bannerHeight = 160 }) => {
  // Calculate square size based on banner height
  // Formula: (height - vertical padding) / 7 days - gap
  const squareSize = useMemo(() => {
    const verticalPadding = 8; // 0px top + 8px bottom
    const gap = 3;
    const availableHeight = bannerHeight - verticalPadding;
    const totalGaps = 6 * gap; // 6 gaps between 7 days
    return Math.floor((availableHeight - totalGaps) / 7);
  }, [bannerHeight]);

  const weeks = useMemo(() => {
    const today = new Date();
    const daysToShow = 365; // Full year
    const days: Array<{ date: string; count: number; dayOfWeek: number }> = [];

    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      const count = activityData.get(dateKey) || 0;
      days.push({ date: dateKey, count, dayOfWeek: date.getDay() });
    }

    // Group into weeks
    const weekGroups: Array<Array<{ date: string; count: number; dayOfWeek: number }>> = [];
    let currentWeek: Array<{ date: string; count: number; dayOfWeek: number }> = [];

    days.forEach((day) => {
      if (day.dayOfWeek === 0 && currentWeek.length > 0) {
        weekGroups.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(day);
    });

    if (currentWeek.length > 0) {
      weekGroups.push(currentWeek);
    }

    return weekGroups;
  }, [activityData]);

  const maxCount = useMemo(() => {
    let max = 0;
    activityData.forEach((count) => {
      if (count > max) max = count;
    });
    return max || 1;
  }, [activityData]);

  const getColor = (count: number): string => {
    if (count === 0) return `${theme.colors.border}30`;
    const intensity = Math.min(count / maxCount, 1);
    const alpha = Math.floor(20 + intensity * 80); // 20-100% opacity
    return `${theme.colors.primary}${alpha.toString(16).padStart(2, '0')}`;
  };

  const gap = 3;
  const borderRadius = Math.max(2, Math.floor(squareSize * 0.2)); // Scale border radius with square size

  return (
    <div
      style={{
        display: 'flex',
        gap,
        padding: '0 16px 8px 16px',
        width: '100%',
        height: '100%',
        overflowX: 'auto',
        overflowY: 'hidden',
        alignItems: 'center',
      }}
    >
      {weeks.map((week) => (
        <div key={week[0]?.date ?? `week-${week.length}`} style={{ display: 'flex', flexDirection: 'column', gap, flexShrink: 0 }}>
          {week.map((day) => (
            <div
              key={day.date}
              style={{
                width: squareSize,
                height: squareSize,
                borderRadius,
                backgroundColor: getColor(day.count),
                transition: 'all 0.2s ease',
                flexShrink: 0,
              }}
              title={`${day.date}: ${day.count} commits`}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

/**
 * Format number with k/m suffix
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1).replace(/\.0$/, '')}m`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(num);
}

/**
 * Format date to readable string
 */
function formatJoinDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Get initials from name or username
 */
function getInitials(name?: string, username?: string): string {
  const displayName = name || username || '?';
  const parts = displayName.split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return displayName.slice(0, 2).toUpperCase();
}

export const UserProfilePanel: React.FC<UserProfilePanelProps> = ({
  context: _context,
  actions: _actions,
  events: _events,
  userData,
  loading = false,
  error,
}) => {
  const { theme } = useTheme();

  const spacing = useMemo(
    () => ({
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
    }),
    [],
  );

  // Handle open in browser
  const handleOpenUrl = (url: string) => {
    window.open(url, '_blank');
  };

  // Empty state - no user selected
  if (!userData && !loading && !error) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
          color: theme.colors.textSecondary,
          textAlign: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <User size={48} style={{ marginBottom: spacing.md, opacity: 0.5 }} />
        <p style={{
          margin: 0,
          fontSize: theme.fontSizes[2],
          fontFamily: theme.fonts?.body
        }}>
          No user selected
        </p>
        <p style={{
          margin: `${spacing.xs}px 0 0`,
          fontSize: theme.fontSizes[1],
          fontFamily: theme.fonts?.body
        }}>
          Select a user to view their profile
        </p>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
          color: theme.colors.textSecondary,
          backgroundColor: theme.colors.background,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            border: `3px solid ${theme.colors.border}`,
            borderTopColor: theme.colors.primary,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <p style={{
          margin: `${spacing.md}px 0 0`,
          fontSize: theme.fontSizes[2],
          fontFamily: theme.fonts?.body
        }}>
          Loading profile...
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
          color: theme.colors.error,
          textAlign: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <p style={{
          margin: 0,
          fontSize: theme.fontSizes[2],
          fontWeight: theme.fontWeights?.medium ?? 500,
          fontFamily: theme.fonts?.body
        }}>
          Failed to load profile
        </p>
        <p
          style={{
            margin: `${spacing.xs}px 0 0`,
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            fontFamily: theme.fonts?.body,
          }}
        >
          {error}
        </p>
      </div>
    );
  }

  if (!userData) return null;

  const initials = getInitials(userData.name, userData.username);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        overflow: 'auto',
      }}
    >
      {/* Banner with Activity Heatmap */}
      <div
        style={{
          position: 'relative',
          height: 170,
          backgroundColor: theme.colors.backgroundSecondary,
          overflow: 'hidden',
        }}
      >
        <ActivityHeatmap activityData={userData.activityData} theme={theme} bannerHeight={170} />
      </div>

      {/* Profile Content */}
      <div style={{ padding: spacing.md, marginTop: -60, position: 'relative' }}>
        {/* Avatar Section - positioned to overlap banner */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: spacing.md, marginBottom: spacing.md }}>
          {/* Avatar */}
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              backgroundColor: theme.colors.backgroundSecondary,
              border: `4px solid ${theme.colors.background}`,
              overflow: 'hidden',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            }}
          >
            {userData.avatarUrl ? (
              <img
                src={userData.avatarUrl}
                alt={userData.username}
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
                  fontSize: theme.fontSizes[6] ?? 40,
                  fontFamily: theme.fonts?.heading ?? theme.fonts?.body,
                  fontWeight: theme.fontWeights?.semibold ?? 600,
                  color: theme.colors.text,
                  backgroundColor: theme.colors.primary + '20',
                }}
              >
                {initials}
              </div>
            )}
          </div>

          {/* Stats - aligned with bottom of avatar */}
          <div style={{ flex: 1, paddingBottom: spacing.xs }}>
            <div style={{ display: 'flex', gap: spacing.lg, flexWrap: 'wrap' }}>
              <div>
                <div style={{
                  fontSize: theme.fontSizes[3],
                  fontWeight: theme.fontWeights?.semibold ?? 600,
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.text
                }}>
                  {formatNumber(userData.totalCommits)}
                </div>
                <div style={{
                  fontSize: theme.fontSizes[0],
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.textSecondary
                }}>
                  commits
                </div>
              </div>
              <div>
                <div style={{
                  fontSize: theme.fontSizes[3],
                  fontWeight: theme.fontWeights?.semibold ?? 600,
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.text
                }}>
                  {formatNumber(userData.totalRepos)}
                </div>
                <div style={{
                  fontSize: theme.fontSizes[0],
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.textSecondary
                }}>
                  repositories
                </div>
              </div>
              <div>
                <div style={{
                  fontSize: theme.fontSizes[3],
                  fontWeight: theme.fontWeights?.semibold ?? 600,
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.text
                }}>
                  {formatNumber(userData.followers)}
                </div>
                <div style={{
                  fontSize: theme.fontSizes[0],
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.textSecondary
                }}>
                  followers
                </div>
              </div>
              <div>
                <div style={{
                  fontSize: theme.fontSizes[3],
                  fontWeight: theme.fontWeights?.semibold ?? 600,
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.text
                }}>
                  {formatNumber(userData.following)}
                </div>
                <div style={{
                  fontSize: theme.fontSizes[0],
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.textSecondary
                }}>
                  following
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Name and Username */}
        <div style={{ marginBottom: spacing.md }}>
          {userData.name && (
            <h2
              style={{
                margin: 0,
                fontSize: theme.fontSizes[4],
                fontWeight: theme.fontWeights?.semibold ?? 600,
                fontFamily: theme.fonts?.heading ?? theme.fonts?.body,
                color: theme.colors.text,
              }}
            >
              {userData.name}
            </h2>
          )}
          <div
            style={{
              fontSize: theme.fontSizes[2],
              fontFamily: theme.fonts?.body,
              color: theme.colors.textSecondary,
              marginTop: spacing.xs,
            }}
          >
            @{userData.username}
          </div>
        </div>

        {/* Bio */}
        {userData.bio && (
          <p
            style={{
              margin: `0 0 ${spacing.md}px`,
              fontSize: theme.fontSizes[1],
              fontFamily: theme.fonts?.body,
              lineHeight: theme.lineHeights?.body ?? 1.5,
              color: theme.colors.text,
            }}
          >
            {userData.bio}
          </p>
        )}

        {/* Details Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: spacing.sm,
            marginBottom: spacing.md,
          }}
        >
          {userData.company && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts?.body,
                color: theme.colors.textSecondary,
              }}
            >
              <Building2 size={16} />
              <span>{userData.company}</span>
            </div>
          )}
          {userData.location && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts?.body,
                color: theme.colors.textSecondary,
              }}
            >
              <MapPin size={16} />
              <span>{userData.location}</span>
            </div>
          )}
          {userData.websiteUrl && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts?.body,
              }}
            >
              <LinkIcon size={16} color={theme.colors.textSecondary} />
              <button
                onClick={() => userData.websiteUrl && handleOpenUrl(userData.websiteUrl)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: theme.colors.primary,
                  cursor: 'pointer',
                  textDecoration: 'none',
                  fontSize: 'inherit',
                  fontFamily: 'inherit',
                }}
              >
                {userData.websiteUrl && new URL(userData.websiteUrl).hostname}
              </button>
            </div>
          )}
          {userData.twitterHandle && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts?.body,
              }}
            >
              <Twitter size={16} color={theme.colors.textSecondary} />
              <button
                onClick={() => handleOpenUrl(`https://twitter.com/${userData.twitterHandle}`)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: theme.colors.primary,
                  cursor: 'pointer',
                  textDecoration: 'none',
                  fontSize: 'inherit',
                  fontFamily: 'inherit',
                }}
              >
                @{userData.twitterHandle}
              </button>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
              fontSize: theme.fontSizes[1],
              fontFamily: theme.fonts?.body,
              color: theme.colors.textSecondary,
            }}
          >
            <Calendar size={16} />
            <span>Joined {formatJoinDate(userData.joinedDate)}</span>
          </div>
        </div>
      </div>

      {/* Add keyframe animation for loading spinner */}
      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

export default UserProfilePanel;
