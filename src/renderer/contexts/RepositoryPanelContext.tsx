import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type {
  PanelContextValue,
  PanelActions,
  PanelEvent,
  PanelEventEmitter,
  RepositoryMetadata,
  DataSlice,
  PanelAdapters,
  ActiveFileSlice,
} from '@principal-ade/panel-framework-core';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { FileSystemService } from '../main-process-api/FileSystemService';
import { WindowService } from '../main-process-api/WindowService';
import { AlexandriaService } from '../main-process-api/AlexandriaService';
import { GitHubArtifactService } from '../main-process-api/GitHubArtifactService';
import {
  LocalhostDetectionService,
  type RunningServer,
} from '../main-process-api/LocalhostDetectionService';
import { TerminalService } from '../main-process-api/TerminalService';
import { GitService } from '../main-process-api/GitService';
import { SkillLockService } from '../main-process-api/SkillLockService';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { FileTree } from '@principal-ai/repository-abstraction';
import { FileTreeCore, createFileTreeSource, PathsFileTreeBuilder } from '@principal-ai/repository-abstraction';
import type { PackagesSliceData } from '@principal-ai/codebase-composition';
import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';
import { minimatch } from 'minimatch';
import { parseGitHubUrl } from '../../shared/utils/githubUrlParser';
import type { ColorMode, FileMetricData, QualitySliceData } from '@principal-ai/quality-lens-registry';
import type { GlobalSkill } from '../../shared/main-process-api-interfaces/FileSystemAPI';
import { getTracer } from '../telemetry';
import { SpanStatusCode } from '@opentelemetry/api';
import type {
  AlexandriaRepositoriesSlice,
  WorkspaceSlice,
  WorkspaceRepositoriesSlice,
  WorkspacesSlice,
} from '@industry-theme/alexandria-panels';
import type { TerminalSessionInfo } from '@industry-theme/xterm-terminal-panel';
import type { FeedProjectSliceData, ActivityHeatmapSliceData, LineCountsSliceData } from '@industry-theme/file-city-panel';
import type { GitHubIssuesSliceData } from '@industry-theme/github-panels';
import type { BrunoRequest, BrunoResponse, BrunoEnvironment } from '@principal-ade/bruno-panels';
import { BrunoService } from '../main-process-api/BrunoService';

// Color mode for file city visualization - imported from registry
// The registry's ColorMode type includes all built-in and lens-based modes
type FileCityColorMode = ColorMode;

// File city color modes slice data
interface FileCityColorModesSliceData {
  selectedColorMode: FileCityColorMode | null;
  /** Quality data for quality-based color modes (from registry's QualitySliceData) */
  qualityData?: QualitySliceData;
}

// Extend PanelActions with file system actions
// Note: Terminal actions have been moved to TerminalContext
export interface RepositoryPanelActions extends PanelActions {
  /** Read file content - supports all file types (not just markdown) - REQUIRED for MarkdownPanel */
  readFile: (filePath: string) => Promise<string>;
  /** Write file content - REQUIRED for FileEditorPanel and MDXEditorPanel */
  writeFile: (filePath: string, content: string) => Promise<void>;
  /** Get file content at a specific git revision - REQUIRED for GitDiffPanel */
  getFileContentAtRevision: (filePath: string, revision?: string) => Promise<string>;
  /** Open file in viewer - only supports markdown files */
  openFile?: (filePath: string) => Promise<void>;
  // Local Projects panel actions
  selectDirectory?: () => Promise<{ path: string; name: string } | null>;
  registerRepository?: (path: string, remoteUrl?: string) => Promise<void>;
  removeLocalRepository?: (path: string, deleteLocal: boolean) => Promise<void>;
  openLocalRepository?: (entry: AlexandriaEntry) => Promise<void>;
  // Active file management for markdown panel
  setActiveFile?: (filePath: string | null) => Promise<void>;
  // Scenario visibility (for TraceListPanel)
  updateScenarioFilterDefault?: (
    workflowPath: string,
    scenarioId: string,
    filterDefault: boolean,
  ) => Promise<void>;
  // Bruno panel actions
  /** Load and parse a .bru file, returning a BrunoRequest. Parsing happens on the host side. */
  loadBruRequest?: (path: string) => Promise<BrunoRequest>;
  /** Load all environments from environments/*.json files in the collection */
  loadEnvironments?: (collectionPath: string) => Promise<BrunoEnvironment[]>;
  /** Send an HTTP request using Bruno request format */
  sendRequest?: (request: BrunoRequest, environment?: Record<string, string>) => Promise<BrunoResponse>;
}

// Extended context for repository panels
// Note: Terminal state has been moved to TerminalContext
interface RepositoryPanelContextValue extends PanelContextValue {
  repositoryPath: string | null;
  repository: RepositoryMetadata | null;
  loading: boolean;

  // Explicit typed slice properties - no more dynamic Map lookups!
  activeFile: DataSlice<ActiveFileSlice>;
  fileTree: DataSlice<FileTree>;
  rootFileTree: DataSlice<FileTree>;
  openTabs: DataSlice<unknown[]>;
  markdown: DataSlice<unknown>;
  packages: DataSlice<PackagesSliceData | null>;
  repositoryEntry: DataSlice<AlexandriaEntry | null>;
  gitStatusWithFiles: DataSlice<GitStatusWithFiles | null>;
  alexandriaRepositories: DataSlice<AlexandriaRepositoriesSlice>;
  workspace: DataSlice<WorkspaceSlice>;
  workspaceRepositories: DataSlice<WorkspaceRepositoriesSlice>;
  workspaces: DataSlice<WorkspacesSlice>;
  quality: DataSlice<QualitySliceData | null>;
  fileCityColorModes: DataSlice<FileCityColorModesSliceData>;
  localhostServers: DataSlice<RunningServer[]>;
  globalSkills: DataSlice<{ skills: GlobalSkill[] } | null>;
  // Panel-specific slices (from ExtendedPanelContextValue)
  terminal: DataSlice<TerminalSessionInfo[]>;
  feedProject: DataSlice<FeedProjectSliceData>;
  githubIssues: DataSlice<GitHubIssuesSliceData>;
  activityHeatmap: DataSlice<ActivityHeatmapSliceData | null>;
  lineCounts: DataSlice<LineCountsSliceData | null>;
}

// Provider value that contains context, actions, and events separately
interface RepositoryPanelProviderValue {
  context: RepositoryPanelContextValue;
  actions: RepositoryPanelActions;
  events: PanelEventEmitter;
}

const RepositoryPanelContext =
  createContext<RepositoryPanelProviderValue | null>(null);

interface RepositoryPanelProviderProps {
  children: ReactNode;
  repositoryPath: string | null;
  repository: RepositoryMetadata | null;
  /** Event bus for panel communication - must be provided by parent */
  events: PanelEventEmitter;
  /** Trace source service name for OTEL MessagePort routing */
  traceSourceServiceName?: string;
  /** Open tabs from DevWorkspace - used by panels to check selection state */
  openTabs?: unknown[];
}

export const RepositoryPanelProvider: React.FC<
  RepositoryPanelProviderProps
