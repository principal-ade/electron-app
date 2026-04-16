/**
 * OrgProfilePanel
 *
 * Displays an organization's profile with GitHub-style activity and information.
 * Features a Facebook-style layout with an avatar overlapping an activity heatmap banner.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type {
  PanelContextValue,
  PanelActions,
  PanelEventEmitter,
} from '@principal-ade/panel-framework-core';
import {
  Building2,
  Twitter,
  Github,
} from 'lucide-react';
import { RepoCard, type RepoCardData } from './RepoCard';
import type { FileTree } from '@principal-ai/repository-abstraction';

/**
 * Organization identifier in context
 */
export interface OrgIdentifier {
  orgName: string; // GitHub organization name
}

/**
 * Organization profile data
 */
export interface OrgProfileData {
  orgName: string;
  name?: string; // Display name
  email?: string;
  avatarUrl?: string;
  description?: string;
  location?: string;
  twitterHandle?: string;
  websiteUrl?: string;
  activityData: Map<string, number>; // date -> commit count
  totalCommits: number;
  publicRepos: number;
  members: number;
  createdDate: string; // ISO date string
}

/**
 * Context for OrgProfilePanel
 */
export interface OrgProfilePanelContext extends PanelContextValue {
  // Override currentScope to add org
  currentScope: PanelContextValue['currentScope'] & {
    org?: OrgIdentifier; // The organization to display
  };
}

/**
 * Actions for OrgProfilePanel
 */
export interface OrgProfilePanelActions extends PanelActions {
  /**
   * Get GitHub organization profile
   */
  getOrgProfile: (orgName: string) => Promise<OrgProfileData>;

  /**
   * Get organization activity/contribution data
   */
  getOrgActivity: (orgName: string) => Promise<Map<string, number>>;

  /**
   * Get organization's repositories (optional)
   */
  getOrgRepositories?: (orgName: string) => Promise<RepoCardData[]>;

  /**
   * Get file tree for a repository (optional)
   */
  getRepositoryFileTree?: (owner: string, repoName: string) => Promise<FileTree | null>;

  /**
   * Get organization's members (optional)
   */
  getOrgMembers?: (orgName: string) => Promise<unknown[]>;
}

