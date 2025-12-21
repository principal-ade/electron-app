import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type { Theme } from '@principal-ade/industry-theme';
import { PanelEventBus } from '@principal-ade/panel-framework-core';
import type {
  PanelContextValue,
  PanelActions,
  DataSlice,
  WorkspaceMetadata,
  RepositoryMetadata,
  PanelEvent,
  PanelEventEmitter,
  PanelAdapters,
} from '@principal-ade/panel-framework-core';
import { TerminalService } from '../main-process-api/TerminalService';
import type { TerminalInfo } from '../../shared/main-process-api-interfaces/TerminalService';
import { WorkspaceService } from '../main-process-api/WorkspaceService';
import { WindowService } from '../main-process-api/WindowService';
import { AlexandriaDocsService } from '../main-process-api/AlexandriaDocsService';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { AlexandriaService } from '../main-process-api/AlexandriaService';
import { FileSystemService } from '../main-process-api/FileSystemService';
import {
  LocalhostDetectionService,
  type RunningServer,
  type ServerScanResult,
} from '../main-process-api/LocalhostDetectionService';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { FileTree } from '@principal-ai/repository-abstraction';
import { minimatch } from 'minimatch';

// Extend PanelActions with terminal and workspace-specific actions
interface ExtendedPanelActions extends PanelActions {
  createTerminalSession?: (options?: {
    cwd?: string;
    command?: string;
    context?: string;
  }) => Promise<string>;
  writeToTerminal?: (sessionId: string, data: string) => Promise<void>;
  resizeTerminal?: (
    sessionId: string,
    cols: number,
    rows: number,
    force?: boolean,
  ) => Promise<void>;
  destroyTerminalSession?: (sessionId: string) => Promise<void>;
  /**
   * Request a MessagePort for receiving terminal data directly.
   * This bypasses IPC for high-performance data streaming.
   * Returns { success: true } if the port will be delivered via onTerminalPortReady.
   */
  requestTerminalDataPort?: (
    sessionId: string,
  ) => Promise<{ success: boolean; reason?: string }>;
  /**
   * Register a callback to receive MessagePorts for terminal data streaming.
   * Call this before requestTerminalDataPort() to ensure you receive the port.
   * Returns an unsubscribe function.
   */
  onTerminalPortReady?: (
    callback: (
      data: { sessionId: string; writable: boolean },
      port: MessagePort,
    ) => void,
  ) => () => void;
  // Ownership actions
  checkTerminalOwnership?: (sessionId: string) => Promise<{
    exists: boolean;
    ownedByWindowId: number | null;
    ownedByThisWindow?: boolean;
    canClaim: boolean;
  }>;
  claimTerminalOwnership?: (
    sessionId: string,
    force?: boolean,
  ) => Promise<{
    success: boolean;
    reason?: string;
  }>;
  releaseTerminalOwnership?: (sessionId: string) => Promise<{
    success: boolean;
    reason?: string;
  }>;
  refreshTerminal?: (sessionId: string) => Promise<boolean>;
  /**
   * Listen for ownership lost events.
   * Called when another window takes control of a terminal session.
   * Returns an unsubscribe function.
   */
  onOwnershipLost?: (
    callback: (data: { sessionId: string; newOwnerWindowId: number }) => void,
  ) => () => void;
  /**
   * Subscribe to terminal data for a specific session.
   * Returns an unsubscribe function.
   */
  onTerminalData?: (
    sessionId: string,
    callback: (data: string) => void,
  ) => () => void;
  /**
   * List all terminal sessions.
   */
  listTerminalSessions?: () => Promise<TerminalInfo[]>;
  removeRepositoryFromWorkspace?: (
    repositoryId: string,
    workspaceId: string,
  ) => Promise<void>;
  copyToClipboard?: (text: string) => Promise<void>;
  isRepositoryInWorkspaceDirectory?: (
    repository: AlexandriaEntry,
    workspaceId: string,
  ) => Promise<boolean | null>;
  moveRepositoryToWorkspaceDirectory?: (
    repository: AlexandriaEntry,
    workspaceId: string,
  ) => Promise<string>;
  // Localhost detection actions
  detectLocalhostServers?: () => Promise<ServerScanResult>;
  checkLocalhostPort?: (port: number) => Promise<boolean>;
  navigateToLocalhost?: (port: number, path?: string) => void;
  // Local Projects panel actions
  selectDirectory?: () => Promise<{ path: string; name: string } | null>;
  registerRepository?: (name: string, path: string) => Promise<void>;
  removeRepository?: (name: string, deleteLocal: boolean) => Promise<void>;
  openRepository?: (entryOrId: AlexandriaEntry | string) => Promise<void>;
  // Active file management for markdown panel
  setActiveFile?: (filePath: string | null) => Promise<void>;
  // File operations for panels (e.g., principal-view-panels)
  // Matches framework signature: (path: string) => string | Promise<string>
  readFile?: (path: string) => Promise<string>;
}

