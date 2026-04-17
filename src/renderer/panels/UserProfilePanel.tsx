/**
 * UserProfilePanel
 *
 * Displays a user's profile with GitHub-style activity and information.
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
  User,
  Twitter,
  Github,
} from 'lucide-react';
import { RepoCard, type RepoCardData } from './RepoCard';
import type { FileTree } from '@principal-ai/repository-abstraction';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';

/**
 * User identifier in context
 */
export interface UserIdentifier {
  username: string; // GitHub username
}

/**
 * User profile data
 */
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

/**
 * Context for UserProfilePanel
 */
export interface UserProfilePanelContext extends PanelContextValue {
  // Override currentScope to add user
  currentScope: PanelContextValue['currentScope'] & {
    user?: UserIdentifier; // The user to display
  };

  // GitHub sync state (optional)
  githubSyncState?: {
    authenticatedUser?: string; // Current authenticated GitHub user
    following: string[]; // Users we're following
    followers: string[]; // Users following us
  };
}

/**
 * Actions for UserProfilePanel
 */
export interface UserProfilePanelActions extends PanelActions {
  /**
   * Get GitHub user profile
   */
  getUserProfile: (username: string) => Promise<UserProfileData>;

  /**
   * Get user activity/contribution data
   */
  getUserActivity: (username: string) => Promise<Map<string, number>>;

  /**
   * Get user's repositories (optional)
   */
  getUserRepositories?: (username: string) => Promise<RepoCardData[]>;

  /**
   * Get file tree for a repository (optional)
   */
  getRepositoryFileTree?: (owner: string, repoName: string) => Promise<FileTree | null>;

  /**
   * Follow a GitHub user (optional)
   */
  followUser?: (username: string) => Promise<void>;

  /**
   * Unfollow a GitHub user (optional)
   */
  unfollowUser?: (username: string) => Promise<void>;
}

