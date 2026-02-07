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
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { FileTree } from '@principal-ai/repository-abstraction';
import { FileTreeCore } from '@principal-ai/repository-abstraction';
import type { PackageLayer, PackageSummary, PackagesSliceData } from '@principal-ai/codebase-composition';
import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';
import { minimatch } from 'minimatch';
import type { ColorMode, FileMetricData, QualitySliceData } from '@principal-ai/quality-lens-registry';
import type { GlobalSkill } from '../../shared/main-process-api-interfaces/FileSystemAPI';
import type { TraceInfo } from '@industry-theme/principal-view-panels';
import { groupSpansByTrace } from '@industry-theme/principal-view-panels';
import { OtelCollectorService } from '../main-process-api/OtelCollectorService';

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
interface RepositoryPanelActions extends PanelActions {
  /** Read file content - supports all file types (not just markdown) */
  readFile?: (filePath: string) => Promise<string>;
  writeFile?: (filePath: string, content: string) => Promise<void>;
  /** Open file in viewer - only supports markdown files */
  openFile?: (filePath: string) => Promise<void>;
  // Local Projects panel actions
  selectDirectory?: () => Promise<{ path: string; name: string } | null>;
  registerRepository?: (name: string, path: string) => Promise<void>;
  removeRepository?: (name: string, deleteLocal: boolean) => Promise<void>;
  openRepository?: (entry: AlexandriaEntry) => Promise<void>;
  // Active file management for markdown panel
  setActiveFile?: (filePath: string | null) => Promise<void>;
  // Telemetry management
  clearTelemetry?: () => void;
}

// Extended context for repository panels
// Note: Terminal state has been moved to TerminalContext
interface RepositoryPanelContextValue extends PanelContextValue {
  repositoryPath: string;
  repository: RepositoryMetadata | null;
  loading: boolean;
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
}

export const RepositoryPanelProvider: React.FC<
  RepositoryPanelProviderProps