// Extended context interface that panels actually expect
// This includes both framework properties and direct data access
interface ExtendedPanelContextValue extends PanelContextValue {
  repositoryPath: string | null;
  repository: RepositoryMetadata | null;
  gitStatus: {
    staged: string[];
    unstaged: string[];
    untracked: string[];
    deleted: string[];
  };
  gitStatusLoading: boolean;
  markdownFiles: Array<{ path: string; title?: string; lastModified: number }>;
  fileTree: FileTree | null;
  fileTreeLoading: boolean;
  packages: unknown[] | null;
  quality: unknown | null;
  terminalSessions?: Array<{
    id: string;
    pid: number;
    cwd: string;
    shell: string;
    createdAt: number;
    lastActivity: number;
    repositoryPath?: string;
  }>;
  loading: boolean;
  // Localhost detection data
  localhostServers: RunningServer[];
  localhostServersLoading: boolean;
}

// Provider value that contains context, actions, and events separately
interface PanelProviderValue {
  context: ExtendedPanelContextValue;
  actions: ExtendedPanelActions;
  events: PanelEventEmitter;
}

const PanelContext = createContext<PanelProviderValue | null>(null);

interface PanelProviderProps {
  children: ReactNode;
  workspace: WorkspaceMetadata;
  repository?: RepositoryMetadata;
  theme?: Theme;
  terminalContext?: string; // Optional terminal context for session identification (no default)
}

