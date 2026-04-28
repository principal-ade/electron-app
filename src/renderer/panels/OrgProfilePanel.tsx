/**
 * OrgProfilePanel
 *
 * Displays an organization's profile with GitHub-style activity and information.
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
  Building2,
  Twitter,
  Github,
  Eye,
  EyeClosed,
} from 'lucide-react';
import { RepoCard, type RepoCardData } from './RepoCard';
import { OwnerCollectionsTab } from './OwnerCollectionsTab';
import type { FileTree } from '@principal-ai/repository-abstraction';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { GitHubOrgMember } from '../../shared/main-process-api-interfaces/GitHubAPI';

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
  getOrgMembers?: (orgName: string) => Promise<GitHubOrgMember[]>;

  /**
   * Check if organization is watched (orgs are watched as users)
   */
  isOrgWatched?: (orgName: string) => Promise<boolean>;

  /**
   * Watch a GitHub organization (optional)
   */
  watchOrg?: (orgName: string) => Promise<void>;

  /**
   * Unwatch a GitHub organization (optional)
   */
  unwatchOrg?: (orgName: string) => Promise<void>;

  /**
   * Get pinned repositories for the organization (optional)
   */
  getPinnedRepositories?: (username: string) => Promise<string[]>;
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

  // Repositories state
  const [repositories, setRepositories] = useState<RepoCardData[]>([]);
  const [_repositoriesLoading, setRepositoriesLoading] = useState(false);

  // File trees for repositories (lazy loaded)
  const [fileTrees, setFileTrees] = useState<Map<string, FileTree | null>>(new Map());

  // Watch state
  const [isWatched, setIsWatched] = useState(false);
  const [isWatchLoading, setIsWatchLoading] = useState(false);

  // Member avatars
  const [members, setMembers] = useState<GitHubOrgMember[]>([]);
  const [hoveredMemberIndex, setHoveredMemberIndex] = useState<number | null>(null);

  // Pinned repos and responsive layout
  const PINNED_COLUMN_MIN_WIDTH = 900;
  const containerRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState<number>(0);
  const [pinnedRepoNames, setPinnedRepoNames] = useState<string[]>([]);
  type OrgTab = 'repositories' | 'pinned' | 'collections';
  const [activeTab, setActiveTab] = useState<OrgTab>('repositories');

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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setPanelWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (panelWidth >= PINNED_COLUMN_MIN_WIDTH && activeTab === 'pinned') {
      setActiveTab('repositories');
    }
  }, [panelWidth, activeTab]);

  useEffect(() => {
    if (!org || !actions.getPinnedRepositories) {
      setPinnedRepoNames([]);
      return;
    }
    let cancelled = false;
    actions.getPinnedRepositories(org.orgName).then((names) => {
      if (!cancelled) setPinnedRepoNames(names);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [org, actions]);

  // Fetch profile when org changes
  useEffect(() => {
    if (!org) {
      setOrgData(null);
      return;
    }

    let cancelled = false;

    const fetchProfile = async () => {
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
          setRepositories(repos);
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

  // Load member avatars when org changes
  useEffect(() => {
    if (!org || !actions.getOrgMembers) {
      setMembers([]);
      return;
    }

    let cancelled = false;

    actions.getOrgMembers(org.orgName)
      .then((result) => {
        if (!cancelled) setMembers(result.slice(0, 8));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [org, actions]);

  // Load watch status when org changes
  useEffect(() => {
    if (!org || !actions.isOrgWatched) {
      setIsWatched(false);
      return;
    }

    let cancelled = false;

    const loadWatchStatus = async () => {
      try {
        if (!actions.isOrgWatched) {
          return;
        }
        const watched = await actions.isOrgWatched(org.orgName);
        if (!cancelled) {
          setIsWatched(watched);
        }
      } catch (err) {
        console.error('Failed to load watch status:', err);
      }
    };

    loadWatchStatus();

    return () => {
      cancelled = true;
    };
  }, [org, actions]);

  // Handle open in browser - emit event instead
  const handleOpenUrl = (url: string, type: 'website' | 'twitter' | 'github' | 'email') => {
    events.emit({
      type: 'org-profile:open-link',
      source: 'OrgProfilePanel',
      timestamp: Date.now(),
      payload: { url, type },
    });
  };

  // Handle watch/unwatch organization
  const handleToggleWatch = async () => {
    if (!org) return;

    // Check if actions are available
    if (!actions.watchOrg || !actions.unwatchOrg) {
      console.warn('Watch actions not available');
      return;
    }

    setIsWatchLoading(true);
    try {
      if (isWatched) {
        await actions.unwatchOrg(org.orgName);
        setIsWatched(false);
        // Emit specific event for watch toggle
        events.emit({
          type: 'watch:user-toggled',
          source: 'org-profile-panel',
          timestamp: Date.now(),
          payload: { username: org.orgName, watched: false, accountType: 'Organization' as const },
        });
      } else {
        await actions.watchOrg(org.orgName);
        setIsWatched(true);
        // Emit specific event for watch toggle
        events.emit({
          type: 'watch:user-toggled',
          source: 'org-profile-panel',
          timestamp: Date.now(),
          payload: { username: org.orgName, watched: true, accountType: 'Organization' as const },
        });
      }
    } catch (err) {
      console.error('Failed to toggle watch:', err);
    } finally {
      setIsWatchLoading(false);
    }
  };

  // Empty state - no org selected
  if (!org) {
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

  // Create a display object that uses orgData if available, or empty values as fallback
  const displayData: OrgProfileData = orgData || {
    orgName: org.orgName,
    name: undefined,
    email: undefined,
    avatarUrl: undefined,
    description: undefined,
    location: undefined,
    twitterHandle: undefined,
    websiteUrl: undefined,
    activityData: new Map(),
    totalCommits: 0,
    publicRepos: 0,
    members: 0,
    createdDate: new Date().toISOString(),
  };

  const initials = getInitials(displayData.name, displayData.orgName);
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
        <ActivityHeatmap activityData={displayData.activityData} theme={theme} bannerHeight={170} />
      </div>

      {/* Profile Header - Fixed, no scroll */}
      <div style={{ padding: spacing.md, marginTop: -60, position: 'relative', flexShrink: 0, display: 'flex', gap: spacing.md, alignItems: 'stretch' }}>
        {/* Left column */}
        <div style={{ flexShrink: 0 }}>
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
            {displayData.avatarUrl ? (
              <img
                src={displayData.avatarUrl}
                alt={displayData.orgName}
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
                  color: theme.colors.text,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '24px',
                }}>
                  {formatNumber(displayData.publicRepos)}
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
                  color: theme.colors.text,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '24px',
                }}>
                  {formatNumber(displayData.members)}
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
                  color: theme.colors.text,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '24px',
                }}>
                  {formatNumber(displayData.totalCommits)}
                </div>
                <div style={{
                  fontSize: theme.fontSizes[0],
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.textSecondary
                }}>
                  commits
                </div>
              </div>

              {/* Watch Button */}
              <div
                style={{
                  textAlign: 'center',
                  cursor: isWatchLoading ? 'not-allowed' : 'pointer',
                  opacity: isWatchLoading ? 0.6 : 1,
                  transition: 'opacity 0.2s ease',
                  minWidth: '65px',
                }}
                onClick={isWatchLoading ? undefined : handleToggleWatch}
              >
                <div style={{
                  fontSize: theme.fontSizes[3],
                  fontWeight: theme.fontWeights?.semibold ?? 600,
                  fontFamily: theme.fonts?.body,
                  color: isWatched ? theme.colors.primary : theme.colors.text,
                  display: 'flex',
                  justifyContent: 'center',
                }}>
                  {isWatched ? <Eye size={24} /> : <EyeClosed size={24} />}
                </div>
                <div style={{
                  fontSize: theme.fontSizes[0],
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.textSecondary,
                  whiteSpace: 'nowrap',
                }}>
                  {isWatched ? 'watching' : 'watch'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Name and Organization Name */}
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
                onClick={() => handleOpenUrl(`https://github.com/${displayData.orgName}`, 'github')}
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
                {displayData.orgName}
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

            {/* Member avatars */}
            {members.length > 0 && (
              <>
                <span style={{ color: theme.colors.textSecondary, fontSize: theme.fontSizes[2] }}>•</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {members.map((member, i) => (
                  <div
                    key={member.id}
                    style={{
                      position: 'relative',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={() => setHoveredMemberIndex(i)}
                    onMouseLeave={() => setHoveredMemberIndex(null)}
                    onClick={() => events.emit({
                      type: 'user:profile-selected',
                      source: 'org-profile-panel',
                      timestamp: Date.now(),
                      payload: { username: member.login },
                    })}
                  >
                    <img
                      src={member.avatar_url}
                      alt={member.login}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        border: `2px solid ${theme.colors.background}`,
                        objectFit: 'cover',
                        display: 'block',
                        transform: hoveredMemberIndex === i ? 'translateY(-3px)' : 'translateY(0)',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                    {hoveredMemberIndex === i && (
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
                        {member.login}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              </>
            )}
          </div>
        </div>

        {/* Description */}
        {displayData.description && (
          <p
            style={{
              margin: `0 0 ${spacing.md}px`,
              fontSize: theme.fontSizes[1],
              fontFamily: theme.fonts?.body,
              lineHeight: theme.lineHeights?.body ?? 1.5,
              color: theme.colors.text,
            }}
          >
            {displayData.description}
          </p>
        )}
        </div>

        {/* Right column: pinned repos (wide mode only) */}
        {!isNarrow && pinnedRepoNames.length > 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: 60, minWidth: 0 }}>
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
                      const repositoryEntry: AlexandriaEntry = repoData?.alexandriaEntry || ({
                        path: repoData?.repoPath || '',
                        name: name ?? nameWithOwner,
                        remoteUrl: `https://github.com/${owner}/${name}.git`,
                        registeredAt: repoData?.createdAt || new Date().toISOString(),
                        hasViews: false,
                        viewCount: 0,
                        views: [],
                        github: {
                          id: nameWithOwner,
                          owner: owner ?? '',
                          name: name ?? nameWithOwner,
                          stars: repoData?.stars || 0,
                          description: repoData?.description,
                          primaryLanguage: repoData?.language,
                          lastUpdated: new Date().toISOString(),
                        },
                      } as unknown as AlexandriaEntry);
                      events.emit({
                        type: 'feed:repository-selected',
                        source: 'OrgProfilePanel',
                        timestamp: Date.now(),
                        payload: { repository: repositoryEntry },
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
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: `1px solid ${theme.colors.border}`,
        padding: `0 ${spacing.md}px`,
        gap: spacing.md,
        flexShrink: 0,
      }}>
        <button
          style={{
            background: 'none',
            border: 'none',
            padding: `${spacing.sm}px ${spacing.md}px`,
            fontSize: theme.fontSizes[2],
            fontFamily: theme.fonts?.body,
            fontWeight: theme.fontWeights?.semibold ?? 600,
            color: activeTab === 'repositories' ? theme.colors.primary : theme.colors.textSecondary,
            borderBottom: activeTab === 'repositories' ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            marginBottom: -1,
          }}
          onClick={() => setActiveTab('repositories')}
          onMouseEnter={(e) => { if (activeTab !== 'repositories') e.currentTarget.style.color = theme.colors.text; }}
          onMouseLeave={(e) => { if (activeTab !== 'repositories') e.currentTarget.style.color = theme.colors.textSecondary; }}
        >
          Repositories
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
          onMouseEnter={(e) => { if (activeTab !== 'collections') e.currentTarget.style.color = theme.colors.text; }}
          onMouseLeave={(e) => { if (activeTab !== 'collections') e.currentTarget.style.color = theme.colors.textSecondary; }}
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
            onMouseEnter={(e) => { if (activeTab !== 'pinned') e.currentTarget.style.color = theme.colors.text; }}
            onMouseLeave={(e) => { if (activeTab !== 'pinned') e.currentTarget.style.color = theme.colors.textSecondary; }}
          >
            Pinned
          </button>
        )}
      </div>

      {/* Pinned tab content (narrow only) */}
      {isNarrow && activeTab === 'pinned' && pinnedRepoNames.length > 0 && (
        <div style={{ flex: 1, overflow: 'auto', padding: `0 ${spacing.md}px ${spacing.md}px` }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md, alignContent: 'flex-start' }}>
            {pinnedRepoNames.map((nameWithOwner) => {
              const [owner, name] = nameWithOwner.split('/');
              const repoData = repositories.find(
                (r) => r.repoName === name && r.githubOwner === owner
              );
              return (
                <div
                  key={nameWithOwner}
                  onClick={() => {
                    const repositoryEntry: AlexandriaEntry = repoData?.alexandriaEntry || ({
                      path: repoData?.repoPath || '',
                      name: name ?? nameWithOwner,
                      remoteUrl: `https://github.com/${owner}/${name}.git`,
                      registeredAt: repoData?.createdAt || new Date().toISOString(),
                      hasViews: false,
                      viewCount: 0,
                      views: [],
                      github: {
                        id: nameWithOwner,
                        owner: owner ?? '',
                        name: name ?? nameWithOwner,
                        stars: repoData?.stars || 0,
                        description: repoData?.description,
                        primaryLanguage: repoData?.language,
                        lastUpdated: new Date().toISOString(),
                      },
                    } as unknown as AlexandriaEntry);
                    events.emit({
                      type: 'feed:repository-selected',
                      source: 'OrgProfilePanel',
                      timestamp: Date.now(),
                      payload: { repository: repositoryEntry },
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
        </div>
      )}

      {/* Repositories Grid - Scrollable section */}
      {activeTab === 'repositories' && repositories.length > 0 && (
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
                        source: 'OrgProfilePanel',
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

      {/* Collections Tab - Scrollable section */}
      {activeTab === 'collections' && org && (
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: `${spacing.md}px`,
          }}
        >
          <OwnerCollectionsTab ownerLogin={org.orgName} events={events} />
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
