import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useRef,
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
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { FileTree } from '@principal-ai/repository-abstraction';
import type { PackageLayer } from '@principal-ai/codebase-composition';
import type {
  PackageSummary,
  GitStatusWithFiles,
} from '../../shared/main-process-api-interfaces/RepositoryMonitoringAPI';
import { minimatch } from 'minimatch';

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
  readFile?: (filePath: string) => Promise<string>;
  writeFile?: (filePath: string, content: string) => Promise<void>;
  openFile?: (filePath: string) => Promise<void>;
  // Local Projects panel actions
  selectDirectory?: () => Promise<{ path: string; name: string } | null>;
  registerRepository?: (name: string, path: string) => Promise<void>;
  removeRepository?: (name: string, deleteLocal: boolean) => Promise<void>;
  openRepository?: (entry: AlexandriaEntry) => Promise<void>;
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
}

export const RepositoryPanelProvider: React.FC<
  RepositoryPanelProviderProps
> = ({ children, repositoryPath, repository }) => {
  // Initialize event bus
  const events = useMemo(() => new PanelEventBus(), []);

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
      version?: string;
      metrics: Record<string, number>;
    }>;
    lastUpdated: string;
  } | null>(null);
  const [qualityLoading, setQualityLoading] = useState(false);

  // Loading state
  const [loading] = useState(false);

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

    // Subscribe to git status changes - onGitStatusChanged only provides metadata,
    // so we need to fetch the full status with files when notified
    const unsubscribe = RepositoryMonitoringService.onGitStatusChanged(
      (data) => {
        if (data.repoPath === repositoryPath) {
          console.info(
            '[RepositoryPanelProvider] Git status changed for repository:',
            repositoryPath,
          );
          // Fetch full status with files since the event only has metadata
          RepositoryMonitoringService.getGitStatusWithFiles(repositoryPath)
            .then((status) => {
              setGitStatusData(mapGitStatusToSliceData(status));
            })
            .catch((error) => {
              console.error(
                '[RepositoryPanelProvider] Failed to refresh git status after change:',
                error,
              );
            });
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
        const artifactData = await GitHubArtifactService.getLatestQualityMetrics(
          githubInfo.owner,
          githubInfo.repo,
          branch,
        );

        if (artifactData) {
          // Transform to the format expected by the quality slice
          const packages = artifactData.qualityMetrics.packages.map((pkg) => ({
            name: pkg.name,
            metrics: pkg.hexagon as unknown as Record<string, number>,
          }));

          console.log(
            `[RepositoryPanelProvider] Quality metrics loaded: ${packages.length} packages`,
          );
          setQualityData({
            packages,
            lastUpdated: artifactData.timestamp,
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

  // Create actions object
  // Note: Terminal actions have been moved to TerminalContext
  const actions: RepositoryPanelActions = useMemo(
    () => ({
      notifyPanels: (event: PanelEvent) => {
        events.emit(event);
      },

      // File system actions
      readFile: async (filePath: string) => {
        try {
          const content = await FileSystemService.readFile(filePath);
          return content;
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
          await FileSystemService.writeFile(filePath, content);
        } catch (error) {
          console.error(
            '[RepositoryPanelProvider] Failed to write file:',
            filePath,
            error,
          );
          throw error;
        }
      },

      openFile: async (filePath: string) => {
        try {
          // Check if it's a markdown file
          if (filePath.toLowerCase().endsWith('.md')) {
            await WindowService.openMarkdownViewFromRepository(
              filePath,
              repositoryPath,
              {
                viewMode: 'single',
              },
            );
          } else {
            // For non-markdown files, could open in editor or emit event
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
        lastModified: file.mtime ? new Date(file.mtime).getTime() : undefined,
      }));
  }, [fileTreeData]);

  // Create adapters for panels to use
  const adapters: PanelAdapters = useMemo(
    () => ({
      // readFile accepts relative paths and resolves them against the repository path
      readFile: async (relativePath: string): Promise<string> => {
        const absolutePath = relativePath.startsWith('/')
          ? relativePath
          : `${repositoryPath}/${relativePath}`;
        // FileSystemService.readFile returns { content, filePath } or null
        const result = await FileSystemService.readFile(absolutePath);
        if (!result) {
          throw new Error(`File not found: ${absolutePath}`);
        }
        // Extract content from the result object
        return typeof result === 'string' ? result : result.content;
      },
      matchesPath: (pattern: string, filePath: string): boolean => {
        return minimatch(filePath, pattern);
      },
    }),
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
                  await RepositoryMonitoringService.getGitStatus(repositoryPath);
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