interface UserProfilePanelProps {
  context: UserProfilePanelContext;
  actions: UserProfilePanelActions;
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
  highlightCurrentYear?: boolean; // Whether to highlight current year squares
}> = ({ activityData, theme, bannerHeight = 160, highlightCurrentYear = false }) => {
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
    const days: Array<{ date: string; count: number; dayOfWeek: number; dateObj: Date; monthLabel?: string }> = [];

    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      const count = activityData.get(dateKey) || 0;

      // Add month label if this is the first day of the month
      const monthLabel = date.getDate() === 1
        ? ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][date.getMonth()]
        : undefined;

      days.push({ date: dateKey, count, dayOfWeek: date.getDay(), dateObj: date, monthLabel });
    }

    // Group into weeks
    const weekGroups: Array<Array<{ date: string; count: number; dayOfWeek: number; dateObj: Date; monthLabel?: string }>> = [];
    let currentWeek: Array<{ date: string; count: number; dayOfWeek: number; dateObj: Date; monthLabel?: string }> = [];

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
  const currentYear = new Date().getFullYear();

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
      {weeks.map((week, weekIndex) => (
        <div key={week[0]?.date ?? `week-${weekIndex}`} style={{ display: 'flex', flexDirection: 'column', gap, flexShrink: 0 }}>
          {week.map((day) => {
            const isCurrentYear = day.dateObj.getFullYear() === currentYear;
            const shouldHighlight = highlightCurrentYear && isCurrentYear;

            return (
              <div
                key={day.date}
                style={{
                  width: squareSize,
                  height: squareSize,
                  borderRadius,
                  backgroundColor: getColor(day.count),
                  transition: 'all 0.2s ease',
                  flexShrink: 0,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: shouldHighlight ? `0 0 0 1px ${theme.colors.primary}60` : 'none',
                  boxSizing: 'border-box',
                }}
                title={`${day.date}: ${day.count} commits`}
              >
                {day.monthLabel && (
                  <span
                    style={{
                      fontSize: Math.max(8, Math.floor(squareSize * 0.6)),
                      fontFamily: theme.fonts?.body,
                      fontWeight: theme.fontWeights?.bold || 700,
                      color: theme.colors.background,
                      textShadow: `0 0 2px ${theme.colors.text}`,
                      pointerEvents: 'none',
                    }}
                  >
                    {day.monthLabel}
                  </span>
                )}
              </div>
            );
          })}
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
  context,
  actions,
  events,
}) => {
  const { theme } = useTheme();
  const user = context.currentScope?.user;

  // Panel manages its own profile data state
  const [userData, setUserData] = useState<UserProfileData | null>(null);

  // Repositories state
  const [repositories, setRepositories] = useState<RepoCardData[]>([]);
  const [_repositoriesLoading, setRepositoriesLoading] = useState(false);

  // File trees for repositories (lazy loaded)
  const [fileTrees, setFileTrees] = useState<Map<string, FileTree | null>>(new Map());

  // Hover state for commits this year stat
  const [isCommitsStatHovered, setIsCommitsStatHovered] = useState(false);

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

  // Fetch profile when user changes
  useEffect(() => {
    if (!user) {
      setUserData(null);
      return;
    }

    let cancelled = false;

    const fetchProfile = async () => {
      try {
        // Fetch profile and activity in parallel
        const [profile, activity] = await Promise.all([
          actions.getUserProfile(user.username),
          actions.getUserActivity(user.username),
        ]);

        if (!cancelled) {
          // Merge activity data into profile
          const profileWithActivity: UserProfileData = {
            ...profile,
            activityData: activity,
          };
          setUserData(profileWithActivity);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to fetch user profile:', err);
        }
      }
    };

    fetchProfile();

    return () => {
      cancelled = true;
    };
  }, [user, actions]);

  // Fetch repositories when user changes
  useEffect(() => {
    if (!user || !actions.getUserRepositories) {
      setRepositories([]);
      setRepositoriesLoading(false);
      return;
    }

    let cancelled = false;

    const fetchRepositories = async () => {
      setRepositoriesLoading(true);

      try {
        if (!actions.getUserRepositories) {
          console.warn('getUserRepositories action not available');
          setRepositories([]);
          return;
        }

        const repos = await actions.getUserRepositories(user.username);

        if (!cancelled) {
          // Take top 9 repositories (or however many are returned)
          setRepositories(repos.slice(0, 9));
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to fetch user repositories:', err);
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
  }, [user, actions]);

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
      type: 'user-profile:open-link',
      source: 'UserProfilePanel',
      timestamp: Date.now(),
      payload: { url, type },
    });
  };

  // Create a display object that uses userData if available, or empty values as fallback
  const displayData: UserProfileData = userData || {
    username: user?.username || '',
    name: undefined,
    email: undefined,
    avatarUrl: undefined,
    bio: undefined,
    location: undefined,
    company: undefined,
    twitterHandle: undefined,
    websiteUrl: undefined,
    activityData: new Map(),
    totalCommits: 0,
    totalRepos: 0,
    followers: 0,
    following: 0,
    joinedDate: new Date().toISOString(),
  };

  const initials = getInitials(displayData.name, displayData.username);

  // Calculate commits this year from activityData
  const commitsThisYear = useMemo(() => {
    const currentYear = new Date().getFullYear();
    let count = 0;
    displayData.activityData.forEach((commits, dateKey) => {
      const year = new Date(dateKey).getFullYear();
      if (year === currentYear) {
        count += commits;
      }
    });
    return count;
  }, [displayData.activityData]);

  // Empty state - no user selected
  if (!user) {
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
        <ActivityHeatmap activityData={displayData.activityData} theme={theme} bannerHeight={170} highlightCurrentYear={isCommitsStatHovered} />
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
              borderRadius: '50%',
              backgroundColor: theme.colors.backgroundSecondary,
              border: `4px solid ${theme.colors.background}`,
              overflow: 'hidden',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            }}
          >
            {displayData.avatarUrl ? (
              <img
                src={displayData.avatarUrl}
                alt={displayData.username}
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
              <div
                style={{ textAlign: 'center', cursor: 'pointer' }}
                onMouseEnter={() => setIsCommitsStatHovered(true)}
                onMouseLeave={() => setIsCommitsStatHovered(false)}
              >
                <div style={{
                  fontSize: theme.fontSizes[3],
                  fontWeight: theme.fontWeights?.semibold ?? 600,
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.text
                }}>
                  {formatNumber(commitsThisYear)}
                </div>
                <div style={{
                  fontSize: theme.fontSizes[0],
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.textSecondary
                }}>
                  commits this year
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: theme.fontSizes[3],
                  fontWeight: theme.fontWeights?.semibold ?? 600,
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.text
                }}>
                  {formatNumber(displayData.totalRepos)}
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
                  {formatNumber(displayData.followers)}
                </div>
                <div style={{
                  fontSize: theme.fontSizes[0],
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.textSecondary
                }}>
                  followers
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: theme.fontSizes[3],
                  fontWeight: theme.fontWeights?.semibold ?? 600,
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.text
                }}>
                  {formatNumber(displayData.following)}
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
          {displayData.name && (
            <h2
              style={{
                margin: 0,
                fontSize: theme.fontSizes[4],
                fontWeight: theme.fontWeights?.semibold ?? 600,
                fontFamily: theme.fonts?.heading ?? theme.fonts?.body,
                color: theme.colors.text,
              }}
            >
              {displayData.name}
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
                onClick={() => handleOpenUrl(`https://github.com/${displayData.username}`, 'github')}
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
                {displayData.username}
              </button>
            </div>

            {/* Twitter handle inline */}
            {displayData.twitterHandle && (
              <>
                <span style={{ color: theme.colors.textSecondary, fontSize: theme.fontSizes[2] }}>•</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                  <Twitter size={14} color={theme.colors.textSecondary} />
                  <button
                    onClick={() => handleOpenUrl(`https://twitter.com/${displayData.twitterHandle}`, 'twitter')}
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
                    {displayData.twitterHandle}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Bio */}
        {displayData.bio && (
          <p
            style={{
              margin: `0 0 ${spacing.md}px`,
              fontSize: theme.fontSizes[1],
              fontFamily: theme.fonts?.body,
              lineHeight: theme.lineHeights?.body ?? 1.5,
              color: theme.colors.text,
            }}
          >
            {displayData.bio}
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
                      // Use full AlexandriaEntry if available, otherwise create minimal one
                      const repositoryEntry: AlexandriaEntry = repo.alexandriaEntry || ({
                        path: repo.repoPath || '',
                        name: repo.repoName,
                        remoteUrl: `https://github.com/${repo.githubOwner}/${repo.githubRepoName}.git`,
                        registeredAt: repo.createdAt || new Date().toISOString(),
                        hasViews: false,
                        viewCount: 0,
                        views: [],
                        github: {
                          id: `${repo.githubOwner}/${repo.githubRepoName}`,
                          owner: repo.githubOwner || '',
                          name: repo.githubRepoName || repo.repoName,
                          stars: repo.stars || 0,
                          description: repo.description,
                          primaryLanguage: repo.language,
                          lastUpdated: new Date().toISOString(),
                        },
                      } as unknown as AlexandriaEntry);

                      // Emit event to open repository profile
                      events.emit({
                        type: 'feed:repository-selected',
                        source: 'UserProfilePanel',
                        timestamp: Date.now(),
                        payload: { repository: repositoryEntry },
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

export default UserProfilePanel;
