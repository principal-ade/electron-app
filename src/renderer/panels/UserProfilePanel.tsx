/**
 * UserProfilePanel
 *
 * Displays a user's profile with GitHub-style activity and information.
 * Features a Facebook-style layout with an avatar overlapping an activity heatmap banner.
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
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
  UserPlus,
  UserCheck,
} from 'lucide-react';
import { RepoCard, type RepoCardData } from './RepoCard';
import { OwnerCollectionsTab } from './OwnerCollectionsTab';
import {
  CommitActivityPanel,
  type CommitActivityPanelActions,
} from './CommitActivityPanel';
import type { FileTree } from '@principal-ai/repository-abstraction';
import {
  payloadFromGithub,
  payloadFromLocalEntry,
  type RepositorySelectedPayload,
} from '../events/repositorySelected';
import type { GitHubOrganization } from '../../shared/main-process-api-interfaces/GitHubAPI';

/**
 * User identifier in context
 */
export interface UserIdentifier {
  username: string; // GitHub username
}

/**
 * Recent commit activity (last 24 hours)
 */
export interface RecentCommitActivity {
  id: string;
  timestamp: string;
  repository: string;
  repositoryUrl?: string;
  ownerType?: 'User' | 'Organization';
  isPrivate?: boolean;
  commitCount: number;
  additions?: number;
  deletions?: number;
}

/**
 * Repository the user has contributed to (past ~5 months)
 */
export interface ContributedRepository {
  nameWithOwner: string;
  owner: string;
  name: string;
  url: string;
  commitCount: number;
  lastContributedAt: string;
  isPrivate: boolean;
  ownerType: 'User' | 'Organization';
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
  activityData: Map<string, number>; // date -> commit count (for heatmap)
  recentCommits?: RecentCommitActivity[]; // Recent commits (last 24 hours)
  contributedRepos?: ContributedRepository[]; // Repos contributed to (past ~5 months)
  totalCommits?: number;
  totalRepos?: number;
  followers?: number;
  following?: number;
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
 * User activity response from API
 */
export interface UserActivityAPIResponse {
  recentCommits: RecentCommitActivity[];
  contributions: Array<{ date: string; count: number }>;
  contributedRepos: ContributedRepository[];
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
   * Get user activity/contribution data (heatmap + recent commits)
   */
  getUserActivity: (username: string) => Promise<UserActivityAPIResponse>;

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

  /**
   * Check if the authenticated user is following the given user
   */
  isFollowingUser?: (username: string) => Promise<boolean>;

  /**
   * Get organizations a user belongs to (optional)
   */
  getUserOrgs?: (username: string) => Promise<GitHubOrganization[]>;

