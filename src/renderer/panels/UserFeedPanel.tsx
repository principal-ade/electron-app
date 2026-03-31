/**
 * UserFeedPanel
 *
 * Displays a selected user's GitHub activity feed and contribution graph.
 * Used in the Network page as the right panel when a user is selected.
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
  GitCommit,
  GitMerge,
  GitPullRequest,
  CircleDot,
  ExternalLink,
  Lock,
  Users,
} from 'lucide-react';
import type {
  GitSyncPanelContextType,
  ActivityEvent,
  DailyContribution,
} from '../contexts/GitSyncPanelContext';

interface UserFeedPanelProps {
  context: PanelContextValue<GitSyncPanelContextType>;
  actions: PanelActions;
  events: PanelEventEmitter;
}

/**
 * Format relative time for display
 */
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format follower count with k suffix for large numbers
 */
function formatFollowerCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(count);
}

/**
 * Get icon for activity event type
 */
function getActivityIcon(type: ActivityEvent['type']) {
  switch (type) {
    case 'commit':
      return GitCommit;
    case 'pr_merged':
      return GitMerge;
    case 'pr_opened':
      return GitPullRequest;
    case 'issue_opened':
      return CircleDot;
    default:
      return GitCommit;
  }
}

/**
 * Get color for activity event type
 */
function getActivityColor(type: ActivityEvent['type'], theme: ReturnType<typeof useTheme>['theme']): string {
  switch (type) {
    case 'commit':
      return theme.colors.primary;
    case 'pr_merged':
      return '#8b5cf6'; // purple
    case 'pr_opened':
      return theme.colors.success;
    case 'issue_opened':
      return '#f59e0b'; // amber
    default:
      return theme.colors.textSecondary;
  }
}

/**
 * Get label for activity event
 */
function getActivityLabel(event: ActivityEvent): string {
  switch (event.type) {
    case 'commit':
      return `${event.metadata?.commitCount ?? 1} commit${(event.metadata?.commitCount ?? 1) > 1 ? 's' : ''} to ${event.repository}`;
    case 'pr_merged':
      return `Merged PR #${event.metadata?.prNumber ?? ''} "${event.title}"`;
    case 'pr_opened':
      return `Opened PR #${event.metadata?.prNumber ?? ''} "${event.title}"`;
    case 'issue_opened':
      return `Opened issue #${event.metadata?.issueNumber ?? ''} "${event.title}"`;
    default:
      return event.repository;
  }
}

/**
 * Contribution graph component
 */