> = ({ children, repositoryPath, repository, events, traceSourceServiceName }) => {
  // Track file tree for the current repository
  const [fileTreeData, setFileTreeData] = useState<FileTree | null>(null);
  const [fileTreeLoading, setFileTreeLoading] = useState(false);
  const [fileTreeVersion, setFileTreeVersion] = useState<number>(0);

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

  // Track active file for markdown panel (and other file viewers)
  const [activeFileData, setActiveFileData] = useState<{
    path: string;
    content: string;
    type: string;
  } | null>(null);
  const [activeFileLoading, setActiveFileLoading] = useState(false);
  const [activeFileError, setActiveFileError] = useState<Error | null>(null);

  // Track global skills from ~/.claude and ~/.agent
  const [globalSkillsData, setGlobalSkillsData] = useState<GlobalSkill[]>([]);
  const [globalSkillsLoading, setGlobalSkillsLoading] = useState(false);

  // Track telemetry traces for trace viewer
  const [telemetryTraces, setTelemetryTraces] = useState<TraceInfo[]>([]);
  const [telemetryLoading, setTelemetryLoading] = useState(false);

  // Helper to extract owner/repo from git remote URL
  const parseGitHubRemote = (
    remoteUrl: string,
  ): { owner: string; repo: string } | null => {
    // Handle SSH format: git@github.com:owner/repo.git
    const sshMatch = remoteUrl.match(/git@github\.com:([^/]+)\/([^.]+)/);
    if (sshMatch) {
      return { owner: sshMatch[1], repo: sshMatch[2] };
    }
    // Handle HTTPS format: https://github.com/owner/repo.git
    const httpsMatch = remoteUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
    if (httpsMatch) {
      return { owner: httpsMatch[1], repo: httpsMatch[2] };
    }
    return null;
  };

  // Fetch file tree when repository changes and subscribe to cache sync updates
  useEffect(() => {
    const fetchFileTree = async () => {
      if (!repositoryPath) {
        setFileTreeData(null);
        setFileTreeVersion(0);
        return;
      }

      setFileTreeLoading(true);
      try {
        const tree =
          await RepositoryMonitoringService.getFileTree(repositoryPath);
        console.info(
          '[RepositoryPanelProvider] Fetched file tree for repository:',
          repositoryPath,
        );
        setFileTreeData(tree);
        setFileTreeVersion((prev) => prev + 1); // Increment version on initial load
      } catch (error) {
        console.error(
          '[RepositoryPanelProvider] Failed to fetch file tree:',
          error,
        );
        setFileTreeData(null);
        setFileTreeVersion(0);
      } finally {
        setFileTreeLoading(false);
      }
    };

    fetchFileTree();

    // Subscribe to cache sync events for fileTree updates
    const unsubscribe = RepositoryMonitoringService.onCacheSync((event) => {
      if (event.repoPath === repositoryPath && event.slice === 'fileTree') {
        if (event.entry.data) {
          const tree = event.entry.data as FileTree;
          const version = event.entry.version || 0;
          console.info(
            '[RepositoryPanelProvider] FileTree cache sync received:',
            repositoryPath,
            `SHA: ${tree?.sha}`,
          );

          setFileTreeData(tree);
          setFileTreeVersion(version);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [repositoryPath]);

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
    // Hash based on port, pid, and name (the identifying characteristics)
    return JSON.stringify(
      localhostServers.map(s => ({
        port: s.port,
        pid: s.pid,
        name: s.name,
      })).sort((a, b) => a.port - b.port)
    );
  }, [localhostServers]);

  // Create stable references for data objects - only update when their stable ID changes
  // This prevents unnecessary re-renders of all panels when object references change
  const stableFileTreeData = useMemo(() => fileTreeData, [fileTreeStableId]);
  const stableQualityData = useMemo(() => qualityData, [qualityDataTimestamp]);
  const stableActiveFileData = useMemo(() => activeFileData, [activeFilePath]);
  const stableGitStatusData = useMemo(() => gitStatusData, [gitStatusHash]);
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
    // Listen for the event emitted by QualityHexagonPanel
    const unsubColorMode = events.on<{ colorMode: string }>(
      'quality:colorMode:select',
      (event) => {
        const { colorMode } = event.payload;
        if (colorMode) {
          console.info(
            '[RepositoryPanelProvider] Color mode changed via quality:colorMode:select:',
            colorMode,
          );
          setFileCityColorMode(colorMode as FileCityColorMode);
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
  }, [events]);

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
    const fetchQualityMetrics = async () => {
      if (!repositoryPath) {
        setQualityData(null);
        return;
      }

      setQualityLoading(true);
      try {
        // Get git remote info to determine owner/repo
        const remoteInfo =
          await RepositoryMonitoringService.getGitRemoteInfo(repositoryPath);
        if (!remoteInfo?.remoteUrl) {
          console.log(
            '[RepositoryPanelProvider] No git remote, cannot fetch quality metrics',
          );
          setQualityData(null);
          return;
        }

        const githubInfo = parseGitHubRemote(remoteInfo.remoteUrl);
        if (!githubInfo) {
          console.log('[RepositoryPanelProvider] Not a GitHub repository');
          setQualityData(null);
          return;
        }

        // Get git status to know the current branch
        const gitStatus =
          await RepositoryMonitoringService.getGitStatus(repositoryPath);
        const branch = gitStatus?.branch || 'main';

        console.log(
          `[RepositoryPanelProvider] Fetching quality metrics for ${githubInfo.owner}/${githubInfo.repo}@${branch}`,
        );

        // Fetch from GitHub artifacts
        const artifactData =
          await GitHubArtifactService.getLatestQualityMetrics(
            githubInfo.owner,
            githubInfo.repo,
            branch,
          );

        if (artifactData) {
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
          console.log(
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
        } else {
          console.log(
            '[RepositoryPanelProvider] No quality artifacts found for this repository',
          );
          setQualityData(null);
        }
      } catch (error) {
        console.error(
          '[RepositoryPanelProvider] Failed to fetch quality metrics:',
          error,
        );
        setQualityData(null);
      } finally {
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
  }, []);

  // Register MessagePort for OTEL traces
  useEffect(() => {
    let windowId: string | null = null;
    let sourceUrl: string | null = null;
    let unsubscribe: (() => void) | null = null;

    const registerTelemetryPort = async () => {
      try {
        // Generate window ID and determine source service name
        windowId = `dev-workspace-${Date.now()}`;
        sourceUrl = traceSourceServiceName || 'principal-ade';

        console.info('[RepositoryPanelProvider] 🔌 Registering telemetry port');
        console.info('[RepositoryPanelProvider] traceSourceServiceName prop:', traceSourceServiceName);
        console.info('[RepositoryPanelProvider] Final sourceUrl:', sourceUrl);
        console.info('[RepositoryPanelProvider] Window ID:', windowId);

        // Subscribe to OTEL messages (port is handled in preload)
        unsubscribe = (window as any).electron.onOtelMessage(
          windowId,
          sourceUrl,
          (data: any) => {
            try {
              console.log('[RepositoryPanelProvider] Received OTEL message:', data?.type || data);

              // Check if this is a connection confirmation heartbeat from the server
              if (data?.type === 'CONNECTION_CONFIRMED') {
                console.info('[RepositoryPanelProvider] 🎉 Server connection confirmed!', {
                  windowId: data.windowId,
                  sourceUrl: data.sourceUrl,
                  timestamp: new Date(data.timestamp).toISOString(),
                });
                return;
              }

              // Check if this is a trace batch from the server
              if (data?.type === 'TRACE_BATCH') {
                console.log('[RepositoryPanelProvider] Received TRACE_BATCH from server');
                // Extract the payload from the wrapper
                const payload = data.payload;
                if (!payload || !payload.resourceSpans) {
                  console.warn('[RepositoryPanelProvider] Invalid TRACE_BATCH payload:', data);
                  return;
                }
                // Process the OTLP payload
                const newTraces = groupSpansByTrace(payload);
                console.log('[RepositoryPanelProvider] Converted to TraceInfo[]:', newTraces);

                if (newTraces.length > 0) {
                  console.info(
                    `[RepositoryPanelProvider] Received ${newTraces.length} new traces from source: ${data.source}`
                  );

                  setTelemetryTraces((prev) => {
                    // Merge new traces with existing, avoiding duplicates
                    const existingIds = new Set(prev.map((t) => t.traceId));
                    const uniqueNewTraces = newTraces.filter(
                      (t) => !existingIds.has(t.traceId)
                    );

                    // Keep only last 1000 traces
                    const combined = [...prev, ...uniqueNewTraces];
                    return combined.slice(-1000);
                  });
                }
                return;
              }

              // Unknown message type
              console.warn('[RepositoryPanelProvider] Received unknown message type:', data?.type || data);
            } catch (error) {
              console.error(
                '[RepositoryPanelProvider] Error processing telemetry message:',
                error
              );
            }
          }
        );

        // Trigger IPC registration (port will arrive in preload)
        const response = await OtelCollectorService.registerPort(windowId, sourceUrl);

        if (!response.success) {
          console.error('[RepositoryPanelProvider] Failed to register telemetry port:', response.error);
          return;
        }

        console.info('[RepositoryPanelProvider] ✅ Telemetry port registration initiated');
        console.info('[RepositoryPanelProvider] Window ID:', windowId);
        console.info('[RepositoryPanelProvider] Source URL:', sourceUrl);

        // Send ready ping to server after a short delay to ensure subscription is set up
        setTimeout(() => {
          console.info('[RepositoryPanelProvider] 📤 Sending RENDERER_READY ping to server');
          const sent = (window as any).electron.sendOtelMessage(windowId, sourceUrl, {
            type: 'RENDERER_READY',
            windowId,
            sourceUrl,
            timestamp: Date.now(),
          });
          if (!sent) {
            console.warn('[RepositoryPanelProvider] Failed to send RENDERER_READY - port not ready yet');
          }
        }, 100);
      } catch (error) {
        console.error(
          '[RepositoryPanelProvider] Failed to register telemetry port:',
          error
        );
      }
    };

    registerTelemetryPort();

    // Cleanup on unmount or when traceSourceServiceName changes
    return () => {
      // Unsubscribe from messages
      if (unsubscribe) {
        unsubscribe();
      }

      // Clean up the port
      if (windowId && sourceUrl) {
        (window as any).electron.removeOtelPort(windowId, sourceUrl);
      }

      // Unregister from main process
      if (windowId && sourceUrl) {
        OtelCollectorService.unregisterPort(windowId, sourceUrl).catch((err) => {
          console.warn('[RepositoryPanelProvider] Error unregistering port:', err);
        });
      }
    };
  }, [traceSourceServiceName]);

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
          // Resolve relative paths against the repository path
          const absolutePath = filePath.startsWith('/')
            ? filePath
            : `${repositoryPath}/${filePath}`;
          const result = await FileSystemService.readFile(absolutePath);
          if (!result) {
            throw new Error(`File not found: ${filePath}`);
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

      openFile: async (filePath: string): Promise<void> => {
        try {
          // Make absolute path if needed
          const absolutePath = filePath.startsWith('/')
            ? filePath
            : `${repositoryPath}/${filePath}`;

          console.log('[RepositoryPanelProvider] Opening file:', absolutePath);

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

      registerRepository: async (name: string, path: string) => {
        try {
          await AlexandriaService.registerRepository(name, path);
          console.info(
            '[RepositoryPanelProvider] Registered repository:',
            name,
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

      removeRepository: async (name: string, deleteLocal: boolean) => {
        try {
          await AlexandriaService.removeRepository(name, deleteLocal);
          console.info('[RepositoryPanelProvider] Removed repository:', name);
        } catch (error) {
          console.error(
            '[RepositoryPanelProvider] Failed to remove repository:',
            error,
          );
          throw error;
        }
      },

      openRepository: async (entry: AlexandriaEntry) => {
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

          setActiveFileData({
            path: absolutePath,
            content: result.content,
            type,
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

      clearTelemetry: () => {
        console.info('[RepositoryPanelProvider] Clearing telemetry traces');
        setTelemetryTraces([]);
      },
    }),
    [repositoryPath, events],
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
        console.log('[RepositoryPanelProvider] adapters.readFile called:', {
          relativePath,
          absolutePath,
          repositoryPath,
        });
        // FileSystemService.readFile returns { content, filePath } or null
        const result = await FileSystemService.readFile(absolutePath);
        if (!result) {
          console.log('[RepositoryPanelProvider] File not found:', absolutePath);
          throw new Error(`Failed to fetch content for ${relativePath}`);
        }
        console.log('[RepositoryPanelProvider] File read successfully:', absolutePath);
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

              console.log('[RepositoryPanelProvider] getFileContentAtRevision:', {
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
    [repositoryPath],
  );

  // DEBUG: Track which dependencies are changing to cause slices recreation
  const slicesDepsRef = useRef<{
    repositoryPath: string | null;
    augmentedFileTreeData: typeof augmentedFileTreeData;
    fileTreeLoading: boolean;
    markdownFiles: typeof markdownFiles;
    packagesData: typeof packagesData;
    packagesLoading: boolean;
    stableGitStatusData: typeof stableGitStatusData;
    gitStatusLoading: boolean;
    alexandriaRepositories: typeof alexandriaRepositories;
    alexandriaRepositoriesLoading: boolean;
    stableQualityData: typeof stableQualityData;
    qualityLoading: boolean;
    stableActiveFileData: typeof stableActiveFileData;
    activeFileLoading: boolean;
    activeFileError: typeof activeFileError;
    effectiveColorMode: FileCityColorMode;
    stableLocalhostServers: typeof stableLocalhostServers;
    localhostServersLoading: boolean;
    globalSkillsData: typeof globalSkillsData;
    globalSkillsLoading: boolean;
  } | null>(null);

  if (slicesDepsRef.current) {
    const depsChanged = {
      repositoryPath: slicesDepsRef.current.repositoryPath !== repositoryPath,
      augmentedFileTreeData: slicesDepsRef.current.augmentedFileTreeData !== augmentedFileTreeData,
      fileTreeLoading: slicesDepsRef.current.fileTreeLoading !== fileTreeLoading,
      markdownFiles: slicesDepsRef.current.markdownFiles !== markdownFiles,
      packagesData: slicesDepsRef.current.packagesData !== packagesData,
      packagesLoading: slicesDepsRef.current.packagesLoading !== packagesLoading,
      stableGitStatusData: slicesDepsRef.current.stableGitStatusData !== stableGitStatusData,
      gitStatusLoading: slicesDepsRef.current.gitStatusLoading !== gitStatusLoading,
      alexandriaRepositories: slicesDepsRef.current.alexandriaRepositories !== alexandriaRepositories,
      alexandriaRepositoriesLoading: slicesDepsRef.current.alexandriaRepositoriesLoading !== alexandriaRepositoriesLoading,
      stableQualityData: slicesDepsRef.current.stableQualityData !== stableQualityData,
      qualityLoading: slicesDepsRef.current.qualityLoading !== qualityLoading,
      stableActiveFileData: slicesDepsRef.current.stableActiveFileData !== stableActiveFileData,
      activeFileLoading: slicesDepsRef.current.activeFileLoading !== activeFileLoading,
      activeFileError: slicesDepsRef.current.activeFileError !== activeFileError,
      effectiveColorMode: slicesDepsRef.current.effectiveColorMode !== effectiveColorMode,
      stableLocalhostServers: slicesDepsRef.current.stableLocalhostServers !== stableLocalhostServers,
      localhostServersLoading: slicesDepsRef.current.localhostServersLoading !== localhostServersLoading,
      globalSkillsData: slicesDepsRef.current.globalSkillsData !== globalSkillsData,
      globalSkillsLoading: slicesDepsRef.current.globalSkillsLoading !== globalSkillsLoading,
    };

    const changedDeps = Object.entries(depsChanged)
      .filter(([, changed]) => changed)
      .map(([key]) => key);

    if (changedDeps.length > 0) {
      console.log('[RepositoryPanelContext] Slices recreated due to:', changedDeps);
    }
  }

  slicesDepsRef.current = {
    repositoryPath,
    augmentedFileTreeData,
    fileTreeLoading,
    markdownFiles,
    packagesData,
    packagesLoading,
    stableGitStatusData,
    gitStatusLoading,
    alexandriaRepositories,
    alexandriaRepositoriesLoading,
    stableQualityData,
    qualityLoading,
    stableActiveFileData,
    activeFileLoading,
    activeFileError,
    effectiveColorMode,
    stableLocalhostServers,
    localhostServersLoading,
    globalSkillsData,
    globalSkillsLoading,
  };

  // Create data slices
  const slices = useMemo<Map<string, DataSlice>>(
    () =>
      new Map([
        [
          'fileTree',
          {
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
                  console.log(
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
          },
        ],
        [
          'markdown',
          {
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
                  console.log(
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
          },
        ],
        [
          'packages',
          {
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
                  console.log(
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
          },
        ],
        [
          'gitStatusWithFiles',
          {
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
                  console.log(
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
          },
        ],
        [
          'alexandriaRepositories',
          {
            scope: 'repository' as const,
            name: 'alexandriaRepositories',
            data: { repositories: alexandriaRepositories },
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
          },
        ],
        [
          'quality',
          {
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
          },
        ],
        [
          'active-file',
          {
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
          },
        ],
        [
          'fileCityColorModes',
          {
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
          },
        ],
        [
          'localhostServers',
          {
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
          },
        ],
        [
          'globalSkills',
          {
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
          },
        ],
        [
          'telemetry',
          {
            scope: 'workspace' as const,
            name: 'telemetry',
            data: telemetryTraces,
            loading: telemetryLoading,
            error: null,
            refresh: async () => {
              // For now, telemetry refresh is a no-op
              // Real implementation will fetch from telemetry service
              setTelemetryLoading(false);
            },
          },
        ],
      ]),
    [
      repositoryPath,
      augmentedFileTreeData, // Augmented with deleted files - stable reference that changes when SHA or deleted files change
      fileTreeLoading,
      markdownFiles, // Derived from stableFileTreeData, already stable
      packagesData,
      packagesLoading,
      stableGitStatusData, // Stable reference - only changes when content hash changes
      gitStatusLoading,
      alexandriaRepositories,
      alexandriaRepositoriesLoading,
      stableQualityData, // Stable reference - only changes when timestamp changes
      qualityLoading,
      stableActiveFileData, // Stable reference - only changes when path changes
      activeFileLoading,
      activeFileError,
      effectiveColorMode,
      stableLocalhostServers, // Stable reference - only changes when server list content changes
      localhostServersLoading,
      globalSkillsData,
      globalSkillsLoading,
      telemetryTraces,
      telemetryLoading,
    ],
  );

  // Memoize currentScope to prevent recreation
  const currentScope = useMemo(
    () => ({
      type: 'repository' as const,
      repository,
    }),
    [repository],
  );

  // Memoize callback functions to prevent recreation
  const getSlice = useCallback(
    <T = unknown,>(name: string): DataSlice<T> | undefined => {
      return slices.get(name) as DataSlice<T> | undefined;
    },
    [slices],
  );

  const getWorkspaceSlice = useCallback(() => undefined, []); // No workspace slices in repository context

  const getRepositorySlice = useCallback(
    <T = unknown,>(name: string): DataSlice<T> | undefined => {
      const slice = slices.get(name);
      return slice?.scope === 'repository'
        ? (slice as DataSlice<T>)
        : undefined;
    },
    [slices],
  );

  const hasSlice = useCallback(
    (name: string, scope?: 'workspace' | 'repository'): boolean => {
      const slice = slices.get(name);
      if (!slice) return false;
      return scope ? slice.scope === scope : true;
    },
    [slices],
  );

  const isSliceLoading = useCallback(
    (name: string, scope?: 'workspace' | 'repository'): boolean => {
      const slice = slices.get(name);
      if (!slice) return false;
      if (scope && slice.scope !== scope) return false;
      return slice.loading;
    },
    [slices],
  );

  const refresh = useCallback(
    async (scope?: 'workspace' | 'repository', sliceName?: string): Promise<void> => {
      const slicesToRefresh = Array.from(slices.values()).filter((slice) => {
        if (scope && slice.scope !== scope) return false;
        if (sliceName && slice.name !== sliceName) return false;
        return true;
      });

      await Promise.all(slicesToRefresh.map((slice) => slice.refresh()));
    },
    [slices],
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
      getSlice,
      getWorkspaceSlice,
      getRepositorySlice,
      hasSlice,
      isSliceLoading,
      refresh,
    }),
    [
      repositoryPath,
      repository,
      loading,
      currentScope,
      slices,
      adapters,
      getSlice,
      getWorkspaceSlice,
      getRepositorySlice,
      hasSlice,
      isSliceLoading,
      refresh,
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