export const PanelProvider: React.FC<PanelProviderProps> = ({
  children,
  workspace,
  repository,
  theme: _theme,
  terminalContext,
}) => {
  // Initialize event bus
  const events = useMemo(() => new PanelEventBus(), []);

  // Track active terminal sessions
  const [terminalSessions, setTerminalSessions] = useState<TerminalInfo[]>([]);

  // Track terminal session subscriptions for cleanup
  const terminalSubscriptionsRef = useRef<Map<string, () => void>>(new Map());

  // Track workspace repositories
  const [workspaceRepositories, setWorkspaceRepositories] = useState<
    AlexandriaEntry[]
  >([]);
  const [repositoriesLoading, setRepositoriesLoading] = useState(false);

  // Track markdown files for the current repository
  const [markdownFiles, setMarkdownFiles] = useState<
    Array<{ path: string; title?: string; lastModified: number }>
  >([]);
  const [markdownLoading, setMarkdownLoading] = useState(false);

  // Track file tree for the current repository
  const [fileTreeData, setFileTreeData] = useState<FileTree | null>(null);
  const [fileTreeLoading, setFileTreeLoading] = useState(false);

  // Track localhost servers
  const [localhostServers, setLocalhostServers] = useState<RunningServer[]>([]);
  const [localhostServersLoading, setLocalhostServersLoading] = useState(false);
  const localhostWatchIdRef = useRef<string | null>(null);

  // Track all Alexandria repositories (for Local Projects panel)
  const [alexandriaRepositories, setAlexandriaRepositories] = useState<
    AlexandriaEntry[]
  >([]);
  const [alexandriaRepositoriesLoading, setAlexandriaRepositoriesLoading] =
    useState(false);

  // Track active file for markdown panel (and other file viewers)
  const [activeFileData, setActiveFileData] = useState<{
    path: string;
    content: string;
    type: string;
  } | null>(null);
  const [activeFileLoading, setActiveFileLoading] = useState(false);
  const [activeFileError, setActiveFileError] = useState<Error | null>(null);

  // Fetch markdown files when repository changes
  useEffect(() => {
    const fetchMarkdownFiles = async () => {
      if (!repository?.path) {
        setMarkdownFiles([]);
        return;
      }

      setMarkdownLoading(true);
      try {
        // Create an AlexandriaEntry from the repository
        const entry: AlexandriaEntry = {
          name: repository.name,
          path: repository.path,
        } as AlexandriaEntry;

        const docs =
          await AlexandriaDocsService.getComprehensiveDocuments(entry);

        // Combine all documents (tracked + untracked)
        const allDocs = [...docs.tracked, ...docs.untracked];

        // Map to the format expected by the panel
        const files = allDocs.map((docPath) => ({
          path: docPath,
          title: undefined, // We could extract title from file content if needed
          lastModified: Date.now(), // We could get actual mtime if needed
        }));

        console.info(
          '[PanelContext] Fetched markdown files for repository:',
          repository.path,
          files,
        );
        setMarkdownFiles(files);
      } catch (error) {
        console.error('[PanelContext] Failed to fetch markdown files:', error);
        setMarkdownFiles([]);
      } finally {
        setMarkdownLoading(false);
      }
    };

    fetchMarkdownFiles();
  }, [repository?.path, repository?.name]);

  // Fetch file tree when repository changes
  useEffect(() => {
    const fetchFileTree = async () => {
      if (!repository?.path) {
        setFileTreeData(null);
        return;
      }

      setFileTreeLoading(true);
      try {
        const tree = await RepositoryMonitoringService.getFileTree(
          repository.path,
        );
        console.info(
          '[PanelContext] Fetched file tree for repository:',
          repository.path,
        );
        console.info('[PanelContext] FileTree stats:', tree?.stats);
        console.info(
          '[PanelContext] FileTree sample allFiles (first 5):',
          tree?.allFiles?.slice(0, 5),
        );
        console.info(
          '[PanelContext] FileTree .alexandria files:',
          tree?.allFiles?.filter(
            (f) =>
              f.path.includes('.alexandria') ||
              f.relativePath?.includes('.alexandria'),
          ),
        );
        setFileTreeData(tree);
      } catch (error) {
        console.error('[PanelContext] Failed to fetch file tree:', error);
        setFileTreeData(null);
      } finally {
        setFileTreeLoading(false);
      }
    };

    fetchFileTree();
  }, [repository?.path]);

  // Fetch workspace repositories
  useEffect(() => {
    const fetchRepositories = async () => {
      if (!workspace?.id) {
        setWorkspaceRepositories([]);
        return;
      }

      setRepositoriesLoading(true);
      try {
        const repos = await WorkspaceService.getRepositoriesInWorkspace(
          workspace.id as string,
        );
        setWorkspaceRepositories(repos);
      } catch (error) {
        console.error(
          '[PanelContext] Failed to fetch workspace repositories:',
          error,
        );
        setWorkspaceRepositories([]);
      } finally {
        setRepositoriesLoading(false);
      }
    };

    fetchRepositories();
  }, [workspace?.id]);

  // Initialize localhost server detection
  useEffect(() => {
    let unsubscribeUpdates: (() => void) | null = null;

    const initLocalhostDetection = async () => {
      setLocalhostServersLoading(true);
      try {
        // Do initial scan
        const result = await LocalhostDetectionService.detectRunningServers();
        setLocalhostServers(result.servers);

        // Start watching for changes (every 5 seconds)
        const { watchId } = await LocalhostDetectionService.startWatching(
          undefined,
          5000,
        );
        localhostWatchIdRef.current = watchId;

        // Subscribe to updates
        unsubscribeUpdates = LocalhostDetectionService.onServersUpdated(
          (scanResult) => {
            setLocalhostServers(scanResult.servers);
          },
        );
      } catch (error) {
        console.error(
          '[PanelContext] Failed to initialize localhost detection:',
          error,
        );
      } finally {
        setLocalhostServersLoading(false);
      }
    };

    initLocalhostDetection();

    return () => {
      // Cleanup: stop watching and unsubscribe
      if (localhostWatchIdRef.current) {
        LocalhostDetectionService.stopWatching(
          localhostWatchIdRef.current,
        ).catch((err) => {
          console.error(
            '[PanelContext] Failed to stop localhost watching:',
            err,
          );
        });
        localhostWatchIdRef.current = null;
      }
      if (unsubscribeUpdates) {
        unsubscribeUpdates();
      }
    };
  }, []);

  // Listen for workspace membership changes and refresh repositories
  useEffect(() => {
    const unsubscribe = WorkspaceService.onWorkspaceChange((event) => {
      // Only refresh if it's a membership change for the current workspace
      if (
        event.type === 'membership-changed' &&
        event.workspaceId === workspace?.id
      ) {
        console.info(
          '[PanelContext] Workspace membership changed, refreshing repositories',
        );

        // Refetch repositories
        if (workspace?.id) {
          setRepositoriesLoading(true);
          WorkspaceService.getRepositoriesInWorkspace(workspace.id as string)
            .then((repos) => {
              setWorkspaceRepositories(repos);
            })
            .catch((error) => {
              console.error(
                '[PanelContext] Failed to refresh workspace repositories after membership change:',
                error,
              );
            })
            .finally(() => {
              setRepositoriesLoading(false);
            });
        }
      }
    });

    return unsubscribe;
  }, [workspace?.id]);

  // Fetch all Alexandria repositories (for Local Projects panel) and subscribe to changes
  useEffect(() => {
    const fetchAlexandriaRepositories = async () => {
      setAlexandriaRepositoriesLoading(true);
      try {
        const repos = await AlexandriaService.getRepositories();
        console.info(
          '[PanelContext] Fetched Alexandria repositories:',
          repos.length,
        );
        setAlexandriaRepositories(repos);
      } catch (error) {
        console.error(
          '[PanelContext] Failed to fetch Alexandria repositories:',
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
      console.info('[PanelContext] Alexandria repository change:', event.type);
      // Refetch repositories on any change
      fetchAlexandriaRepositories();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Wire up terminal exit events to panel event bus
  useEffect(() => {
    let unsubExit: (() => void) | null = null;

    // Forward terminal exit events to panel event bus
    TerminalService.onExit((terminalExit) => {
      events.emit({
        type: 'terminal:exit',
        source: 'alexandria-workspace',
        timestamp: Date.now(),
        payload: terminalExit,
      });

      // Unsubscribe from terminal data for this session
      const unsubscribe = terminalSubscriptionsRef.current.get(
        terminalExit.sessionId,
      );
      if (unsubscribe) {
        unsubscribe();
        terminalSubscriptionsRef.current.delete(terminalExit.sessionId);
      }

      // Remove session from list on exit
      setTerminalSessions((prev) =>
        prev.filter((s) => s.id !== terminalExit.sessionId),
      );
    }).then((unsub) => {
      unsubExit = unsub;
    });

    // Cleanup on unmount - unsubscribe from all terminal data subscriptions
    return () => {
      unsubExit?.();

      // Clean up all terminal data subscriptions
      terminalSubscriptionsRef.current.forEach((unsubscribe) => {
        unsubscribe();
      });
      terminalSubscriptionsRef.current.clear();
    };
  }, [events]);

  // Listen for repository:opened events and open dev workspace window
  useEffect(() => {
    const unsubscribe = events.on('repository:opened', (event) => {
      const { repository } = event.payload as {
        repositoryId: string;
        repository: AlexandriaEntry;
      };
      if (repository) {
        WindowService.openDevWorkspace({
          alexandriaEntry: repository,
        });
      }
    });

    return unsubscribe;
  }, [events]);

  // Define data slices (memoized to update with workspace repositories)
  const slices = useMemo<Map<string, DataSlice>>(
    () =>
      new Map([
        [
          'git',
          {
            scope: 'repository' as const,
            name: 'git',
            data: null,
            loading: false,
            error: null,
            refresh: async () => {
              // TODO: Implement git data fetching
              console.info('[PanelContext] Refreshing git data...');
            },
          },
        ],
        [
          'workspace',
          {
            scope: 'workspace' as const,
            name: 'workspace',
            data: workspace,
            loading: false,
            error: null,
            refresh: async () => {
              // TODO: Implement workspace data fetching
              console.info('[PanelContext] Refreshing workspace data...');
            },
          },
        ],
        [
          'workspaceRepositories',
          {
            scope: 'workspace' as const,
            name: 'workspaceRepositories',
            data: workspaceRepositories,
            loading: repositoriesLoading,
            error: null,
            refresh: async () => {
              // Refetch repositories
              if (workspace?.id) {
                setRepositoriesLoading(true);
                try {
                  const repos =
                    await WorkspaceService.getRepositoriesInWorkspace(
                      workspace.id as string,
                    );
                  setWorkspaceRepositories(repos);
                } catch (error) {
                  console.error(
                    '[PanelContext] Failed to refresh workspace repositories:',
                    error,
                  );
                } finally {
                  setRepositoriesLoading(false);
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
            loading: markdownLoading,
            error: null,
            refresh: async () => {
              // Refetch markdown files
              if (repository?.path) {
                setMarkdownLoading(true);
                try {
                  const entry: AlexandriaEntry = {
                    name: repository.name,
                    path: repository.path,
                  } as AlexandriaEntry;
                  const docs =
                    await AlexandriaDocsService.getComprehensiveDocuments(
                      entry,
                    );
                  const allDocs = [...docs.tracked, ...docs.untracked];
                  const files = allDocs.map((docPath) => ({
                    path: docPath,
                    title: undefined,
                    lastModified: Date.now(),
                  }));
                  setMarkdownFiles(files);
                } catch (error) {
                  console.error(
                    '[PanelContext] Failed to refresh markdown files:',
                    error,
                  );
                } finally {
                  setMarkdownLoading(false);
                }
              }
            },
          },
        ],
        [
          'fileTree',
          {
            scope: 'repository' as const,
            name: 'fileTree',
            data: fileTreeData,
            loading: fileTreeLoading,
            error: null,
            refresh: async () => {
              // Refetch file tree
              if (repository?.path) {
                setFileTreeLoading(true);
                try {
                  const tree = await RepositoryMonitoringService.getFileTree(
                    repository.path,
                  );
                  setFileTreeData(tree);
                } catch (error) {
                  console.error(
                    '[PanelContext] Failed to refresh file tree:',
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
                  '[PanelContext] Failed to refresh localhost servers:',
                  error,
                );
              } finally {
                setLocalhostServersLoading(false);
              }
            },
          },
        ],
        [
          'alexandriaRepositories',
          {
            scope: 'workspace' as const,
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
                  '[PanelContext] Failed to refresh Alexandria repositories:',
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
                  const repoPath = repository?.path || workspace?.path || '';
                  const absolutePath = activeFileData.path.startsWith('/')
                    ? activeFileData.path
                    : `${repoPath}/${activeFileData.path}`;
                  const result =
                    await window.mainProcess.fileSystem.readFile(absolutePath);
                  if (result) {
                    setActiveFileData({
                      ...activeFileData,
                      content: result.content,
                    });
                  }
                } catch (error) {
                  console.error(
                    '[PanelContext] Failed to refresh active file:',
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
      ]),
    [
      workspace,
      workspaceRepositories,
      repositoriesLoading,
      markdownFiles,
      markdownLoading,
      fileTreeData,
      fileTreeLoading,
      repository,
      localhostServers,
      localhostServersLoading,
      alexandriaRepositories,
      alexandriaRepositoriesLoading,
      activeFileData,
      activeFileLoading,
      activeFileError,
    ],
  );

  // Define panel actions
  const actions: ExtendedPanelActions = useMemo(
    () => {
      const repoPath = repository?.path || workspace?.path || '';

      return {
        openFile: (filePath: string) => {
          // Resolve relative paths against repository path
          const absolutePath = filePath.startsWith('/')
            ? filePath
            : `${repoPath}/${filePath}`;
          console.info('[PanelContext] Opening file:', absolutePath);
          events.emit({
            type: 'file:opened',
            source: 'alexandria-workspace',
            timestamp: Date.now(),
            payload: { filePath: absolutePath },
          });
        },
        openRepository: async (entryOrId: AlexandriaEntry | string) => {
          // Handle both AlexandriaEntry objects and repository ID strings
          if (typeof entryOrId === 'string') {
            console.info('[PanelContext] Opening repository by ID:', entryOrId);
            events.emit({
              type: 'repository:opened',
              source: 'alexandria-workspace',
              timestamp: Date.now(),
              payload: { repositoryId: entryOrId },
            });
          } else {
            // It's an AlexandriaEntry - open dev workspace directly
            try {
              await WindowService.openDevWorkspace({
                alexandriaEntry: entryOrId,
              });
              console.info('[PanelContext] Opened repository:', entryOrId.name);
            } catch (error) {
              console.error('[PanelContext] Failed to open repository:', error);
              throw error;
            }
          }
        },
        openGitDiff: (filePath: string, status?: string) => {
          console.info('[PanelContext] Opening git diff:', filePath, status);
          events.emit({
            type: 'git:diff',
            source: 'alexandria-workspace',
            timestamp: Date.now(),
            payload: { filePath, status },
          });
        },
        navigateToPanel: (panelId: string) => {
          console.info('[PanelContext] Navigating to panel:', panelId);
          events.emit({
            type: 'panel:focus',
            source: 'alexandria-workspace',
            timestamp: Date.now(),
            payload: { panelId },
          });
        },
        notifyPanels: (event: PanelEvent) => {
          events.emit(event);
        },

        // Terminal actions
        createTerminalSession: async (options?: {
          cwd?: string;
          command?: string;
          context?: string;
        }) => {
          console.info(
            '[PanelContext] createTerminalSession called with options:',
            options,
          );
          // Use the provided context (from TabbedTerminalPanel) or fall back to the provider's terminalContext
          const sessionContext = options?.context || terminalContext;
          if (!sessionContext) {
            throw new Error(
              'terminalContext is required in PanelProvider to create terminal sessions. ' +
                'Please provide a terminalContext prop to PanelProvider.',
            );
          }
          const cwd = options?.cwd || workspace.path;

          // Always create a new session - each tab should have its own PTY
          let sessionId: string;
          if (options?.command) {
            sessionId = await TerminalService.createWithCommand(
              cwd,
              options.command,
              sessionContext,
            );
          } else {
            sessionId = await TerminalService.create(cwd, sessionContext);
          }

          // Subscribe to this terminal's data channel and forward to panel event bus
          // Only subscribe if we haven't already subscribed to this session
          if (!terminalSubscriptionsRef.current.has(sessionId)) {
            const unsubscribe = TerminalService.onDataForSession(
              sessionId,
              (data) => {
                // Forward terminal data to panel event bus
                events.emit({
                  type: 'terminal:data',
                  source: 'alexandria-workspace',
                  timestamp: Date.now(),
                  payload: { sessionId, data },
                });
              },
            );

            // Store unsubscribe function for cleanup
            terminalSubscriptionsRef.current.set(sessionId, unsubscribe);
          }

          // Fetch updated terminal info
          const terminals = await TerminalService.list();
          setTerminalSessions(terminals);

          return sessionId;
        },

        writeToTerminal: async (sessionId: string, data: string) => {
          await TerminalService.write(sessionId, data);
        },

        resizeTerminal: async (
          sessionId: string,
          cols: number,
          rows: number,
          force?: boolean,
        ) => {
          await TerminalService.resize(sessionId, cols, rows, force);
        },

        destroyTerminalSession: async (sessionId: string) => {
          console.info(
            '[PanelContext] Destroying terminal session:',
            sessionId,
          );

          // Unsubscribe from terminal data before destroying
          const unsubscribe = terminalSubscriptionsRef.current.get(sessionId);
          if (unsubscribe) {
            unsubscribe();
            terminalSubscriptionsRef.current.delete(sessionId);
          }

          await TerminalService.destroy(sessionId);
          setTerminalSessions((prev) => prev.filter((s) => s.id !== sessionId));
        },

        // MessagePort-based terminal data streaming (high-performance path)
        requestTerminalDataPort: async (sessionId: string) => {
          console.info(
            '[PanelContext] requestTerminalDataPort called for session:',
            sessionId,
          );
          const result = await TerminalService.requestDataPort(sessionId);
          console.info(
            '[PanelContext] requestTerminalDataPort result:',
            result,
          );
          return result;
        },

        onTerminalPortReady: (callback) => {
          return TerminalService.onPortReady(callback);
        },

        // Terminal ownership actions
        checkTerminalOwnership: async (sessionId: string) => {
          return TerminalService.checkOwnership(sessionId);
        },

        claimTerminalOwnership: async (sessionId: string, force?: boolean) => {
          console.info(
            '[PanelContext] claimTerminalOwnership called for session:',
            sessionId,
            'force:',
            force,
          );
          const result = await TerminalService.claimOwnership(sessionId, force);
          console.info('[PanelContext] claimTerminalOwnership result:', result);
          return result;
        },

        releaseTerminalOwnership: async (sessionId: string) => {
          return TerminalService.releaseOwnership(sessionId);
        },

        refreshTerminal: async (sessionId: string) => {
          return TerminalService.refresh(sessionId);
        },

        onOwnershipLost: (
          callback: (data: {
            sessionId: string;
            newOwnerWindowId: number;
          }) => void,
        ) => {
          return TerminalService.onOwnershipLost(callback);
        },

        // Session-specific data subscription (used by TabbedTerminalPanel)
        // Automatically claims ownership and requests a data port
        onTerminalData: (
          sessionId: string,
          callback: (data: string) => void,
        ) => {
          console.info(
            '[PanelContext] onTerminalData called for session:',
            sessionId,
          );

          // First claim ownership, then request data port, then refresh terminal
          // This matches the terminal-testing-app pattern:
          // 1. claimTerminalOwnership - so we're the owner and receive data
          // 2. requestTerminalDataPort - to get the MessageChannel for streaming
          // 3. refreshTerminal - force redraw since we don't have buffer history
          TerminalService.claimOwnership(sessionId)
            .then((ownershipResult) => {
              console.info(
                '[PanelContext] Claimed ownership for session:',
                sessionId,
                'result:',
                ownershipResult,
              );

              // Request the data port regardless of ownership result
              return TerminalService.requestDataPort(sessionId);
            })
            .then((portResult) => {
              console.info(
                '[PanelContext] Requested data port for session:',
                sessionId,
                'result:',
                portResult,
              );

              // After port is ready, force a refresh to redraw the terminal
              // This sends Ctrl+L which redraws the prompt/screen
              setTimeout(() => {
                TerminalService.refresh(sessionId)
                  .then(() => {
                    console.info(
                      '[PanelContext] Refreshed terminal for session:',
                      sessionId,
                    );
                  })
                  .catch((err) => {
                    console.warn(
                      '[PanelContext] Failed to refresh terminal:',
                      err,
                    );
                  });
              }, 100); // Small delay to ensure port is fully connected
            })
            .catch((err) => {
              console.warn('[PanelContext] Failed during reconnection:', err);
            });

          return TerminalService.onDataForSession(sessionId, callback);
        },

        // List terminal sessions (used by TabbedTerminalPanel for restoration)
        listTerminalSessions: async () => {
          console.info('[PanelContext] listTerminalSessions called');
          const sessions = await TerminalService.list();
          console.info(
            '[PanelContext] listTerminalSessions found:',
            sessions.length,
            'sessions',
          );
          // Map to TerminalSessionInfo format (directory -> cwd)
          return sessions.map((s) => ({
            id: s.id,
            pid: 0,
            cwd: s.directory,
            shell: '',
            createdAt: s.createdAt,
            lastActivity: s.lastActivity,
            context: s.context,
          }));
        },

        // Workspace actions
        removeRepositoryFromWorkspace: async (
          repositoryId: string,
          workspaceId: string,
        ) => {
          console.info(
            '[PanelContext] Removing repository from workspace:',
            repositoryId,
            workspaceId,
          );

          try {
            await WorkspaceService.removeRepositoryFromWorkspace(
              repositoryId,
              workspaceId,
            );

            // Refresh the repositories list
            if (workspace?.id === workspaceId) {
              const repos =
                await WorkspaceService.getRepositoriesInWorkspace(workspaceId);
              setWorkspaceRepositories(repos);
            }

            // Emit event
            events.emit({
              type: 'workspace:membership-changed',
              source: 'alexandria-workspace',
              timestamp: Date.now(),
              payload: { repositoryId, workspaceId, action: 'removed' },
            });
          } catch (error) {
            console.error(
              '[PanelContext] Failed to remove repository from workspace:',
              error,
            );
            throw error;
          }
        },

        copyToClipboard: async (text: string) => {
          console.info('[PanelContext] Copying to clipboard');
          await navigator.clipboard.writeText(text);
        },

        // Repository location actions
        isRepositoryInWorkspaceDirectory: async (
          repository: AlexandriaEntry,
          workspaceId: string,
        ) => {
          console.info(
            '[PanelContext] Checking if repository is in workspace directory:',
            repository.name,
            workspaceId,
          );

          try {
            return await WorkspaceService.isRepositoryInWorkspaceDirectory(
              repository,
              workspaceId,
            );
          } catch (error) {
            console.error(
              '[PanelContext] Failed to check repository location:',
              error,
            );
            throw error;
          }
        },

        moveRepositoryToWorkspaceDirectory: async (
          repository: AlexandriaEntry,
          workspaceId: string,
        ) => {
          console.info(
            '[PanelContext] Moving repository to workspace directory:',
            repository.name,
            workspaceId,
          );

          try {
            const newPath =
              await WorkspaceService.moveRepositoryToWorkspaceDirectory(
                repository,
                workspaceId,
              );

            // Refresh the repositories list to reflect the updated path
            if (workspace?.id === workspaceId) {
              const repos =
                await WorkspaceService.getRepositoriesInWorkspace(workspaceId);
              setWorkspaceRepositories(repos);
            }

            // Emit event to notify other panels
            events.emit({
              type: 'repository:moved',
              source: 'alexandria-workspace',
              timestamp: Date.now(),
              payload: {
                repositoryId: repository.github?.id || repository.name,
                workspaceId,
                newPath,
              },
            });

            return newPath;
          } catch (error) {
            console.error('[PanelContext] Failed to move repository:', error);
            throw error;
          }
        },

        // Localhost detection actions
        detectLocalhostServers: async () => {
          setLocalhostServersLoading(true);
          try {
            const result =
              await LocalhostDetectionService.detectRunningServers();
            setLocalhostServers(result.servers);
            return result;
          } finally {
            setLocalhostServersLoading(false);
          }
        },

        checkLocalhostPort: async (port: number) => {
          return LocalhostDetectionService.checkPort(port);
        },

        navigateToLocalhost: (port: number, path?: string) => {
          console.info('[PanelContext] Navigating to localhost:', port, path);
          events.emit({
            type: 'localhost:navigate',
            source: 'alexandria-workspace',
            timestamp: Date.now(),
            payload: { port, path: path || '/' },
          });
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
            console.error('[PanelContext] Failed to select directory:', error);
            return null;
          }
        },

        registerRepository: async (name: string, path: string) => {
          try {
            await AlexandriaService.registerRepository(name, path);
            console.info('[PanelContext] Registered repository:', name, path);
          } catch (error) {
            console.error(
              '[PanelContext] Failed to register repository:',
              error,
            );
            throw error;
          }
        },

        removeRepository: async (name: string, deleteLocal: boolean) => {
          try {
            await AlexandriaService.removeRepository(name, deleteLocal);
            console.info('[PanelContext] Removed repository:', name);
          } catch (error) {
            console.error('[PanelContext] Failed to remove repository:', error);
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
            const repoPath = repository?.path || workspace?.path || '';
            const absolutePath = filePath.startsWith('/')
              ? filePath
              : `${repoPath}/${filePath}`;

            console.info('[PanelContext] Setting active file:', absolutePath);

            const result =
              await window.mainProcess.fileSystem.readFile(absolutePath);

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
            console.error('[PanelContext] Failed to set active file:', error);
            setActiveFileError(
              error instanceof Error ? error : new Error('Failed to read file'),
            );
          } finally {
            setActiveFileLoading(false);
          }
        },

        // File operations for panels (e.g., principal-view-panels Architecture panel)
        // Returns string directly to match framework signature
        readFile: async (path: string): Promise<string> => {
          const repoPath = repository?.path || workspace?.path || '';
          const absolutePath = path.startsWith('/')
            ? path
            : `${repoPath}/${path}`;

          console.info('[PanelContext] Reading file:', absolutePath);

          const result =
            await window.mainProcess.fileSystem.readFile(absolutePath);

          if (!result) {
            throw new Error(`Failed to read file: ${path}`);
          }

          return result.content;
        },
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, workspace, repository?.path, repository?.name, terminalContext],
  );

  // Create adapters for panels to use (memoized to avoid recreating on every render)
  const adapters: PanelAdapters = useMemo(() => {
    const repoPath = repository?.path || workspace?.path || '';
    console.log('[PanelContext] Creating adapters with repoPath:', repoPath);

    return {
      // Minimal adapters (for panels using FileTree-based adapters)
      // readFile accepts relative paths and resolves them against the repository path
      readFile: async (path: string): Promise<string> => {
        // Resolve relative paths against repository path
        const absolutePath = path.startsWith('/')
          ? path
          : `${repoPath}/${path}`;
        const result =
          await window.mainProcess.fileSystem.readFile(absolutePath);
        if (!result) throw new Error(`Failed to read file: ${path}`);
        return result.content;
      },
      matchesPath: (pattern: string, path: string): boolean => {
        return minimatch(path, pattern);
      },
    };
  }, [repository?.path, workspace?.path]);

  // Create the extended context value with both framework and panel-specific properties
  const context: ExtendedPanelContextValue = useMemo(
    () => ({
      currentScope: {
        type: repository ? ('repository' as const) : ('workspace' as const),
        workspace,
        repository,
      },
      slices,
      adapters,
      getSlice: <T = unknown,>(name: string): DataSlice<T> | undefined => {
        return slices.get(name) as DataSlice<T> | undefined;
      },
      getWorkspaceSlice: <T = unknown,>(
        name: string,
      ): DataSlice<T> | undefined => {
        const slice = slices.get(name);
        return slice?.scope === 'workspace'
          ? (slice as DataSlice<T>)
          : undefined;
      },
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
      // Panel-specific properties
      repositoryPath: workspace.path, // Use workspace path, not repository path
      repository: repository || null,
      gitStatus: {
        staged: [],
        unstaged: [],
        untracked: [],
        deleted: [],
      },
      gitStatusLoading: false,
      markdownFiles,
      fileTree: fileTreeData,
      fileTreeLoading,
      packages: null,
      quality: null,
      terminalSessions: terminalSessions.map((session) => ({
        id: session.id,
        pid: 0, // TerminalInfo doesn't include pid
        cwd: session.directory || '',
        shell: '', // TerminalInfo doesn't include shell
        createdAt: session.createdAt || Date.now(),
        lastActivity: session.lastActivity || Date.now(),
        repositoryPath: undefined, // TerminalInfo doesn't include repositoryPath
      })),
      loading: false,
      // Localhost detection data
      localhostServers,
      localhostServersLoading,
    }),
    [
      workspace,
      repository,
      slices,
      adapters,
      terminalSessions,
      markdownFiles,
      fileTreeData,
      fileTreeLoading,
      localhostServers,
      localhostServersLoading,
    ],
  );

  // Combine context, actions, and events into provider value
  const value: PanelProviderValue = useMemo(
    () => ({
      context,
      actions,
      events,
    }),
    [context, actions, events],
  );

  return (
    <PanelContext.Provider value={value}>{children}</PanelContext.Provider>
  );
};

export const usePanelProvider = (): PanelProviderValue => {
  const value = useContext(PanelContext);
  if (!value) {
    throw new Error('usePanelProvider must be used within a PanelProvider');
  }
  return value;
};

export default PanelContext;
