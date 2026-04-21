/**
 * RepositoryProfilePanel
 *
 * Displays a repository's profile with GitHub-style activity and information.
 * Features a Facebook-style layout with an owner avatar overlapping an activity heatmap banner.
 * Modeled after UserProfilePanel for visual consistency.
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
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
  GitBranch,
  CheckCircle2,
  AlertCircle,
  Circle,
  Github,
  Play,
  Pause,
  Eye,
  EyeClosed,
} from 'lucide-react';
import { ArchitectureMapHighlightLayers, type HighlightLayer, createFileColorHighlightLayers } from '@principal-ai/file-city-react';
import {
  buildCityDataFromFileTree,
  estimateLineCounts,
  enrichWithLineCounts,
  type CityData,
} from '@industry-theme/repository-composition-panels';
import type { FileTree } from '@principal-ai/repository-abstraction';
import { DocumentView } from 'themed-markdown';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { LocalClone } from '../../shared/types/repository.types';
import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';
import { GitService } from '../main-process-api/GitService';
import { GithubService } from '../main-process-api/GithubService';
import { ShellService } from '../main-process-api/ShellService';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';

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
  totalCommits?: number; // Optional to show loading state
  contributors?: number; // Number of contributors
  defaultBranch: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  htmlUrl?: string; // GitHub URL
  isPrivate: boolean;
  isLocal?: boolean; // Whether this is a local repository
  localClones?: LocalClone[]; // All local clones of this repository
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
   * Get README content from GitHub repository
   */
  getReadmeContent?: (owner: string, name: string) => Promise<string | null>;

  /**
   * Open repository in dev workspace
   */
  openRepository: (entry: AlexandriaEntry) => Promise<void>;

  /**
   * Check if repository is watched
   */
  isRepositoryWatched?: (owner: string, repo: string) => Promise<boolean>;

  /**
   * Watch a GitHub repository (optional)
   */
  watchRepository?: (owner: string, repo: string) => Promise<void>;

  /**
   * Unwatch a GitHub repository (optional)
   */
  unwatchRepository?: (owner: string, repo: string) => Promise<void>;
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

/**
 * Calculate repository age in human-readable format
 */
