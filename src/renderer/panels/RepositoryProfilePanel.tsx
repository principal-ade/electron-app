/**
 * RepositoryProfilePanel
 *
 * Displays a repository's profile with GitHub-style activity and information.
 * Features a Facebook-style layout with an owner avatar overlapping an activity heatmap banner.
 * Modeled after UserProfilePanel for visual consistency.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type {
  PanelContextValue,
  PanelActions,
  PanelEventEmitter,
} from '@principal-ade/panel-framework-core';
import {
  FolderGit2,
  GitCommit,
  FolderOpen,
  Trash2,
  Users,
} from 'lucide-react';
import { FileCity3D } from '@principal-ai/file-city-react';
import {
  buildCityDataFromFileTree,
  estimateLineCounts,
  enrichWithLineCounts,
  type CityData,
} from '@industry-theme/repository-composition-panels';
import type { FileTree } from '@principal-ai/repository-abstraction';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { GitService } from '../main-process-api/GitService';
import { GithubService } from '../main-process-api/GithubService';

export interface RepositoryProfileData {
  name: string;
  fullName: string; // e.g., "owner/repo"
  owner: string;
  ownerAvatarUrl?: string;
  ownerType?: 'User' | 'Organization'; // Type of owner
  description?: string;
  language?: string;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  size: number; // in KB
  activityData: Map<string, number>; // date -> commit count
  totalCommits: number;
  contributors?: number; // Number of contributors
  defaultBranch: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  htmlUrl?: string; // GitHub URL
  isPrivate: boolean;
  isLocal?: boolean; // Whether this is a local repository
  localPath?: string; // Local file system path
  github?: {
    owner: string;
    name: string;
  };
}

/**
 * Extended context for RepositoryProfilePanel
 * Only contains repository metadata - file trees are fetched via actions
 */
export interface RepositoryProfilePanelContext extends PanelContextValue {
  // Repository metadata is provided through currentScope
  // File trees are NOT in context - they're fetched by the panel using actions
}

/**
 * Extended actions for RepositoryProfilePanel
 */
export interface RepositoryProfilePanelActions extends PanelActions {
  /**
   * Get local file tree from working directory
   */
  getLocalFileTree: (repoPath: string) => Promise<FileTree | null>;

  /**
   * Get remote file tree from GitHub default branch
   */
  getRemoteFileTree: (owner: string, name: string) => Promise<FileTree | null>;

  /**
   * Get line counts for files in a local repository
   * Returns empty object for remote repositories
   */
  getLineCounts: (repoPath: string) => Promise<Record<string, number>>;

  /**
   * Open repository in dev workspace
   */
  openRepository: (entry: AlexandriaEntry) => Promise<void>;
}

interface RepositoryProfilePanelProps {
  context: RepositoryProfilePanelContext;
  actions: RepositoryProfilePanelActions;
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
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
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
 * Calculate repository age in human-readable format
 */
function getRepositoryAge(createdAt: string): string {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 30) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths !== 1 ? 's' : ''}`;
  }

  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears !== 1 ? 's' : ''}`;
}

/**
 * Get initials from repository name
 */
