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
  Code,
  Calendar,
  HardDrive,
  ExternalLink,
  GitCommit,
  FolderOpen,
  Trash2,
} from 'lucide-react';
import { FileCity3D } from '@principal-ai/file-city-react';
import {
  buildCityDataFromFileTree,
  estimateLineCounts,
  enrichWithLineCounts,
  type CityData,
} from '@industry-theme/repository-composition-panels';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';

export interface RepositoryProfileData {
  name: string;
  fullName: string; // e.g., "owner/repo"
  owner: string;
  ownerAvatarUrl?: string;
  description?: string;
  language?: string;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  size: number; // in KB
  activityData: Map<string, number>; // date -> commit count
  totalCommits: number;
  defaultBranch: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  htmlUrl?: string; // GitHub URL
  isPrivate: boolean;
  isLocal?: boolean; // Whether this is a local repository
  localPath?: string; // Local file system path
  fileCityImageUrl?: string;
}

interface RepositoryProfilePanelProps {
  context: PanelContextValue;
  actions: PanelActions;
  events: PanelEventEmitter;
  repositoryData?: RepositoryProfileData;
  loading?: boolean;
  error?: string;
  onOpenRepository?: () => void;
  onDeleteRepository?: () => void;
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
 * Format size in bytes to human-readable
 */
function formatSize(sizeInKB: number): string {
  if (sizeInKB >= 1024 * 1024) {
    return `${(sizeInKB / (1024 * 1024)).toFixed(1)} GB`;
  }
  if (sizeInKB >= 1024) {
    return `${(sizeInKB / 1024).toFixed(1)} MB`;
  }
  return `${sizeInKB} KB`;
}

/**
 * Format date to readable string
 */
function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
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

export const RepositoryProfilePanel: React.FC<RepositoryProfilePanelProps> = ({
  context: _context,
  actions: _actions,
  events: _events,
  repositoryData,
  loading = false,
  error,
  onOpenRepository,
  onDeleteRepository,
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

  // State for 3D city data
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [cityDataLoading, setCityDataLoading] = useState(false);

  // Build city data from file tree when repository changes
  useEffect(() => {
    let cancelled = false;

    const buildCityData = async () => {
      const repoPath = repositoryData?.localPath;
      if (!repoPath) {
        setCityData(null);
        return;
      }

      setCityDataLoading(true);

      try {
        // Get file tree from repository monitoring service
        const fileTree = await RepositoryMonitoringService.getFileTree(repoPath);
        if (!fileTree || cancelled) {
          setCityDataLoading(false);
          return;
        }

        // Build city data from file tree
        const rootPath = fileTree.metadata?.id || '';
        const rawCityData = buildCityDataFromFileTree(fileTree, rootPath);

        // Get actual line counts from main process
        let finalCityData: CityData;
        try {
          if (window.mainProcess?.fileCityImage?.countLines) {
            const rawLineCounts = await window.mainProcess.fileCityImage.countLines(repoPath);

            // Transform line counts to use the correct rootPath prefix
            const repoName = repoPath.split('/').pop() || '';
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
          } else {
            finalCityData = estimateLineCounts(rawCityData);
          }
        } catch (_error) {
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
  }, [repositoryData?.localPath]);

  // Handle open in browser
  const handleOpenUrl = (url: string) => {
    window.open(url, '_blank');
  };

  // Empty state - no repository selected
  if (!repositoryData && !loading && !error) {
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
          Loading repository...
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
          {error}
        </p>
      </div>
    );
  }

  if (!repositoryData) return null;

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
          <ActivityHeatmap activityData={repositoryData.activityData} theme={theme} bannerHeight={170} />
        </div>

        {/* Profile Content */}
        <div style={{ padding: spacing.md, marginTop: -60, position: 'relative' }}>
        {/* Avatar Section - positioned to overlap banner */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: spacing.md, marginBottom: spacing.md }}>
          {/* Owner Avatar */}
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
              <div>
                <div style={{
                  fontSize: theme.fontSizes[3],
                  fontWeight: theme.fontWeights?.semibold ?? 600,
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.text
                }}>
                  {formatNumber(repositoryData.stars)}
                </div>
                <div style={{
                  fontSize: theme.fontSizes[0],
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.textSecondary
                }}>
                  stars
                </div>
              </div>
              <div>
                <div style={{
                  fontSize: theme.fontSizes[3],
                  fontWeight: theme.fontWeights?.semibold ?? 600,
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.text
                }}>
                  {formatNumber(repositoryData.forks)}
                </div>
                <div style={{
                  fontSize: theme.fontSizes[0],
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.textSecondary
                }}>
                  forks
                </div>
              </div>
              <div>
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
              <div>
                <div style={{
                  fontSize: theme.fontSizes[3],
                  fontWeight: theme.fontWeights?.semibold ?? 600,
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.text
                }}>
                  {formatNumber(repositoryData.watchers)}
                </div>
                <div style={{
                  fontSize: theme.fontSizes[0],
                  fontFamily: theme.fonts?.body,
                  color: theme.colors.textSecondary
                }}>
                  watchers
                </div>
              </div>
            </div>

            {/* Action Buttons (for local repos) - right aligned */}
            {repositoryData.isLocal && (
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                <button
                  onClick={onOpenRepository}
                  disabled={!onOpenRepository}
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
                    cursor: onOpenRepository ? 'pointer' : 'not-allowed',
                    transition: 'opacity 0.2s ease',
                    opacity: onOpenRepository ? 1 : 0.5,
                    fontSize: theme.fontSizes[1],
                    fontFamily: theme.fonts?.body,
                  }}
                  onMouseEnter={(e) => {
                    if (onOpenRepository) {
                      e.currentTarget.style.opacity = '0.9';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (onOpenRepository) {
                      e.currentTarget.style.opacity = '1';
                    }
                  }}
                >
                  <FolderOpen size={14} />
                  Open
                </button>
                <button
                  onClick={onDeleteRepository}
                  disabled={!onDeleteRepository}
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
                    cursor: onDeleteRepository ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s ease',
                    opacity: onDeleteRepository ? 1 : 0.5,
                    fontSize: theme.fontSizes[1],
                    fontFamily: theme.fonts?.body,
                  }}
                  onMouseEnter={(e) => {
                    if (onDeleteRepository) {
                      e.currentTarget.style.backgroundColor = theme.colors.error;
                      e.currentTarget.style.color = theme.colors.background;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (onDeleteRepository) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = theme.colors.error;
                    }
                  }}
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Repository Name and Full Name */}
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
          <div
            style={{
              fontSize: theme.fontSizes[2],
              fontFamily: theme.fonts?.body,
              color: theme.colors.textSecondary,
              marginTop: spacing.xs,
            }}
          >
            {repositoryData.fullName}
          </div>
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

        {/* Details Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: spacing.sm,
            marginBottom: spacing.md,
          }}
        >
          {repositoryData.language && (
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
              <Code size={16} />
              <span>{repositoryData.language}</span>
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
            <HardDrive size={16} />
            <span>{formatSize(repositoryData.size)}</span>
          </div>
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
            <GitCommit size={16} />
            <span>{repositoryData.defaultBranch}</span>
          </div>
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
            <span>Created {formatDate(repositoryData.createdAt)}</span>
          </div>
          {repositoryData.htmlUrl && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts?.body,
              }}
            >
              <ExternalLink size={16} color={theme.colors.textSecondary} />
              <button
                onClick={() => repositoryData.htmlUrl && handleOpenUrl(repositoryData.htmlUrl)}
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
                View on GitHub
              </button>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Bottom Section - File City 3D and Stats (fills remaining height) */}
      <div style={{ flex: 1, display: 'flex', gap: spacing.md, padding: spacing.md, overflow: 'hidden' }}>
        {/* File City 3D - Left */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            borderRadius: theme.radii?.[2] || 8,
            overflow: 'hidden',
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.backgroundSecondary,
            position: 'relative',
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            {cityData ? (
              <FileCity3D
                cityData={cityData}
                width="100%"
                height="100%"
                showControls={true}
                heightScaling="linear"
                linearScale={0.5}
                animation={{ startFlat: true, autoStartDelay: null }}
                isLoading={cityDataLoading}
                loadingMessage="Building 3D city..."
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

          {/* Latest Commit Info - Right */}
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
                <GitCommit size={16} color={theme.colors.primary} />
                <h4
                  style={{
                    margin: 0,
                    fontSize: theme.fontSizes[2],
                    fontWeight: 600,
                    color: theme.colors.text,
                    fontFamily: theme.fonts?.body,
                  }}
                >
                  Repository Stats
                </h4>
              </div>
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
            </section>
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