interface OrgProfilePanelProps {
  context: OrgProfilePanelContext;
  actions: OrgProfilePanelActions;
  events: PanelEventEmitter;
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
 * Get initials from name or org name
 */
function getInitials(name?: string, orgName?: string): string {
  const displayName = name || orgName || '?';
  const parts = displayName.split(/[\s-_]/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return displayName.slice(0, 2).toUpperCase();
}

export const OrgProfilePanel: React.FC<OrgProfilePanelProps> = ({
  context,
  actions,
  events,
}) => {
  const { theme } = useTheme();
  const org = context.currentScope?.org;

  // Panel manages its own profile data state
  const [orgData, setOrgData] = useState<OrgProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Repositories state
  const [repositories, setRepositories] = useState<RepoCardData[]>([]);
  const [_repositoriesLoading, setRepositoriesLoading] = useState(false);

  // File trees for repositories (lazy loaded)
  const [fileTrees, setFileTrees] = useState<Map<string, FileTree | null>>(new Map());

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

  // Fetch profile when org changes
  useEffect(() => {
    if (!org) {
      setOrgData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchProfile = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch profile and activity in parallel
        const [profile, activity] = await Promise.all([
          actions.getOrgProfile(org.orgName),
          actions.getOrgActivity(org.orgName),
        ]);

        if (!cancelled) {
          // Merge activity data into profile
          const profileWithActivity: OrgProfileData = {
            ...profile,
            activityData: activity,
          };
          setOrgData(profileWithActivity);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to fetch org profile:', err);
          setError(err instanceof Error ? err.message : 'Failed to load profile');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchProfile();

    return () => {
      cancelled = true;
    };
  }, [org, actions]);

  // Fetch repositories when org changes
  useEffect(() => {
    if (!org || !actions.getOrgRepositories) {
      setRepositories([]);
      setRepositoriesLoading(false);
      return;
    }

    let cancelled = false;

    const fetchRepositories = async () => {
      setRepositoriesLoading(true);

      try {
        if (!actions.getOrgRepositories) {
          console.warn('getOrgRepositories action not available');
          setRepositories([]);
          return;
        }

        const repos = await actions.getOrgRepositories(org.orgName);

        if (!cancelled) {
          // Take top 9 repositories (or however many are returned)
          setRepositories(repos.slice(0, 9));
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to fetch org repositories:', err);
          setRepositories([]);
        }
      } finally {
        if (!cancelled) {
          setRepositoriesLoading(false);
        }
      }
    };

    fetchRepositories();

    return () => {
      cancelled = true;
    };
  }, [org, actions]);

  // Lazy fetch file trees for repositories
  useEffect(() => {
    if (repositories.length === 0 || !actions.getRepositoryFileTree) {
      return;
    }

    const fetchFileTrees = async () => {
      const newFileTrees = new Map<string, FileTree | null>();

      // Fetch file trees in parallel
      await Promise.all(
        repositories.map(async (repo) => {
          const key = `${repo.githubOwner}/${repo.repoName}`;

          try {
            const fileTree = await actions.getRepositoryFileTree!(
              repo.githubOwner!,
              repo.repoName
            );
            newFileTrees.set(key, fileTree);
          } catch (err) {
            console.warn(`Failed to fetch file tree for ${key}:`, err);
            newFileTrees.set(key, null);
          }
        })
      );

      setFileTrees(newFileTrees);
    };

    fetchFileTrees();
  }, [repositories, actions]);

  // Handle open in browser - emit event instead
  const handleOpenUrl = (url: string, type: 'website' | 'twitter' | 'github' | 'email') => {
    events.emit({
      type: 'org-profile:open-link',
      source: 'OrgProfilePanel',
      timestamp: Date.now(),
      payload: { url, type },
    });
  };

  // Empty state - no org selected
  if (!orgData && !loading && !error) {
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
        <Building2 size={48} style={{ marginBottom: spacing.md, opacity: 0.5 }} />
        <p style={{
          margin: 0,
          fontSize: theme.fontSizes[2],
          fontFamily: theme.fonts?.body
        }}>
          No organization selected
        </p>
        <p style={{
          margin: `${spacing.xs}px 0 0`,
          fontSize: theme.fontSizes[1],
          fontFamily: theme.fonts?.body
        }}>
          Select an organization to view its profile
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
          Loading organization...
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
          Failed to load organization
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

  if (!orgData) return null;

  const initials = getInitials(orgData.name, orgData.orgName);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Banner with Activity Heatmap - Fixed at top */}
      <div
        style={{
          position: 'relative',
          height: 170,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <ActivityHeatmap activityData={orgData.activityData} theme={theme} bannerHeight={170} />
      </div>

      {/* Profile Header - Fixed, no scroll */}
      <div style={{ padding: spacing.md, marginTop: -60, position: 'relative', flexShrink: 0 }}>
        {/* Avatar Section - positioned to overlap banner */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: spacing.md, marginBottom: spacing.md }}>
          {/* Avatar */}
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 16,
              backgroundColor: theme.colors.backgroundSecondary,
              border: `4px solid ${theme.colors.background}`,
              overflow: 'hidden',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            }}
          >
            {orgData.avatarUrl ? (
              <img
                src={orgData.avatarUrl}
                alt={orgData.orgName}
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
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: theme.fontSizes[3],
                  fontWeight: theme.fontWeights?.semibold ?? 600,
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.text
                }}>
                  {formatNumber(orgData.publicRepos)}
                </div>
                <div style={{
                  fontSize: theme.fontSizes[0],
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.textSecondary
                }}>
                  projects
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: theme.fontSizes[3],
                  fontWeight: theme.fontWeights?.semibold ?? 600,
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.text
                }}>
                  {formatNumber(orgData.members)}
                </div>
                <div style={{
                  fontSize: theme.fontSizes[0],
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.textSecondary
                }}>
                  members
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: theme.fontSizes[3],
                  fontWeight: theme.fontWeights?.semibold ?? 600,
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.text
                }}>
                  {formatNumber(orgData.totalCommits)}
                </div>
                <div style={{
                  fontSize: theme.fontSizes[0],
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.textSecondary
                }}>
                  commits
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Name and Organization Name */}
        <div style={{ marginBottom: spacing.md }}>
          {orgData.name && (
            <h2
              style={{
                margin: 0,
                fontSize: theme.fontSizes[4],
                fontWeight: theme.fontWeights?.semibold ?? 600,
                fontFamily: theme.fonts?.heading ?? theme.fonts?.body,
                color: theme.colors.text,
              }}
            >
              {orgData.name}
            </h2>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
              marginTop: spacing.xs,
              flexWrap: 'wrap',
            }}
          >
            {/* GitHub handle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
              <Github size={14} color={theme.colors.textSecondary} />
              <button
                onClick={() => handleOpenUrl(`https://github.com/${orgData.orgName}`, 'github')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontSize: theme.fontSizes[2],
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.textSecondary,
                  cursor: 'pointer',
                  textDecoration: 'none',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = theme.colors.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = theme.colors.textSecondary;
                }}
              >
                {orgData.orgName}
              </button>
            </div>

            {/* Twitter handle inline */}
            {orgData.twitterHandle && (
              <>
                <span style={{ color: theme.colors.textSecondary, fontSize: theme.fontSizes[2] }}>•</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                  <Twitter size={14} color={theme.colors.textSecondary} />
                  <button
                    onClick={() => handleOpenUrl(`https://twitter.com/${orgData.twitterHandle}`, 'twitter')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      fontSize: theme.fontSizes[2],
                      fontFamily: theme.fonts?.body,
                      color: theme.colors.textSecondary,
                      cursor: 'pointer',
                      textDecoration: 'none',
                      transition: 'color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = theme.colors.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = theme.colors.textSecondary;
                    }}
                  >
                    {orgData.twitterHandle}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Description */}
        {orgData.description && (
          <p
            style={{
              margin: `0 0 ${spacing.md}px`,
              fontSize: theme.fontSizes[1],
              fontFamily: theme.fonts?.body,
              lineHeight: theme.lineHeights?.body ?? 1.5,
              color: theme.colors.text,
            }}
          >
            {orgData.description}
          </p>
        )}
      </div>

      {/* Repositories Grid - Scrollable section */}
      {repositories.length > 0 && (
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: `0 ${spacing.md}px ${spacing.md}px`,
          }}
        >
          <div style={{ marginTop: spacing.md }}>
            <h3
              style={{
                margin: 0,
                marginBottom: spacing.md,
                fontSize: theme.fontSizes[3],
                fontWeight: theme.fontWeights?.semibold ?? 600,
                fontFamily: theme.fonts?.heading ?? theme.fonts?.body,
                color: theme.colors.text,
              }}
            >
              Popular repositories
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))',
                gap: spacing.md,
              }}
            >
              {repositories.map((repo) => {
                const fileTreeKey = `${repo.githubOwner}/${repo.repoName}`;
                const fileTree = fileTrees.get(fileTreeKey);

                return (
                  <RepoCard
                    key={repo.repoName}
                    repo={repo}
                    fileTree={fileTree}
                    onClick={() => {
                      // Emit event to open repository profile
                      events.emit({
                        type: 'org-profile:repository-selected',
                        source: 'OrgProfilePanel',
                        timestamp: Date.now(),
                        payload: { repository: repo },
                      });
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

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

export default OrgProfilePanel;