> = ({ children, repositoryPath, repository, events, openTabs = [] }) => {
  // Track file tree for the current repository
  const [fileTreeData, setFileTreeData] = useState<FileTree | null>(null);
  const [fileTreeLoading, setFileTreeLoading] = useState(false);

  // Track root file tree for .claude/plans directory
  const [rootFileTreeData, setRootFileTreeData] = useState<FileTree | null>(null);
  const [rootFileTreeLoading, setRootFileTreeLoading] = useState(false);

  // Use a ref to always have the latest rootFileTreeData in actions
  const rootFileTreeDataRef = useRef<FileTree | null>(null);
  rootFileTreeDataRef.current = rootFileTreeData;

  // Debug log when rootFileTreeData changes
  useEffect(() => {
    console.info('[RepositoryPanelProvider] rootFileTreeData updated:', {
      hasData: !!rootFileTreeData,
      metadataId: rootFileTreeData?.metadata?.id,
      fileCount: rootFileTreeData?.allFiles?.length,
    });
  }, [rootFileTreeData]);

  // Track packages data for the current repository
  const [packagesData, setPackagesData] = useState<PackagesSliceData | null>(
    null,
  );
  const [packagesLoading, setPackagesLoading] = useState(false);

  // Track git status for the current repository
  const [gitStatusData, setGitStatusData] = useState<GitStatusWithFiles | null>(
    null,
  );
  const [gitStatusLoading, setGitStatusLoading] = useState(false);

  // Track activity heatmap data (commits per day for last 30 days)
  const [activityHeatmapData, setActivityHeatmapData] = useState<ActivityHeatmapSliceData | null>(null);
  const [activityHeatmapLoading, setActivityHeatmapLoading] = useState(false);

  // Track line counts data (for File City 3D building heights)
  const [lineCountsData, setLineCountsData] = useState<LineCountsSliceData | null>(null);
  const [lineCountsLoading, setLineCountsLoading] = useState(false);

  // Track selected color mode for file city visualization
  const [fileCityColorMode, setFileCityColorMode] =
    useState<FileCityColorMode | null>(null);

  // Track all Alexandria repositories (for Local Projects panel)
  const [alexandriaRepositories, setAlexandriaRepositories] = useState<
    AlexandriaEntry[]
  >([]);
  const [alexandriaRepositoriesLoading, setAlexandriaRepositoriesLoading] =
    useState(false);

  // Track quality metrics data (fetched from GitHub Actions artifacts)
  // Initially null - will show empty state with setup instructions
  const [qualityData, setQualityData] = useState<{
    packages: Array<{
      name: string;
      path?: string;
      version?: string;
      metrics: Record<string, number>;
      /** List of lens IDs that actually ran for this package */
      lensesRan?: string[];
      /** True if this is a monorepo orchestrator package (config-only, no source) */
      isOrchestrator?: boolean;
    }>;
    lastUpdated: string;
    /** Per-file coverage percentages from test runners */
    fileCoverage?: Record<string, number>;
    /** Per-file metrics from all lenses, keyed by lens ID */
    fileMetrics?: Record<string, FileMetricData[]>;
  } | null>(null);
  const [qualityLoading, setQualityLoading] = useState(false);

  // Loading state
  const [loading] = useState(false);

  // Track localhost servers
  const [localhostServers, setLocalhostServers] = useState<RunningServer[]>([]);
  const [localhostServersLoading, setLocalhostServersLoading] = useState(false);

  // Track terminal sessions
  const [terminalSessions, setTerminalSessions] = useState<TerminalSessionInfo[]>([]);
  const [terminalSessionsLoading, setTerminalSessionsLoading] = useState(false);

  // Track active file for markdown panel (and other file viewers)
  const [activeFileData, setActiveFileData] = useState<ActiveFileSlice | null>(null);
  const [activeFileLoading, setActiveFileLoading] = useState(false);
  const [activeFileError, setActiveFileError] = useState<Error | null>(null);

  // Track global skills from ~/.claude and ~/.agent
  const [globalSkillsData, setGlobalSkillsData] = useState<GlobalSkill[]>([]);
  const [globalSkillsLoading, setGlobalSkillsLoading] = useState(false);

  // Ref for repositoryPath so fileReader always has current value
  const repositoryPathRef = useRef<string | null>(repositoryPath);
  repositoryPathRef.current = repositoryPath;

  // Helper to extract owner/repo from git remote URL
  const parseGitHubRemote = (
    remoteUrl: string,
  ): { owner: string; repo: string } | null => parseGitHubUrl(remoteUrl);

  // Fetch file tree when repository changes and subscribe to cache sync updates
  // Strategy: Load cached data first for instant display, then refresh in background
  // Fresh data arrives via CACHE_SYNC event handled below.
  useEffect(() => {
    const fetchFileTree = async () => {
      if (!repositoryPath) {
        setFileTreeData(null);
        return;
      }

      setFileTreeLoading(true);
      try {
        // FAST PATH: Get cached data immediately for instant display
        const cachedTree = await RepositoryMonitoringService.getFileTree(repositoryPath);
        if (cachedTree) {
          setFileTreeData(cachedTree);
          setFileTreeLoading(false); // Stop loading spinner immediately
          console.info(
            '[RepositoryPanelProvider] Loaded cached file tree:',
            repositoryPath,
            `SHA: ${cachedTree.sha}`,
          );
        }

        // BACKGROUND REFRESH: Trigger fresh data fetch (will arrive via CACHE_SYNC)
        await RepositoryMonitoringService.refreshRepository(repositoryPath);
        console.info(
          '[RepositoryPanelProvider] Triggered background refresh for:',
          repositoryPath,
        );
      } catch (error) {
        console.error(
          '[RepositoryPanelProvider] Failed to fetch file tree:',
          error,
        );
        setFileTreeData(null);
        setFileTreeLoading(false);
      }
    };

    fetchFileTree();

    // Subscribe to cache sync events for fileTree updates
    const unsubscribe = RepositoryMonitoringService.onCacheSync((event) => {
      if (event.repoPath === repositoryPath && event.slice === 'fileTree') {
        if (event.entry.data) {
          const tree = event.entry.data as FileTree;
          console.info(
            '[RepositoryPanelProvider] FileTree cache sync received:',
            repositoryPath,
            `SHA: ${tree?.sha}`,
          );

          setFileTreeData(tree);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [repositoryPath]);

  // Load and watch global .claude/plans directory for Claude plans
  useEffect(() => {
    let plansDir: string;

    // Function to load plans file tree
    const loadPlansFileTree = async () => {
      setRootFileTreeLoading(true);
      try {
        // Get user's home directory
        const homePath = await FileSystemService.getHomePath();
        plansDir = `${homePath}/.claude/plans`;

        // Step 1: Read ONLY the .claude/plans directory (fast, no recursion)
        const entries = await FileSystemService.readDirectory(plansDir);

        // Step 2: Filter for plan files
        const planFileNames = entries
          .filter((entry) => entry.endsWith('.md') || entry.endsWith('.MD'));

        // Step 3: Fetch file stats for each plan file to get modification times
        const planFilesWithStats = await Promise.all(
          planFileNames.map(async (fileName) => {
            const absolutePath = `${plansDir}/${fileName}`;
            const stats = await FileSystemService.getFileStats(absolutePath);
            return {
              path: `.claude/plans/${fileName}`,
              size: stats?.size || 0,
              lastModified: stats?.lastModified || new Date(),
            };
          })
        );

        // Step 4: Build FileTree with file metadata
        const builder = new PathsFileTreeBuilder();
        const builtTree = builder.build({
          files: planFilesWithStats.map(f => f.path),
          rootPath: homePath,
        });

        // Step 5: Augment FileTree with file stats (mtime, size)
        const enrichedFileTree = {
          ...builtTree,
          allFiles: builtTree.allFiles.map((file, index) => {
            const statsEntry = planFilesWithStats[index];
            return {
              ...file,
              size: statsEntry?.size || file.size || 0,
              lastModified: statsEntry?.lastModified || file.lastModified || new Date(),
            };
          }),
        };

        // Step 6: Set metadata.id to home directory for path resolution
        const fileTree: FileTree = {
          ...enrichedFileTree,
          metadata: {
            ...enrichedFileTree.metadata,
            id: homePath, // Home directory is the base path
          },
        };

        console.info(
          '[RepositoryPanelProvider] Loaded global plans file tree:',
          plansDir,
          planFilesWithStats.length,
          'plans',
          'metadata.id:',
          fileTree.metadata?.id,
        );

        setRootFileTreeData(fileTree);
      } catch (error) {
        console.error(
          '[RepositoryPanelProvider] Failed to load global plans:',
          error,
        );
        setRootFileTreeData(null);
      } finally {
        setRootFileTreeLoading(false);
      }
    };

    // Setup file watcher for the plans directory
    const setupWatcher = async () => {
      try {
        const homePath = await FileSystemService.getHomePath();
        plansDir = `${homePath}/.claude/plans`;

        await FileSystemService.watchDirectory({
          directoryPath: plansDir,
          fileTypes: ['.md', '.MD'],
          isSubdirectory: false,
        });
        console.info('[RepositoryPanelProvider] Started watching global plans directory:', plansDir);
      } catch (error) {
        console.error('[RepositoryPanelProvider] Failed to setup global plans watcher:', error);
      }
    };

    // Initial load
    loadPlansFileTree();
    setupWatcher();

    // Subscribe to directory change events
    const unsubscribe = FileSystemService.onDirectoryChange((event) => {
      if (event.path && event.path.includes('.claude/plans/')) {
        console.info(
          `[RepositoryPanelProvider] Global plans directory ${event.type}:`,
          event.path,
        );
        // Reload plans when directory changes
        loadPlansFileTree();
      }
    });

    return () => {
      unsubscribe();
      if (plansDir) {
        FileSystemService.stopWatchingDirectory(plansDir).catch((error) => {
          console.error('[RepositoryPanelProvider] Failed to stop watching global plans directory:', error);
        });
      }
    };
  }, []); // Run once on mount, watch global directory

  // Fetch packages when repository changes and subscribe to cache sync updates
  useEffect(() => {
    const fetchPackages = async () => {
      if (!repositoryPath) {
        setPackagesData(null);
        return;
      }

      setPackagesLoading(true);
      try {
        const result =
          await RepositoryMonitoringService.getPackages(repositoryPath);
        if (result) {
          console.info(
            '[RepositoryPanelProvider] Fetched packages for repository:',
            repositoryPath,
            result.packages.length,
            'packages',
          );
          setPackagesData(result);
        } else {
          setPackagesData(null);
        }
      } catch (error) {
        console.error(
          '[RepositoryPanelProvider] Failed to fetch packages:',
          error,
        );
        setPackagesData(null);
      } finally {
        setPackagesLoading(false);
      }
    };

    fetchPackages();

    // Subscribe to cache sync events for packages updates
    const unsubscribe = RepositoryMonitoringService.onCacheSync((event) => {
      if (event.repoPath === repositoryPath && event.slice === 'packages') {
        console.info(
          '[RepositoryPanelProvider] Packages cache sync received for repository:',
          repositoryPath,
        );
        if (event.entry.data) {
          setPackagesData(event.entry.data as PackagesSliceData);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [repositoryPath]);

  // Fetch git status when repository changes and subscribe to updates
  useEffect(() => {
    const fetchGitStatus = async () => {
      if (!repositoryPath) {
        setGitStatusData(null);
        return;
      }

      setGitStatusLoading(true);
      try {
        const status =
          await RepositoryMonitoringService.getGitStatusWithFiles(
            repositoryPath,
          );
        console.info(
          '[RepositoryPanelProvider] Fetched git status for repository:',
          repositoryPath,
        );
        setGitStatusData(status);
      } catch (error) {
        console.error(
          '[RepositoryPanelProvider] Failed to fetch git status:',
          error,
        );
        setGitStatusData(null);
      } finally {
        setGitStatusLoading(false);
      }
    };

    fetchGitStatus();

    // Subscribe to git status changes - event now includes full GitStatusWithFiles
    const unsubscribe = RepositoryMonitoringService.onGitStatusChanged(
      (data) => {
        if (data.repoPath === repositoryPath) {
          console.info(
            '[RepositoryPanelProvider] Git status changed for repository:',
            repositoryPath,
          );
          // Use the event data directly - it now includes file arrays and hash
          setGitStatusData(data);
        }
      },
    );

    return () => {
      unsubscribe();
    };
  }, [repositoryPath]);

  // Fetch activity heatmap data (commits per day for last 30 days)
  useEffect(() => {
    const fetchActivityHeatmap = async () => {
      if (!repositoryPath) {
        setActivityHeatmapData(null);
        return;
      }

      setActivityHeatmapLoading(true);
      try {
        const commitDates = await GitService.getCommitDatesForHeatMap(repositoryPath, 30);
        setActivityHeatmapData({
          days: commitDates.map(d => ({ date: d.date, count: d.count })),
        });
      } catch (error) {
        console.error('[RepositoryPanelProvider] Failed to fetch activity heatmap:', error);
        setActivityHeatmapData(null);
      } finally {
        setActivityHeatmapLoading(false);
      }
    };

    fetchActivityHeatmap();
  }, [repositoryPath]);

  // Fetch line counts data (for File City 3D building heights)
  useEffect(() => {
    const fetchLineCounts = async () => {
      if (!repositoryPath) {
        setLineCountsData(null);
        return;
      }

      setLineCountsLoading(true);
      try {
        const rawLineCounts = await window.mainProcess?.fileCityImage?.countLines(repositoryPath);
        if (rawLineCounts) {
          // Transform paths to use relative paths (strip repo name prefix if present)
          const repoName = repositoryPath.split('/').pop() || '';
          const lineCounts: Record<string, number> = {};
          for (const [filePath, count] of Object.entries(rawLineCounts)) {
            if (typeof count !== 'number' || count < 0) continue;
            // Strip repo name prefix if present (e.g., "electron-app/src/file.ts" -> "src/file.ts")
            if (filePath.startsWith(repoName + '/')) {
              lineCounts[filePath.slice(repoName.length + 1)] = count;
            } else {
              lineCounts[filePath] = count;
            }
          }
          setLineCountsData({
            lineCounts,
            status: 'available',
          });
        }
      } catch (error) {
        console.error('[RepositoryPanelProvider] Failed to fetch line counts:', error);
        setLineCountsData(null);
      } finally {
        setLineCountsLoading(false);
      }
    };

    fetchLineCounts();
  }, [repositoryPath]);

  // Fetch all Alexandria repositories (for Local Projects panel) and subscribe to changes
  useEffect(() => {
    const fetchAlexandriaRepositories = async () => {
      setAlexandriaRepositoriesLoading(true);
      try {
        const repos = await AlexandriaService.getRepositories();
        console.info(
          '[RepositoryPanelProvider] Fetched Alexandria repositories:',
          repos.length,
        );
        setAlexandriaRepositories(repos);
      } catch (error) {
        console.error(
          '[RepositoryPanelProvider] Failed to fetch Alexandria repositories:',
          error,
        );
        setAlexandriaRepositories([]);
      } finally {
        setAlexandriaRepositoriesLoading(false);
      }
    };

    fetchAlexandriaRepositories();

    // Subscribe to repository changes
    const unsubscribe = AlexandriaService.onRepositoryChange((event) => {
      console.info(
        '[RepositoryPanelProvider] Alexandria repository change:',
        event.type,
      );
      // Refetch repositories on any change
      fetchAlexandriaRepositories();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Extract stable identifiers for memoization (prevents unnecessary re-renders)
  // Only stabilize data that actually has SHA/timestamp/ID - not arrays
  // For fileTree, use the SHA which is now content-based (changes with each file modification)
  const fileTreeStableId = fileTreeData?.sha;
  const qualityDataTimestamp = qualityData?.lastUpdated;
  const activeFilePath = activeFileData?.path;
  // Git status hash is now computed at the source (repository-monitoring-server)
  const gitStatusHash = gitStatusData?.hash;

  // Localhost servers doesn't have a natural stable ID, so compute a hash
  // This prevents re-renders when the array reference changes but content is the same
  const localhostServersHash = useMemo(() => {
    if (!localhostServers || localhostServers.length === 0) return 'empty';
    // Hash based on port, pid, and label (the identifying characteristics)
    return JSON.stringify(
      localhostServers.map(s => ({
        port: s.port,
        pid: s.pid,
        label: s.label,
      })).sort((a, b) => a.port - b.port)
    );
  }, [localhostServers]);

  // Create stable references for data objects - only update when their stable ID changes
  // This prevents unnecessary re-renders of all panels when object references change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableFileTreeData = useMemo(() => fileTreeData, [fileTreeStableId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableQualityData = useMemo(() => qualityData, [qualityDataTimestamp]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableActiveFileData = useMemo(() => activeFileData, [activeFilePath]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableGitStatusData = useMemo(() => gitStatusData, [gitStatusHash]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableLocalhostServers = useMemo(() => localhostServers, [localhostServersHash]);

  // Augment file tree with deleted files from git status
  const augmentedFileTreeData = useMemo(() => {
    if (!stableFileTreeData || !stableGitStatusData?.deletedFiles?.length) {
      return stableFileTreeData;
    }

    // Create file entries for deleted files
    const deletedFileInfos = stableGitStatusData.deletedFiles.map(filePath => ({
      path: filePath,
      size: 0,
      lastModified: new Date(0),
    }));

    // Use FileTreeCore.augmentWithFiles() to properly rebuild tree structure
    return FileTreeCore.augmentWithFiles(
      stableFileTreeData,
      deletedFileInfos,
      {
        updateSha: (baseSha, count) => `${baseSha}-deleted:${count}`,
        fileDefaults: { size: 0, lastModified: new Date(0) },
      }
    );
  }, [stableFileTreeData, stableGitStatusData]);

  // Compute effective color mode: use explicit selection, or auto-select 'git' if there are changes
  const effectiveColorMode = useMemo((): FileCityColorMode => {
    // If explicitly set, use that
    if (fileCityColorMode) {
      return fileCityColorMode;
    }
    // Auto-select 'git' mode if there are any git changes
    if (stableGitStatusData) {
      const hasChanges =
        stableGitStatusData.stagedFiles.length > 0 ||
        stableGitStatusData.modifiedFiles.length > 0 ||
        stableGitStatusData.untrackedFiles.length > 0 ||
        stableGitStatusData.deletedFiles.length > 0;
      if (hasChanges) {
        return 'git';
      }
    }
    // Default to file types
    return 'fileTypes';
  }, [fileCityColorMode, stableGitStatusData]);

  // Listen for workspace file change events and trigger refresh
  // This ensures file tree updates when files are added/removed
  // We use refreshRepository() instead of getFileTree() to avoid race conditions
  useEffect(() => {
    if (!repositoryPath) {
      return;
    }

    const unsubscribe = RepositoryMonitoringService.onWorkspaceChange((event) => {
      if (event.repoPath === repositoryPath) {
        console.info(
          '[RepositoryPanelProvider] Workspace changed, refreshing file tree:',
          repositoryPath,
        );
        // Use refreshRepository() to invalidate cache and wait for CACHE_SYNC
        // This avoids the race condition of calling getFileTree() which returns stale data
        RepositoryMonitoringService.refreshRepository(repositoryPath).catch((error) => {
          console.error(
            '[RepositoryPanelProvider] Failed to refresh after workspace change:',
            error,
          );
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [repositoryPath]);

  // Listen for color mode change events from panels (e.g., quality hexagon clicks)
  // The QualityHexagonPanel emits 'quality:colorMode:select' with payload { colorMode }
  useEffect(() => {
    const tracer = getTracer('principal-ade-dev-workspace');

    // Listen for the event emitted by QualityHexagonPanel
    const unsubColorMode = events.on<{ colorMode: string }>(
      'quality:colorMode:select',
      (event) => {
        const { colorMode } = event.payload;
        if (colorMode) {
          // Create a span for the color mode change operation
          const span = tracer.startSpan('quality.colorMode.change', {
            attributes: {
              'colorMode.name': colorMode,
              'colorMode.previous': fileCityColorMode || 'none',
            },
          });

          // Emit color mode selected event
          span.addEvent('quality.colorMode.selected', {
            'colorMode.name': colorMode,
            'colorMode.previous': fileCityColorMode || 'none',
          });

          console.info(
            '[RepositoryPanelProvider] Color mode changed via quality:colorMode:select:',
            colorMode,
          );
          setFileCityColorMode(colorMode as FileCityColorMode);

          // Emit File City re-render event
          span.addEvent('quality.fileCity.rerendered', {
            'colorMode.name': colorMode,
          });

          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
        }
      },
    );

    // Also listen for legacy 'filecity:colormode' events for backwards compatibility
    const unsubLegacy = events.on('filecity:colormode', (event) => {
      const mode = event.payload as FileCityColorMode | null;
      console.info(
        '[RepositoryPanelProvider] Color mode changed via filecity:colormode:',
        mode,
      );
      setFileCityColorMode(mode);
    });

    return () => {
      unsubColorMode?.();
      unsubLegacy?.();
    };
  }, [events, fileCityColorMode]);

  // Listen for refresh requests from AgenticResourcesPanel
  useEffect(() => {
    const unsubscribeSkillsRefresh = events.on('skills:refresh', async () => {
      console.info('[RepositoryPanelProvider] Received skills:refresh event, refreshing global skills and file tree');

      // Refresh both global skills and file tree (for project skills)
      try {
        await Promise.all([
          // Refresh global skills from ~/.claude/skills and ~/.agent/skills
          (async () => {
            setGlobalSkillsLoading(true);
            try {
              const skills = await FileSystemService.getGlobalSkills();
              console.info('[RepositoryPanelProvider] Refreshed global skills:', skills.length);
              setGlobalSkillsData(skills);
            } catch (error) {
              console.error('[RepositoryPanelProvider] Failed to refresh global skills:', error);
            } finally {
              setGlobalSkillsLoading(false);
            }
          })(),
          // Refresh file tree for project skills
          (async () => {
            if (repositoryPath) {
              setFileTreeLoading(true);
              try {
                await RepositoryMonitoringService.refreshRepository(repositoryPath);
                console.info('[RepositoryPanelProvider] Refreshed file tree for project skills');
              } catch (error) {
                console.error('[RepositoryPanelProvider] Failed to refresh file tree:', error);
              } finally {
                setFileTreeLoading(false);
              }
            }
          })(),
        ]);
      } catch (error) {
        console.error('[RepositoryPanelProvider] Error during skills refresh:', error);
      }
    });

    const unsubscribeAgentsRefresh = events.on('agents:refresh', async () => {
      console.info('[RepositoryPanelProvider] Received agents:refresh event, refreshing file tree');

      // Refresh file tree to pick up new AGENTS.md and subagent files
      if (repositoryPath) {
        setFileTreeLoading(true);
        try {
          await RepositoryMonitoringService.refreshRepository(repositoryPath);
          console.info('[RepositoryPanelProvider] Refreshed file tree for agents');
        } catch (error) {
          console.error('[RepositoryPanelProvider] Failed to refresh file tree for agents:', error);
        } finally {
          setFileTreeLoading(false);
        }
      }
    });

    return () => {
      unsubscribeSkillsRefresh?.();
      unsubscribeAgentsRefresh?.();
    };
  }, [events, repositoryPath]);

  // Fetch quality metrics from GitHub Actions artifacts when repository changes
  useEffect(() => {
    const tracer = getTracer('principal-ade-dev-workspace');

    const fetchQualityMetrics = async () => {
      if (!repositoryPath) {
        setQualityData(null);
        return;
      }

      setQualityLoading(true);

      // Start the parent span for the entire artifact fetch operation
      const span = tracer.startSpan('quality.artifact.fetch', {
        attributes: {
          'repository.path': repositoryPath,
        },
      });

      try {
        // Step 1: Resolve git remote
        span.addEvent('quality.artifact.step.remote', {
          'step': 'Resolving git remote',
          'repository.path': repositoryPath,
        });

        const remoteInfo =
          await RepositoryMonitoringService.getGitRemoteInfo(repositoryPath);
        if (!remoteInfo?.remoteUrl) {
          console.info(
            '[RepositoryPanelProvider] No git remote, cannot fetch quality metrics',
          );
          span.addEvent('quality.artifact.skipped', {
            'skip.reason': 'no_git_remote',
            'message': 'Repository has no git remote configured',
          });
          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
          setQualityData(null);
          return;
        }

        span.addEvent('quality.artifact.step.remote.resolved', {
          'step': 'Git remote resolved',
          'remote.url': remoteInfo.remoteUrl,
        });

        // Step 2: Parse GitHub info
        const githubInfo = parseGitHubRemote(remoteInfo.remoteUrl);
        if (!githubInfo) {
          console.info('[RepositoryPanelProvider] Not a GitHub repository');
          span.addEvent('quality.artifact.skipped', {
            'skip.reason': 'not_github',
            'message': 'Remote URL is not a GitHub repository',
            'remote.url': remoteInfo.remoteUrl,
          });
          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
          setQualityData(null);
          return;
        }

        // Add GitHub info to span
        span.setAttribute('github.owner', githubInfo.owner);
        span.setAttribute('github.repo', githubInfo.repo);

        span.addEvent('quality.artifact.step.github.parsed', {
          'step': 'GitHub info parsed',
          'github.owner': githubInfo.owner,
          'github.repo': githubInfo.repo,
        });

        // Step 3: Get current branch
        span.addEvent('quality.artifact.step.branch', {
          'step': 'Getting current branch',
        });

        const gitStatus =
          await RepositoryMonitoringService.getGitStatus(repositoryPath);

        // Debug: log gitStatus structure
        console.info('[RepositoryPanelProvider] gitStatus:', JSON.stringify(gitStatus, null, 2));

        // Extract branch - gitStatus.branch should be a string per GitStatusMetadata
        const branch = gitStatus?.branch ?? 'main';
        const branchSource = gitStatus?.branch ? 'git status' : 'default';
        span.setAttribute('git.branch', branch);

        span.addEvent('quality.artifact.step.branch.resolved', {
          'step': 'Branch resolved',
          'git.branch': branch,
          'git.branchSource': branchSource,
        });

        // Step 4: Emit fetching event (starting API call)
        span.addEvent('quality.artifact.fetching', {
          'github.owner': githubInfo.owner,
          'github.repo': githubInfo.repo,
          'git.branch': branch,
        });

        console.info(
          `[RepositoryPanelProvider] Fetching quality metrics for ${githubInfo.owner}/${githubInfo.repo}@${branch}`,
        );

        // Step 5: Call GitHub API
        span.addEvent('quality.artifact.step.api.calling', {
          'step': 'Calling GitHub Actions API',
          'github.owner': githubInfo.owner,
          'github.repo': githubInfo.repo,
          'git.branch': branch,
        });

        const apiStartTime = Date.now();
        const artifactData =
          await GitHubArtifactService.getLatestQualityMetrics(
            githubInfo.owner,
            githubInfo.repo,
            branch,
          );
        const apiDuration = Date.now() - apiStartTime;

        span.addEvent('quality.artifact.step.api.complete', {
          'step': 'GitHub API call complete',
          'api.duration.ms': apiDuration,
          'api.found': artifactData !== null,
        });

        if (artifactData) {
          // Emit artifact received event
          span.addEvent('quality.artifact.received', {
            'github.owner': githubInfo.owner,
            'github.repo': githubInfo.repo,
            'git.branch': branch,
            'packages.count': artifactData.qualityMetrics.packages.length,
            'artifact.timestamp': artifactData.timestamp,
          });

          // Transform to the format expected by the quality slice
          // Include lensesRan and isOrchestrator so the panel knows which metrics are configured
          const packages = artifactData.qualityMetrics.packages.map((pkg) => ({
            name: pkg.name,
            path: pkg.path,
            metrics: pkg.hexagon as unknown as Record<string, number>,
            lensesRan: pkg.lensesRan,
            isOrchestrator: pkg.isOrchestrator,
          }));

          // Log what file metrics we received
          const fileMetricsKeys = artifactData.fileMetrics
            ? Object.keys(artifactData.fileMetrics)
            : [];
          console.info(
            `[RepositoryPanelProvider] Quality metrics loaded: ${packages.length} packages, ` +
              `fileCoverage: ${artifactData.fileCoverage ? Object.keys(artifactData.fileCoverage).length : 0} files, ` +
              `fileMetrics: ${fileMetricsKeys.join(', ') || 'none'}`,
          );

          setQualityData({
            packages,
            lastUpdated: artifactData.timestamp,
            // Include per-file data for File City visualization
            fileCoverage: artifactData.fileCoverage,
            fileMetrics: artifactData.fileMetrics as Record<string, FileMetricData[]> | undefined,
          });

          // Emit context updated event
          span.addEvent('quality.context.updated', {
            'repository.path': repositoryPath,
            'quality.packages.count': packages.length,
            'quality.lastUpdated': artifactData.timestamp,
          });

          span.setAttribute('packages.count', packages.length);
          span.setStatus({ code: SpanStatusCode.OK });
        } else {
          // Emit not found event
          span.addEvent('quality.artifact.notFound', {
            'github.owner': githubInfo.owner,
            'github.repo': githubInfo.repo,
            'git.branch': branch,
          });

          span.setStatus({ code: SpanStatusCode.OK });
          setQualityData(null);
        }
      } catch (error) {
        console.error(
          '[RepositoryPanelProvider] Failed to fetch quality metrics:',
          error,
        );
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        setQualityData(null);
      } finally {
        span.end();
        setQualityLoading(false);
      }
    };

    fetchQualityMetrics();
  }, [repositoryPath]);

  // Initialize localhost server detection
  useEffect(() => {
    let unsubscribeUpdates: (() => void) | null = null;
    let watchId: string | null = null;

    const initLocalhostDetection = async () => {
      setLocalhostServersLoading(true);
      try {
        // Start watching for localhost servers
        const { watchId: id } = await LocalhostDetectionService.startWatching(
          undefined,
          5000,
        );
        watchId = id;

        // Subscribe to updates
        unsubscribeUpdates = LocalhostDetectionService.onServersUpdated(
          (result) => {
            setLocalhostServers(result.servers);
          },
        );

        // Fetch initial servers
        const result = await LocalhostDetectionService.detectRunningServers();
        setLocalhostServers(result.servers);
      } catch (error) {
        console.error(
          '[RepositoryPanelContext] Failed to initialize localhost detection:',
          error,
        );
      } finally {
        setLocalhostServersLoading(false);
      }
    };

    initLocalhostDetection();

    return () => {
      // Cleanup: stop watching and unsubscribe
      if (watchId) {
        LocalhostDetectionService.stopWatching(watchId).catch((err) => {
          console.error(
            '[RepositoryPanelContext] Failed to stop localhost watching:',
            err,
          );
        });
      }
      if (unsubscribeUpdates) {
        unsubscribeUpdates();
      }
    };
  }, []);

  // Fetch terminal sessions and subscribe to TIPC updates
  useEffect(() => {
    const fetchTerminalSessions = async () => {
      setTerminalSessionsLoading(true);
      try {
        const sessions = await TerminalService.list();
        // Map TerminalInfo to TerminalSessionInfo
        const sessionInfos: TerminalSessionInfo[] = sessions.map((s) => ({
          id: s.id,
          pid: 0,
          cwd: s.directory || '',
          shell: '',
          createdAt: s.createdAt || Date.now(),
          lastActivity: s.lastActivity || Date.now(),
          context: s.context,
          status: s.status,
          metadata: s.metadata,
          agentSessionId: s.agentSessionId,
          ownedByWindowId: s.ownedByWindowId,
        }));
        setTerminalSessions(sessionInfos);
      } catch (error) {
        console.error(
          '[RepositoryPanelContext] Failed to fetch terminal sessions:',
          error,
        );
      } finally {
        setTerminalSessionsLoading(false);
      }
    };

    // Initial fetch
    fetchTerminalSessions();

    // Subscribe to session changes via TIPC (from main process)
    const unsubscribeSessions = TerminalService.onSessionsChanged((sessions) => {
      // Map TerminalInfo to TerminalSessionInfo
      const sessionInfos: TerminalSessionInfo[] = sessions.map((s) => ({
        id: s.id,
        pid: 0,
        cwd: s.directory || '',
        shell: '',
        createdAt: s.createdAt || Date.now(),
        lastActivity: s.lastActivity || Date.now(),
        context: s.context,
        status: s.status,
        metadata: s.metadata,
        agentSessionId: s.agentSessionId,
        ownedByWindowId: s.ownedByWindowId,
      }));
      setTerminalSessions(sessionInfos);
    });

    return () => {
      unsubscribeSessions();
    };
  }, []);

  // Fetch global skills from ~/.claude and ~/.agent
  useEffect(() => {
    const fetchGlobalSkills = async () => {
      setGlobalSkillsLoading(true);
      try {
        const skills = await FileSystemService.getGlobalSkills();
        console.info(
          '[RepositoryPanelProvider] Fetched global skills:',
          skills.length,
        );
        setGlobalSkillsData(skills);
      } catch (error) {
        console.error(
          '[RepositoryPanelProvider] Failed to fetch global skills:',
          error,
        );
        setGlobalSkillsData([]);
      } finally {
        setGlobalSkillsLoading(false);
      }
    };

    fetchGlobalSkills();

    // Listen for skill changes from any window (IPC broadcasts from main process)
    const unsubInstall = SkillLockService.onSkillInstalled((payload) => {
      console.info('[RepositoryPanelProvider] Skill installed, refreshing global skills:', payload.skillName);
      fetchGlobalSkills();
    });
    const unsubUninstall = SkillLockService.onSkillUninstalled((payload) => {
      console.info('[RepositoryPanelProvider] Skill uninstalled, refreshing global skills:', payload.skillName);
      fetchGlobalSkills();
    });
    const unsubUpdate = SkillLockService.onSkillUpdated((payload) => {
      console.info('[RepositoryPanelProvider] Skill updated, refreshing global skills:', payload.skillName);
      fetchGlobalSkills();
    });

    return () => {
      unsubInstall();
      unsubUninstall();
      unsubUpdate();
    };
  }, []);

  // Create actions object
  // Note: Terminal actions have been moved to TerminalContext
  const actions: RepositoryPanelActions = useMemo(
    () => ({
      notifyPanels: (event: PanelEvent) => {
        events.emit(event);
      },

      // File system actions - readFile supports both absolute and relative paths
      readFile: async (filePath: string) => {
        try {
          // Use ref to get the latest rootFileTreeData value
          const currentRootFileTree = rootFileTreeDataRef.current;

          console.info('[RepositoryPanelProvider] readFile called with:', {
            filePath,
            includesClaude: filePath.includes('.claude/plans/'),
            rootFileTreeMetadataId: currentRootFileTree?.metadata?.id,
            repositoryPath,
          });

          let absolutePath: string;

          // Check if this is a plan file from the global .claude/plans directory
          if (filePath.includes('.claude/plans/')) {
            const basePath = currentRootFileTree?.metadata?.id;
            console.info('[RepositoryPanelProvider] Plan file detected. basePath:', basePath);

            if (basePath) {
              // If path is already absolute but wrong (uses repositoryPath instead of home)
              // Fix it by extracting the relative part and re-resolving
              if (repositoryPath && filePath.startsWith(repositoryPath + '/')) {
                // Extract relative path: /repo/.claude/plans/file.md -> .claude/plans/file.md
                const relativePath = filePath.substring(repositoryPath.length + 1);
                absolutePath = `${basePath}/${relativePath}`;
                console.info('[RepositoryPanelProvider] Fixed wrong absolute path:', {
                  original: filePath,
                  relativePath,
                  corrected: absolutePath,
                });
              } else if (filePath.startsWith('/')) {
                // Already absolute and might be correct
                absolutePath = filePath;
              } else {
                // Relative path
                absolutePath = `${basePath}/${filePath}`;
              }
              console.info('[RepositoryPanelProvider] Reading plan file from home dir:', absolutePath);
            } else {
              console.warn('[RepositoryPanelProvider] rootFileTree metadata.id not available, using fallback');
              absolutePath = filePath.startsWith('/')
                ? filePath
                : `${repositoryPath}/${filePath}`;
            }
          } else {
            // Regular repository file - resolve against repository path
            absolutePath = filePath.startsWith('/')
              ? filePath
              : `${repositoryPath}/${filePath}`;
            console.info('[RepositoryPanelProvider] Reading repository file:', absolutePath);
          }

          const result = await FileSystemService.readFile(absolutePath);
          if (!result) {
            throw new Error(`File not found: ${absolutePath}`);
          }
          return result.content;
        } catch (error) {
          console.error(
            '[RepositoryPanelProvider] Failed to read file:',
            filePath,
            error,
          );
          throw error;
        }
      },

      writeFile: async (filePath: string, content: string) => {
        try {
          // Resolve relative paths against the repository path
          const absolutePath = filePath.startsWith('/')
            ? filePath
            : `${repositoryPath}/${filePath}`;
          await FileSystemService.writeFile(absolutePath, content);
        } catch (error) {
          console.error(
            '[RepositoryPanelProvider] Failed to write file:',
            filePath,
            error,
          );
          throw error;
        }
      },

      getFileContentAtRevision: async (filePath: string, revision: string = 'HEAD') => {
        if (!repositoryPath) {
          throw new Error('No repository path set');
        }

        // Calculate the path relative to repository root
        let pathRelativeToRepo = filePath;
        if (filePath.startsWith('/')) {
          // If absolute path, make it relative to repository root
          if (filePath.startsWith(repositoryPath + '/')) {
            pathRelativeToRepo = filePath.substring(repositoryPath.length + 1);
          } else if (filePath === repositoryPath) {
            pathRelativeToRepo = '';
          } else {
            throw new Error(`File path is outside repository: ${filePath}`);
          }
        }

        console.info('[RepositoryPanelProvider] getFileContentAtRevision:', {
          repositoryPath,
          originalPath: filePath,
          pathRelativeToRepo,
          revision
        });

        // Use FileSystemService to call IPC with the relative path
        const content = await FileSystemService.getFileContentAtRevision(
          repositoryPath,
          pathRelativeToRepo,
          revision
        );

        if (content === null) {
          throw new Error(`File not found at revision ${revision}: ${filePath}`);
        }

        return content;
      },

      openFile: async (filePath: string): Promise<void> => {
        try {
          // Use ref to get the latest rootFileTreeData value
          const currentRootFileTree = rootFileTreeDataRef.current;

          let absolutePath: string;

          // Check if this is a plan file from the global .claude/plans directory
          if (filePath.includes('.claude/plans/')) {
            const basePath = currentRootFileTree?.metadata?.id;
            if (basePath) {
              // If path is already absolute but wrong (uses repositoryPath instead of home)
              if (repositoryPath && filePath.startsWith(repositoryPath + '/')) {
                const relativePath = filePath.substring(repositoryPath.length + 1);
                absolutePath = `${basePath}/${relativePath}`;
                console.info('[RepositoryPanelProvider] Fixed wrong absolute path for openFile:', {
                  original: filePath,
                  corrected: absolutePath,
                });
              } else if (filePath.startsWith('/')) {
                absolutePath = filePath;
              } else {
                absolutePath = `${basePath}/${filePath}`;
              }
              console.info('[RepositoryPanelProvider] Opening plan file from home dir:', absolutePath);
            } else {
              console.warn('[RepositoryPanelProvider] rootFileTree metadata.id not available for openFile, using fallback');
              absolutePath = filePath.startsWith('/')
                ? filePath
                : `${repositoryPath}/${filePath}`;
            }
          } else {
            // Regular repository file
            absolutePath = filePath.startsWith('/')
              ? filePath
              : `${repositoryPath}/${filePath}`;
          }

          console.info('[RepositoryPanelProvider] Opening file:', absolutePath);

          // Emit file:opened event - let the workspace layouts decide how to handle it
          events.emit({
            type: 'file:opened',
            source: 'repository-panel',
            timestamp: Date.now(),
            payload: { filePath: absolutePath },
          });
        } catch (error) {
          console.error(
            '[RepositoryPanelProvider] Failed to open file:',
            filePath,
            error,
          );
          throw error;
        }
      },

      // Local Projects panel actions
      selectDirectory: async () => {
        try {
          const result = await FileSystemService.selectDirectory({
            title: 'Select Project Directory',
            buttonLabel: 'Add Project',
            properties: ['openDirectory'],
          });
          if (
            result &&
            !result.canceled &&
            'filePaths' in result &&
            result.filePaths.length > 0
          ) {
            const selectedPath = result.filePaths[0];
            // Extract the directory name from the path
            const name = selectedPath.split('/').pop() || selectedPath;
            return { path: selectedPath, name };
          }
          return null;
        } catch (error) {
          console.error(
            '[RepositoryPanelProvider] Failed to select directory:',
            error,
          );
          return null;
        }
      },

      registerRepository: async (path: string, remoteUrl?: string) => {
        try {
          await AlexandriaService.registerRepository(path, remoteUrl);
          console.info(
            '[RepositoryPanelProvider] Registered repository:',
            path,
          );
        } catch (error) {
          console.error(
            '[RepositoryPanelProvider] Failed to register repository:',
            error,
          );
          throw error;
        }
      },

      removeLocalRepository: async (path: string, deleteLocal: boolean) => {
        try {
          await AlexandriaService.removeRepository(path, deleteLocal);
          console.info('[RepositoryPanelProvider] Removed repository:', path);
        } catch (error) {
          console.error(
            '[RepositoryPanelProvider] Failed to remove repository:',
            error,
          );
          throw error;
        }
      },

      openLocalRepository: async (entry: AlexandriaEntry) => {
        try {
          await WindowService.openDevWorkspace({
            alexandriaEntry: entry,
          });
          console.info(
            '[RepositoryPanelProvider] Opened repository:',
            entry.name,
          );
        } catch (error) {
          console.error(
            '[RepositoryPanelProvider] Failed to open repository:',
            error,
          );
          throw error;
        }
      },

      // Active file management for markdown panel
      setActiveFile: async (filePath: string | null) => {
        if (!filePath) {
          // Clear the active file
          setActiveFileData(null);
          setActiveFileError(null);
          return;
        }

        setActiveFileLoading(true);
        setActiveFileError(null);

        try {
          const absolutePath = filePath.startsWith('/')
            ? filePath
            : `${repositoryPath}/${filePath}`;

          console.info(
            '[RepositoryPanelProvider] Setting active file:',
            absolutePath,
          );

          const result = await FileSystemService.readFile(absolutePath);

          if (!result) {
            throw new Error(`Failed to read file: ${filePath}`);
          }

          // Determine file type from extension
          const extension = filePath.split('.').pop()?.toLowerCase() || '';
          const type =
            extension === 'md' ||
            extension === 'mdx' ||
            extension === 'markdown'
              ? 'markdown'
              : extension;

          const source = createFileTreeSource.localWorkingCopy(
            repositoryPath || '',
            '',
            repository?.name || 'unknown',
            '',
          );

          setActiveFileData({
            path: absolutePath,
            content: result.content,
            type,
            source,
          });
        } catch (error) {
          console.error(
            '[RepositoryPanelProvider] Failed to set active file:',
            error,
          );
          setActiveFileError(
            error instanceof Error ? error : new Error('Failed to read file'),
          );
        } finally {
          setActiveFileLoading(false);
        }
      },

      updateScenarioFilterDefault: async (
        workflowPath: string,
        scenarioId: string,
        filterDefault: boolean,
      ) => {
        console.info(
          '[RepositoryPanelProvider] Updating scenario filterDefault:',
          { workflowPath, scenarioId, filterDefault },
        );
        try {
          // Resolve the absolute path
          const absolutePath = workflowPath.startsWith('/')
            ? workflowPath
            : `${repositoryPath}/${workflowPath}`;

          // Read the workflow file
          const result = await FileSystemService.readFile(absolutePath);
          if (!result) {
            throw new Error(`Workflow file not found: ${workflowPath}`);
          }
          const content = typeof result === 'string' ? result : result.content;

          // Parse and update the workflow JSON
          const workflow = JSON.parse(content);
          if (workflow.scenarios && Array.isArray(workflow.scenarios)) {
            const scenario = workflow.scenarios.find(
              (s: { id?: string }) => s.id === scenarioId,
            );
            if (scenario) {
              scenario.filterDefault = filterDefault;
            } else {
              console.warn(
                '[RepositoryPanelProvider] Scenario not found:',
                scenarioId,
              );
              return;
            }
          } else {
            console.warn(
              '[RepositoryPanelProvider] No scenarios array in workflow:',
              workflowPath,
            );
            return;
          }

          // Write the updated workflow back
          await FileSystemService.writeFile(
            absolutePath,
            JSON.stringify(workflow, null, 2),
          );
          console.info(
            '[RepositoryPanelProvider] Scenario filterDefault updated successfully',
          );
        } catch (error) {
          console.error(
            '[RepositoryPanelProvider] Failed to update scenario filterDefault:',
            error,
          );
          throw error;
        }
      },

      loadBruRequest: async (path: string): Promise<BrunoRequest> => {
        const absolutePath = path.startsWith('/')
          ? path
          : `${repositoryPath}/${path}`;

        return BrunoService.loadBruRequest(absolutePath);
      },

      loadEnvironments: async (collectionPath: string): Promise<BrunoEnvironment[]> => {
        const absolutePath = collectionPath.startsWith('/')
          ? collectionPath
          : `${repositoryPath}/${collectionPath}`;

        return BrunoService.loadEnvironments(absolutePath);
      },

      sendRequest: async (
        request: BrunoRequest,
        environment?: Record<string, string>,
      ): Promise<BrunoResponse> => {
        return BrunoService.sendRequest(request, environment);
      },
    }),
    [repositoryPath, events, repository?.name],
  );

  // Extract markdown files from file tree
  const markdownFiles = useMemo(() => {
    if (!stableFileTreeData?.allFiles) return [];

    return stableFileTreeData.allFiles
      .filter((file) => {
        const name = file.name || file.path.split('/').pop() || '';
        return name.toLowerCase().endsWith('.md');
      })
      .map((file) => ({
        path: file.path,
        title: (file.name || file.path.split('/').pop() || '').replace(
          /\.md$/i,
          '',
        ),
        lastModified: file.lastModified
          ? new Date(file.lastModified).getTime()
          : undefined,
      }));
  }, [stableFileTreeData]);

  // Create adapters for panels to use
  const adapters: PanelAdapters = useMemo(
    () => {
      // Shared readFile implementation
      const readFileImpl = async (relativePath: string): Promise<string> => {
        const absolutePath = relativePath.startsWith('/')
          ? relativePath
          : `${repositoryPath}/${relativePath}`;
        console.info('[RepositoryPanelProvider] adapters.readFile called:', {
          relativePath,
          absolutePath,
          repositoryPath,
        });
        // FileSystemService.readFile returns { content, filePath } or null
        const result = await FileSystemService.readFile(absolutePath);
        if (!result) {
          console.info('[RepositoryPanelProvider] File not found:', absolutePath);
          throw new Error(`Failed to fetch content for ${relativePath}`);
        }
        console.info('[RepositoryPanelProvider] File read successfully:', absolutePath);
        // Extract content from the result object
        return typeof result === 'string' ? result : result.content;
      };

      // Shared writeFile implementation
      const writeFileImpl = async (relativePath: string, content: string): Promise<void> => {
        const absolutePath = relativePath.startsWith('/')
          ? relativePath
          : `${repositoryPath}/${relativePath}`;
        await FileSystemService.writeFile(absolutePath, content);
      };

      return {
        // readFile accepts relative paths and resolves them against the repository path
        readFile: readFileImpl,
        matchesPath: (pattern: string, filePath: string): boolean => {
          return minimatch(filePath, pattern);
        },
        // fileSystem adapter for panels that need full file system access (e.g., Kanban panel, TraceListPanel)
        fileSystem: {
          exists: async (relativePath: string): Promise<boolean> => {
            try {
              const absolutePath = relativePath.startsWith('/')
                ? relativePath
                : `${repositoryPath}/${relativePath}`;
              const result = await FileSystemService.readFile(absolutePath);
              return result !== null;
            } catch {
              return false;
            }
          },
          readFile: readFileImpl,
          writeFile: writeFileImpl,
          createDir: async (_relativePath: string): Promise<void> => {
            // Directories are created implicitly when files are written
            // No explicit directory creation needed for local filesystem
            return;
          },
          deleteFile: async (relativePath: string): Promise<void> => {
            const absolutePath = relativePath.startsWith('/')
              ? relativePath
              : `${repositoryPath}/${relativePath}`;
            await FileSystemService.deleteFile(absolutePath);
          },
          // Git-specific method to read file content at a specific revision
          getFileContentAtRevision: async (
            filePath: string,
            revision: string = 'HEAD'
          ): Promise<string | null> => {
            try {
              if (!repositoryPath) {
                console.warn('[RepositoryPanelProvider] No repository path set');
                return null;
              }

              // Calculate the path relative to repository root
              let pathRelativeToRepo = filePath;
              if (filePath.startsWith('/')) {
                // If absolute path, make it relative to repository root
                if (filePath.startsWith(repositoryPath + '/')) {
                  pathRelativeToRepo = filePath.substring(repositoryPath.length + 1);
                } else if (filePath === repositoryPath) {
                  pathRelativeToRepo = '';
                } else {
                  console.warn('[RepositoryPanelProvider] File path is outside repository:', {
                    filePath,
                    repositoryPath
                  });
                  return null;
                }
              }

              console.info('[RepositoryPanelProvider] getFileContentAtRevision:', {
                repositoryPath,
                originalPath: filePath,
                pathRelativeToRepo,
                revision
              });

              // Use FileSystemService to call IPC with the relative path
              const content = await FileSystemService.getFileContentAtRevision(
                repositoryPath,
                pathRelativeToRepo,
                revision
              );

              return content;
            } catch (error) {
              console.error('[RepositoryPanelProvider] Failed to get file content from git:', error);
              return null;
            }
          },
          // Path manipulation methods required by TraceListPanel
          join: (...paths: string[]): string => {
            return paths
              .join('/')
              .replace(/\/+/g, '/')
              .replace(/\/$/, '') || '/';
          },
          dirname: (path: string): string => {
            const lastSlash = path.lastIndexOf('/');
            return lastSlash <= 0 ? '/' : path.slice(0, lastSlash);
          },
          basename: (path: string, ext?: string): string => {
            const segments = path.split('/');
            let base = segments[segments.length - 1] || '';
            if (ext && base.endsWith(ext)) {
              base = base.slice(0, -ext.length);
            }
            return base;
          },
          extname: (path: string): string => {
            const segments = path.split('/');
            const base = segments[segments.length - 1] || '';
            const lastDot = base.lastIndexOf('.');
            return lastDot > 0 ? base.slice(lastDot) : '';
          },
          normalize: (path: string): string => {
            return path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
          },
        },
      };
    },
    [repositoryPath], // rootFileTreeData removed - we use ref instead
  );

  // Create data slices
  // Create direct slice objects first for type-safe access by new v0.3.0+ panels
  const fileTreeSlice: DataSlice<FileTree> = useMemo(
    () => ({
      scope: 'repository' as const,
      name: 'fileTree',
      data: augmentedFileTreeData,
      loading: fileTreeLoading,
      error: null,
      refresh: async () => {
        if (repositoryPath) {
          setFileTreeLoading(true);
          try {
            // Force cache invalidation and rebuild
            // This will emit CACHE_SYNC events that the onCacheSync listener
            // (line 241) will handle to update state automatically
            await RepositoryMonitoringService.refreshRepository(
              repositoryPath,
            );
            console.info(
              '[RepositoryPanelProvider] Refresh triggered for file tree, waiting for cache sync event',
            );
          } catch (error) {
            console.error(
              '[RepositoryPanelProvider] Failed to refresh file tree:',
              error,
            );
            // Fallback: try to get whatever is in cache
            const tree =
              await RepositoryMonitoringService.getFileTree(
                repositoryPath,
              );
            setFileTreeData(tree);
          } finally {
            setFileTreeLoading(false);
          }
        }
      },
    }),
    [augmentedFileTreeData, fileTreeLoading, repositoryPath],
  );

  const rootFileTreeSlice: DataSlice<FileTree> = useMemo(
    () => ({
      scope: 'global' as const,
      name: 'rootFileTree',
      data: rootFileTreeData,
      loading: rootFileTreeLoading,
      error: null,
      refresh: async () => {
        setRootFileTreeLoading(true);
        try {
          const homePath = await FileSystemService.getHomePath();
          const plansDir = `${homePath}/.claude/plans`;
          const entries = await FileSystemService.readDirectory(plansDir);

          const planFileNames = entries
            .filter((entry) => entry.endsWith('.md') || entry.endsWith('.MD'));

          const planFilesWithStats = await Promise.all(
            planFileNames.map(async (fileName) => {
              const absolutePath = `${plansDir}/${fileName}`;
              const stats = await FileSystemService.getFileStats(absolutePath);
              return {
                path: `.claude/plans/${fileName}`,
                size: stats?.size || 0,
                lastModified: stats?.lastModified || new Date(),
              };
            })
          );

          const builder = new PathsFileTreeBuilder();
          const builtTree = builder.build({
            files: planFilesWithStats.map(f => f.path),
            rootPath: homePath,
          });

          const enrichedFileTree = {
            ...builtTree,
            allFiles: builtTree.allFiles.map((file, index) => {
              const statsEntry = planFilesWithStats[index];
              return {
                ...file,
                size: statsEntry?.size || file.size || 0,
                lastModified: statsEntry?.lastModified || file.lastModified || new Date(),
              };
            }),
          };

          const fileTree: FileTree = {
            ...enrichedFileTree,
            metadata: {
              ...enrichedFileTree.metadata,
              id: homePath,
            },
          };

          setRootFileTreeData(fileTree);
          console.info('[RepositoryPanelProvider] Refreshed global plans file tree');
        } catch (error) {
          console.error('[RepositoryPanelProvider] Failed to refresh global plans:', error);
          setRootFileTreeData(null);
        } finally {
          setRootFileTreeLoading(false);
        }
      },
    }),
    [rootFileTreeData, rootFileTreeLoading],
  );

  const activeFileSlice: DataSlice<ActiveFileSlice> = useMemo(
    () => ({
      scope: 'repository' as const,
      name: 'active-file',
      data: stableActiveFileData,
      loading: activeFileLoading,
      error: activeFileError,
      refresh: async () => {
        // Re-read the file if there's an active file
        if (stableActiveFileData?.path) {
          setActiveFileLoading(true);
          try {
            const absolutePath = stableActiveFileData.path.startsWith('/')
              ? stableActiveFileData.path
              : `${repositoryPath}/${stableActiveFileData.path}`;
            const result = await FileSystemService.readFile(absolutePath);
            if (result) {
              setActiveFileData({
                ...stableActiveFileData,
                content: result.content,
              });
            }
          } catch (error) {
            console.error(
              '[RepositoryPanelProvider] Failed to refresh active file:',
              error,
            );
            setActiveFileError(
              error instanceof Error
                ? error
                : new Error('Failed to refresh file'),
            );
          } finally {
            setActiveFileLoading(false);
          }
        }
      },
    }),
    [stableActiveFileData, activeFileLoading, activeFileError, repositoryPath],
  );

  const openTabsSlice: DataSlice<unknown[]> = useMemo(
    () => ({
      scope: 'workspace' as const,
      name: 'openTabs',
      data: openTabs,
      loading: false,
      error: null,
      refresh: async () => {
        // Tabs are managed by DevWorkspace, no refresh needed
      },
    }),
    [openTabs],
  );

  // Explicit DataSlice: markdown
  const markdownSlice = useMemo<DataSlice<unknown>>(
    () => ({
      scope: 'repository' as const,
      name: 'markdown',
      data: markdownFiles,
      loading: fileTreeLoading,
      error: null,
      refresh: async () => {
        // Markdown slice refreshes when fileTree refreshes
        if (repositoryPath) {
          setFileTreeLoading(true);
          try {
            // Force cache invalidation and rebuild
            // Markdown files are extracted from the file tree,
            // so refreshing the repository will update both
            await RepositoryMonitoringService.refreshRepository(
              repositoryPath,
            );
            console.info(
              '[RepositoryPanelProvider] Refresh triggered for markdown, waiting for cache sync event',
            );
          } catch (error) {
            console.error(
              '[RepositoryPanelProvider] Failed to refresh markdown:',
              error,
            );
            // Fallback: try to get whatever is in cache
            const tree =
              await RepositoryMonitoringService.getFileTree(
                repositoryPath,
              );
            setFileTreeData(tree);
          } finally {
            setFileTreeLoading(false);
          }
        }
      },
    }),
    [markdownFiles, fileTreeLoading, repositoryPath],
  );

  // Explicit DataSlice: packages
  const packagesSlice = useMemo<DataSlice<PackagesSliceData | null>>(
    () => ({
      scope: 'repository' as const,
      name: 'packages',
      data: packagesData,
      loading: packagesLoading,
      error: null,
      refresh: async () => {
        if (repositoryPath) {
          setPackagesLoading(true);
          try {
            // Force cache invalidation and rebuild
            // This will emit CACHE_SYNC events that the onCacheSync listener
            // (line 315) will handle to update state automatically
            await RepositoryMonitoringService.refreshRepository(
              repositoryPath,
            );
            console.info(
              '[RepositoryPanelProvider] Refresh triggered for packages, waiting for cache sync event',
            );
          } catch (error) {
            console.error(
              '[RepositoryPanelProvider] Failed to refresh packages:',
              error,
            );
            // Fallback: try to get whatever is in cache
            const result =
              await RepositoryMonitoringService.getPackages(
                repositoryPath,
              );
            if (result) {
              setPackagesData(result);
            } else {
              setPackagesData(null);
            }
          } finally {
            setPackagesLoading(false);
          }
        }
      },
    }),
    [packagesData, packagesLoading, repositoryPath],
  );

  // Repository entry slice (for PackageCompositionPanel GitHub visibility)
  // Find the current repository's AlexandriaEntry from the loaded repositories
  const currentAlexandriaEntry = useMemo(() => {
    if (!repositoryPath || alexandriaRepositories.length === 0) return null;
    return alexandriaRepositories.find(entry => entry.path === repositoryPath) || null;
  }, [repositoryPath, alexandriaRepositories]);

  // Returns null if the workspace path isn't in the registry yet — upstream
  // PackageCompositionPanel reads `data?.github?.isPublic` with optional
  // chaining and handles null. Post-rekey, openDevWorkspaceWindow guarantees
  // registration before the window opens, so a miss here only happens during
  // the brief load window before alexandriaRepositories arrives.
  const repositoryEntrySlice = useMemo<DataSlice<AlexandriaEntry | null>>(
    () => ({
      scope: 'repository' as const,
      name: 'repositoryEntry',
      data: currentAlexandriaEntry,
      loading: alexandriaRepositoriesLoading,
      error: null,
      refresh: async () => {},
    }),
    [currentAlexandriaEntry, alexandriaRepositoriesLoading],
  );

  // Explicit DataSlice: gitStatusWithFiles
  const gitStatusWithFilesSlice = useMemo<DataSlice<GitStatusWithFiles | null>>(
    () => ({
      scope: 'repository' as const,
      name: 'gitStatusWithFiles',
      data: stableGitStatusData,
      loading: gitStatusLoading,
      error: null,
      refresh: async () => {
        if (repositoryPath) {
          setGitStatusLoading(true);
          try {
            // Force cache invalidation and rebuild
            // This will emit GIT_STATUS_CHANGED events that the onGitStatusChanged
            // listener (line 365) will handle to update state automatically
            await RepositoryMonitoringService.refreshRepository(
              repositoryPath,
            );
            console.info(
              '[RepositoryPanelProvider] Refresh triggered for git status, waiting for event',
            );
          } catch (error) {
            console.error(
              '[RepositoryPanelProvider] Failed to refresh git status:',
              error,
            );
            // Fallback: try to get whatever is in cache
            const status =
              await RepositoryMonitoringService.getGitStatusWithFiles(
                repositoryPath,
              );
            setGitStatusData(status);
          } finally {
            setGitStatusLoading(false);
          }
        }
      },
    }),
    [stableGitStatusData, gitStatusLoading, repositoryPath],
  );

  // Explicit DataSlice: alexandriaRepositories (for alexandria panels compatibility)
  const alexandriaRepositoriesSlice = useMemo<DataSlice<unknown>>(
    () => ({
      scope: 'repository' as const,
      name: 'alexandriaRepositories',
      data: {
        repositories: alexandriaRepositories,
        discoveredRepositories: [],
        loading: alexandriaRepositoriesLoading,
        error: undefined,
      },
      loading: alexandriaRepositoriesLoading,
      error: null,
      refresh: async () => {
        setAlexandriaRepositoriesLoading(true);
        try {
          const repos = await AlexandriaService.getRepositories();
          setAlexandriaRepositories(repos);
        } catch (error) {
          console.error(
            '[RepositoryPanelProvider] Failed to refresh Alexandria repositories:',
            error,
          );
          setAlexandriaRepositories([]);
        } finally {
          setAlexandriaRepositoriesLoading(false);
        }
      },
    }),
    [alexandriaRepositories, alexandriaRepositoriesLoading],
  );

  // Explicit DataSlice: workspace (stub for compatibility)
  const workspaceSlice = useMemo<DataSlice<unknown>>(
    () => ({
      scope: 'repository' as const,
      name: 'workspace',
      data: {
        workspace: null,
        loading: false,
        error: undefined,
      },
      loading: false,
      error: null,
      refresh: async () => {
        // No workspace data in repository context
      },
    }),
    [],
  );

  // Explicit DataSlice: workspaces (stub for compatibility)
  const workspacesSlice = useMemo<DataSlice<unknown>>(
    () => ({
      scope: 'repository' as const,
      name: 'workspaces',
      data: {
        workspaces: [],
        defaultWorkspaceId: null,
        loading: false,
        error: undefined,
      },
      loading: false,
      error: null,
      refresh: async () => {
        // No workspaces list in repository context
      },
    }),
    [],
  );

  // Explicit DataSlice: workspaceRepositories (stub for compatibility)
  const workspaceRepositoriesSlice = useMemo<DataSlice<unknown>>(
    () => ({
      scope: 'repository' as const,
      name: 'workspaceRepositories',
      data: {
        repositories: [],
        loading: false,
        error: undefined,
      },
      loading: false,
      error: null,
      refresh: async () => {
        // No workspace repositories in repository context
      },
    }),
    [],
  );

  // Explicit DataSlice: quality
  const qualitySlice = useMemo<DataSlice<QualitySliceData | null>>(
    () => ({
      scope: 'repository' as const,
      name: 'quality',
      data: stableQualityData,
      loading: qualityLoading,
      error: null,
      refresh: async () => {
        if (!repositoryPath) return;

        setQualityLoading(true);
        try {
          const remoteInfo =
            await RepositoryMonitoringService.getGitRemoteInfo(
              repositoryPath,
            );
          if (!remoteInfo?.remoteUrl) {
            setQualityData(null);
            return;
          }

          const githubInfo = parseGitHubRemote(remoteInfo.remoteUrl);
          if (!githubInfo) {
            setQualityData(null);
            return;
          }

          const gitStatus =
            await RepositoryMonitoringService.getGitStatus(
              repositoryPath,
            );
          const branch = gitStatus?.branch || 'main';

          // Clear cache to force fresh fetch
          await GitHubArtifactService.clearCache();

          const artifactData =
            await GitHubArtifactService.getLatestQualityMetrics(
              githubInfo.owner,
              githubInfo.repo,
              branch,
            );

          if (artifactData) {
            const packages = artifactData.qualityMetrics.packages.map(
              (pkg) => ({
                name: pkg.name,
                metrics: pkg.hexagon as unknown as Record<string, number>,
              }),
            );
            setQualityData({
              packages,
              lastUpdated: artifactData.timestamp,
            });
          } else {
            setQualityData(null);
          }
        } catch (error) {
          console.error(
            '[RepositoryPanelProvider] Failed to refresh quality metrics:',
            error,
          );
          setQualityData(null);
        } finally {
          setQualityLoading(false);
        }
      },
    }),
    [stableQualityData, qualityLoading, repositoryPath],
  );

  // Explicit DataSlice: fileCityColorModes
  const fileCityColorModesSlice = useMemo<DataSlice<FileCityColorModesSliceData>>(
    () => ({
      scope: 'repository' as const,
      name: 'fileCityColorModes',
      data: {
        selectedColorMode: effectiveColorMode,
        // Include quality data for File City to render layers
        qualityData: stableQualityData
          ? {
              fileCoverage: stableQualityData.fileCoverage,
              fileMetrics: stableQualityData.fileMetrics,
            }
          : undefined,
      } as FileCityColorModesSliceData,
      loading: false,
      error: null,
      refresh: async () => {
        // No async refresh needed - color mode is computed from other state
      },
    }),
    [effectiveColorMode, stableQualityData],
  );

  // Explicit DataSlice: localhostServers
  const localhostServersSlice = useMemo<DataSlice<RunningServer[]>>(
    () => ({
      scope: 'workspace' as const,
      name: 'localhostServers',
      data: stableLocalhostServers,
      loading: localhostServersLoading,
      error: null,
      refresh: async () => {
        // Refetch localhost servers
        setLocalhostServersLoading(true);
        try {
          const result =
            await LocalhostDetectionService.detectRunningServers();
          setLocalhostServers(result.servers);
        } catch (error) {
          console.error(
            '[RepositoryPanelContext] Failed to refresh localhost servers:',
            error,
          );
        } finally {
          setLocalhostServersLoading(false);
        }
      },
    }),
    [stableLocalhostServers, localhostServersLoading],
  );

  // Explicit DataSlice: globalSkills
  const globalSkillsSlice = useMemo<DataSlice<{ skills: GlobalSkill[] } | null>>(
    () => ({
      scope: 'workspace' as const,
      name: 'globalSkills',
      data: { skills: globalSkillsData },
      loading: globalSkillsLoading,
      error: null,
      refresh: async () => {
        // Refetch global skills
        setGlobalSkillsLoading(true);
        try {
          const skills = await FileSystemService.getGlobalSkills();
          setGlobalSkillsData(skills);
        } catch (error) {
          console.error(
            '[RepositoryPanelContext] Failed to refresh global skills:',
            error,
          );
        } finally {
          setGlobalSkillsLoading(false);
        }
      },
    }),
    [globalSkillsData, globalSkillsLoading],
  );

  // Panel-specific slices (from ExtendedPanelContextValue)
  // Terminal slice - provides terminal sessions data
  const terminalSlice = useMemo<DataSlice<TerminalSessionInfo[]>>(
    () => ({
      scope: 'repository' as const,
      name: 'terminal',
      data: terminalSessions,
      loading: terminalSessionsLoading,
      error: null,
      refresh: async () => {
        setTerminalSessionsLoading(true);
        try {
          const sessions = await TerminalService.list();
          const sessionInfos: TerminalSessionInfo[] = sessions.map((s) => ({
            id: s.id,
            pid: 0,
            cwd: s.directory || '',
            shell: '',
            createdAt: s.createdAt || Date.now(),
            lastActivity: s.lastActivity || Date.now(),
            context: s.context,
            status: s.status,
            metadata: s.metadata,
            agentSessionId: s.agentSessionId,
          }));
          setTerminalSessions(sessionInfos);
        } catch (error) {
          console.error(
            '[RepositoryPanelContext] Failed to refresh terminal sessions:',
            error,
          );
        } finally {
          setTerminalSessionsLoading(false);
        }
      },
    }),
    [terminalSessions, terminalSessionsLoading],
  );

  // Feed project slice (for FeedCodeCityPanel)
  const feedProjectSlice = useMemo<DataSlice<FeedProjectSliceData>>(
    () => ({
      scope: 'repository' as const,
      name: 'feedProject',
      data: {
        repo: {
          owner: '',
          name: '',
          fullName: '',
          description: undefined,
          htmlUrl: '',
          stars: 0,
          forks: 0,
          language: undefined,
          topics: [],
        },
        rootPackage: undefined,
      },
      loading: false,
      error: null,
      refresh: async () => {},
    }),
    [],
  );

  // GitHub issues slice (for GitHubIssuesPanel)
  const githubIssuesSlice = useMemo<DataSlice<GitHubIssuesSliceData>>(
    () => ({
      scope: 'repository' as const,
      name: 'githubIssues',
      data: {
        issues: [],
        owner: '',
        repo: '',
        isAuthenticated: false,
        error: undefined,
      },
      loading: false,
      error: null,
      refresh: async () => {},
    }),
    [],
  );

  // Activity heatmap slice (for CodeCityPanel)
  const activityHeatmapSlice = useMemo<DataSlice<ActivityHeatmapSliceData | null>>(
    () => ({
      scope: 'repository' as const,
      name: 'activityHeatmap',
      data: activityHeatmapData,
      loading: activityHeatmapLoading,
      error: null,
      refresh: async () => {
        if (!repositoryPathRef.current) return;

        setActivityHeatmapLoading(true);
        try {
          const commitDates = await GitService.getCommitDatesForHeatMap(repositoryPathRef.current, 30);
          setActivityHeatmapData({
            days: commitDates.map(d => ({ date: d.date, count: d.count })),
          });
        } catch (error) {
          console.error('[RepositoryPanelContext] Failed to refresh activity heatmap:', error);
        } finally {
          setActivityHeatmapLoading(false);
        }
      },
    }),
    [activityHeatmapData, activityHeatmapLoading],
  );

  // Line counts slice (for CodeCityPanel building heights)
  const lineCountsSlice = useMemo<DataSlice<LineCountsSliceData | null>>(
    () => ({
      scope: 'repository' as const,
      name: 'lineCounts',
      data: lineCountsData,
      loading: lineCountsLoading,
      error: null,
      refresh: async () => {
        if (!repositoryPathRef.current) return;

        setLineCountsLoading(true);
        try {
          const rawLineCounts = await window.mainProcess?.fileCityImage?.countLines(repositoryPathRef.current);
          if (rawLineCounts) {
            // Transform paths to use relative paths (strip repo name prefix if present)
            const repoName = repositoryPathRef.current.split('/').pop() || '';
            const lineCounts: Record<string, number> = {};
            for (const [filePath, count] of Object.entries(rawLineCounts)) {
              if (typeof count !== 'number' || count < 0) continue;
              // Strip repo name prefix if present (e.g., "electron-app/src/file.ts" -> "src/file.ts")
              if (filePath.startsWith(repoName + '/')) {
                lineCounts[filePath.slice(repoName.length + 1)] = count;
              } else {
                lineCounts[filePath] = count;
              }
            }
            setLineCountsData({
              lineCounts,
              status: 'available',
            });
          }
        } catch (error) {
          console.error('[RepositoryPanelContext] Failed to refresh line counts:', error);
        } finally {
          setLineCountsLoading(false);
        }
      },
    }),
    [lineCountsData, lineCountsLoading],
  );

  // Empty slices Map for backward compatibility with PanelContextValue interface
  const slices = useMemo<Map<string, DataSlice<unknown>>>(() => new Map(), []);

  // Memoize currentScope to prevent recreation
  const currentScope = useMemo(
    () => ({
      type: 'repository' as const,
      // Filter out null to match PanelContextValue type (repository is optional, not nullable)
      ...(repository ? { repository } : {}),
    }),
    [repository],
  );

  // Memoize callback functions to prevent recreation
  const isSliceLoading = useCallback(
    (_name: string, _scope?: 'workspace' | 'repository'): boolean => {
      // No-op: Moving away from dynamic slice checking
      // Panels should access typed properties directly (context.fileTree.loading)
      return false;
    },
    [],
  );

  const refresh = useCallback(
    async (_scope?: 'workspace' | 'repository', _sliceName?: string): Promise<void> => {
      // No-op: Actions handle their own data refreshing
      // React's reactivity handles UI updates automatically
      // Any actual refresh should be triggered via actions, not context.refresh()
    },
    [],
  );

  // Create context value
  // Note: Terminal state has been moved to TerminalContext
  const context: RepositoryPanelContextValue = useMemo(
    () => ({
      // Repository-specific properties
      repositoryPath,
      repository,
      loading,

      // PanelContextValue required properties
      currentScope,
      slices,
      adapters,
      isSliceLoading,
      refresh,

      // Explicit typed slice properties - no more dynamic Map lookups!
      activeFile: activeFileSlice,
      fileTree: fileTreeSlice,
      rootFileTree: rootFileTreeSlice,
      openTabs: openTabsSlice,
      markdown: markdownSlice,
      packages: packagesSlice,
      repositoryEntry: repositoryEntrySlice,
      gitStatusWithFiles: gitStatusWithFilesSlice,
      alexandriaRepositories: alexandriaRepositoriesSlice as DataSlice<AlexandriaRepositoriesSlice>,
      workspace: workspaceSlice as DataSlice<WorkspaceSlice>,
      workspaceRepositories: workspaceRepositoriesSlice as DataSlice<WorkspaceRepositoriesSlice>,
      workspaces: workspacesSlice as DataSlice<WorkspacesSlice>,
      quality: qualitySlice,
      fileCityColorModes: fileCityColorModesSlice,
      localhostServers: localhostServersSlice,
      globalSkills: globalSkillsSlice,
      // Panel-specific slices (from ExtendedPanelContextValue)
      terminal: terminalSlice,
      feedProject: feedProjectSlice,
      githubIssues: githubIssuesSlice,
      activityHeatmap: activityHeatmapSlice,
      lineCounts: lineCountsSlice,
    }),
    [
      repositoryPath,
      repository,
      loading,
      currentScope,
      slices,
      adapters,
      isSliceLoading,
      refresh,
      activeFileSlice,
      fileTreeSlice,
      rootFileTreeSlice,
      openTabsSlice,
      markdownSlice,
      packagesSlice,
      repositoryEntrySlice,
      gitStatusWithFilesSlice,
      alexandriaRepositoriesSlice,
      workspaceSlice,
      workspaceRepositoriesSlice,
      workspacesSlice,
      qualitySlice,
      fileCityColorModesSlice,
      localhostServersSlice,
      globalSkillsSlice,
      terminalSlice,
      feedProjectSlice,
      githubIssuesSlice,
      activityHeatmapSlice,
      lineCountsSlice,
    ],
  );

  // Provider value
  const value: RepositoryPanelProviderValue = useMemo(
    () => ({
      context,
      actions,
      events,
    }),
    [context, actions, events],
  );

  return (
    <RepositoryPanelContext.Provider value={value}>
      {children}
    </RepositoryPanelContext.Provider>
  );
};

export const useRepositoryPanelProvider = (): RepositoryPanelProviderValue => {
  const context = useContext(RepositoryPanelContext);
  if (!context) {
    throw new Error(
      'useRepositoryPanelProvider must be used within a RepositoryPanelProvider',
    );
  }
  return context;
};