const ContributionGraph: React.FC<{
  contributions: DailyContribution[];
  theme: ReturnType<typeof useTheme>['theme'];
}> = ({ contributions, theme }) => {
  const maxCount = Math.max(...contributions.map((c) => c.count), 1);

  // Get day labels
  const dayLabels = contributions.map((c) => {
    const date = new Date(c.date);
    return date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2);
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 4,
          height: 48,
        }}
      >
        {contributions.map((contribution) => {
          const height = contribution.count > 0 ? Math.max(8, (contribution.count / maxCount) * 48) : 4;
          const opacity = contribution.count > 0 ? 0.4 + (contribution.count / maxCount) * 0.6 : 0.1;

          return (
            <div
              key={contribution.date}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <div
                style={{
                  width: '100%',
                  height,
                  backgroundColor: theme.colors.primary,
                  opacity,
                  borderRadius: 2,
                  transition: 'height 0.2s ease, opacity 0.2s ease',
                }}
                title={`${contribution.count} contribution${contribution.count !== 1 ? 's' : ''} on ${contribution.date}`}
              />
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 4,
        }}
      >
        {dayLabels.map((label, idx) => (
          <div
            key={`${label}-${idx}`}
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 10,
              color: theme.colors.textTertiary,
            }}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
};

export const UserFeedPanel: React.FC<UserFeedPanelProps> = ({
  context,
  actions: _actions,
  events: _events,
}) => {
  const { theme } = useTheme();

  const activityData = context.userActivity?.data;
  const loading = context.userActivity?.loading ?? false;
  const error = context.userActivity?.error;

  const spacing = useMemo(
    () => ({
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
    }),
    [],
  );

  // Handle open in browser
  const handleOpenInBrowser = (url: string) => {
    window.open(url, '_blank');
  };

  // Empty state - no user selected
  if (!activityData && !loading && !error) {
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
        }}
      >
        <User size={48} style={{ marginBottom: spacing.md, opacity: 0.5 }} />
        <p style={{ margin: 0, fontSize: theme.fontSizes[2] }}>No user selected</p>
        <p style={{ margin: `${spacing.xs}px 0 0`, fontSize: theme.fontSizes[1] }}>
          Select a user from the network to see their activity
        </p>
      </div>
    );
  }

  // Loading state
  if (loading && !activityData) {
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
        }}
      >
        <p style={{ margin: 0, fontSize: theme.fontSizes[2] }}>Loading activity...</p>
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
        }}
      >
        <p style={{ margin: 0, fontSize: theme.fontSizes[2] }}>Failed to load activity</p>
        <p style={{ margin: `${spacing.xs}px 0 0`, fontSize: theme.fontSizes[1], color: theme.colors.textSecondary }}>
          {error.message}
        </p>
      </div>
    );
  }

  if (!activityData) return null;

  const { user, activity, contributions } = activityData;
  const totalContributions = contributions.reduce((sum, c) => sum + c.count, 0);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        overflow: 'hidden',
      }}
    >
      {/* User Header */}
      <div
        style={{
          padding: spacing.md,
          borderBottom: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.md,
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
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
                <User size={32} color={theme.colors.textSecondary} />
              </div>
            )}
          </div>

          {/* User info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              style={{
                margin: 0,
                fontSize: theme.fontSizes[3],
                fontWeight: 600,
                color: theme.colors.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user.name ?? user.login}
            </h3>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
                marginTop: spacing.xs,
                fontSize: theme.fontSizes[1],
                color: theme.colors.textSecondary,
              }}
            >
              <span>@{user.login}</span>
              <span>·</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Users size={12} />
                <span>{formatFollowerCount(user.followersCount)} followers</span>
              </div>
            </div>
          </div>

          {/* Open in GitHub button */}
          <button
            onClick={() => handleOpenInBrowser(`https://github.com/${user.login}`)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: spacing.sm,
              backgroundColor: 'transparent',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radii?.[1] ?? 4,
              cursor: 'pointer',
              color: theme.colors.textSecondary,
              transition: 'all 0.15s ease',
            }}
            title="Open in GitHub"
          >
            <ExternalLink size={16} />
          </button>
        </div>
      </div>

      {/* Contribution Graph */}
      <div
        style={{
          padding: spacing.md,
          borderBottom: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: spacing.sm,
          }}
        >
          <span
            style={{
              fontSize: theme.fontSizes[1],
              fontWeight: 500,
              color: theme.colors.text,
            }}
          >
            Last 7 days
          </span>
          <span
            style={{
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
            }}
          >
            {totalContributions} contribution{totalContributions !== 1 ? 's' : ''}
          </span>
        </div>
        <ContributionGraph contributions={contributions} theme={theme} />
      </div>

      {/* Activity Feed */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: spacing.md,
        }}
      >
        <h4
          style={{
            margin: 0,
            marginBottom: spacing.md,
            fontSize: theme.fontSizes[1],
            fontWeight: 500,
            color: theme.colors.text,
          }}
        >
          Activity
        </h4>

        {activity.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes[1],
              padding: spacing.lg,
            }}
          >
            No recent activity
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            {activity.map((event) => {
              const Icon = getActivityIcon(event.type);
              const color = getActivityColor(event.type, theme);
              const label = getActivityLabel(event);

              return (
                <div
                  key={event.id}
                  style={{
                    display: 'flex',
                    gap: spacing.sm,
                    padding: spacing.sm,
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderRadius: theme.radii?.[1] ?? 4,
                    border: `1px solid ${theme.colors.border}`,
                    cursor: event.url ? 'pointer' : 'default',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => event.url && handleOpenInBrowser(event.url)}
                  onMouseEnter={(e) => {
                    if (event.url) {
                      e.currentTarget.style.borderColor = theme.colors.primary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = theme.colors.border;
                  }}
                >
                  {/* Icon */}
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      backgroundColor: `${color}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={14} color={color} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing.xs,
                        fontSize: theme.fontSizes[1],
                        color: theme.colors.text,
                      }}
                    >
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {label}
                      </span>
                      {event.isPrivate && (
                        <Lock size={10} color={theme.colors.textSecondary} />
                      )}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing.xs,
                        marginTop: 2,
                        fontSize: theme.fontSizes[0],
                        color: theme.colors.textSecondary,
                      }}
                    >
                      {event.type !== 'commit' && (
                        <>
                          <span>{event.repository}</span>
                          <span>·</span>
                        </>
                      )}
                      <span>{formatRelativeTime(event.timestamp)}</span>
                      {event.metadata?.additions !== undefined && (
                        <>
                          <span>·</span>
                          <span style={{ color: theme.colors.success }}>
                            +{event.metadata.additions}
                          </span>
                          <span style={{ color: theme.colors.error }}>
                            -{event.metadata.deletions ?? 0}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserFeedPanel;