function getRepositoryAge(createdAt: string): string {
  const created = new Date(createdAt);

  // Handle invalid dates - show loading indicator
  if (isNaN(created.getTime())) {
    return '—';
  }

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

  // Read repository from context
  const repositoryData = context.currentScope?.repository as RepositoryProfileData | undefined;

  // State for file trees (fetched via actions)
  const [localFileTree, setLocalFileTree] = useState<FileTree | null>(null);
  const [remoteFileTree, setRemoteFileTree] = useState<FileTree | null>(null);
  const [fileTreesError, setFileTreesError] = useState<string | null>(null);

  // State for README content (for remote repos without local clones)
  const [readmeContent, setReadmeContent] = useState<string | null>(null);
  const [readmeLoading, setReadmeLoading] = useState(false);

  // State for city data (derived from file trees)
  const [cityData, setCityData] = useState<CityData | null>(null);

  // State for contributors list
  const [showContributors, setShowContributors] = useState(false);
  const [contributors, setContributors] = useState<Array<{ name: string; commits: number }>>([]);
  const [contributorsLoading, setContributorsLoading] = useState(false);

  // State for git branch status (sync status) per clone
  const [branchStatusMap, setBranchStatusMap] = useState<Map<string, {
    ahead: number;
    behind: number;
    hasUpstream: boolean;
    branch: string;
  }>>(new Map());

  // State for git working directory status per clone
  const [gitStatusMap, setGitStatusMap] = useState<Map<string, GitStatusWithFiles>>(new Map());

  // State for showing path in cloned badge
  const [showPath, setShowPath] = useState(false);

  // State for commit playback
  type PlayMode = 'today' | 'week' | 'year';
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<PlayMode>('year');
  const [highlightLayers, setHighlightLayers] = useState<HighlightLayer[]>([]);
  const [currentCommitInfo, setCurrentCommitInfo] = useState<{
    hash: string;
    message: string;
    author: string;
    date: string;
  } | null>(null);
  const playbackRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  // Watch state
  const [isWatched, setIsWatched] = useState(false);
  const [isWatchLoading, setIsWatchLoading] = useState(false);

  // Suffix layers visibility toggle
  const [showSuffixLayers, setShowSuffixLayers] = useState(true);

  // Fetch branch status for all local clones
  useEffect(() => {
    let cancelled = false;

    const fetchBranchStatuses = async () => {
      const clones = repositoryData?.localClones;
      if (!repositoryData || !clones || clones.length === 0) {
        setBranchStatusMap(new Map());
        return;
      }

      const newStatusMap = new Map();

      // Fetch status for each clone
      await Promise.all(
        clones.map(async (clone) => {
          try {
            const status = await GitService.getBranchStatus(clone.path);
            if (!cancelled) {
              newStatusMap.set(clone.path, status);
            }
          } catch (error) {
            console.error(`[RepositoryProfilePanel] Failed to fetch branch status for ${clone.path}:`, error);
          }
        })
      );

      if (!cancelled) {
        setBranchStatusMap(newStatusMap);
      }
    };

    fetchBranchStatuses();

    return () => {
      cancelled = true;
    };
  }, [repositoryData]);

  // Fetch git working directory status for all local clones
  useEffect(() => {
    let cancelled = false;

    const fetchGitStatuses = async () => {
      const clones = repositoryData?.localClones;
      if (!repositoryData || !clones || clones.length === 0) {
        setGitStatusMap(new Map());
        return;
      }

      const newStatusMap = new Map<string, GitStatusWithFiles>();

      // Fetch status for each clone using RepositoryMonitoringService
      await Promise.all(
        clones.map(async (clone) => {
          try {
            const status = await RepositoryMonitoringService.getGitStatusWithFiles(clone.path);

            if (cancelled) return;

            if (status) {
              newStatusMap.set(clone.path, status);
            }
          } catch (error) {
            console.error(`[RepositoryProfilePanel] Failed to fetch git status for ${clone.path}:`, error);
          }
        })
      );

      if (!cancelled) {
        setGitStatusMap(newStatusMap);
      }
    };

    fetchGitStatuses();

    return () => {
      cancelled = true;
    };
  }, [repositoryData]);

  // Create initial highlight layers from git status and file suffixes when data loads
  useEffect(() => {
    // Only create highlights if not currently playing
    if (isPlaying) {
      return;
    }

    const layers: HighlightLayer[] = [];

    // 1. First, add file suffix color layers (higher priority: 100+)
    // Higher priority = drawn first = appears underneath
    // These show the default colors for all files based on their extensions
    if (showSuffixLayers && cityData?.buildings) {
      const fileSuffixLayers = createFileColorHighlightLayers(cityData.buildings);

      // Check if there are any git changes
      const hasGitChanges = gitStatusMap.size > 0 && Array.from(gitStatusMap.values()).some(status => status.isDirty);

      // Dim suffix layers when git changes are present to help focus on git status
      // Also boost their priority so they render underneath git layers
      // Since git layers use borders, the dimmed suffix colors will show through
      const adjustedSuffixLayers = hasGitChanges
        ? fileSuffixLayers.map(layer => ({
            ...layer,
            opacity: (layer.opacity ?? 1.0) * 0.2, // Reduce opacity to 20% when git changes present
            priority: layer.priority + 100, // Boost priority to render underneath git layers
          }))
        : fileSuffixLayers.map(layer => ({
            ...layer,
            priority: layer.priority + 100, // Always boost priority for consistent layering
          }));

      layers.push(...adjustedSuffixLayers);
    }

    // 2. Then, add git status layers with borders (lower priority: 1-4)
    // Lower priority = drawn later = appears on top
    // Borders allow the suffix colors underneath to show through while highlighting git status
    if (gitStatusMap.size > 0) {
      // Get the first clone's git status (usually there's only one)
      const firstClone = repositoryData?.localClones?.[0];
      if (firstClone) {
        const gitStatus = gitStatusMap.get(firstClone.path);
        if (gitStatus && gitStatus.isDirty) {
          // Staged files - green layer with border
          if (gitStatus.stagedFiles && gitStatus.stagedFiles.length > 0) {
            layers.push({
              id: 'git-staged',
              name: 'Staged Files',
              enabled: true,
              color: theme.colors.success,
              priority: 4,
              items: gitStatus.stagedFiles.map(path => ({ type: 'file' as const, path, renderStrategy: 'border' as const })),
              opacity: 0.8,
            });
          }

          // Modified files - orange/warning layer with border
          if (gitStatus.modifiedFiles && gitStatus.modifiedFiles.length > 0) {
            layers.push({
              id: 'git-modified',
              name: 'Modified Files',
              enabled: true,
              color: theme.colors.warning,
              priority: 3,
              items: gitStatus.modifiedFiles.map(path => ({ type: 'file' as const, path, renderStrategy: 'border' as const })),
              opacity: 0.8,
            });
          }

          // Untracked files - blue/info layer with border
          if (gitStatus.untrackedFiles && gitStatus.untrackedFiles.length > 0) {
            layers.push({
              id: 'git-untracked',
              name: 'Untracked Files',
              enabled: true,
              color: theme.colors.info,
              priority: 2,
              items: gitStatus.untrackedFiles.map(path => ({ type: 'file' as const, path, renderStrategy: 'border' as const })),
              opacity: 0.8,
            });
          }

          // Deleted files - red/error layer with border
          if (gitStatus.deletedFiles && gitStatus.deletedFiles.length > 0) {
            layers.push({
              id: 'git-deleted',
              name: 'Deleted Files',
              enabled: true,
              color: theme.colors.error,
              priority: 1,
              items: gitStatus.deletedFiles.map(path => ({ type: 'file' as const, path, renderStrategy: 'border' as const })),
              opacity: 0.8,
            });
          }

          console.info('[RepositoryProfilePanel] Created git status layers:', {
            staged: gitStatus.stagedFiles?.length || 0,
            modified: gitStatus.modifiedFiles?.length || 0,
            untracked: gitStatus.untrackedFiles?.length || 0,
            deleted: gitStatus.deletedFiles?.length || 0,
          });
        }
      }
    }

    setHighlightLayers(layers);

    console.info('[RepositoryProfilePanel] Total highlight layers:', layers.length);
  }, [gitStatusMap, isPlaying, repositoryData?.localClones, theme.colors, cityData, showSuffixLayers]);

  // Load watch status when repository changes
  useEffect(() => {
    if (!repositoryData?.github || !actions.isRepositoryWatched) {
      setIsWatched(false);
      return;
    }

    let cancelled = false;

    const loadWatchStatus = async () => {
      try {
        if (!actions.isRepositoryWatched || !repositoryData.github) {
          return;
        }
        const watched = await actions.isRepositoryWatched(
          repositoryData.github.owner,
          repositoryData.github.name
        );
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
  }, [repositoryData, actions]);

  // Fetch file trees when repository changes
  useEffect(() => {
    let cancelled = false;

    const fetchFileTrees = async () => {
      if (!repositoryData) {
        setLocalFileTree(null);
        setRemoteFileTree(null);
        setFileTreesError(null);
        setCityData(null);
        // Reset contributors
        setShowContributors(false);
        setContributors([]);
        return;
      }

      setFileTreesError(null);

      try {
        const promises: Promise<void>[] = [];

        const localPath = repositoryData?.localClones?.[0]?.path;
        // Fetch local file tree if repository has a local path
        if (localPath) {
          promises.push(
            actions.getLocalFileTree(localPath)
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
        }
      }
    };

    fetchFileTrees();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repositoryData?.localClones, repositoryData?.github, actions]);

  // Fetch README content for remote repos without local clones
  useEffect(() => {
    let cancelled = false;

    const fetchReadme = async () => {
      // Only fetch README for repos without local clones
      const hasLocalClone = repositoryData?.localClones && repositoryData.localClones.length > 0;
      if (hasLocalClone || !repositoryData?.github || !remoteFileTree) {
        setReadmeContent(null);
        setReadmeLoading(false);
        return;
      }

      setReadmeLoading(true);

      try {
        // Find README file in the remote file tree
        const findReadme = (tree: FileTree): string | null => {
          const readmePattern = /^readme(\.md|\.markdown|\.txt)?$/i;

          // Check all files for README in the root directory
          for (const file of tree.allFiles) {
            // Only check files in the root (no path separators in relativePath besides the filename)
            const isInRoot = !file.relativePath.includes('/') || file.relativePath.split('/').length === 1;
            if (isInRoot && readmePattern.test(file.name)) {
              return file.relativePath;
            }
          }

          return null;
        };

        const readmePath = findReadme(remoteFileTree);

        if (readmePath) {
          const content = await GithubService.getFileContent(
            repositoryData.github.owner,
            repositoryData.github.name,
            readmePath
          );

          if (!cancelled) {
            setReadmeContent(content);
            setReadmeLoading(false);
          }
        } else {
          if (!cancelled) {
            setReadmeContent(null);
            setReadmeLoading(false);
          }
        }
      } catch (error) {
        console.error('[RepositoryProfilePanel] Failed to fetch README:', error);
        if (!cancelled) {
          setReadmeContent(null);
          setReadmeLoading(false);
        }
      }
    };

    fetchReadme();

    return () => {
      cancelled = true;
    };
  }, [remoteFileTree, repositoryData?.github, repositoryData?.localClones]);

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
        // Build city data from file tree - use empty string as root path for clean relative paths
        const rootPath = '';
        const rawCityData = buildCityDataFromFileTree(fileTree, rootPath);

        const localPath = repositoryData?.localClones?.[0]?.path;
        // Get actual line counts if this is a local repository
        let finalCityData: CityData;
        if (localPath) {
          try {
            const rawLineCounts = await actions.getLineCounts(localPath);

            // Transform line counts to use clean relative paths
            const repoName = localPath.split('/').pop() || '';
            const lineCounts: Record<string, number> = {};
            for (const [filePath, count] of Object.entries(rawLineCounts)) {
              if (typeof count !== 'number' || count < 0) continue;

              if (filePath.startsWith(repoName + '/')) {
                const relativePath = filePath.slice(repoName.length + 1);
                lineCounts[relativePath] = count;
              } else {
                lineCounts[filePath] = count;
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
        }
      } catch (error) {
        console.error('[RepositoryProfilePanel] Failed to build city data:', error);
        if (!cancelled) {
          setCityData(null);
        }
      }
    };

    buildCityData();

    return () => {
      cancelled = true;
    };
  }, [localFileTree, remoteFileTree, repositoryData?.localClones, actions]);

  // Handle open repository for a specific clone
  const handleOpenRepository = async (clonePath: string) => {
    if (repositoryData) {
      // Convert RepositoryProfileData to AlexandriaEntry format
      const repositoryEntry = {
        name: repositoryData.name,
        path: clonePath,
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

  // Handle delete clone
  const handleDeleteClone = (clonePath: string) => {
    if (repositoryData) {
      events.emit({
        type: 'repository-profile:delete-clone-requested',
        source: 'repository-profile-panel',
        timestamp: Date.now(),
        payload: {
          repository: repositoryData,
          clonePath,
        },
      });
    }
  };

  // Handle open in GitHub
  const handleOpenInGitHub = async () => {
    if (repositoryData?.htmlUrl) {
      await ShellService.openExternal(repositoryData.htmlUrl);
    }
  };

  // Handle playback toggle
  const handlePlayPause = async (mode: PlayMode) => {
    if (isPlaying) {
      // Stop playback
      playbackRef.current.cancelled = true;
      setIsPlaying(false);
      setCurrentCommitInfo(null);
      setHighlightLayers([]);
      return;
    }

    const localPath = repositoryData?.localClones?.[0]?.path;
    if (!localPath) return;

    playbackRef.current.cancelled = false;
    setIsPlaying(true);
    setPlayMode(mode);
    setHighlightLayers([]);

    try {
      // Get commits based on mode
      const commits = await GitService.getCommitHistory(localPath, mode === 'year' ? 365 : mode === 'week' ? 7 : 1);

      // Play through commits
      for (const commit of commits) {
        if (playbackRef.current.cancelled) break; // Stop if user paused

        setCurrentCommitInfo({
          hash: commit.hash,
          message: commit.message.split('\n')[0],
          author: commit.author,
          date: commit.date.split('T')[0],
        });

        // Get changed files for this commit
        const changedFiles = await GitService.getChangedFilesForCommit(localPath, commit.hash);

        // Group files by status type (layers only support one color per layer)
        const addedFiles: string[] = [];
        const modifiedFiles: string[] = [];
        const deletedFiles: string[] = [];

        for (const [filePath, fileInfo] of changedFiles.entries()) {
          switch (fileInfo.status) {
            case 'added':
              addedFiles.push(filePath);
              break;
            case 'modified':
            case 'renamed':
              modifiedFiles.push(filePath);
              break;
            case 'deleted':
              deletedFiles.push(filePath);
              break;
          }
        }

        // Create separate layers for each status type with borders
        const layers: HighlightLayer[] = [];

        if (addedFiles.length > 0) {
          layers.push({
            id: `commit-${commit.hash}-added`,
            name: `Added Files`,
            enabled: true,
            color: theme.colors.success,
            priority: 3,
            items: addedFiles.map(path => ({ type: 'file' as const, path, renderStrategy: 'border' as const })),
            opacity: 0.8,
          });
        }

        if (modifiedFiles.length > 0) {
          layers.push({
            id: `commit-${commit.hash}-modified`,
            name: `Modified Files`,
            enabled: true,
            color: theme.colors.warning,
            priority: 2,
            items: modifiedFiles.map(path => ({ type: 'file' as const, path, renderStrategy: 'border' as const })),
            opacity: 0.8,
          });
        }

        if (deletedFiles.length > 0) {
          layers.push({
            id: `commit-${commit.hash}-deleted`,
            name: `Deleted Files`,
            enabled: true,
            color: theme.colors.error,
            priority: 1,
            items: deletedFiles.map(path => ({ type: 'file' as const, path, renderStrategy: 'border' as const })),
            opacity: 0.8,
          });
        }

        setHighlightLayers(layers);

        // Wait before showing next commit
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.warn('[RepositoryProfilePanel] Playback error:', error);
    } finally {
      if (!playbackRef.current.cancelled) {
        setIsPlaying(false);
        setCurrentCommitInfo(null);
        setHighlightLayers([]);
      }
    }
  };

  // Handle owner avatar click to open profile
  const handleOwnerClick = () => {
    if (repositoryData && repositoryData.owner !== 'local') {
      const isOrg = repositoryData.ownerType === 'Organization';
      console.info('[RepositoryProfilePanel] Owner clicked:', repositoryData.owner, 'isOrg:', isOrg);
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
    const localPath = repositoryData?.localClones?.[0]?.path;
    // Check if we have either local path or GitHub info
    if (!localPath && !repositoryData?.github) return;

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

        if (localPath) {
          // Local repository - use git
          contributorsList = await GitService.getContributors(localPath);
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

  // Handle watch/unwatch repository
  const handleToggleWatch = async () => {
    if (!repositoryData?.github) return;

    // Check if actions are available
    if (!actions.watchRepository || !actions.unwatchRepository) {
      console.warn('Watch actions not available');
      return;
    }

    setIsWatchLoading(true);
    try {
      if (isWatched) {
        await actions.unwatchRepository(
          repositoryData.github.owner,
          repositoryData.github.name
        );
        setIsWatched(false);
        // Emit specific event for watch toggle
        events.emit({
          type: 'watch:repo-toggled',
          source: 'repository-profile-panel',
          timestamp: Date.now(),
          payload: {
            owner: repositoryData.github.owner,
            repo: repositoryData.github.name,
            watched: false,
          },
        });
      } else {
        await actions.watchRepository(
          repositoryData.github.owner,
          repositoryData.github.name
        );
        setIsWatched(true);
        // Emit specific event for watch toggle
        events.emit({
          type: 'watch:repo-toggled',
          source: 'repository-profile-panel',
          timestamp: Date.now(),
          payload: {
            owner: repositoryData.github.owner,
            repo: repositoryData.github.name,
            watched: true,
          },
        });
      }
    } catch (err) {
      console.error('Failed to toggle watch:', err);
    } finally {
      setIsWatchLoading(false);
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

          {/* Stats - aligned with bottom of avatar */}
          <div style={{ flex: 1, paddingBottom: spacing.xs, display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', gap: spacing.lg, flexWrap: 'wrap' }}>
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

              {/* Watch Button */}
              {repositoryData.github && (
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
              )}
            </div>
          </div>
        </div>

        {/* Repository Name and Status Badge */}
        <div style={{ marginBottom: spacing.md }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
            {repositoryData.htmlUrl && (
              <button
                onClick={handleOpenInGitHub}
                title="Open in GitHub"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: theme.colors.textSecondary,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = theme.colors.text;
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = theme.colors.textSecondary;
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <Github size={24} />
              </button>
            )}
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
          </div>
          {repositoryData.isLocal && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
                marginTop: spacing.sm,
                flexWrap: 'wrap',
              }}
            >
              {/* Local Clones List with Branch Status */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, width: '100%' }}>
                {repositoryData.localClones?.map((clone, index) => {
                  const branchStatus = branchStatusMap.get(clone.path);
                  const gitStatus = gitStatusMap.get(clone.path);

                  return (
                    <div key={clone.path} style={{ display: 'flex', gap: spacing.xs, alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* Clone Path Badge */}
                      <button
                        onClick={() => setShowPath(!showPath)}
                        title={showPath ? 'Click to show "cloned"' : `Click to show path\n${clone.path}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: spacing.xs,
                          padding: `${spacing.xs}px ${spacing.sm}px`,
                          backgroundColor: `${theme.colors.success}15`,
                          border: `1px solid ${theme.colors.success}30`,
                          borderRadius: 6,
                          fontSize: theme.fontSizes[0],
                          fontFamily: theme.fonts?.body,
                          fontWeight: theme.fontWeights?.medium ?? 500,
                          color: theme.colors.success,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = `${theme.colors.success}25`;
                          e.currentTarget.style.borderColor = `${theme.colors.success}50`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = `${theme.colors.success}15`;
                          e.currentTarget.style.borderColor = `${theme.colors.success}30`;
                        }}
                      >
                        <FolderGit2 size={12} />
                        {showPath
                          ? shortenPath(clone.path)
                          : index === 0 ? 'cloned' : `clone ${index + 1}`}
                      </button>

                      {/* Branch and Status Badge for this clone */}
                      {branchStatus && (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: spacing.xs,
                            padding: `${spacing.xs}px ${spacing.sm}px`,
                            backgroundColor: theme.colors.backgroundSecondary,
                            border: `1px solid ${theme.colors.border}`,
                            borderRadius: 6,
                            fontSize: theme.fontSizes[0],
                            fontFamily: theme.fonts?.body,
                            fontWeight: theme.fontWeights?.medium ?? 500,
                            color: theme.colors.text,
                          }}
                        >
                          <GitBranch size={12} />
                          <span>{branchStatus.branch}</span>

                          {/* Status Indicator */}
                          {gitStatus && gitStatus.isDirty ? (
                            <>
                              <span style={{ color: theme.colors.textSecondary }}>•</span>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  color: gitStatus.hasStaged ? theme.colors.warning : theme.colors.textSecondary,
                                }}
                              >
                                <Circle size={8} fill="currentColor" />
                                <span>
                                  {(() => {
                                    const total = (gitStatus.stagedFiles?.length || 0) +
                                                  (gitStatus.modifiedFiles?.length || 0) +
                                                  (gitStatus.untrackedFiles?.length || 0) +
                                                  (gitStatus.deletedFiles?.length || 0);
                                    return total === 1 ? '1 change' : `${total} changes`;
                                  })()}
                                </span>
                              </div>
                            </>
                          ) : !branchStatus.hasUpstream ? (
                            <>
                              <span style={{ color: theme.colors.textSecondary }}>•</span>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  color: theme.colors.warning,
                                }}
                              >
                                <AlertCircle size={12} />
                                <span>no remote</span>
                              </div>
                            </>
                          ) : branchStatus.ahead === 0 && branchStatus.behind === 0 ? (
                            <>
                              <span style={{ color: theme.colors.textSecondary }}>•</span>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  color: theme.colors.success,
                                }}
                              >
                                <CheckCircle2 size={12} />
                                <span>in sync</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <span style={{ color: theme.colors.textSecondary }}>•</span>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  color: branchStatus.ahead > 0 && branchStatus.behind > 0
                                    ? theme.colors.error
                                    : branchStatus.behind > 0
                                      ? theme.colors.warning
                                      : theme.colors.info,
                                }}
                              >
                                <AlertCircle size={12} />
                                <span>
                                  {branchStatus.ahead > 0 && branchStatus.behind === 0
                                    ? `${branchStatus.ahead} ahead`
                                    : branchStatus.ahead === 0 && branchStatus.behind > 0
                                      ? `${branchStatus.behind} behind`
                                      : `${branchStatus.ahead}↑ ${branchStatus.behind}↓`}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Action Buttons for this clone */}
                      <button
                        onClick={() => handleOpenRepository(clone.path)}
                        title="Open in workspace"
                        style={{
                          padding: `${spacing.xs}px ${spacing.sm}px`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.xs,
                          border: 'none',
                          borderRadius: 6,
                          background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primary}dd)`,
                          color: theme.colors.background,
                          cursor: 'pointer',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          fontSize: theme.fontSizes[0],
                          fontFamily: theme.fonts?.body,
                          fontWeight: theme.fontWeights?.medium ?? 500,
                          boxShadow: `0 2px 8px ${theme.colors.primary}40, 0 1px 2px rgba(0, 0, 0, 0.1)`,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = `0 4px 12px ${theme.colors.primary}60, 0 2px 4px rgba(0, 0, 0, 0.15)`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = `0 2px 8px ${theme.colors.primary}40, 0 1px 2px rgba(0, 0, 0, 0.1)`;
                        }}
                        onMouseDown={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = `0 1px 4px ${theme.colors.primary}30`;
                        }}
                        onMouseUp={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = `0 4px 12px ${theme.colors.primary}60, 0 2px 4px rgba(0, 0, 0, 0.15)`;
                        }}
                      >
                        <FolderOpen size={12} />
                        Open
                      </button>
                      <button
                        onClick={() => handleDeleteClone(clone.path)}
                        title="Delete this clone"
                        style={{
                          padding: `${spacing.xs}px ${spacing.sm}px`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.xs,
                          border: `1px solid ${theme.colors.error}50`,
                          borderRadius: 6,
                          background: `${theme.colors.error}08`,
                          color: theme.colors.error,
                          cursor: 'pointer',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          fontSize: theme.fontSizes[0],
                          fontFamily: theme.fonts?.body,
                          fontWeight: theme.fontWeights?.medium ?? 500,
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = theme.colors.error;
                          e.currentTarget.style.color = theme.colors.background;
                          e.currentTarget.style.borderColor = theme.colors.error;
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = `0 4px 12px ${theme.colors.error}40, 0 2px 4px rgba(0, 0, 0, 0.1)`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = `${theme.colors.error}08`;
                          e.currentTarget.style.color = theme.colors.error;
                          e.currentTarget.style.borderColor = `${theme.colors.error}50`;
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                        }}
                        onMouseDown={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)';
                        }}
                        onMouseUp={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = `0 4px 12px ${theme.colors.error}40, 0 2px 4px rgba(0, 0, 0, 0.1)`;
                        }}
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>
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
                {(() => {
                  const hasLocalClone = repositoryData?.localClones && repositoryData.localClones.length > 0;
                  const firstClone = repositoryData?.localClones?.[0];
                  const gitStatus = firstClone ? gitStatusMap.get(firstClone.path) : null;
                  const hasChanges = gitStatus && gitStatus.isDirty;

                  if (showContributors) {
                    return <Users size={16} color={theme.colors.primary} />;
                  } else if (!hasLocalClone && (readmeContent || readmeLoading)) {
                    return <FolderGit2 size={16} color={theme.colors.primary} />;
                  } else if (!showContributors && hasChanges) {
                    return <Circle size={16} color={theme.colors.warning} />;
                  } else {
                    return <GitCommit size={16} color={theme.colors.primary} />;
                  }
                })()}
                <h4
                  style={{
                    margin: 0,
                    fontSize: theme.fontSizes[2],
                    fontWeight: 600,
                    color: theme.colors.text,
                    fontFamily: theme.fonts?.body,
                  }}
                >
                  {(() => {
                    const hasLocalClone = repositoryData?.localClones && repositoryData.localClones.length > 0;
                    const firstClone = repositoryData?.localClones?.[0];
                    const gitStatus = firstClone ? gitStatusMap.get(firstClone.path) : null;
                    const hasChanges = gitStatus && gitStatus.isDirty;

                    if (showContributors) {
                      return 'Contributors';
                    } else if (!hasLocalClone && (readmeContent || readmeLoading)) {
                      return 'README';
                    } else if (!showContributors && hasChanges) {
                      return 'Changed Files';
                    } else {
                      return 'Repository Stats';
                    }
                  })()}
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
                contributors.length === 0 ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: spacing.lg,
                    color: theme.colors.textSecondary,
                    fontFamily: theme.fonts?.body,
                    fontSize: theme.fontSizes[1],
                  }}>
                    No contributors found
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, flex: 1, overflow: 'auto' }}>
                    {contributors.map((contributor) => (
                      <div
                        key={contributor.name}
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
                )
              ) : (() => {
                // Check if we should show README for remote-only repos
                const hasLocalClone = repositoryData?.localClones && repositoryData.localClones.length > 0;

                if (!hasLocalClone && readmeContent) {
                  // Show README for remote-only repositories
                  return (
                    <div style={{ flex: 1, overflow: 'auto' }}>
                      <DocumentView
                        content={readmeContent}
                        theme={theme}
                        enableKeyboardScrolling={false}
                        transparentBackground={true}
                      />
                    </div>
                  );
                }

                if (!hasLocalClone && readmeLoading) {
                  return (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: spacing.lg,
                      color: theme.colors.textSecondary,
                    }}>
                      Loading README...
                    </div>
                  );
                }

                // Check if we should show changed files instead of stats
                const firstClone = repositoryData?.localClones?.[0];
                const gitStatus = firstClone ? gitStatusMap.get(firstClone.path) : null;
                const hasChanges = gitStatus && gitStatus.isDirty;

                if (hasChanges) {
                  // Show changed files
                  const sections = [
                    { title: 'Staged', files: gitStatus.stagedFiles || [], color: theme.colors.success, icon: '✓' },
                    { title: 'Modified', files: gitStatus.modifiedFiles || [], color: theme.colors.warning, icon: '●' },
                    { title: 'Untracked', files: gitStatus.untrackedFiles || [], color: theme.colors.info, icon: '?' },
                    { title: 'Deleted', files: gitStatus.deletedFiles || [], color: theme.colors.error, icon: '✕' },
                  ].filter(section => section.files.length > 0);

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md, flex: 1, overflow: 'auto' }}>
                      {sections.map((section) => (
                        <div key={section.title}>
                          <div style={{
                            fontSize: theme.fontSizes[0],
                            fontWeight: theme.fontWeights?.semibold ?? 600,
                            fontFamily: theme.fonts?.body,
                            color: section.color,
                            marginBottom: spacing.xs,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}>
                            {section.title} ({section.files.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
                            {section.files.map((filePath) => (
                              <div
                                key={filePath}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: spacing.xs,
                                  padding: spacing.xs,
                                  backgroundColor: theme.colors.background,
                                  borderRadius: theme.radii?.[1] || 4,
                                  fontSize: theme.fontSizes[0],
                                  fontFamily: theme.fonts?.monospace,
                                }}
                              >
                                <span style={{ color: section.color, flexShrink: 0, width: 16, textAlign: 'center' }}>
                                  {section.icon}
                                </span>
                                <span style={{
                                  color: theme.colors.text,
                                  flex: 1,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }} title={filePath}>
                                  {filePath}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }

                // Otherwise show normal stats
                return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
                {/* Playback Buttons (for local repos) */}
                {repositoryData.isLocal && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, marginTop: spacing.md }}>
                    <span
                      style={{
                        fontSize: theme.fontSizes[1],
                        fontWeight: 500,
                        color: theme.colors.textSecondary,
                        fontFamily: theme.fonts?.body,
                      }}
                    >
                      Commit History:
                    </span>
                    <div style={{ display: 'flex', gap: spacing.xs, flexWrap: 'wrap' }}>
                      {isPlaying ? (
                        <button
                          onClick={() => handlePlayPause(playMode)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: spacing.xs,
                            padding: `${spacing.xs}px ${spacing.sm}px`,
                            background: theme.colors.backgroundSecondary,
                            border: `1px solid ${theme.colors.border}`,
                            borderRadius: 6,
                            color: theme.colors.text,
                            fontSize: theme.fontSizes[0],
                            fontFamily: theme.fonts?.body,
                            fontWeight: theme.fontWeights?.medium ?? 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <Pause size={12} />
                          Stop
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handlePlayPause('today')}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: spacing.xs,
                              padding: `${spacing.xs}px ${spacing.sm}px`,
                              background: theme.colors.backgroundSecondary,
                              border: `1px solid ${theme.colors.border}`,
                              borderRadius: 6,
                              color: theme.colors.text,
                              fontSize: theme.fontSizes[0],
                              fontFamily: theme.fonts?.body,
                              fontWeight: theme.fontWeights?.medium ?? 500,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = `${theme.colors.primary}15`;
                              e.currentTarget.style.borderColor = theme.colors.primary;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = theme.colors.backgroundSecondary;
                              e.currentTarget.style.borderColor = theme.colors.border;
                            }}
                          >
                            <Play size={12} />
                            Latest
                          </button>
                          <button
                            onClick={() => handlePlayPause('week')}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: spacing.xs,
                              padding: `${spacing.xs}px ${spacing.sm}px`,
                              background: theme.colors.backgroundSecondary,
                              border: `1px solid ${theme.colors.border}`,
                              borderRadius: 6,
                              color: theme.colors.text,
                              fontSize: theme.fontSizes[0],
                              fontFamily: theme.fonts?.body,
                              fontWeight: theme.fontWeights?.medium ?? 500,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = `${theme.colors.primary}15`;
                              e.currentTarget.style.borderColor = theme.colors.primary;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = theme.colors.backgroundSecondary;
                              e.currentTarget.style.borderColor = theme.colors.border;
                            }}
                          >
                            <Play size={12} />
                            Last 7 Active
                          </button>
                          <button
                            onClick={() => handlePlayPause('year')}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: spacing.xs,
                              padding: `${spacing.xs}px ${spacing.sm}px`,
                              background: theme.colors.backgroundSecondary,
                              border: `1px solid ${theme.colors.border}`,
                              borderRadius: 6,
                              color: theme.colors.text,
                              fontSize: theme.fontSizes[0],
                              fontFamily: theme.fonts?.body,
                              fontWeight: theme.fontWeights?.medium ?? 500,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = `${theme.colors.primary}15`;
                              e.currentTarget.style.borderColor = theme.colors.primary;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = theme.colors.backgroundSecondary;
                              e.currentTarget.style.borderColor = theme.colors.border;
                            }}
                          >
                            <Play size={12} />
                            Full Year
                          </button>
                        </>
                      )}
                    </div>

                    {/* Current commit info during playback */}
                    {currentCommitInfo && (
                      <div
                        style={{
                          padding: spacing.sm,
                          background: `${theme.colors.primary}10`,
                          border: `1px solid ${theme.colors.primary}30`,
                          borderRadius: 6,
                          fontSize: theme.fontSizes[0],
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: spacing.xs, color: theme.colors.text }}>
                          {currentCommitInfo.message}
                        </div>
                        <div style={{ color: theme.colors.textSecondary, fontSize: theme.fontSizes[0] }}>
                          {currentCommitInfo.author} • {currentCommitInfo.date}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
                );
              })()}
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
            position: 'relative',
          }}
        >
          {/* Toggle suffix layers button */}
          {cityData && (
            <button
              onClick={() => setShowSuffixLayers(!showSuffixLayers)}
              style={{
                position: 'absolute',
                top: spacing.sm,
                right: spacing.sm,
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                gap: spacing.xs,
                padding: `${spacing.xs}px ${spacing.sm}px`,
                background: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: 6,
                color: showSuffixLayers ? theme.colors.text : theme.colors.textSecondary,
                fontSize: theme.fontSizes[0],
                fontFamily: theme.fonts?.body,
                fontWeight: theme.fontWeights?.medium ?? 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${theme.colors.primary}15`;
                e.currentTarget.style.borderColor = theme.colors.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = theme.colors.backgroundSecondary;
                e.currentTarget.style.borderColor = theme.colors.border;
              }}
              title={showSuffixLayers ? 'Hide file type colors' : 'Show file type colors'}
            >
              {showSuffixLayers ? <Eye size={14} /> : <EyeClosed size={14} />}
              <span>File Types</span>
            </button>
          )}

          {cityData ? (
            <ArchitectureMapHighlightLayers
              cityData={cityData}
              highlightLayers={highlightLayers}
              canvasBackgroundColor={theme.colors.backgroundSecondary}
              defaultBuildingColor={theme.colors.muted}
              defaultDirectoryColor={theme.colors.backgroundSecondary}
              enableZoom={true}
              showFileTypeIcons={true}
              showDirectoryLabels={true}
              fullSize={true}
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
              No city data available
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
