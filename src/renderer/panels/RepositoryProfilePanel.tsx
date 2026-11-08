/**
 * RepositoryProfilePanel
 *
 * Displays a repository's profile with GitHub-style activity and information.
 * Features a Facebook-style layout with an owner avatar overlapping an activity heatmap banner.
 * Modeled after UserProfilePanel for visual consistency.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { useRepositoryStatuses } from '../hooks/useRepositoryStatuses';
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
  GitBranch,
  CheckCircle2,
  AlertCircle,
  Circle,
  Check,
  Copy,
  Loader2,
  Download,
  GitFork,
  Terminal,
  Bookmark,
  BookmarkCheck,
} from 'lucide-react';
import { useHomePins } from './home-panel/useHomePins';
import {
  ArchitectureMapHighlightLayers,
  type HighlightLayer,
  createFileColorHighlightLayers,
} from '@principal-ai/file-city-react';
import {
  buildCityDataFromFileTree,
  enrichWithLineCounts,
  type CityData,
} from '../dev-workspace/file-city-panel/cityDataBuilders';
import type { FileTree } from '@principal-ai/repository-abstraction';
import { DocumentView } from 'themed-markdown';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { payloadFromGithub } from '../events/repositorySelected';
import { emitTerminalNew } from '../events/portalIntents';
import { githubIdToPurl } from '@principal-ai/alexandria-core-library';
import { RepositoryBuildsSection } from './build-configurations/RepositoryBuildsSection';
import type { LocalClone } from '../../shared/types/repository.types';
import * as LucideIcons from 'lucide-react';
import { GithubService } from '../main-process-api/GithubService';
import { useAuthUser } from '../providers/AuthProvider';
import { ShellService } from '../main-process-api/ShellService';
import {
  GitCloneModal,
  type CloneProgressState,
} from '../components/GitCloneModal';
import { ForkModal } from './components/ForkModal';
import { RepositoryPackageList } from './components/RepositoryPackageList';

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
  defaultBranch: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  htmlUrl?: string; // GitHub URL
  isPrivate?: boolean;
  isLocal?: boolean; // Whether this is a local repository
  localClones?: LocalClone[]; // All local clones of this repository
  github?: {
    owner: string;
    name: string;
    defaultBranch?: string;
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
   * Open repository in dev workspace. The action is responsible for resolving
   * the local path to an Alexandria entry (registering it if necessary).
   */
  openRepository: (path: string, remoteUrl?: string) => Promise<void>;

  /** Open a localhost browser tab linked to a managed process when available. */
  openLocalhostBrowser?: (
    port: number,
    path?: string,
    label?: string,
    processId?: string,
  ) => void;

  /**
   * Check if repository is starred
   */
  isRepositoryStarred?: (owner: string, repo: string) => Promise<boolean>;

  /**
   * Star a GitHub repository (optional)
   */
  starRepository?: (owner: string, repo: string) => Promise<void>;

  /**
   * Unstar a GitHub repository (optional)
   */
  unstarRepository?: (owner: string, repo: string) => Promise<void>;

  /**
   * Register a cloned or existing local repository with Alexandria
   */
  registerRepository: (
    path: string,
    remoteUrl?: string,
  ) => Promise<AlexandriaEntry>;
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
    const days: Array<{
      date: string;
      count: number;
      dayOfWeek: number;
      dateObj: Date;
      monthLabel?: string;
    }> = [];

    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      const count = activityData.get(dateKey) || 0;

      // Add month label if this is the first day of the month
      const monthLabel =
        date.getDate() === 1
          ? ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][
              date.getMonth()
            ]
          : undefined;

      days.push({
        date: dateKey,
        count,
        dayOfWeek: date.getDay(),
        dateObj: date,
        monthLabel,
      });
    }

    // Group into weeks
    const weekGroups: Array<
      Array<{
        date: string;
        count: number;
        dayOfWeek: number;
        dateObj: Date;
        monthLabel?: string;
      }>
    > = [];
    let currentWeek: Array<{
      date: string;
      count: number;
      dayOfWeek: number;
      dateObj: Date;
      monthLabel?: string;
    }> = [];

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
        <div
          key={week[0]?.date ?? `week-${weekIndex}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap,
            flexShrink: 0,
          }}
        >
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
  const unixHomeMatch = fullPath.match(
    /^(\/Users\/[^/]+|\/home\/[^/]+)(\/.*)?$/,
  );
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

function transformImageUrl(
  src: string,
  repositoryInfo: { owner: string; repo: string; branch?: string },
): string {
  if (
    src.startsWith('http://') ||
    src.startsWith('https://') ||
    src.startsWith('data:')
  ) {
    return src;
  }
  const branch = repositoryInfo.branch || 'main';
  const path = src.startsWith('/') ? src.slice(1) : src;
  return `https://raw.githubusercontent.com/${repositoryInfo.owner}/${repositoryInfo.repo}/${branch}/${path}`;
}

function transformHtmlImageUrls(
  content: string,
  repositoryInfo: { owner: string; repo: string; branch?: string },
): string {
  return content.replace(
    /(<img\s[^>]*?)src="([^"]+)"([^>]*?>)/gi,
    (match, before, src, after) => {
      const transformed = transformImageUrl(src, repositoryInfo);
      return `${before}src="${transformed}"${after}`;
    },
  );
}

