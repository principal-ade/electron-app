import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { PanelEventBus } from '@principal-ade/panel-framework-core';
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
import type { PackageLayer } from '@principal-ai/codebase-composition';
import type {
  PackageSummary,
  GitStatusWithFiles,
} from '@principal-ai/repository-monitoring-server';
import { minimatch } from 'minimatch';
import type { ColorMode, FileMetricData, QualitySliceData } from '@principal-ai/quality-lens-registry';

// Types for packages slice data (matches @industry-theme/alexandria-panels DependenciesPanel expectations)
interface PackagesSliceData {
  packages: PackageLayer[];
  summary: PackageSummary;
}

// Git status slice data - simple string arrays for file paths
interface GitStatusSliceData {
  staged: string[];
  unstaged: string[];
  untracked: string[];
  deleted: string[];
}

// Color mode for file city visualization - imported from registry
// The registry's ColorMode type includes all built-in and lens-based modes
type FileCityColorMode = ColorMode;

// File city color modes slice data
interface FileCityColorModesSliceData {
  selectedColorMode: FileCityColorMode | null;
  /** Quality data for quality-based color modes (from registry's QualitySliceData) */
  qualityData?: QualitySliceData;
}

// Helper to convert GitStatusWithFiles to GitStatusSliceData
function mapGitStatusToSliceData(
  status: GitStatusWithFiles | null,
): GitStatusSliceData {
  if (!status) {
    return { staged: [], unstaged: [], untracked: [], deleted: [] };
  }
  return {
    staged: status.stagedFiles ?? [],
    unstaged: status.modifiedFiles ?? [],
    untracked: status.untrackedFiles ?? [],
    deleted: status.deletedFiles ?? [],
  };
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
  repositoryPath: string;
  repository: RepositoryMetadata;
  /** Event bus for panel communication - must be provided by parent */
  events: PanelEventEmitter;
}

export const RepositoryPanelProvider: React.FC<
  RepositoryPanelProviderProps