  /**
   * Get pinned repositories for a user (optional)
   * Returns array of "owner/repo" strings
   */
  getPinnedRepositories?: (username: string) => Promise<string[]>;
}

interface UserProfilePanelProps {
  context: UserProfilePanelContext;
  actions: UserProfilePanelActions;
  events: PanelEventEmitter;
  /**
   * Actions forwarded to the embedded CommitActivityPanel (and its
   * RepoActivityCards). Kept as a separate prop so the panel itself doesn't
   * import renderer main-process-api services — that keeps it Storybook-safe.
   */
  commitActivityActions: CommitActivityPanelActions;
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
function formatNumber(num: number | undefined): string {
  // Handle undefined, null, or NaN values - show loading indicator
  if (num === undefined || num === null || Number.isNaN(num)) {
    return '—';
  }

  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1).replace(/\.0$/, '')}m`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(num);
}

function payloadFromRepoCard(repo: RepoCardData): RepositorySelectedPayload {
  if (repo.alexandriaEntry) return payloadFromLocalEntry(repo.alexandriaEntry);
  return payloadFromGithub({
    owner: repo.githubOwner ?? '',
    name: repo.githubRepoName ?? repo.repoName,
    description: repo.description,
    stars: repo.stars,
    primaryLanguage: repo.language,
    isPublic: !repo.isPrivate,
    lastUpdated: repo.updatedAt,
    createdAt: repo.createdAt,
  });
}

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
  commitActivityActions,
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

  // Follow state
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'pinned' | 'collections'>('activity');

  // Panel width for responsive pinned column
  const containerRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState(0);
  const PINNED_COLUMN_MIN_WIDTH = 900;

  // Org avatars
  const [userOrgs, setUserOrgs] = useState<GitHubOrganization[]>([]);
  const [hoveredOrgIndex, setHoveredOrgIndex] = useState<number | null>(null);

  // Pinned repos
  const [pinnedRepoNames, setPinnedRepoNames] = useState<string[]>([]);

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

  // Track panel width for responsive layout
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setPanelWidth(width);
      if (width >= PINNED_COLUMN_MIN_WIDTH && activeTab === 'pinned') {
        setActiveTab('activity');
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeTab]);

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
          // Convert contributions array to Map for heatmap
          const activityMap = new Map<string, number>();
          activity.contributions.forEach((day) => {
            activityMap.set(day.date, day.count);
          });

          // Merge activity data into profile
          const profileWithActivity: UserProfileData = {
            ...profile,
            activityData: activityMap,
            recentCommits: activity.recentCommits,
            contributedRepos: activity.contributedRepos,
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
          setRepositories(repos);
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

  // Load follow status when user changes
  useEffect(() => {
    if (!user || !actions.isFollowingUser) {
      setIsFollowing(false);
      return;
    }

    let cancelled = false;

    const loadFollowStatus = async () => {
      try {
        if (!actions.isFollowingUser) {
          return;
        }
        const following = await actions.isFollowingUser(user.username);
        if (!cancelled) {
          setIsFollowing(following);
        }
      } catch (err) {
        console.error('Failed to load follow status:', err);
      }
    };

    loadFollowStatus();

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
            if (!actions.getRepositoryFileTree || !repo.githubOwner) {
              newFileTrees.set(key, null);
              return;
            }
            const fileTree = await actions.getRepositoryFileTree(
              repo.githubOwner,
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

  // Load orgs for this user
  useEffect(() => {
    if (!user || !actions.getUserOrgs) {
      setUserOrgs([]);
      return;
    }

    let cancelled = false;

    actions.getUserOrgs(user.username)
      .then((result) => {
        if (!cancelled) setUserOrgs(result.slice(0, 8));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [user, actions]);

  // Fetch pinned repos when user changes
  useEffect(() => {
    if (!user || !actions.getPinnedRepositories) {
      setPinnedRepoNames([]);
      return;
    }

    let cancelled = false;

    actions.getPinnedRepositories(user.username)
      .then((names) => {
        if (!cancelled) setPinnedRepoNames(names);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [user, actions]);

  // Handle open in browser - emit event instead
  const handleOpenUrl = (url: string, type: 'website' | 'twitter' | 'github' | 'email') => {
    events.emit({
      type: 'user-profile:open-link',
      source: 'UserProfilePanel',
      timestamp: Date.now(),
      payload: { url, type },
    });
  };

  // Handle follow/unfollow user
  const handleToggleFollow = async () => {
    if (!user) return;

    if (!actions.followUser || !actions.unfollowUser) {
      console.warn('Follow actions not available');
      return;
    }

    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        await actions.unfollowUser(user.username);
        setIsFollowing(false);
      } else {
        await actions.followUser(user.username);
        setIsFollowing(true);
      }
      events.emit({
        type: 'follow:user-toggled',
        source: 'user-profile-panel',
        timestamp: Date.now(),
        payload: { username: user.username, following: !isFollowing },
      });
    } catch (err) {
      console.error('Failed to toggle follow:', err);
    } finally {
      setIsFollowLoading(false);
    }
  };

  // Create a display object that uses userData if available, or empty values as fallback
  // Eagerly construct avatar URL from username for instant display
  // Use undefined for numeric values to show loading state ("—") vs actual 0
  const displayData: UserProfileData = userData || {
    username: user?.username || '',
    name: undefined,
    email: undefined,
    avatarUrl: user?.username ? `https://github.com/${user.username}.png` : undefined,
    bio: undefined,
    location: undefined,
    company: undefined,
    twitterHandle: undefined,
    websiteUrl: undefined,
    activityData: new Map(),
    totalCommits: undefined,
    totalRepos: undefined,
    followers: undefined,
    following: undefined,
    joinedDate: new Date().toISOString(),
  };

  const initials = getInitials(displayData.name, displayData.username);

  // Calculate commits this year from activityData
  const commitsThisYear = useMemo(() => {
    // Return undefined during loading state
    if (!userData) {
      return undefined;
    }

    const currentYear = new Date().getFullYear();
    let count = 0;
    displayData.activityData.forEach((commits, dateKey) => {
      const year = new Date(dateKey).getFullYear();
      if (year === currentYear) {
        count += commits;
      }
    });
    return count;
  }, [userData, displayData.activityData]);

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

  const isNarrow = panelWidth > 0 && panelWidth < PINNED_COLUMN_MIN_WIDTH;

  return (
    <div
      ref={containerRef}
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
        <div style={{ display: 'flex', alignItems: 'stretch', gap: spacing.md }}>

          {/* Left column: avatar+stats row, then name/bio below */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {/* Avatar + Stats row — same as original */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: spacing.md }}>
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

              {/* Stats */}
              <div style={{ paddingBottom: spacing.xs }}>
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
                      color: theme.colors.text,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '24px',
                    }}>
                      {formatNumber(commitsThisYear)}
                    </div>
                    <div style={{ fontSize: theme.fontSizes[0], fontFamily: theme.fonts?.body, color: theme.colors.textSecondary }}>
                      commits this year
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: theme.fontSizes[3],
                      fontWeight: theme.fontWeights?.semibold ?? 600,
                      fontFamily: theme.fonts?.body,
                      color: theme.colors.text,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '24px',
                    }}>
                      {formatNumber(displayData.totalRepos)}
                    </div>
                    <div style={{ fontSize: theme.fontSizes[0], fontFamily: theme.fonts?.body, color: theme.colors.textSecondary }}>
                      projects
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: theme.fontSizes[3],
                      fontWeight: theme.fontWeights?.semibold ?? 600,
                      fontFamily: theme.fonts?.body,
                      color: theme.colors.text,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '24px',
                    }}>
                      {formatNumber(displayData.followers)}
                    </div>
                    <div style={{ fontSize: theme.fontSizes[0], fontFamily: theme.fonts?.body, color: theme.colors.textSecondary }}>
                      followers
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: theme.fontSizes[3],
                      fontWeight: theme.fontWeights?.semibold ?? 600,
                      fontFamily: theme.fonts?.body,
                      color: theme.colors.text,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '24px',
                    }}>
                      {formatNumber(displayData.following)}
                    </div>
                    <div style={{ fontSize: theme.fontSizes[0], fontFamily: theme.fonts?.body, color: theme.colors.textSecondary }}>
                      following
                    </div>
                  </div>

                  {/* Follow Button - hidden on own profile */}
                  {actions.followUser && actions.unfollowUser &&
                    context.githubSyncState?.authenticatedUser !== user.username && (
                    <div
                      style={{
                        textAlign: 'center',
                        cursor: isFollowLoading ? 'not-allowed' : 'pointer',
                        opacity: isFollowLoading ? 0.6 : 1,
                        transition: 'opacity 0.2s ease',
                        minWidth: '65px',
                      }}
                      onClick={isFollowLoading ? undefined : handleToggleFollow}
                    >
                      <div style={{
                        fontSize: theme.fontSizes[3],
                        fontWeight: theme.fontWeights?.semibold ?? 600,
                        fontFamily: theme.fonts?.body,
                        color: isFollowing ? theme.colors.primary : theme.colors.text,
                        display: 'flex',
                        justifyContent: 'center',
                      }}>
                        {isFollowing ? <UserCheck size={24} /> : <UserPlus size={24} />}
                      </div>
                      <div style={{
                        fontSize: theme.fontSizes[0],
                        fontFamily: theme.fonts?.body,
                        color: theme.colors.textSecondary,
                        whiteSpace: 'nowrap',
                      }}>
                        {isFollowing ? 'following' : 'follow'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Name and Username */}
            <div>
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
                    onMouseEnter={(e) => { e.currentTarget.style.color = theme.colors.primary; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = theme.colors.textSecondary; }}
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
                        onMouseEnter={(e) => { e.currentTarget.style.color = theme.colors.primary; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = theme.colors.textSecondary; }}
                      >
                        {displayData.twitterHandle}
                      </button>
                    </div>
                  </>
                )}

                {/* Org avatars */}
                {userOrgs.length > 0 && (
                  <>
                    <span style={{ color: theme.colors.textSecondary, fontSize: theme.fontSizes[2] }}>•</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {userOrgs.map((org, i) => (
                        <div
                          key={org.id}
                          style={{ position: 'relative', cursor: 'pointer' }}
                          onMouseEnter={() => setHoveredOrgIndex(i)}
                          onMouseLeave={() => setHoveredOrgIndex(null)}
                          onClick={() => events.emit({
                            type: 'owner:selected',
                            source: 'user-profile-panel',
                            timestamp: Date.now(),
                            payload: { owner: org.login, isOrg: true },
                          })}
                        >
                          <img
                            src={org.avatar_url}
                            alt={org.login}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              border: `2px solid ${theme.colors.background}`,
                              objectFit: 'cover',
                              display: 'block',
                              transform: hoveredOrgIndex === i ? 'translateY(-3px)' : 'translateY(0)',
                              transition: 'transform 0.15s ease',
                            }}
                          />
                          {hoveredOrgIndex === i && (
                            <div style={{
                              position: 'absolute',
                              bottom: '100%',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              marginBottom: 4,
                              background: theme.colors.surface ?? theme.colors.background,
                              border: `1px solid ${theme.colors.border ?? theme.colors.textSecondary}`,
                              borderRadius: 4,
                              padding: '2px 6px',
                              fontSize: theme.fontSizes[1],
                              fontFamily: theme.fonts?.body,
                              color: theme.colors.text,
                              whiteSpace: 'nowrap',
                              pointerEvents: 'none',
                              zIndex: 100,
                            }}>
                              {org.login}
                            </div>
                          )}
                        </div>
                      ))}
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

          {/* Right column: pinned repos (wide mode only) */}
          {!isNarrow && pinnedRepoNames.length > 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: 60, minWidth: 0 }}>

            {/* Pinned repos */}
            {pinnedRepoNames.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, alignContent: 'flex-start' }}>
                {pinnedRepoNames.map((nameWithOwner) => {
                  const [owner, name] = nameWithOwner.split('/');
                  const repoData = repositories.find(
                    (r) => r.repoName === name && r.githubOwner === owner
                  );
                  return (
                    <div
                      key={nameWithOwner}
                      onClick={() => {
                        events.emit({
                          type: 'repository:selected',
                          source: 'UserProfilePanel',
                          timestamp: Date.now(),
                          payload: repoData
                            ? payloadFromRepoCard(repoData)
                            : payloadFromGithub({ owner: owner ?? '', name: name ?? nameWithOwner }),
                        });
                      }}
                      style={{
                        width: 'calc(50% - 4px)',
                        minWidth: 120,
                        padding: `${spacing.xs}px ${spacing.sm}px`,
                        borderRadius: 6,
                        border: `1px solid ${theme.colors.border ?? theme.colors.textSecondary + '40'}`,
                        backgroundColor: theme.colors.backgroundSecondary ?? theme.colors.background,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        boxSizing: 'border-box',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        fontSize: theme.fontSizes[1],
                        fontWeight: theme.fontWeights?.semibold ?? 600,
                        fontFamily: theme.fonts?.body,
                        color: theme.colors.primary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {name ?? nameWithOwner}
                      </div>
                      {repoData?.description && (
                        <div style={{
                          fontSize: theme.fontSizes[0],
                          fontFamily: theme.fonts?.body,
                          color: theme.colors.textSecondary,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          lineHeight: 1.3,
                        }}>
                          {repoData.description}
                        </div>
                      )}
                      {repoData?.language && (
                        <div style={{
                          fontSize: theme.fontSizes[0],
                          fontFamily: theme.fonts?.body,
                          color: theme.colors.textSecondary,
                          marginTop: 2,
                        }}>
                          {repoData.language}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}

        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: `1px solid ${theme.colors.border}`,
          padding: `0 ${spacing.md}px`,
          gap: spacing.md,
        }}
      >
        <button
          style={{
            background: 'none',
            border: 'none',
            padding: `${spacing.sm}px ${spacing.md}px`,
            fontSize: theme.fontSizes[2],
            fontFamily: theme.fonts?.body,
            fontWeight: theme.fontWeights?.semibold ?? 600,
            color: activeTab === 'overview' ? theme.colors.primary : theme.colors.textSecondary,
            borderBottom: activeTab === 'overview' ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            marginBottom: -1,
          }}
          onClick={() => setActiveTab('overview')}
          onMouseEnter={(e) => {
            if (activeTab !== 'overview') {
              e.currentTarget.style.color = theme.colors.text;
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'overview') {
              e.currentTarget.style.color = theme.colors.textSecondary;
            }
          }}
        >
          Projects
        </button>
        <button
          style={{
            background: 'none',
            border: 'none',
            padding: `${spacing.sm}px ${spacing.md}px`,
            fontSize: theme.fontSizes[2],
            fontFamily: theme.fonts?.body,
            fontWeight: theme.fontWeights?.semibold ?? 600,
            color: activeTab === 'activity' ? theme.colors.primary : theme.colors.textSecondary,
            borderBottom: activeTab === 'activity' ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            marginBottom: -1,
          }}
          onClick={() => setActiveTab('activity')}
          onMouseEnter={(e) => {
            if (activeTab !== 'activity') {
              e.currentTarget.style.color = theme.colors.text;
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'activity') {
              e.currentTarget.style.color = theme.colors.textSecondary;
            }
          }}
        >
          Activity
        </button>
        <button
          style={{
            background: 'none',
            border: 'none',
            padding: `${spacing.sm}px ${spacing.md}px`,
            fontSize: theme.fontSizes[2],
            fontFamily: theme.fonts?.body,
            fontWeight: theme.fontWeights?.semibold ?? 600,
            color: activeTab === 'collections' ? theme.colors.primary : theme.colors.textSecondary,
            borderBottom: activeTab === 'collections' ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            marginBottom: -1,
          }}
          onClick={() => setActiveTab('collections')}
          onMouseEnter={(e) => {
            if (activeTab !== 'collections') e.currentTarget.style.color = theme.colors.text;
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'collections') e.currentTarget.style.color = theme.colors.textSecondary;
          }}
        >
          Collections
        </button>
        {isNarrow && pinnedRepoNames.length > 0 && (
          <button
            style={{
              background: 'none',
              border: 'none',
              padding: `${spacing.sm}px ${spacing.md}px`,
              fontSize: theme.fontSizes[2],
              fontFamily: theme.fonts?.body,
              fontWeight: theme.fontWeights?.semibold ?? 600,
              color: activeTab === 'pinned' ? theme.colors.primary : theme.colors.textSecondary,
              borderBottom: activeTab === 'pinned' ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginBottom: -1,
            }}
            onClick={() => setActiveTab('pinned')}
            onMouseEnter={(e) => {
              if (activeTab !== 'pinned') e.currentTarget.style.color = theme.colors.text;
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'pinned') e.currentTarget.style.color = theme.colors.textSecondary;
            }}
          >
            Pinned
          </button>
        )}
      </div>

      {/* Scrollable content section */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: `0 ${spacing.md}px ${spacing.md}px`,
        }}
      >
        {/* Activity Tab */}
        {activeTab === 'activity' && userData && (
          <div style={{ marginTop: spacing.md, height: 600, display: 'flex', flexDirection: 'column' }}>
            <CommitActivityPanel
              source={{ kind: 'owner', login: userData.username, accountType: 'User' }}
              events={events}
              hideHeader
              actions={commitActivityActions}
            />
          </div>
        )}

        {/* Collections Tab */}
        {activeTab === 'collections' && userData && (
          <div style={{ marginTop: spacing.md }}>
            <OwnerCollectionsTab ownerLogin={userData.username} events={events} />
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && repositories.length > 0 && (
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
              Repositories
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
                      events.emit({
                        type: 'repository:selected',
                        source: 'UserProfilePanel',
                        timestamp: Date.now(),
                        payload: payloadFromRepoCard(repo),
                      });
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Pinned Tab (narrow mode only) */}
        {activeTab === 'pinned' && (
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
              Pinned repositories
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))',
                gap: spacing.md,
              }}
            >
              {pinnedRepoNames.map((nameWithOwner) => {
                const [owner, name] = nameWithOwner.split('/');
                const repo = repositories.find(
                  (r) => r.repoName === name && r.githubOwner === owner
                );
                if (!repo) return null;
                const fileTreeKey = nameWithOwner;
                const fileTree = fileTrees.get(fileTreeKey);
                return (
                  <RepoCard
                    key={nameWithOwner}
                    repo={repo}
                    fileTree={fileTree}
                    onClick={() => {
                      events.emit({
                        type: 'repository:selected',
                        source: 'UserProfilePanel',
                        timestamp: Date.now(),
                        payload: payloadFromRepoCard(repo),
                      });
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}
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