export const RepositoryProfilePanel: React.FC<RepositoryProfilePanelProps> = ({
  context,
  actions,
  events,
}) => {
  const { theme } = useTheme();
  const { user } = useAuthUser();

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
  const repositoryData = context.currentScope?.repository as
    RepositoryProfileData | undefined;
  const repositoryPath = repositoryData?.localClones?.[0]?.path;
  // Home pin key: clone path when cloned, otherwise GitHub purl so uncloned
  // repos pin the same way the Home rail does (`path ?? pkg:github/o/n`).
  const { isRepoPinned, toggleRepoPin } = useHomePins();
  const pinPurl = repositoryData?.github
    ? `pkg:github/${repositoryData.github.owner}/${repositoryData.github.name}`
    : undefined;
  const pinPathKey = repositoryPath ?? undefined;
  const isPinned =
    (pinPathKey ? isRepoPinned(pinPathKey) : false) ||
    (pinPurl ? isRepoPinned(pinPurl) : false);
  const handleTogglePin = () => {
    if (isPinned) {
      // Unpin both keys so a purl-pin made before cloning doesn't linger
      // after the row migrates to its clone path (see buildHomeTabEntries).
      if (pinPathKey && isRepoPinned(pinPathKey)) toggleRepoPin(pinPathKey);
      if (pinPurl && isRepoPinned(pinPurl)) toggleRepoPin(pinPurl);
    } else if (pinPathKey ?? pinPurl) {
      toggleRepoPin((pinPathKey ?? pinPurl) as string);
    }
  };
  const pinKeyAvailable = Boolean(pinPathKey ?? pinPurl);
  const [showStats, setShowStats] = useState(false);
  const [hoveredPackagePath, setHoveredPackagePath] = useState<string | null>(
    null,
  );
  useEffect(() => {
    setShowStats(false);
    setHoveredPackagePath(null);
  }, [repositoryPath, repositoryData?.fullName]);

  // State for file trees (fetched via actions)
  const [localFileTree, setLocalFileTree] = useState<FileTree | null>(null);
  const [remoteFileTree, setRemoteFileTree] = useState<FileTree | null>(null);
  const [fileTreesError, setFileTreesError] = useState<string | null>(null);

  // State for README content (for remote repos without local clones)
  const [readmeContent, setReadmeContent] = useState<string | null>(null);
  const [readmeLoading, setReadmeLoading] = useState(false);

  // State for city data (derived from file trees)
  const [cityData, setCityData] = useState<CityData | null>(null);

  // Branch badges and changed files share the same monitored snapshot.
  const { statuses: gitStatusMap } = useRepositoryStatuses(
    repositoryData?.localClones?.map((clone) => clone.path) ?? [],
  );
  const branchStatusMap = gitStatusMap;

  // State for showing path in cloned badge
  const [showPath, setShowPath] = useState(false);

  // Feedback for copying a local clone path (keyed by the path just copied).
  const [copiedClonePath, setCopiedClonePath] = useState<string | null>(null);

  const [highlightLayers, setHighlightLayers] = useState<HighlightLayer[]>([]);

  const packageSpotlightLayers = useMemo<HighlightLayer[] | null>(() => {
    if (hoveredPackagePath === null || !cityData) return null;
    const directory = hoveredPackagePath
      .replace(/\\/g, '/')
      .replace(/^\.\/|\/+$/g, '');
    const paths = new Set(
      cityData.buildings
        .filter(
          (building) =>
            !directory ||
            directory === '.' ||
            building.path.startsWith(`${directory}/`),
        )
        .map((building) => building.path),
    );
    if (paths.size === 0) return null;

    // Keep existing file colors and git borders inside the package only.
    // Leaving all-file color layers active would defeat map isolation.
    return highlightLayers
      .map((layer) => ({
        ...layer,
        items: layer.items.filter(
          (item) => item.type === 'file' && paths.has(item.path),
        ),
      }))
      .filter((layer) => layer.items.length > 0);
  }, [hoveredPackagePath, cityData, highlightLayers]);

  const changedFileSpotlightLayers = useMemo<HighlightLayer[] | null>(() => {
    if (
      showStats ||
      !repositoryPath ||
      !gitStatusMap.get(repositoryPath)?.isDirty ||
      !cityData
    )
      return null;

    const gitLayers = highlightLayers.filter(
      (layer) => layer.enabled && layer.id.startsWith('git-'),
    );
    const changedPaths = new Set(
      gitLayers.flatMap((layer) => layer.items.map((item) => item.path)),
    );
    // Only changed files count as highlighted, so unchanged files can dim.
    // Use their original file colors rather than the dimmed overview colors.
    const fileColors = createFileColorHighlightLayers(
      cityData.buildings.filter((building) => changedPaths.has(building.path)),
    ).map((layer) => ({ ...layer, priority: layer.priority + 100 }));
    return [...fileColors, ...gitLayers];
  }, [showStats, repositoryPath, gitStatusMap, cityData, highlightLayers]);
  const spotlightLayers = packageSpotlightLayers ?? changedFileSpotlightLayers;

  // Track which button is currently bouncing (by clone path)
  const [bouncingButton, setBouncingButton] = useState<string | null>(null);

  // Fork state
  const [isForked, setIsForked] = useState(false);
  const [forkedRepoOwner, setForkedRepoOwner] = useState<string | null>(null);

  // Clone modal state for repos without local clones.
  // Long-running clone progress is shown inline on this panel (not in the modal)
  // so the user can keep using the app while a clone runs.
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneProgress, setCloneProgress] = useState<CloneProgressState | null>(
    null,
  );
  const [showForkModal, setShowForkModal] = useState(false);

  // Auto-clear successful clone progress after a short celebration.
  useEffect(() => {
    if (cloneProgress?.phase !== 'complete') return;
    const timer = setTimeout(() => setCloneProgress(null), 3000);
    return () => clearTimeout(timer);
  }, [cloneProgress?.phase]);

  // Create initial highlight layers from git status and file suffixes when data loads
  useEffect(() => {
    const layers: HighlightLayer[] = [];

    // 1. First, add file suffix color layers (higher priority: 100+)
    // Higher priority = drawn first = appears underneath
    // These show the default colors for all files based on their extensions
    if (cityData?.buildings) {
      const fileSuffixLayers = createFileColorHighlightLayers(
        cityData.buildings,
      );

      // Check if there are any git changes
      const hasGitChanges =
        gitStatusMap.size > 0 &&
        Array.from(gitStatusMap.values()).some((status) => status.isDirty);

      // Dim suffix layers when git changes are present to help focus on git status
      // Also boost their priority so they render underneath git layers
      // Since git layers use borders, the dimmed suffix colors will show through
      const adjustedSuffixLayers = hasGitChanges
        ? fileSuffixLayers.map((layer) => ({
            ...layer,
            opacity: (layer.opacity ?? 1.0) * 0.2, // Reduce opacity to 20% when git changes present
            priority: layer.priority + 100, // Boost priority to render underneath git layers
          }))
        : fileSuffixLayers.map((layer) => ({
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
              items: gitStatus.stagedFiles.map((path) => ({
                type: 'file' as const,
                path,
                renderStrategy: 'border' as const,
              })),
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
              items: gitStatus.modifiedFiles.map((path) => ({
                type: 'file' as const,
                path,
                renderStrategy: 'border' as const,
              })),
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
              items: gitStatus.untrackedFiles.map((path) => ({
                type: 'file' as const,
                path,
                renderStrategy: 'border' as const,
              })),
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
              items: gitStatus.deletedFiles.map((path) => ({
                type: 'file' as const,
                path,
                renderStrategy: 'border' as const,
              })),
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

    console.info(
      '[RepositoryProfilePanel] Total highlight layers:',
      layers.length,
    );
  }, [gitStatusMap, repositoryData?.localClones, theme.colors, cityData]);

  // Check if the current user has already forked this repo
  useEffect(() => {
    const github = repositoryData?.github;
    if (!github) {
      setIsForked(false);
      return;
    }

    const login = user?.login;
    if (!login) {
      setIsForked(false);
      setForkedRepoOwner(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const userRepo = await GithubService.getRepository(login, github.name);
        const isFork =
          !!userRepo &&
          userRepo.fork === true &&
          userRepo.parent?.full_name === `${github.owner}/${github.name}`;
        if (!cancelled) {
          setIsForked(isFork);
          setForkedRepoOwner(isFork ? login : null);
        }
      } catch {
        if (!cancelled) {
          setIsForked(false);
          setForkedRepoOwner(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [repositoryData, user?.login]);

  // Fetch file trees when repository changes
  useEffect(() => {
    let cancelled = false;

    const fetchFileTrees = async () => {
      if (!repositoryData) {
        setLocalFileTree(null);
        setRemoteFileTree(null);
        setFileTreesError(null);
        setCityData(null);
        return;
      }

      setFileTreesError(null);

      try {
        const promises: Promise<void>[] = [];

        const localPath = repositoryData?.localClones?.[0]?.path;
        // Fetch local file tree if repository has a local path
        if (localPath) {
          promises.push(
            actions
              .getLocalFileTree(localPath)
              .then((tree) => {
                if (!cancelled) setLocalFileTree(tree);
              })
              .catch((error) => {
                console.error(
                  '[RepositoryProfilePanel] Failed to fetch local file tree:',
                  error,
                );
                if (!cancelled) setFileTreesError(error.message);
              }),
          );
        }

        // Fetch remote file tree if repository has GitHub info
        if (repositoryData.github) {
          promises.push(
            actions
              .getRemoteFileTree(
                repositoryData.github.owner,
                repositoryData.github.name,
              )
              .then((tree) => {
                if (!cancelled) setRemoteFileTree(tree);
              })
              .catch((error) => {
                console.error(
                  '[RepositoryProfilePanel] Failed to fetch remote file tree:',
                  error,
                );
                // Don't set error for remote failures - it's less critical
              }),
          );
        }

        await Promise.all(promises);
      } catch (error) {
        console.error(
          '[RepositoryProfilePanel] Failed to fetch file trees:',
          error,
        );
        if (!cancelled) {
          setFileTreesError(
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    };

    fetchFileTrees();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    repositoryData?.localClones,
    repositoryData?.github?.owner,
    repositoryData?.github?.name,
    actions,
  ]);

  // Fetch README content for remote repos without local clones
  useEffect(() => {
    let cancelled = false;

    const fetchReadme = async () => {
      // Only fetch README for repos without local clones
      const hasLocalClone =
        repositoryData?.localClones && repositoryData.localClones.length > 0;
      if (hasLocalClone || !repositoryData?.github) {
        setReadmeContent(null);
        setReadmeLoading(false);
        return;
      }
      if (!remoteFileTree) {
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
            const isInRoot =
              !file.relativePath.includes('/') ||
              file.relativePath.split('/').length === 1;
            if (isInRoot && readmePattern.test(file.name)) {
              return file.relativePath;
            }
          }

          return null;
        };

        const readmePath = findReadme(remoteFileTree);

        if (readmePath) {
          const branch =
            repositoryData.defaultBranch ||
            repositoryData.github?.defaultBranch ||
            undefined;
          const content = await GithubService.getFileContent(
            repositoryData.github.owner,
            repositoryData.github.name,
            readmePath,
            branch,
          );

          if (!cancelled) {
            const repoInfo = {
              owner: repositoryData.github.owner,
              repo: repositoryData.github.name,
              branch,
            };
            setReadmeContent(
              content ? transformHtmlImageUrls(content, repoInfo) : content,
            );
            setReadmeLoading(false);
          }
        } else {
          if (!cancelled) {
            setReadmeContent(null);
            setReadmeLoading(false);
          }
        }
      } catch (error) {
        console.error(
          '[RepositoryProfilePanel] Failed to fetch README:',
          error,
        );
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
  }, [
    remoteFileTree,
    repositoryData?.github,
    repositoryData?.github?.owner,
    repositoryData?.github?.name,
    repositoryData?.localClones,
    repositoryData?.defaultBranch,
  ]);

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

            finalCityData = enrichWithLineCounts(rawCityData, lineCounts);
          } catch (error) {
            console.error(
              '[RepositoryProfilePanel] Failed to get line counts:',
              error,
            );
            finalCityData = rawCityData;
          }
        } else {
          // Remote repository - no real line counts available
          finalCityData = rawCityData;
        }

        if (!cancelled) {
          setCityData(finalCityData);
        }
      } catch (error) {
        console.error(
          '[RepositoryProfilePanel] Failed to build city data:',
          error,
        );
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
    if (!repositoryData) return;

    setBouncingButton(clonePath);
    setTimeout(() => setBouncingButton(null), 2000);

    await actions.openRepository(
      clonePath,
      repositoryData.htmlUrl || undefined,
    );
  };

  // Open a terminal tab rooted at this clone's path. Emitted on the local bus;
  // the Projects open-forwarder lifts it to the portal bus where
  // PortalIntentBridge materializes the terminal tab in the shared workspace.
  const handleOpenTerminal = (clonePath: string) => {
    emitTerminalNew(events, 'repository-profile-panel', {
      directory: clonePath,
      label: repositoryData?.name,
    });
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

  // Open a repo-relative file in a workspace tab. The projects window's
  // WorkspaceShell listens for `file:opened` on this bus and routes by
  // extension (markdown → doc tab, media → media tab, else source-file tab).
  // File City + git-status paths are repo-relative, so prefix the clone root.
  const openFileInTab = (path: string) => {
    const clonePath = repositoryData?.localClones?.[0]?.path;
    if (!clonePath) return; // remote-only repos have no local file to open
    const filePath = path.startsWith('/') ? path : `${clonePath}/${path}`;
    events.emit({
      type: 'file:opened',
      source: 'repo-profile-panel',
      timestamp: Date.now(),
      payload: { filePath, repositoryPath: clonePath },
    });
  };

  // File City building click → open the file (directories are ignored).
  const handleFileCityFileClick = (
    path: string,
    type: 'file' | 'directory',
  ) => {
    if (type !== 'file') return;
    openFileInTab(path);
  };

  // Copy a local clone's full (unshortened) path to the clipboard.
  const handleCopyClonePath = async (clonePath: string) => {
    try {
      await navigator.clipboard.writeText(clonePath);
      setCopiedClonePath(clonePath);
      setTimeout(
        () => setCopiedClonePath((prev) => (prev === clonePath ? null : prev)),
        1500,
      );
    } catch (error) {
      console.error('Failed to copy clone path:', error);
    }
  };

  // Handle owner avatar click to open profile
  const handleOwnerClick = () => {
    if (repositoryData && repositoryData.owner !== 'local') {
      const isOrg = repositoryData.ownerType === 'Organization';
      console.info(
        '[RepositoryProfilePanel] Owner clicked:',
        repositoryData.owner,
        'isOrg:',
        isOrg,
      );
      events.emit({
        type: 'owner:selected',
        source: 'repository-profile-panel',
        timestamp: Date.now(),
        payload: {
          owner: repositoryData.owner,
          isOrg,
        },
      });
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
        <FolderGit2
          size={48}
          style={{ marginBottom: spacing.md, opacity: 0.5 }}
        />
        <p
          style={{
            margin: 0,
            fontSize: theme.fontSizes[2],
            fontFamily: theme.fonts?.body,
          }}
        >
          No repository selected
        </p>
        <p
          style={{
            margin: `${spacing.xs}px 0 0`,
            fontSize: theme.fontSizes[1],
            fontFamily: theme.fonts?.body,
          }}
        >
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
        <p
          style={{
            margin: 0,
            fontSize: theme.fontSizes[2],
            fontWeight: theme.fontWeights?.medium ?? 500,
            fontFamily: theme.fonts?.body,
          }}
        >
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
  const fileCount = (localFileTree ?? remoteFileTree)?.allFiles?.length;
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
        <div
          style={{
            padding: spacing.md,
            marginTop: -60,
            position: 'relative',
            display: 'flex',
            gap: spacing.lg,
            alignItems: 'stretch',
          }}
        >
          {/* Left column */}
          <div
            style={{
              flexShrink: 0,
              minWidth: 0,
            }}
          >
            {/* Avatar Section - positioned to overlap banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: spacing.md,
                marginBottom: spacing.md,
              }}
            >
              {/* Owner Avatar */}
              <div
                onClick={handleOwnerClick}
                title={
                  repositoryData.owner !== 'local'
                    ? `View ${repositoryData.owner}'s profile`
                    : undefined
                }
                style={{
                  width: 120,
                  height: 120,
                  borderRadius:
                    repositoryData.ownerType === 'User' ? '50%' : '12px',
                  backgroundColor: theme.colors.backgroundSecondary,
                  border: `4px solid ${theme.colors.background}`,
                  overflow: 'hidden',
                  flexShrink: 0,
                  position: 'relative',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                  cursor:
                    repositoryData.owner !== 'local' ? 'pointer' : 'default',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (repositoryData.owner !== 'local') {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow =
                      '0 4px 12px rgba(0, 0, 0, 0.2)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (repositoryData.owner !== 'local') {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow =
                      '0 2px 8px rgba(0, 0, 0, 0.15)';
                  }
                }}
              >
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
                  }}
                >
                  {initials}
                </div>
                {repositoryData.ownerAvatarUrl && (
                  <img
                    src={repositoryData.ownerAvatarUrl}
                    alt={repositoryData.owner}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      opacity: 0,
                      transition: 'opacity 0.15s ease',
                    }}
                    onLoad={(e) => {
                      e.currentTarget.style.opacity = '1';
                    }}
                  />
                )}
              </div>

              {/* Repository name, visibility badge, explorer */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 2,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.sm,
                  }}
                >
                  {repositoryData.isPrivate !== undefined && (
                    <span
                      style={{
                        fontSize: theme.fontSizes[0],
                        fontFamily: theme.fonts?.body,
                        color: repositoryData.isPrivate
                          ? theme.colors.textSecondary
                          : theme.colors.textMuted,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: 4,
                        padding: '2px 8px',
                        lineHeight: 1.5,
                      }}
                    >
                      {repositoryData.isPrivate ? 'Private' : 'Public'}
                    </span>
                  )}
                  {repositoryData.github &&
                    (() => {
                      const github = repositoryData.github;
                      return (
                        <button
                          onClick={() =>
                            events.emit({
                              type: 'repository:explorer-open',
                              source: 'repo-profile-panel',
                              timestamp: Date.now(),
                              payload: payloadFromGithub({
                                owner: github.owner,
                                name: github.name,
                                defaultBranch: github.defaultBranch,
                              }),
                            })
                          }
                          title="Open the explorer view"
                          style={{
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: theme.fontSizes[0],
                            fontFamily: theme.fonts?.body,
                            color: theme.colors.primary,
                            border: `1px solid ${theme.colors.primary}`,
                            borderRadius: 4,
                            padding: '2px 8px',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            lineHeight: 1.5,
                          }}
                        >
                          <LucideIcons.Compass size={11} />
                          Explorer
                        </button>
                      );
                    })()}
                  {pinKeyAvailable && (
                    <button
                      onClick={handleTogglePin}
                      title={
                        isPinned
                          ? 'Unpin repository from Home'
                          : 'Pin repository to Home'
                      }
                      aria-pressed={isPinned}
                      style={{
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: theme.fontSizes[0],
                        fontFamily: theme.fonts?.body,
                        color: isPinned
                          ? theme.colors.primary
                          : theme.colors.textSecondary,
                        border: `1px solid ${isPinned ? theme.colors.primary : theme.colors.border}`,
                        borderRadius: 4,
                        padding: '2px 8px',
                        backgroundColor: isPinned
                          ? `${theme.colors.primary}18`
                          : 'transparent',
                        cursor: 'pointer',
                        lineHeight: 1.5,
                      }}
                    >
                      {isPinned ? (
                        <BookmarkCheck size={11} />
                      ) : (
                        <Bookmark size={11} />
                      )}
                      {isPinned ? 'Pinned' : 'Pin'}
                    </button>
                  )}
                </div>
                <h2
                  onClick={
                    repositoryData.htmlUrl ? handleOpenInGitHub : undefined
                  }
                  title={repositoryData.htmlUrl ? 'Open in GitHub' : undefined}
                  style={{
                    margin: 0,
                    fontSize: theme.fontSizes[4],
                    fontWeight: theme.fontWeights?.semibold ?? 600,
                    fontFamily: theme.fonts?.heading ?? theme.fonts?.body,
                    color: theme.colors.text,
                    cursor: repositoryData.htmlUrl ? 'pointer' : 'default',
                  }}
                >
                  {repositoryData.name}
                </h2>
              </div>
            </div>

            {/* Clone / GitHub actions */}
            <div style={{ marginBottom: spacing.md }}>
              {!repositoryData.isLocal && (
                <div
                  style={{
                    marginTop: spacing.sm,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: spacing.xs,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: spacing.xs,
                      flexWrap: 'wrap',
                    }}
                  >
                    <button
                      onClick={() => setShowCloneModal(true)}
                      disabled={
                        cloneProgress?.phase === 'cloning' ||
                        cloneProgress?.phase === 'registering'
                      }
                      style={{
                        padding: `${spacing.xs}px ${spacing.sm}px`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing.xs,
                        border: 'none',
                        borderRadius: 6,
                        background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primary}dd)`,
                        color: theme.colors.background,
                        cursor:
                          cloneProgress?.phase === 'cloning' ||
                          cloneProgress?.phase === 'registering'
                            ? 'not-allowed'
                            : 'pointer',
                        opacity:
                          cloneProgress?.phase === 'cloning' ||
                          cloneProgress?.phase === 'registering'
                            ? 0.7
                            : 1,
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        fontSize: theme.fontSizes[0],
                        fontFamily: theme.fonts?.body,
                        fontWeight: theme.fontWeights?.medium ?? 500,
                        boxShadow: `0 2px 8px ${theme.colors.primary}40, 0 1px 2px rgba(0, 0, 0, 0.1)`,
                      }}
                      onMouseEnter={(e) => {
                        if (
                          cloneProgress?.phase === 'cloning' ||
                          cloneProgress?.phase === 'registering'
                        ) {
                          return;
                        }
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
                        if (
                          cloneProgress?.phase === 'cloning' ||
                          cloneProgress?.phase === 'registering'
                        ) {
                          return;
                        }
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = `0 4px 12px ${theme.colors.primary}60, 0 2px 4px rgba(0, 0, 0, 0.15)`;
                      }}
                    >
                      {cloneProgress?.phase === 'cloning' ||
                      cloneProgress?.phase === 'registering' ? (
                        <Loader2
                          size={12}
                          style={{ animation: 'spin 1s linear infinite' }}
                        />
                      ) : (
                        <Download size={12} />
                      )}
                      {cloneProgress?.phase === 'cloning' ||
                      cloneProgress?.phase === 'registering'
                        ? 'Cloning…'
                        : 'Clone'}
                    </button>
                    {isForked && forkedRepoOwner ? (
                      <button
                        onClick={() => {
                          const github = repositoryData.github;
                          if (!github) return;
                          const forkName = github.name;
                          events.emit({
                            type: 'repository:selected',
                            source: 'repository-profile-panel',
                            timestamp: Date.now(),
                            payload: payloadFromGithub({
                              owner: forkedRepoOwner,
                              name: forkName,
                            }),
                          });
                        }}
                        style={{
                          padding: `${spacing.xs}px ${spacing.sm}px`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.xs,
                          border: `1px solid ${theme.colors.primary}`,
                          borderRadius: 6,
                          background: `${theme.colors.primary}18`,
                          color: theme.colors.primary,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          fontSize: theme.fontSizes[0],
                          fontFamily: theme.fonts?.body,
                          fontWeight: theme.fontWeights?.medium ?? 500,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = `${theme.colors.primary}28`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = `${theme.colors.primary}18`;
                        }}
                      >
                        <GitFork size={12} />
                        forked: {forkedRepoOwner}
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowForkModal(true)}
                        style={{
                          padding: `${spacing.xs}px ${spacing.sm}px`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.xs,
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: 6,
                          background: 'transparent',
                          color: theme.colors.textSecondary,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          fontSize: theme.fontSizes[0],
                          fontFamily: theme.fonts?.body,
                          fontWeight: theme.fontWeights?.medium ?? 500,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = theme.colors.primary;
                          e.currentTarget.style.borderColor =
                            theme.colors.primary;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color =
                            theme.colors.textSecondary;
                          e.currentTarget.style.borderColor =
                            theme.colors.border;
                        }}
                      >
                        <GitFork size={12} />
                        Fork
                      </button>
                    )}
                  </div>
                  {/* Inline clone progress — shown here so cloning never blocks the profile behind a modal */}
                  {cloneProgress && (
                    <div
                      role="status"
                      aria-live="polite"
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: spacing.sm,
                        padding: `${spacing.xs}px ${spacing.sm}px`,
                        borderRadius: 6,
                        border: `1px solid ${
                          cloneProgress.phase === 'error'
                            ? theme.colors.error
                            : cloneProgress.phase === 'complete'
                              ? theme.colors.success
                              : theme.colors.border
                        }`,
                        backgroundColor:
                          cloneProgress.phase === 'error'
                            ? `${theme.colors.error}12`
                            : cloneProgress.phase === 'complete'
                              ? `${theme.colors.success}12`
                              : theme.colors.backgroundSecondary,
                        fontSize: theme.fontSizes[0],
                        fontFamily: theme.fonts?.body,
                        color: theme.colors.text,
                        maxWidth: '100%',
                      }}
                    >
                      <div style={{ flexShrink: 0, marginTop: 1 }}>
                        {cloneProgress.phase === 'cloning' ||
                        cloneProgress.phase === 'registering' ? (
                          <Loader2
                            size={14}
                            style={{
                              animation: 'spin 1s linear infinite',
                              color: theme.colors.primary,
                            }}
                          />
                        ) : cloneProgress.phase === 'complete' ? (
                          <CheckCircle2
                            size={14}
                            style={{ color: theme.colors.success }}
                          />
                        ) : (
                          <AlertCircle
                            size={14}
                            style={{ color: theme.colors.error }}
                          />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: theme.fontWeights?.medium ?? 500,
                            color:
                              cloneProgress.phase === 'error'
                                ? theme.colors.error
                                : cloneProgress.phase === 'complete'
                                  ? theme.colors.success
                                  : theme.colors.text,
                          }}
                        >
                          {cloneProgress.message}
                        </div>
                        {cloneProgress.phase === 'error' &&
                          cloneProgress.details && (
                            <pre
                              style={{
                                margin: `${spacing.xs}px 0 0`,
                                padding: spacing.xs,
                                maxHeight: 120,
                                overflow: 'auto',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                fontSize: 11,
                                fontFamily:
                                  theme.fonts?.monospace ?? 'monospace',
                                color: theme.colors.textSecondary,
                                backgroundColor: theme.colors.background,
                                borderRadius: 4,
                              }}
                            >
                              {cloneProgress.details}
                            </pre>
                          )}
                      </div>
                      {(cloneProgress.phase === 'error' ||
                        cloneProgress.phase === 'complete') && (
                        <div
                          style={{
                            display: 'flex',
                            gap: spacing.xs,
                            flexShrink: 0,
                            alignItems: 'center',
                          }}
                        >
                          {cloneProgress.phase === 'error' && (
                            <button
                              type="button"
                              onClick={() => {
                                setCloneProgress(null);
                                setShowCloneModal(true);
                              }}
                              style={{
                                padding: `2px ${spacing.xs}px`,
                                borderRadius: 4,
                                border: 'none',
                                background: theme.colors.primary,
                                color: theme.colors.background,
                                cursor: 'pointer',
                                fontSize: theme.fontSizes[0],
                                fontFamily: theme.fonts?.body,
                              }}
                            >
                              Retry
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setCloneProgress(null)}
                            aria-label="Dismiss clone status"
                            style={{
                              padding: 2,
                              border: 'none',
                              background: 'transparent',
                              color: theme.colors.textSecondary,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <LucideIcons.X size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
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
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: spacing.xs,
                      width: '100%',
                    }}
                  >
                    {repositoryData.localClones?.map((clone, index) => {
                      const branchStatus = branchStatusMap.get(clone.path);
                      const gitStatus = gitStatusMap.get(clone.path);

                      return (
                        <div
                          key={clone.path}
                          style={{
                            display: 'flex',
                            gap: spacing.xs,
                            alignItems: 'center',
                            flexWrap: 'wrap',
                          }}
                        >
                          {/* Clone path badge + attached "Copy Path" segment */}
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                          >
                            <button
                              onClick={() => setShowPath(!showPath)}
                              title={
                                showPath
                                  ? 'Click to show "cloned"'
                                  : `Click to show path\n${clone.path}`
                              }
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: spacing.xs,
                                padding: `${spacing.xs}px ${spacing.sm}px`,
                                backgroundColor: `${theme.colors.success}15`,
                                border: `1px solid ${theme.colors.success}30`,
                                // Square off the right edge when the copy segment
                                // is attached so the two read as one control.
                                borderRadius: showPath ? '6px 0 0 6px' : 6,
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
                                : index === 0
                                  ? 'cloned'
                                  : `clone ${index + 1}`}
                            </button>

                            {/* Copy Path — shown only when the path is expanded */}
                            {showPath && (
                              <button
                                onClick={() =>
                                  void handleCopyClonePath(clone.path)
                                }
                                title={
                                  copiedClonePath === clone.path
                                    ? 'Copied'
                                    : `Copy path\n${clone.path}`
                                }
                                aria-label="Copy clone path"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: spacing.xs,
                                  padding: `${spacing.xs}px ${spacing.sm}px`,
                                  // Overlap the seam so the shared edge is one line.
                                  marginLeft: -1,
                                  backgroundColor: `${theme.colors.success}15`,
                                  border: `1px solid ${theme.colors.success}30`,
                                  borderRadius: '0 6px 6px 0',
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
                                {copiedClonePath === clone.path ? (
                                  <>
                                    <Check size={12} />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy size={12} />
                                    Copy Path
                                  </>
                                )}
                              </button>
                            )}
                          </div>

                          {/* Branch and Status Badge for this clone */}
                          {branchStatus && (
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: spacing.xs,
                                padding: `${spacing.xs}px ${spacing.sm}px`,
                                backgroundColor:
                                  theme.colors.backgroundSecondary,
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: 6,
                                fontSize: theme.fontSizes[0],
                                fontFamily: theme.fonts?.body,
                                fontWeight: theme.fontWeights?.medium ?? 500,
                                color: theme.colors.text,
                              }}
                            >
                              {/* Sync status vs remote (shown regardless of local changes) */}
                              {(branchStatus.ahead > 0 ||
                                branchStatus.behind > 0) && (
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    color:
                                      branchStatus.ahead > 0 &&
                                      branchStatus.behind > 0
                                        ? theme.colors.error
                                        : branchStatus.behind > 0
                                          ? theme.colors.warning
                                          : theme.colors.info,
                                  }}
                                >
                                  <AlertCircle size={12} />
                                  <span>
                                    {branchStatus.ahead > 0 &&
                                    branchStatus.behind === 0
                                      ? `${branchStatus.ahead} ahead`
                                      : branchStatus.ahead === 0 &&
                                          branchStatus.behind > 0
                                        ? `${branchStatus.behind} behind`
                                        : `${branchStatus.ahead}↑ ${branchStatus.behind}↓`}
                                  </span>
                                </div>
                              )}

                              {(branchStatus.ahead > 0 ||
                                branchStatus.behind > 0) && (
                                <span
                                  style={{ color: theme.colors.textSecondary }}
                                >
                                  •
                                </span>
                              )}
                              <GitBranch size={12} />
                              <span>{branchStatus.branch}</span>

                              {/* Local working-tree changes */}
                              {gitStatus && gitStatus.isDirty && (
                                <>
                                  <span
                                    style={{
                                      color: theme.colors.textSecondary,
                                    }}
                                  >
                                    •
                                  </span>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      color: gitStatus.hasStaged
                                        ? theme.colors.warning
                                        : theme.colors.textSecondary,
                                    }}
                                  >
                                    <Circle size={8} fill="currentColor" />
                                    <span>
                                      {(() => {
                                        const total =
                                          (gitStatus.stagedFiles?.length || 0) +
                                          (gitStatus.modifiedFiles?.length ||
                                            0) +
                                          (gitStatus.untrackedFiles?.length ||
                                            0) +
                                          (gitStatus.deletedFiles?.length || 0);
                                        return total === 1
                                          ? '1 change'
                                          : `${total} changes`;
                                      })()}
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
                            className={
                              bouncingButton === clone.path
                                ? 'bounce-animation'
                                : ''
                            }
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
                              transition:
                                bouncingButton === clone.path
                                  ? 'none'
                                  : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              fontSize: theme.fontSizes[0],
                              fontFamily: theme.fonts?.body,
                              fontWeight: theme.fontWeights?.medium ?? 500,
                              boxShadow: `0 2px 8px ${theme.colors.primary}40, 0 1px 2px rgba(0, 0, 0, 0.1)`,
                            }}
                            onMouseEnter={(e) => {
                              if (bouncingButton !== clone.path) {
                                e.currentTarget.style.transform =
                                  'translateY(-2px)';
                                e.currentTarget.style.boxShadow = `0 4px 12px ${theme.colors.primary}60, 0 2px 4px rgba(0, 0, 0, 0.15)`;
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (bouncingButton !== clone.path) {
                                e.currentTarget.style.transform =
                                  'translateY(0)';
                                e.currentTarget.style.boxShadow = `0 2px 8px ${theme.colors.primary}40, 0 1px 2px rgba(0, 0, 0, 0.1)`;
                              }
                            }}
                            onMouseDown={(e) => {
                              if (bouncingButton !== clone.path) {
                                e.currentTarget.style.transform =
                                  'translateY(0)';
                                e.currentTarget.style.boxShadow = `0 1px 4px ${theme.colors.primary}30`;
                              }
                            }}
                            onMouseUp={(e) => {
                              if (bouncingButton !== clone.path) {
                                e.currentTarget.style.transform =
                                  'translateY(-2px)';
                                e.currentTarget.style.boxShadow = `0 4px 12px ${theme.colors.primary}60, 0 2px 4px rgba(0, 0, 0, 0.15)`;
                              }
                            }}
                          >
                            <FolderOpen size={12} />
                            Open
                          </button>
                          <button
                            onClick={() => handleOpenTerminal(clone.path)}
                            title="Open a terminal here"
                            style={{
                              padding: `${spacing.xs}px ${spacing.sm}px`,
                              display: 'flex',
                              alignItems: 'center',
                              gap: spacing.xs,
                              border: `1px solid ${theme.colors.border}`,
                              borderRadius: 6,
                              background: theme.colors.backgroundSecondary,
                              color: theme.colors.text,
                              cursor: 'pointer',
                              transition:
                                'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              fontSize: theme.fontSizes[0],
                              fontFamily: theme.fonts?.body,
                              fontWeight: theme.fontWeights?.medium ?? 500,
                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor =
                                theme.colors.primary;
                              e.currentTarget.style.color =
                                theme.colors.primary;
                              e.currentTarget.style.transform =
                                'translateY(-2px)';
                              e.currentTarget.style.boxShadow = `0 4px 12px ${theme.colors.primary}30, 0 2px 4px rgba(0, 0, 0, 0.1)`;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor =
                                theme.colors.border;
                              e.currentTarget.style.color = theme.colors.text;
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow =
                                '0 1px 3px rgba(0, 0, 0, 0.05)';
                            }}
                            onMouseDown={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow =
                                '0 1px 2px rgba(0, 0, 0, 0.1)';
                            }}
                            onMouseUp={(e) => {
                              e.currentTarget.style.transform =
                                'translateY(-2px)';
                              e.currentTarget.style.boxShadow = `0 4px 12px ${theme.colors.primary}30, 0 2px 4px rgba(0, 0, 0, 0.1)`;
                            }}
                          >
                            <Terminal size={12} />
                            Terminal
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
                              transition:
                                'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              fontSize: theme.fontSizes[0],
                              fontFamily: theme.fonts?.body,
                              fontWeight: theme.fontWeights?.medium ?? 500,
                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background =
                                theme.colors.error;
                              e.currentTarget.style.color =
                                theme.colors.background;
                              e.currentTarget.style.borderColor =
                                theme.colors.error;
                              e.currentTarget.style.transform =
                                'translateY(-2px)';
                              e.currentTarget.style.boxShadow = `0 4px 12px ${theme.colors.error}40, 0 2px 4px rgba(0, 0, 0, 0.1)`;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = `${theme.colors.error}08`;
                              e.currentTarget.style.color = theme.colors.error;
                              e.currentTarget.style.borderColor = `${theme.colors.error}50`;
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow =
                                '0 1px 3px rgba(0, 0, 0, 0.05)';
                            }}
                            onMouseDown={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow =
                                '0 1px 2px rgba(0, 0, 0, 0.1)';
                            }}
                            onMouseUp={(e) => {
                              e.currentTarget.style.transform =
                                'translateY(-2px)';
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
              {repositoryData.owner !== 'local' &&
                repositoryData.fullName.includes('/') && (
                  <RepositoryBuildsSection
                    purl={githubIdToPurl(repositoryData.fullName)}
                  />
                )}
            </div>
          </div>

          {/* Stats - pinned to the right of the profile row */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              alignSelf: 'flex-start',
              height: 120,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'flex-end',
              paddingBottom: spacing.xs,
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: spacing.lg,
                flexWrap: 'wrap',
                flexShrink: 0,
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: theme.fontSizes[3],
                    fontWeight: theme.fontWeights?.semibold ?? 600,
                    fontFamily: theme.fonts?.body,
                    color: theme.colors.text,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '24px',
                  }}
                >
                  {getRepositoryAge(repositoryData.createdAt)}
                </div>
                <div
                  style={{
                    fontSize: theme.fontSizes[0],
                    fontFamily: theme.fonts?.body,
                    color: theme.colors.textSecondary,
                  }}
                >
                  old
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: theme.fontSizes[3],
                    fontWeight: theme.fontWeights?.semibold ?? 600,
                    fontFamily: theme.fonts?.body,
                    color: theme.colors.text,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '24px',
                  }}
                >
                  {formatNumber(fileCount)}
                </div>
                <div
                  style={{
                    fontSize: theme.fontSizes[0],
                    fontFamily: theme.fonts?.body,
                    color: theme.colors.textSecondary,
                  }}
                >
                  files
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: theme.fontSizes[3],
                    fontWeight: theme.fontWeights?.semibold ?? 600,
                    fontFamily: theme.fonts?.body,
                    color: theme.colors.text,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '24px',
                  }}
                >
                  {formatNumber(repositoryData.totalCommits)}
                </div>
                <div
                  style={{
                    fontSize: theme.fontSizes[0],
                    fontFamily: theme.fonts?.body,
                    color: theme.colors.textSecondary,
                  }}
                >
                  commits
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section - Stats and File City 3D (fills remaining height) */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: spacing.md,
          padding: spacing.md,
          overflow: 'hidden',
        }}
      >
        {/* Repository Info - Left */}
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
              const hasLocalClone =
                repositoryData?.localClones &&
                repositoryData.localClones.length > 0;
              const firstClone = repositoryData?.localClones?.[0];
              const gitStatus = firstClone
                ? gitStatusMap.get(firstClone.path)
                : null;
              const hasChanges = gitStatus && gitStatus.isDirty;

              if (!hasLocalClone && (readmeContent || readmeLoading)) {
                return <FolderGit2 size={16} color={theme.colors.primary} />;
              } else if (hasChanges && !showStats) {
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
                const hasLocalClone =
                  repositoryData?.localClones &&
                  repositoryData.localClones.length > 0;
                const firstClone = repositoryData?.localClones?.[0];
                const gitStatus = firstClone
                  ? gitStatusMap.get(firstClone.path)
                  : null;
                const hasChanges = gitStatus && gitStatus.isDirty;

                if (!hasLocalClone && (readmeContent || readmeLoading)) {
                  return 'README';
                } else if (hasChanges && !showStats) {
                  return 'Changed Files';
                } else {
                  return 'Repository Info';
                }
              })()}
            </h4>
            {repositoryPath && gitStatusMap.get(repositoryPath)?.isDirty && (
              <button
                type="button"
                onClick={() => setShowStats((previous) => !previous)}
                style={{
                  marginLeft: 'auto',
                  padding: `${spacing.xs}px ${spacing.sm}px`,
                  background: 'transparent',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: 4,
                  color: theme.colors.primary,
                  fontSize: theme.fontSizes[1],
                  fontFamily: theme.fonts?.body,
                  cursor: 'pointer',
                }}
              >
                {showStats ? 'Changed Files' : 'Repository Info'}
              </button>
            )}
          </div>

          {(() => {
            // Check if we should show README for remote-only repos
            const hasLocalClone =
              repositoryData?.localClones &&
              repositoryData.localClones.length > 0;

            if (!hasLocalClone && readmeContent) {
              // Show README for remote-only repositories
              return (
                <div style={{ flex: 1, overflow: 'auto' }}>
                  <DocumentView
                    content={readmeContent}
                    theme={theme}
                    enableKeyboardScrolling={false}
                    transparentBackground={true}
                    repositoryInfo={
                      repositoryData.github
                        ? {
                            owner: repositoryData.github.owner,
                            repo: repositoryData.github.name,
                            branch: repositoryData.defaultBranch || undefined,
                          }
                        : undefined
                    }
                  />
                </div>
              );
            }

            if (!hasLocalClone && readmeLoading) {
              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: spacing.lg,
                    color: theme.colors.textSecondary,
                  }}
                >
                  Loading README...
                </div>
              );
            }

            // Check if we should show changed files instead of stats
            const firstClone = repositoryData?.localClones?.[0];
            const gitStatus = firstClone
              ? gitStatusMap.get(firstClone.path)
              : null;
            const hasChanges = gitStatus && gitStatus.isDirty;

            if (hasChanges && !showStats) {
              // Show changed files
              // Paths that no longer exist on disk. Git reports a staged
              // deletion in both `stagedFiles` and `deletedFiles`, so a
              // deletion can also appear under Staged — those can't open.
              const deletedSet = new Set(gitStatus.deletedFiles || []);
              const sections = [
                {
                  title: 'Staged',
                  files: gitStatus.stagedFiles || [],
                  color: theme.colors.success,
                  icon: '✓',
                },
                {
                  title: 'Modified',
                  files: gitStatus.modifiedFiles || [],
                  color: theme.colors.warning,
                  icon: '●',
                },
                {
                  title: 'Untracked',
                  files: gitStatus.untrackedFiles || [],
                  color: theme.colors.info,
                  icon: '?',
                },
                {
                  title: 'Deleted',
                  files: gitStatus.deletedFiles || [],
                  color: theme.colors.error,
                  icon: '✕',
                },
              ].filter((section) => section.files.length > 0);

              return (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: spacing.md,
                    flex: 1,
                    overflow: 'auto',
                  }}
                >
                  {sections.map((section) => (
                    <div key={section.title}>
                      <div
                        style={{
                          fontSize: theme.fontSizes[0],
                          fontWeight: theme.fontWeights?.semibold ?? 600,
                          fontFamily: theme.fonts?.body,
                          color: section.color,
                          marginBottom: spacing.xs,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        {section.title} ({section.files.length})
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 0,
                        }}
                      >
                        {section.files.map((rawPath) => {
                          // Porcelain renames arrive as "old -> new"; use the
                          // new path for opening/display.
                          const filePath = rawPath.includes(' -> ')
                            ? (rawPath.split(' -> ').pop() ?? rawPath)
                            : rawPath;
                          // A deleted file no longer exists on disk. A staged
                          // deletion also appears under Staged, so gate on the
                          // deleted set rather than the section title.
                          const openable = !deletedSet.has(rawPath);
                          return (
                            <button
                              key={rawPath}
                              type="button"
                              disabled={!openable}
                              onClick={() =>
                                openable && openFileInTab(filePath)
                              }
                              title={openable ? `Open ${filePath}` : rawPath}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: spacing.xs,
                                padding: `${spacing.sm}px ${spacing.xs}px`,
                                backgroundColor: theme.colors.background,
                                border: 'none',
                                borderRadius: theme.radii?.[1] || 4,
                                fontSize: theme.fontSizes[0],
                                fontFamily: theme.fonts?.monospace,
                                textAlign: 'left',
                                width: '100%',
                                cursor: openable ? 'pointer' : 'default',
                                transition: 'background-color 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (openable)
                                  e.currentTarget.style.backgroundColor =
                                    theme.colors.backgroundSecondary;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  theme.colors.background;
                              }}
                            >
                              <span
                                style={{
                                  color: section.color,
                                  flexShrink: 0,
                                  width: 16,
                                  textAlign: 'center',
                                }}
                              >
                                {section.icon}
                              </span>
                              <span
                                style={{
                                  color: theme.colors.text,
                                  flex: 1,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {filePath}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            }

            // Otherwise show normal stats
            return (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: spacing.md,
                }}
              >
                {repositoryPath && (
                  <RepositoryPackageList
                    key={repositoryPath}
                    repositoryPath={repositoryPath}
                    onOpenFile={openFileInTab}
                    onPackageHover={setHoveredPackagePath}
                    onOpenBrowser={actions.openLocalhostBrowser}
                  />
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
          {cityData ? (
            <ArchitectureMapHighlightLayers
              cityData={cityData}
              highlightLayers={spotlightLayers ?? highlightLayers}
              fileColorLayers={spotlightLayers ? [] : undefined}
              isolationMode={spotlightLayers ? 'transparent' : undefined}
              dimOpacity={packageSpotlightLayers ? 0.15 : 0.55}
              canvasBackgroundColor={theme.colors.backgroundSecondary}
              defaultBuildingColor={theme.colors.muted}
              defaultDirectoryColor={theme.colors.backgroundSecondary}
              enableZoom={true}
              showFileTypeIcons={true}
              showDirectoryLabels={true}
              fullSize={true}
              maxCanvasSize={2048}
              onBuildingClick={(building) =>
                handleFileCityFileClick(building.path, 'file')
              }
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

      {/* Add keyframe animations */}
      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes bounce {
          0% {
            transform: translateY(0);
            animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
          }
          10% {
            transform: translateY(-16px);
            animation-timing-function: cubic-bezier(0.755, 0.05, 0.855, 0.06);
          }
          20% {
            transform: translateY(0);
            animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
          }
          27% {
            transform: translateY(-10px);
            animation-timing-function: cubic-bezier(0.755, 0.05, 0.855, 0.06);
          }
          34% {
            transform: translateY(0);
            animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
          }
          40% {
            transform: translateY(-5px);
            animation-timing-function: cubic-bezier(0.755, 0.05, 0.855, 0.06);
          }
          46% {
            transform: translateY(0);
            animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
          }
          51% {
            transform: translateY(-2px);
            animation-timing-function: cubic-bezier(0.755, 0.05, 0.855, 0.06);
          }
          56%, 100% {
            transform: translateY(0);
          }
        }

        .bounce-animation {
          animation: bounce 2s cubic-bezier(0.22, 1, 0.36, 1) infinite;
        }
      `}</style>
      <GitCloneModal
        isOpen={showCloneModal}
        onClose={() => setShowCloneModal(false)}
        initialUrl={repositoryData?.htmlUrl ?? undefined}
        registerRepository={actions.registerRepository}
        onCloneProgress={setCloneProgress}
        onRepositoryAdded={() => {
          setShowCloneModal(false);
          events.emit({
            type: 'repository-profile:clone-completed',
            source: 'repository-profile-panel',
            timestamp: Date.now(),
            payload: {},
          });
        }}
      />
      <ForkModal
        isOpen={showForkModal}
        onClose={() => setShowForkModal(false)}
        repoOwner={repositoryData?.github?.owner ?? repositoryData?.owner ?? ''}
        repoName={repositoryData?.github?.name ?? repositoryData?.name ?? ''}
        registerRepository={actions.registerRepository}
      />
    </div>
  );
};

export default RepositoryProfilePanel;