> = ({ children, repositoryPath, repository, events }) => {
  // Track file tree for the current repository
  const [fileTreeData, setFileTreeData] = useState<FileTree | null>(null);
  const [fileTreeLoading, setFileTreeLoading] = useState(false);

  // Track packages data for the current repository
  const [packagesData, setPackagesData] = useState<PackagesSliceData | null>(
    null,
  );
  const [packagesLoading, setPackagesLoading] = useState(false);

  // Track git status for the current repository
  const [gitStatusData, setGitStatusData] = useState<GitStatusSliceData | null>(
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
        return;
      }

      setFileTreeLoading(true);
      try {
        const tree =
          await RepositoryMonitoringService.getFileTree(repositoryPath);
        console.info(
          '[RepositoryPanelProvider] Fetched file tree for repository:',
          repositoryPath,
          tree,
        );
        setFileTreeData(tree);
      } catch (error) {
        console.error(
          '[RepositoryPanelProvider] Failed to fetch file tree:',
          error,
        );
        setFileTreeData(null);
      } finally {
        setFileTreeLoading(false);
      }
    };

    fetchFileTree();

    // Subscribe to cache sync events for fileTree updates
    const unsubscribe = RepositoryMonitoringService.onCacheSync((event) => {
      if (event.repoPath === repositoryPath && event.slice === 'fileTree') {
        console.info(
          '[RepositoryPanelProvider] File tree cache sync received for repository:',
          repositoryPath,
        );
        if (event.entry.data) {
          setFileTreeData(event.entry.data as FileTree);
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
        setGitStatusData(mapGitStatusToSliceData(status));
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
          // Use the event data directly - it now includes file arrays
          setGitStatusData(mapGitStatusToSliceData(data));
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

  // Compute effective color mode: use explicit selection, or auto-select 'git' if there are changes
  const effectiveColorMode = useMemo((): FileCityColorMode => {
    // If explicitly set, use that
    if (fileCityColorMode) {
      return fileCityColorMode;
    }
    // Auto-select 'git' mode if there are any git changes
    if (gitStatusData) {
      const hasChanges =
        gitStatusData.staged.length > 0 ||
        gitStatusData.unstaged.length > 0 ||
        gitStatusData.untracked.length > 0 ||
        gitStatusData.deleted.length > 0;
      if (hasChanges) {
        return 'git';
      }
    }
    // Default to file types
    return 'fileTypes';
  }, [fileCityColorMode, gitStatusData]);

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
          // Extract relative path - if already absolute, strip the repository path prefix
          const relativeFilePath = filePath.startsWith('/')
            ? filePath.startsWith(repositoryPath)
              ? filePath.substring(repositoryPath.length).replace(/^\//, '')
              : filePath.substring(1) // Fallback: strip leading slash
            : filePath;

          // Check if it's a markdown file
          if (filePath.toLowerCase().endsWith('.md')) {
            await WindowService.openMarkdownViewFromRepository(
              relativeFilePath,
              repositoryPath,
              {
                viewMode: 'single',
              },
            );
          } else {
            // For non-markdown files, log but don't fail
            // Use adapters.readFile or actions.readFile for content reading
            console.log(
              '[RepositoryPanelProvider] openFile called for non-markdown:',
              filePath,
            );
          }
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
    }),
    [repositoryPath, events],
  );

  // Extract markdown files from file tree
  const markdownFiles = useMemo(() => {
    if (!fileTreeData?.allFiles) return [];

    return fileTreeData.allFiles
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
  }, [fileTreeData]);

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
        // fileSystem adapter for panels that need full file system access (e.g., Kanban panel)
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
        },
      };
    },
    [repositoryPath],
  );

  // Create data slices
  const slices = useMemo<Map<string, DataSlice>>(
    () =>
      new Map([
        [
          'fileTree',
          {
            scope: 'repository' as const,
            name: 'fileTree',
            data: fileTreeData,
            loading: fileTreeLoading,
            error: null,
            refresh: async () => {
              if (repositoryPath) {
                setFileTreeLoading(true);
                try {
                  const tree =
                    await RepositoryMonitoringService.getFileTree(
                      repositoryPath,
                    );
                  setFileTreeData(tree);
                } catch (error) {
                  console.error(
                    '[RepositoryPanelProvider] Failed to refresh file tree:',
                    error,
                  );
                  setFileTreeData(null);
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
                  const tree =
                    await RepositoryMonitoringService.getFileTree(
                      repositoryPath,
                    );
                  setFileTreeData(tree);
                } catch (error) {
                  console.error(
                    '[RepositoryPanelProvider] Failed to refresh file tree:',
                    error,
                  );
                  setFileTreeData(null);
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
                  const result =
                    await RepositoryMonitoringService.getPackages(
                      repositoryPath,
                    );
                  if (result) {
                    setPackagesData(result);
                  } else {
                    setPackagesData(null);
                  }
                } catch (error) {
                  console.error(
                    '[RepositoryPanelProvider] Failed to refresh packages:',
                    error,
                  );
                  setPackagesData(null);
                } finally {
                  setPackagesLoading(false);
                }
              }
            },
          },
        ],
        [
          'git',
          {
            scope: 'repository' as const,
            name: 'git',
            data: gitStatusData,
            loading: gitStatusLoading,
            error: null,
            refresh: async () => {
              if (repositoryPath) {
                setGitStatusLoading(true);
                try {
                  const status =
                    await RepositoryMonitoringService.getGitStatusWithFiles(
                      repositoryPath,
                    );
                  setGitStatusData(mapGitStatusToSliceData(status));
                } catch (error) {
                  console.error(
                    '[RepositoryPanelProvider] Failed to refresh git status:',
                    error,
                  );
                  setGitStatusData(null);
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
            data: qualityData,
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
            data: activeFileData,
            loading: activeFileLoading,
            error: activeFileError,
            refresh: async () => {
              // Re-read the file if there's an active file
              if (activeFileData?.path) {
                setActiveFileLoading(true);
                try {
                  const absolutePath = activeFileData.path.startsWith('/')
                    ? activeFileData.path
                    : `${repositoryPath}/${activeFileData.path}`;
                  const result = await FileSystemService.readFile(absolutePath);
                  if (result) {
                    setActiveFileData({
                      ...activeFileData,
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
              qualityData: qualityData
                ? {
                    fileCoverage: qualityData.fileCoverage,
                    fileMetrics: qualityData.fileMetrics,
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
            data: localhostServers,
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
      ]),
    [
      repositoryPath,
      fileTreeData,
      fileTreeLoading,
      markdownFiles,
      packagesData,
      packagesLoading,
      gitStatusData,
      gitStatusLoading,
      alexandriaRepositories,
      alexandriaRepositoriesLoading,
      qualityData,
      qualityLoading,
      activeFileData,
      activeFileLoading,
      activeFileError,
      effectiveColorMode,
      localhostServers,
      localhostServersLoading,
    ],
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
      currentScope: {
        type: 'repository' as const,
        repository,
      },
      slices,
      adapters,
      getSlice: <T = unknown,>(name: string): DataSlice<T> | undefined => {
        return slices.get(name) as DataSlice<T> | undefined;
      },
      getWorkspaceSlice: () => undefined, // No workspace slices in repository context
      getRepositorySlice: <T = unknown,>(
        name: string,
      ): DataSlice<T> | undefined => {
        const slice = slices.get(name);
        return slice?.scope === 'repository'
          ? (slice as DataSlice<T>)
          : undefined;
      },
      hasSlice: (name: string, scope?: 'workspace' | 'repository'): boolean => {
        const slice = slices.get(name);
        if (!slice) return false;
        return scope ? slice.scope === scope : true;
      },
      isSliceLoading: (
        name: string,
        scope?: 'workspace' | 'repository',
      ): boolean => {
        const slice = slices.get(name);
        if (!slice) return false;
        if (scope && slice.scope !== scope) return false;
        return slice.loading;
      },
      refresh: async (
        scope?: 'workspace' | 'repository',
        sliceName?: string,
      ): Promise<void> => {
        const slicesToRefresh = Array.from(slices.values()).filter((slice) => {
          if (scope && slice.scope !== scope) return false;
          if (sliceName && slice.name !== sliceName) return false;
          return true;
        });

        await Promise.all(slicesToRefresh.map((slice) => slice.refresh()));
      },
    }),
    [repositoryPath, repository, loading, slices, adapters],
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
