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
import { TerminalService } from '../main-process-api/TerminalService';
import type { TerminalInfo, TerminalOwnershipStatus, TerminalOwnershipResult, RequestDataPortResult, PortReadyData } from '../../shared/main-process-api-interfaces/TerminalService';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { FileSystemService } from '../main-process-api/FileSystemService';
import { WindowService } from '../main-process-api/WindowService';
import type { FileTree } from '@principal-ai/repository-abstraction';
import type { PackageLayer } from '@principal-ai/codebase-composition';
import type { PackageSummary, GitStatusWithFiles } from '../../shared/main-process-api-interfaces/RepositoryMonitoringAPI';
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
function mapGitStatusToSliceData(status: GitStatusWithFiles | null): GitStatusSliceData {
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

// Extend PanelActions with terminal-specific and file system actions
interface RepositoryPanelActions extends PanelActions {
  createTerminalSession?: (options?: { cwd?: string; context?: string }) => Promise<string>;
  writeToTerminal?: (sessionId: string, data: string) => Promise<void>;
  resizeTerminal?: (
    sessionId: string,
    cols: number,
    rows: number,
    force?: boolean
  ) => Promise<void>;
  destroyTerminalSession?: (sessionId: string) => Promise<void>;
  readFile?: (filePath: string) => Promise<string>;
  writeFile?: (filePath: string, content: string) => Promise<void>;
  openFile?: (filePath: string) => Promise<void>;
  // Terminal ownership actions
  checkTerminalOwnership?: (sessionId: string) => Promise<TerminalOwnershipStatus>;
  claimTerminalOwnership?: (sessionId: string, force?: boolean) => Promise<TerminalOwnershipResult>;
  releaseTerminalOwnership?: (sessionId: string) => Promise<TerminalOwnershipResult>;
  refreshTerminal?: (sessionId: string) => Promise<boolean>;
  // MessagePort-based terminal data streaming (high-performance path)
  requestTerminalDataPort?: (sessionId: string) => Promise<RequestDataPortResult>;
  onTerminalPortReady?: (callback: (data: PortReadyData, port: MessagePort) => void) => () => void;
  // Session-specific data subscription (used by TabbedTerminalPanel)
  onTerminalData?: (sessionId: string, callback: (data: string) => void) => () => void;
  // List terminal sessions (used by TabbedTerminalPanel for restoration)
  listTerminalSessions?: () => Promise<TerminalInfo[]>;
}

// Extended context for repository panels
interface RepositoryPanelContextValue extends PanelContextValue {
  repositoryPath: string;
  repository: RepositoryMetadata | null; // Required by terminal panel
  terminalSessions?: TerminalInfo[];
  terminalContext?: string; // Context prefix for terminal sessions
  loading: boolean;
}

// Provider value that contains context, actions, and events separately
interface RepositoryPanelProviderValue {
  context: RepositoryPanelContextValue;
  actions: RepositoryPanelActions;
  events: PanelEventEmitter;
}

const RepositoryPanelContext = createContext<RepositoryPanelProviderValue | null>(null);

interface RepositoryPanelProviderProps {
  children: ReactNode;
  repositoryPath: string;
  repository: RepositoryMetadata; // Required - terminal panel needs this
  terminalContext: string; // Required for terminal session identification
}

export const RepositoryPanelProvider: React.FC<RepositoryPanelProviderProps> = ({
  children,
  repositoryPath,
  repository,
  terminalContext,
}) => {
  // Initialize event bus
  const events = useMemo(() => new PanelEventBus(), []);

  // Track active terminal sessions
  const [terminalSessions, setTerminalSessions] = useState<TerminalInfo[]>([]);

  // Track terminal session subscriptions for cleanup
  const terminalSubscriptionsRef = useRef<Map<string, () => void>>(new Map());

  // Track file tree for the current repository
  const [fileTreeData, setFileTreeData] = useState<FileTree | null>(null);
  const [fileTreeLoading, setFileTreeLoading] = useState(false);

  // Track packages data for the current repository
  const [packagesData, setPackagesData] = useState<PackagesSliceData | null>(null);
  const [packagesLoading, setPackagesLoading] = useState(false);

  // Track git status for the current repository
  const [gitStatusData, setGitStatusData] = useState<GitStatusSliceData | null>(null);
  const [gitStatusLoading, setGitStatusLoading] = useState(false);

  // Loading state
  const [loading] = useState(false);

  // Forward terminal exit events to panel event bus
  useEffect(() => {
    let unsubExit: (() => void) | null = null;

    TerminalService.onExit((terminalExit) => {
      events.emit({
        type: 'terminal:exit',
        source: 'repository-panel',
        timestamp: Date.now(),
        payload: terminalExit,
      });

      // Remove this session from our list
      setTerminalSessions((prev) =>
        prev.filter((session) => session.id !== terminalExit.sessionId),
      );

      // Clean up subscription for this terminal
      const unsubscribe = terminalSubscriptionsRef.current.get(terminalExit.sessionId);
      if (unsubscribe) {
        unsubscribe();
        terminalSubscriptionsRef.current.delete(terminalExit.sessionId);
      }
    }).then((unsub) => {
      unsubExit = unsub;
    });

    return () => {
      if (unsubExit) {
        unsubExit();
      }
      // Clean up all terminal subscriptions
      terminalSubscriptionsRef.current.forEach((unsub) => unsub());
      terminalSubscriptionsRef.current.clear();
    };
  }, [events]);

  // Forward terminal ownership lost events to panel event bus
  useEffect(() => {
    const unsubscribe = TerminalService.onOwnershipLost((data) => {
      console.log('[RepositoryPanelProvider] Ownership lost event:', data);
      events.emit({
        type: 'terminal:ownershipLost',
        source: 'repository-panel',
        timestamp: Date.now(),
        payload: data,
      });
    });

    return () => {
      unsubscribe();
    };
  }, [events]);

  // Fetch terminal sessions on mount
  useEffect(() => {
    const loadTerminalSessions = async () => {
      try {
        const sessions = await TerminalService.list();
        setTerminalSessions(sessions);
      } catch (error) {
        console.error('[RepositoryPanelProvider] Failed to load terminal sessions:', error);
      }
    };

    loadTerminalSessions();
  }, []);

  // Fetch file tree when repository changes and subscribe to cache sync updates
  useEffect(() => {
    const fetchFileTree = async () => {
      if (!repositoryPath) {
        setFileTreeData(null);
        return;
      }

      setFileTreeLoading(true);
      try {
        const tree = await RepositoryMonitoringService.getFileTree(repositoryPath);
        console.info('[RepositoryPanelProvider] Fetched file tree for repository:', repositoryPath, tree);
        setFileTreeData(tree);
      } catch (error) {
        console.error('[RepositoryPanelProvider] Failed to fetch file tree:', error);
        setFileTreeData(null);
      } finally {
        setFileTreeLoading(false);
      }
    };

    fetchFileTree();

    // Subscribe to cache sync events for fileTree updates
    const unsubscribe = RepositoryMonitoringService.onCacheSync((event) => {
      if (event.repoPath === repositoryPath && event.slice === 'fileTree') {
        console.info('[RepositoryPanelProvider] File tree cache sync received for repository:', repositoryPath);
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
        const result = await RepositoryMonitoringService.getPackages(repositoryPath);
        if (result) {
          console.info('[RepositoryPanelProvider] Fetched packages for repository:', repositoryPath, result.packages.length, 'packages');
          setPackagesData(result);
        } else {
          setPackagesData(null);
        }
      } catch (error) {
        console.error('[RepositoryPanelProvider] Failed to fetch packages:', error);
        setPackagesData(null);
      } finally {
        setPackagesLoading(false);
      }
    };

    fetchPackages();

    // Subscribe to cache sync events for packages updates
    const unsubscribe = RepositoryMonitoringService.onCacheSync((event) => {
      if (event.repoPath === repositoryPath && event.slice === 'packages') {
        console.info('[RepositoryPanelProvider] Packages cache sync received for repository:', repositoryPath);
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
        const status = await RepositoryMonitoringService.getGitStatusWithFiles(repositoryPath);
        console.info('[RepositoryPanelProvider] Fetched git status for repository:', repositoryPath);
        setGitStatusData(mapGitStatusToSliceData(status));
      } catch (error) {
        console.error('[RepositoryPanelProvider] Failed to fetch git status:', error);
        setGitStatusData(null);
      } finally {
        setGitStatusLoading(false);
      }
    };

    fetchGitStatus();

    // Subscribe to git status changes - onGitStatusChanged only provides metadata,
    // so we need to fetch the full status with files when notified
    const unsubscribe = RepositoryMonitoringService.onGitStatusChanged((data) => {
      if (data.repoPath === repositoryPath) {
        console.info('[RepositoryPanelProvider] Git status changed for repository:', repositoryPath);
        // Fetch full status with files since the event only has metadata
        RepositoryMonitoringService.getGitStatusWithFiles(repositoryPath)
          .then((status) => {
            setGitStatusData(mapGitStatusToSliceData(status));
          })
          .catch((error) => {
            console.error('[RepositoryPanelProvider] Failed to refresh git status after change:', error);
          });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [repositoryPath]);

  // Create actions object
  const actions: RepositoryPanelActions = useMemo(
    () => ({
      notifyPanels: (event: PanelEvent) => {
        events.emit(event);
      },

      // Terminal actions
      createTerminalSession: async (options?: { cwd?: string; context?: string }) => {
        const cwd = options?.cwd || repositoryPath;
        // Use provided context (e.g., tab ID) or fall back to the default terminalContext
        // If a tab-specific context is provided, append it to the base context
        const sessionContext = options?.context
          ? `${terminalContext}:${options.context}`
          : terminalContext;

        // Check existing sessions before creating
        const existingSessions = await TerminalService.list();
        const existingSession = existingSessions.find(s => s.context === sessionContext);

        console.info('[RepositoryPanelProvider] createTerminalSession called with:', {
          optionsCwd: options?.cwd,
          optionsContext: options?.context,
          repositoryPath,
          finalCwd: cwd,
          context: sessionContext,
          existingSession: existingSession ? {
            id: existingSession.id,
            directory: existingSession.directory,
            context: existingSession.context,
          } : null,
          allSessions: existingSessions.map(s => ({ id: s.id, directory: s.directory, context: s.context })),
        });
        const sessionId = await TerminalService.getOrCreate(cwd, sessionContext);

        // Subscribe to this terminal's data channel and forward to panel event bus
        if (!terminalSubscriptionsRef.current.has(sessionId)) {
          const unsubscribe = TerminalService.onDataForSession(sessionId, (data) => {
            events.emit({
              type: 'terminal:data',
              source: 'repository-panel',
              timestamp: Date.now(),
              payload: { sessionId, data },
            });
          });

          terminalSubscriptionsRef.current.set(sessionId, unsubscribe);
        }

        // Update terminal sessions list
        const terminals = await TerminalService.list();
        setTerminalSessions(terminals);
        return sessionId;
      },

      writeToTerminal: async (sessionId: string, data: string) => {
        await TerminalService.write(sessionId, data);
      },

      resizeTerminal: async (sessionId: string, cols: number, rows: number, force?: boolean) => {
        await TerminalService.resize(sessionId, cols, rows, force);
      },

      destroyTerminalSession: async (sessionId: string) => {
        await TerminalService.destroy(sessionId);

        // Clean up subscription
        const unsubscribe = terminalSubscriptionsRef.current.get(sessionId);
        if (unsubscribe) {
          unsubscribe();
          terminalSubscriptionsRef.current.delete(sessionId);
        }

        // Update terminal sessions list
        const terminals = await TerminalService.list();
        setTerminalSessions(terminals);
      },

      // File system actions
      readFile: async (filePath: string) => {
        try {
          const content = await FileSystemService.readFile(filePath);
          return content;
        } catch (error) {
          console.error('[RepositoryPanelProvider] Failed to read file:', filePath, error);
          throw error;
        }
      },

      writeFile: async (filePath: string, content: string) => {
        try {
          await FileSystemService.writeFile(filePath, content);
        } catch (error) {
          console.error('[RepositoryPanelProvider] Failed to write file:', filePath, error);
          throw error;
        }
      },

      openFile: async (filePath: string) => {
        try {
          // Check if it's a markdown file
          if (filePath.toLowerCase().endsWith('.md')) {
            await WindowService.openMarkdownViewFromRepository(filePath, repositoryPath, {
              viewMode: 'single',
            });
          } else {
            // For non-markdown files, could open in editor or emit event
            console.log('[RepositoryPanelProvider] openFile called for non-markdown:', filePath);
          }
        } catch (error) {
          console.error('[RepositoryPanelProvider] Failed to open file:', filePath, error);
          throw error;
        }
      },

      // Terminal ownership actions
      checkTerminalOwnership: async (sessionId: string) => {
        return TerminalService.checkOwnership(sessionId);
      },

      claimTerminalOwnership: async (sessionId: string, force?: boolean) => {
        console.log(`[RepositoryPanelActions] claimTerminalOwnership called: sessionId=${sessionId}, force=${force}`);
        const result = await TerminalService.claimOwnership(sessionId, force);
        console.log(`[RepositoryPanelActions] claimTerminalOwnership result:`, result);
        return result;
      },

      releaseTerminalOwnership: async (sessionId: string) => {
        return TerminalService.releaseOwnership(sessionId);
      },

      // Listen for ownership lost events
      onOwnershipLost: (callback: (data: { sessionId: string; newOwnerWindowId: number }) => void) => {
        console.log('[RepositoryPanelActions] onOwnershipLost: registering callback');
        const unsubscribe = TerminalService.onOwnershipLost((data) => {
          console.log('[RepositoryPanelActions] onOwnershipLost: received event from TerminalService:', data);
          callback(data);
        });
        return () => {
          console.log('[RepositoryPanelActions] onOwnershipLost: unsubscribing');
          unsubscribe();
        };
      },

      refreshTerminal: async (sessionId: string) => {
        return TerminalService.refresh(sessionId);
      },

      listTerminalSessions: async () => {
        return TerminalService.list();
      },

      // Session-specific data subscription (used by TabbedTerminalPanel)
      onTerminalData: (sessionId: string, callback: (data: string) => void) => {
        return TerminalService.onDataForSession(sessionId, callback);
      },

      // MessagePort-based terminal data streaming (high-performance path)
      requestTerminalDataPort: async (sessionId: string) => {
        return TerminalService.requestDataPort(sessionId);
      },

      onTerminalPortReady: (callback: (data: PortReadyData, port: MessagePort) => void) => {
        return TerminalService.onPortReady(callback);
      },
    }),
    [repositoryPath, terminalContext, events],
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
        title: (file.name || file.path.split('/').pop() || '').replace(/\.md$/i, ''),
        lastModified: file.mtime ? new Date(file.mtime).getTime() : undefined,
      }));
  }, [fileTreeData]);

  // Create adapters for panels to use
  const adapters: PanelAdapters = useMemo(() => ({
    // readFile accepts relative paths and resolves them against the repository path
    readFile: async (relativePath: string): Promise<string> => {
      const absolutePath = relativePath.startsWith('/') ? relativePath : `${repositoryPath}/${relativePath}`;
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
  }), [repositoryPath]);

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
                  const tree = await RepositoryMonitoringService.getFileTree(repositoryPath);
                  setFileTreeData(tree);
                } catch (error) {
                  console.error('[RepositoryPanelProvider] Failed to refresh file tree:', error);
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
                  const tree = await RepositoryMonitoringService.getFileTree(repositoryPath);
                  setFileTreeData(tree);
                } catch (error) {
                  console.error('[RepositoryPanelProvider] Failed to refresh file tree:', error);
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
                  const result = await RepositoryMonitoringService.getPackages(repositoryPath);
                  if (result) {
                    setPackagesData(result);
                  } else {
                    setPackagesData(null);
                  }
                } catch (error) {
                  console.error('[RepositoryPanelProvider] Failed to refresh packages:', error);
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
                  const status = await RepositoryMonitoringService.getGitStatusWithFiles(repositoryPath);
                  setGitStatusData(mapGitStatusToSliceData(status));
                } catch (error) {
                  console.error('[RepositoryPanelProvider] Failed to refresh git status:', error);
                  setGitStatusData(null);
                } finally {
                  setGitStatusLoading(false);
                }
              }
            },
          },
        ],
      ]),
    [repositoryPath, fileTreeData, fileTreeLoading, markdownFiles, packagesData, packagesLoading, gitStatusData, gitStatusLoading],
  );

  // Create context value
  const context: RepositoryPanelContextValue = useMemo(
    () => ({
      // Repository-specific properties
      repositoryPath,
      repository,
      terminalSessions,
      terminalContext,
      loading,

      // PanelContextValue required properties
      currentScope: {
        type: 'repository' as const,
        repository,
      },
      slices,
      adapters,
      getSlice: <T = unknown>(name: string): DataSlice<T> | undefined => {
        return slices.get(name) as DataSlice<T> | undefined;
      },
      getWorkspaceSlice: () => undefined, // No workspace slices in repository context
      getRepositorySlice: <T = unknown>(name: string): DataSlice<T> | undefined => {
        const slice = slices.get(name);
        return slice?.scope === 'repository' ? (slice as DataSlice<T>) : undefined;
      },
      hasSlice: (name: string, scope?: 'workspace' | 'repository'): boolean => {
        const slice = slices.get(name);
        if (!slice) return false;
        return scope ? slice.scope === scope : true;
      },
      isSliceLoading: (name: string, scope?: 'workspace' | 'repository'): boolean => {
        const slice = slices.get(name);
        if (!slice) return false;
        if (scope && slice.scope !== scope) return false;
        return slice.loading;
      },
      refresh: async (scope?: 'workspace' | 'repository', sliceName?: string): Promise<void> => {
        const slicesToRefresh = Array.from(slices.values()).filter((slice) => {
          if (scope && slice.scope !== scope) return false;
          if (sliceName && slice.name !== sliceName) return false;
          return true;
        });

        await Promise.all(slicesToRefresh.map((slice) => slice.refresh()));
      },
    }),
    [repositoryPath, repository, terminalSessions, terminalContext, loading, slices, adapters],
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
      'useRepositoryPanelProvider must be used within a RepositoryPanelProvider'
    );
  }
  return context;
};