function getInitials(repoName: string): string {
  const parts = repoName.split(/[-_]/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return repoName.slice(0, 2).toUpperCase();
}

/**
 * Shorten path by replacing home directory with ~/
 * Works cross-platform by detecting common home directory patterns
 */
function shortenPath(fullPath: string): string {
  // Try to detect and replace home directory with ~/
  // Common patterns: /Users/username (macOS), /home/username (Linux), C:\Users\username (Windows)

  // macOS and Linux
  const unixHomeMatch = fullPath.match(/^(\/Users\/[^/]+|\/home\/[^/]+)(\/.*)?$/);
  if (unixHomeMatch) {
    const rest = unixHomeMatch[2] || '';
    return `~${rest}`;
  }

  // Windows
  const windowsHomeMatch = fullPath.match(/^([A-Z]:\\Users\\[^\\]+)(\\.*)?$/i);
  if (windowsHomeMatch) {
    const rest = windowsHomeMatch[2] || '';
    return `~${rest}`;
  }

  return fullPath;
}

export const RepositoryProfilePanel: React.FC<RepositoryProfilePanelProps> = ({
  context,
  actions,
  events,
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

  const borderRadius = theme.radii?.[1] || 4;

  // Read repository from context
  const repositoryData = context.currentScope?.repository as RepositoryProfileData | undefined;

  // State for file trees (fetched via actions)
  const [localFileTree, setLocalFileTree] = useState<FileTree | null>(null);
  const [remoteFileTree, setRemoteFileTree] = useState<FileTree | null>(null);
  const [fileTreesError, setFileTreesError] = useState<string | null>(null);

  // State for 3D city data (derived from file trees)
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [cityDataLoading, setCityDataLoading] = useState(false);

  // State for contributors list
  const [showContributors, setShowContributors] = useState(false);
  const [contributors, setContributors] = useState<Array<{ name: string; commits: number }>>([]);
  const [contributorsLoading, setContributorsLoading] = useState(false);

  // Fetch file trees when repository changes
  useEffect(() => {
    let cancelled = false;

    const fetchFileTrees = async () => {
      if (!repositoryData) {
        setLocalFileTree(null);
        setRemoteFileTree(null);
        setFileTreesError(null);
        setCityData(null);
        setCityDataLoading(false);
        // Reset contributors
        setShowContributors(false);
        setContributors([]);
        return;
      }

      setFileTreesError(null);
      setCityDataLoading(true);

      try {
        const promises: Promise<void>[] = [];

        // Fetch local file tree if repository has a local path
        if (repositoryData.localPath) {
          promises.push(
            actions.getLocalFileTree(repositoryData.localPath)
              .then(tree => {
                if (!cancelled) setLocalFileTree(tree);
              })
              .catch(error => {
                console.error('[RepositoryProfilePanel] Failed to fetch local file tree:', error);
                if (!cancelled) setFileTreesError(error.message);
              })
          );
        }

        // Fetch remote file tree if repository has GitHub info
        if (repositoryData.github) {
          promises.push(
            actions.getRemoteFileTree(repositoryData.github.owner, repositoryData.github.name)
              .then(tree => {
                if (!cancelled) setRemoteFileTree(tree);
              })
              .catch(error => {
                console.error('[RepositoryProfilePanel] Failed to fetch remote file tree:', error);
                // Don't set error for remote failures - it's less critical
              })
          );
        }

        await Promise.all(promises);
      } catch (error) {
        console.error('[RepositoryProfilePanel] Failed to fetch file trees:', error);
        if (!cancelled) {
          setFileTreesError(error instanceof Error ? error.message : String(error));
          setCityDataLoading(false);
        }
      }
    };

    fetchFileTrees();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repositoryData?.localPath, repositoryData?.github, actions]);

  // Build city data from file trees
  useEffect(() => {
    let cancelled = false;

    const buildCityData = async () => {
      // Use local file tree if available, otherwise use remote
      const fileTree = localFileTree || remoteFileTree;
      if (!fileTree) {
        setCityData(null);
        // Don't set loading to false here - let the file tree fetch handle it
        return;
      }

      // Loading state is already set by file tree fetch effect

      try {
        // Build city data from file tree
        const rootPath = fileTree.metadata?.id || '';
        const rawCityData = buildCityDataFromFileTree(fileTree, rootPath);

        // Get actual line counts if this is a local repository
        let finalCityData: CityData;
        if (repositoryData?.localPath) {
          try {
            const rawLineCounts = await actions.getLineCounts(repositoryData.localPath);

            // Transform line counts to use the correct rootPath prefix
            const repoName = repositoryData.localPath.split('/').pop() || '';
            const lineCounts: Record<string, number> = {};
            for (const [filePath, count] of Object.entries(rawLineCounts)) {
              if (typeof count !== 'number' || count < 0) continue;

              if (filePath.startsWith(repoName + '/')) {
                const relativePath = filePath.slice(repoName.length + 1);
                lineCounts[`${rootPath}/${relativePath}`] = count;
              } else {
                lineCounts[`${rootPath}/${filePath}`] = count;
              }
            }

            const enrichedCityData = enrichWithLineCounts(rawCityData, lineCounts);
            finalCityData = estimateLineCounts(enrichedCityData);
          } catch (error) {
            console.error('[RepositoryProfilePanel] Failed to get line counts:', error);
            finalCityData = estimateLineCounts(rawCityData);
          }
        } else {
          // Remote repository - use estimated line counts
          finalCityData = estimateLineCounts(rawCityData);
        }

        if (!cancelled) {
          setCityData(finalCityData);
          setCityDataLoading(false);
        }
      } catch (error) {
        console.error('[RepositoryProfilePanel] Failed to build city data:', error);
        if (!cancelled) {
          setCityData(null);
          setCityDataLoading(false);
        }
      }
    };

    buildCityData();

    return () => {
      cancelled = true;
    };
  }, [localFileTree, remoteFileTree, repositoryData?.localPath, actions]);

  // Handle open repository
  const handleOpenRepository = async () => {
    if (repositoryData && repositoryData.localPath) {
      // Convert RepositoryProfileData to AlexandriaEntry format
      const repositoryEntry = {
        name: repositoryData.name,
        path: repositoryData.localPath,
        remoteUrl: repositoryData.htmlUrl || '',
        registeredAt: repositoryData.createdAt,
        hasViews: false,
        viewCount: 0,
        views: [],
        github: repositoryData.github ? {
          id: `${repositoryData.github.owner}/${repositoryData.github.name}`,
          owner: repositoryData.github.owner,
          name: repositoryData.github.name,
          stars: repositoryData.stars || 0,
          description: repositoryData.description,
          primaryLanguage: repositoryData.language,
          lastUpdated: repositoryData.updatedAt,
        } : undefined,
      } as unknown as AlexandriaEntry;

      // Call the action to open the repository
      await actions.openRepository(repositoryEntry);
    }
  };

  // Handle delete repository
  const handleDeleteRepository = () => {
    if (repositoryData) {
      events.emit({
        type: 'repository-profile:delete-requested',
        source: 'repository-profile-panel',
        timestamp: Date.now(),
        payload: { repository: repositoryData },
      });
    }
  };

  // Handle owner avatar click to open profile
  const handleOwnerClick = () => {
    if (repositoryData && repositoryData.owner !== 'local') {
      const isOrg = repositoryData.ownerType === 'Organization';
      console.log('[RepositoryProfilePanel] Owner clicked:', repositoryData.owner, 'isOrg:', isOrg);
      events.emit({
        type: 'feed:owner-selected',
        source: 'repository-profile-panel',
        timestamp: Date.now(),
        payload: {
          owner: repositoryData.owner,
          isOrg,
        },
      });
    }
  };

  // Handle contributors stat click
  const handleContributorsClick = async () => {
    // Check if we have either local path or GitHub info
    if (!repositoryData?.localPath && !repositoryData?.github) return;

    if (showContributors) {
      // Toggle off
      setShowContributors(false);
      return;
    }

    // Fetch contributors if not already loaded
    if (contributors.length === 0) {
      setContributorsLoading(true);
      try {
        let contributorsList: Array<{ name: string; commits: number }> = [];

        if (repositoryData.localPath) {
          // Local repository - use git
          contributorsList = await GitService.getContributors(repositoryData.localPath);
        } else if (repositoryData.github?.owner && repositoryData.github?.name) {
          // Remote repository - use GitHub API
          const githubContributors = await GithubService.getRepositoryContributors(
            repositoryData.github.owner,
            repositoryData.github.name
          );
          contributorsList = githubContributors.map(c => ({
            name: c.login,
            commits: c.contributions,
          }));
        }

        setContributors(contributorsList);
        setShowContributors(true);
      } catch (error) {
        console.warn('[RepositoryProfilePanel] Failed to fetch contributors:', error);
      } finally {
        setContributorsLoading(false);
      }
    } else {
      setShowContributors(true);
    }
  };

  // Empty state - no repository selected
  if (!repositoryData) {
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
        <FolderGit2 size={48} style={{ marginBottom: spacing.md, opacity: 0.5 }} />
        <p style={{
          margin: 0,
          fontSize: theme.fontSizes[2],
          fontFamily: theme.fonts?.body
        }}>
          No repository selected
        </p>
        <p style={{
          margin: `${spacing.xs}px 0 0`,
          fontSize: theme.fontSizes[1],
          fontFamily: theme.fonts?.body
        }}>
          Select a repository to view its profile
        </p>
      </div>
    );
  }

  // Error state
  if (fileTreesError) {
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
          Failed to load repository
        </p>
        <p
          style={{
            margin: `${spacing.xs}px 0 0`,
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            fontFamily: theme.fonts?.body,
          }}
        >
          {fileTreesError}
        </p>
      </div>
    );
  }

  const initials = getInitials(repositoryData.name);

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
      {/* Top Section - Scrollable Profile Info */}
      <div style={{ flex: '0 1 auto', overflow: 'auto' }}>
        {/* Banner with Activity Heatmap */}
        <div
          style={{
            position: 'relative',
            height: 170,
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <ActivityHeatmap
            activityData={repositoryData.activityData || new Map()}
            theme={theme}
            bannerHeight={170}
          />
        </div>

        {/* Profile Content */}
        <div style={{ padding: spacing.md, marginTop: -60, position: 'relative' }}>
        {/* Avatar Section - positioned to overlap banner */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: spacing.md, marginBottom: spacing.md }}>
          {/* Owner Avatar */}
          <div
            onClick={handleOwnerClick}
            title={repositoryData.owner !== 'local' ? `View ${repositoryData.owner}'s profile` : undefined}
            style={{
              width: 120,
              height: 120,
              borderRadius: repositoryData.ownerType === 'Organization' ? '12px' : '50%',
              backgroundColor: theme.colors.backgroundSecondary,
              border: `4px solid ${theme.colors.background}`,
              overflow: 'hidden',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              cursor: repositoryData.owner !== 'local' ? 'pointer' : 'default',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (repositoryData.owner !== 'local') {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (repositoryData.owner !== 'local') {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
              }
            }}
          >
            {repositoryData.ownerAvatarUrl ? (
              <img
                src={repositoryData.ownerAvatarUrl}
                alt={repositoryData.owner}
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

          {/* Stats and Action Buttons - aligned with bottom of avatar */}
          <div style={{ flex: 1, paddingBottom: spacing.xs, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: spacing.lg, flexWrap: 'wrap' }}>
              {repositoryData.contributors !== undefined && (
                <div
                  style={{ textAlign: 'center', cursor: 'pointer', transition: 'opacity 0.2s ease' }}
                  onClick={handleContributorsClick}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.7';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                  title="Click to view contributors"
                >
                  <div style={{
                    fontSize: theme.fontSizes[3],
                    fontWeight: theme.fontWeights?.semibold ?? 600,
                    fontFamily: theme.fonts?.body,
                    color: theme.colors.text
                  }}>
                    {formatNumber(repositoryData.contributors)}
                  </div>
                  <div style={{
                    fontSize: theme.fontSizes[0],
                    fontFamily: theme.fonts?.body,
                    color: theme.colors.textSecondary
                  }}>
                    devs
                  </div>
                </div>
              )}
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: theme.fontSizes[3],
                  fontWeight: theme.fontWeights?.semibold ?? 600,
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.text
                }}>
                  {formatNumber(repositoryData.totalCommits)}
                </div>
                <div style={{
                  fontSize: theme.fontSizes[0],
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.textSecondary
                }}>
                  commits
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: theme.fontSizes[3],
                  fontWeight: theme.fontWeights?.semibold ?? 600,
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.text
                }}>
                  {getRepositoryAge(repositoryData.createdAt)}
                </div>
                <div style={{
                  fontSize: theme.fontSizes[0],
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.textSecondary
                }}>
                  old
                </div>
              </div>
            </div>

            {/* Action Buttons (for local repos) - right aligned */}
            {repositoryData.isLocal && (
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                <button
                  onClick={handleOpenRepository}
                  title="Open in workspace"
                  style={{
                    padding: `${spacing.xs}px ${spacing.sm}px`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: borderRadius,
                    background: theme.colors.primary,
                    color: theme.colors.background,
                    cursor: 'pointer',
                    transition: 'opacity 0.2s ease',
                    fontSize: theme.fontSizes[1],
                    fontFamily: theme.fonts?.body,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  <FolderOpen size={14} />
                  Open
                </button>
                <button
                  onClick={handleDeleteRepository}
                  title="Delete repository"
                  style={{
                    padding: `${spacing.xs}px ${spacing.sm}px`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs,
                    border: `1px solid ${theme.colors.error}`,
                    borderRadius: borderRadius,
                    background: 'transparent',
                    color: theme.colors.error,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontSize: theme.fontSizes[1],
                    fontFamily: theme.fonts?.body,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.error;
                    e.currentTarget.style.color = theme.colors.background;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = theme.colors.error;
                  }}
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Repository Name and Local Path */}
        <div style={{ marginBottom: spacing.md }}>
          <h2
            style={{
              margin: 0,
              fontSize: theme.fontSizes[4],
              fontWeight: theme.fontWeights?.semibold ?? 600,
              fontFamily: theme.fonts?.heading ?? theme.fonts?.body,
              color: theme.colors.text,
            }}
          >
            {repositoryData.name}
          </h2>
          {repositoryData.localPath && (
            <div
              style={{
                fontSize: theme.fontSizes[2],
                fontFamily: theme.fonts?.body,
                color: theme.colors.textSecondary,
                marginTop: spacing.xs,
              }}
            >
              {shortenPath(repositoryData.localPath)}
            </div>
          )}
        </div>

        {/* Description */}
        {repositoryData.description && (
          <p
            style={{
              margin: `0 0 ${spacing.md}px`,
              fontSize: theme.fontSizes[1],
              fontFamily: theme.fonts?.body,
              lineHeight: theme.lineHeights?.body ?? 1.5,
              color: theme.colors.text,
            }}
          >
            {repositoryData.description}
          </p>
        )}
        </div>
      </div>

      {/* Bottom Section - Stats and File City 3D (fills remaining height) */}
      <div style={{ flex: 1, display: 'flex', gap: spacing.md, padding: spacing.md, overflow: 'hidden' }}>
          {/* Repository Stats - Left */}
          <section
            style={{
              flex: 1,
              minWidth: 0,
              padding: spacing.md,
              background: theme.colors.backgroundSecondary,
              borderRadius: theme.radii?.[2] || 8,
              border: `1px solid ${theme.colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'auto',
            }}
          >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.xs,
                  marginBottom: spacing.md,
                }}
              >
                {showContributors ? (
                  <Users size={16} color={theme.colors.primary} />
                ) : (
                  <GitCommit size={16} color={theme.colors.primary} />
                )}
                <h4
                  style={{
                    margin: 0,
                    fontSize: theme.fontSizes[2],
                    fontWeight: 600,
                    color: theme.colors.text,
                    fontFamily: theme.fonts?.body,
                  }}
                >
                  {showContributors ? 'Contributors' : 'Repository Stats'}
                </h4>
                {showContributors && (
                  <button
                    onClick={() => setShowContributors(false)}
                    style={{
                      marginLeft: 'auto',
                      padding: `${spacing.xs}px ${spacing.sm}px`,
                      fontSize: theme.fontSizes[0],
                      fontFamily: theme.fonts?.body,
                      color: theme.colors.textSecondary,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'color 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = theme.colors.text;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = theme.colors.textSecondary;
                    }}
                  >
                    Back to Stats
                  </button>
                )}
              </div>

              {contributorsLoading ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: spacing.lg,
                  color: theme.colors.textSecondary,
                }}>
                  Loading contributors...
                </div>
              ) : showContributors ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, flex: 1, overflow: 'auto' }}>
                  {contributors.map((contributor, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: spacing.sm,
                        backgroundColor: theme.colors.background,
                        borderRadius: theme.radii?.[1] || 4,
                        fontSize: theme.fontSizes[1],
                        fontFamily: theme.fonts?.body,
                      }}
                    >
                      <span style={{ color: theme.colors.text, flex: 1 }}>
                        {contributor.name}
                      </span>
                      <span style={{
                        color: theme.colors.textSecondary,
                        fontSize: theme.fontSizes[0],
                        minWidth: '60px',
                        textAlign: 'right',
                      }}>
                        {formatNumber(contributor.commits)} commit{contributor.commits !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
                {/* Total Commits */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
                  <span
                    style={{
                      fontSize: theme.fontSizes[1],
                      fontWeight: 500,
                      color: theme.colors.textSecondary,
                      fontFamily: theme.fonts?.body,
                    }}
                  >
                    Total Commits:
                  </span>
                  <span
                    style={{
                      fontSize: theme.fontSizes[4],
                      fontWeight: theme.fontWeights?.semibold ?? 600,
                      color: theme.colors.text,
                      fontFamily: theme.fonts?.body,
                    }}
                  >
                    {formatNumber(repositoryData.totalCommits)}
                  </span>
                </div>

                {/* Last Updated */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
                  <span
                    style={{
                      fontSize: theme.fontSizes[1],
                      fontWeight: 500,
                      color: theme.colors.textSecondary,
                      fontFamily: theme.fonts?.body,
                    }}
                  >
                    Last Updated:
                  </span>
                  <span
                    style={{
                      fontSize: theme.fontSizes[2],
                      color: theme.colors.text,
                      fontFamily: theme.fonts?.body,
                    }}
                  >
                    {new Date(repositoryData.updatedAt).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                {/* Open Issues (if any) */}
                {repositoryData.openIssues > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
                    <span
                      style={{
                        fontSize: theme.fontSizes[1],
                        fontWeight: 500,
                        color: theme.colors.textSecondary,
                        fontFamily: theme.fonts?.body,
                      }}
                    >
                      Open Issues:
                    </span>
                    <span
                      style={{
                        fontSize: theme.fontSizes[2],
                        color: theme.colors.text,
                        fontFamily: theme.fonts?.body,
                      }}
                    >
                      {formatNumber(repositoryData.openIssues)}
                    </span>
                  </div>
                )}

                {/* Activity Indicator */}
                <div
                  style={{
                    marginTop: 'auto',
                    paddingTop: spacing.md,
                    borderTop: `1px solid ${theme.colors.border}`,
                    fontSize: theme.fontSizes[1],
                    color: theme.colors.textSecondary,
                    fontFamily: theme.fonts?.body,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: theme.colors.success,
                      }}
                    />
                    <span>Active repository</span>
                  </div>
                </div>
              </div>
              )}
            </section>

        {/* File City 3D - Right */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            borderRadius: theme.radii?.[2] || 8,
            overflow: 'hidden',
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.backgroundSecondary,
          }}
        >
          {cityData && !cityDataLoading ? (
            <FileCity3D
              cityData={cityData}
              width="100%"
              height="100%"
              showControls={true}
              heightScaling="linear"
              linearScale={0.5}
              animation={{ startFlat: true, autoStartDelay: null }}
              backgroundColor={theme.colors.backgroundSecondary}
              style={{
                width: '100%',
                height: '100%',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.colors.textSecondary,
              }}
            >
              {cityDataLoading ? 'Loading 3D city...' : 'No city data available'}
            </div>
          )}
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

export default RepositoryProfilePanel;
