import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import type { Theme } from '@a24z/industry-theme';
import { PanelEventBus } from '@principal-ade/panel-framework-core';
import type {
  PanelContextValue,
  PanelActions,
  DataSlice,
  WorkspaceMetadata,
  RepositoryMetadata,
  PanelEvent,
  PanelEventEmitter,
} from '@principal-ade/panel-framework-core';
import { TerminalService } from '../main-process-api/TerminalService';
import type { TerminalInfo } from '../../shared/main-process-api-interfaces/TerminalService';
import { WorkspaceService } from '../main-process-api/WorkspaceService';
import { WindowService } from '../main-process-api/WindowService';
import { AlexandriaDocsService } from '../main-process-api/AlexandriaDocsService';
import type { AlexandriaEntry } from '@a24z/core-library';

// Extend PanelActions with terminal and workspace-specific actions
interface ExtendedPanelActions extends PanelActions {
  createTerminalSession?: (options?: { cwd?: string }) => Promise<string>;
  writeToTerminal?: (sessionId: string, data: string) => Promise<void>;
  resizeTerminal?: (
    sessionId: string,
    cols: number,
    rows: number
  ) => Promise<void>;
  destroyTerminalSession?: (sessionId: string) => Promise<void>;
  removeRepositoryFromWorkspace?: (
    repositoryId: string,
    workspaceId: string
  ) => Promise<void>;
  copyToClipboard?: (text: string) => Promise<void>;
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
  fileTree: unknown | null;
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
}

export const PanelProvider: React.FC<PanelProviderProps> = ({
  children,
  workspace,
  repository,
  theme: _theme,
}) => {
  // Initialize event bus
  const events = useMemo(() => new PanelEventBus(), []);

  // Track active terminal sessions
  const [terminalSessions, setTerminalSessions] = useState<TerminalInfo[]>([]);

  // Track workspace repositories
  const [workspaceRepositories, setWorkspaceRepositories] = useState<AlexandriaEntry[]>([]);
  const [repositoriesLoading, setRepositoriesLoading] = useState(false);

  // Track markdown files for the current repository
  const [markdownFiles, setMarkdownFiles] = useState<Array<{ path: string; title?: string; lastModified: number }>>([]);
  const [markdownLoading, setMarkdownLoading] = useState(false);

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

        const docs = await AlexandriaDocsService.getComprehensiveDocuments(entry);

        // Combine all documents (tracked + untracked)
        const allDocs = [...docs.tracked, ...docs.untracked];

        // Map to the format expected by the panel
        const files = allDocs.map((docPath) => ({
          path: docPath,
          title: undefined, // We could extract title from file content if needed
          lastModified: Date.now(), // We could get actual mtime if needed
        }));

        console.info('[PanelContext] Fetched markdown files for repository:', repository.path, files);
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

  // Fetch workspace repositories
  useEffect(() => {
    const fetchRepositories = async () => {
      if (!workspace?.id) {
        setWorkspaceRepositories([]);
        return;
      }

      setRepositoriesLoading(true);
      try {
        const repos = await WorkspaceService.getRepositoriesInWorkspace(workspace.id as string);
        setWorkspaceRepositories(repos);
      } catch (error) {
        console.error('[PanelContext] Failed to fetch workspace repositories:', error);
        setWorkspaceRepositories([]);
      } finally {
        setRepositoriesLoading(false);
      }
    };

    fetchRepositories();
  }, [workspace?.id]);

  // Listen for workspace membership changes and refresh repositories
  useEffect(() => {
    const unsubscribe = WorkspaceService.onWorkspaceChange((event) => {
      // Only refresh if it's a membership change for the current workspace
      if (event.type === 'membership-changed' && event.workspaceId === workspace?.id) {
        console.info('[PanelContext] Workspace membership changed, refreshing repositories');

        // Refetch repositories
        if (workspace?.id) {
          setRepositoriesLoading(true);
          WorkspaceService.getRepositoriesInWorkspace(workspace.id as string)
            .then((repos) => {
              setWorkspaceRepositories(repos);
            })
            .catch((error) => {
              console.error('[PanelContext] Failed to refresh workspace repositories after membership change:', error);
            })
            .finally(() => {
              setRepositoriesLoading(false);
            });
        }
      }
    });

    return unsubscribe;
  }, [workspace?.id]);

  // Wire up terminal events to panel event bus
  useEffect(() => {
    let unsubData: (() => void) | null = null;
    let unsubExit: (() => void) | null = null;

    // Forward terminal data events to panel event bus
    TerminalService.onData((terminalData) => {
      events.emit({
        type: 'terminal:data',
        source: 'alexandria-workspace',
        timestamp: Date.now(),
        payload: terminalData,
      });
    }).then((unsub) => {
      unsubData = unsub;
    });

    // Forward terminal exit events to panel event bus
    TerminalService.onExit((terminalExit) => {
      events.emit({
        type: 'terminal:exit',
        source: 'alexandria-workspace',
        timestamp: Date.now(),
        payload: terminalExit,
      });

      // Remove session from list on exit
      setTerminalSessions((prev) =>
        prev.filter((s) => s.id !== terminalExit.sessionId)
      );
    }).then((unsub) => {
      unsubExit = unsub;
    });

    // Cleanup on unmount
    return () => {
      unsubData?.();
      unsubExit?.();
    };
  }, [events]);

  // Listen for repository:opened events and open repository window
  useEffect(() => {
    const unsubscribe = events.on('repository:opened', (event) => {
      const { repository } = event.payload as { repositoryId: string; repository: AlexandriaEntry };
      if (repository) {
        WindowService.openRepositoryDashboard(repository);
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
                  const repos = await WorkspaceService.getRepositoriesInWorkspace(workspace.id as string);
                  setWorkspaceRepositories(repos);
                } catch (error) {
                  console.error('[PanelContext] Failed to refresh workspace repositories:', error);
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
                  const docs = await AlexandriaDocsService.getComprehensiveDocuments(entry);
                  const allDocs = [...docs.tracked, ...docs.untracked];
                  const files = allDocs.map((docPath) => ({
                    path: docPath,
                    title: undefined,
                    lastModified: Date.now(),
                  }));
                  setMarkdownFiles(files);
                } catch (error) {
                  console.error('[PanelContext] Failed to refresh markdown files:', error);
                } finally {
                  setMarkdownLoading(false);
                }
              }
            },
          },
        ],
      ]),
    [workspace, workspaceRepositories, repositoriesLoading, markdownFiles, markdownLoading, repository]
  );

  // Define panel actions
  const actions: ExtendedPanelActions = useMemo(
    () => ({
      openFile: (filePath: string) => {
        console.info('[PanelContext] Opening file:', filePath);
        events.emit({
          type: 'file:opened',
          source: 'alexandria-workspace',
          timestamp: Date.now(),
          payload: { filePath },
        });
      },
      openRepository: (repositoryId: string) => {
        console.info('[PanelContext] Opening repository:', repositoryId);
        events.emit({
          type: 'repository:opened',
          source: 'alexandria-workspace',
          timestamp: Date.now(),
          payload: { repositoryId },
        });
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
      createTerminalSession: async (options?: { cwd?: string }) => {
        const cwd = options?.cwd || workspace.path;
        console.info('[PanelContext] createTerminalSession called with:', {
          optionsCwd: options?.cwd,
          workspacePath: workspace.path,
          finalCwd: cwd,
          repository: repository?.name
        });
        const sessionId = await TerminalService.create(cwd, 'alexandria-workspace');

        // Fetch updated terminal info
        const terminals = await TerminalService.list();
        setTerminalSessions(terminals);

        return sessionId;
      },

      writeToTerminal: async (sessionId: string, data: string) => {
        await TerminalService.write(sessionId, data);
      },

      resizeTerminal: async (sessionId: string, cols: number, rows: number) => {
        await TerminalService.resize(sessionId, cols, rows);
      },

      destroyTerminalSession: async (sessionId: string) => {
        console.info('[PanelContext] Destroying terminal session:', sessionId);
        await TerminalService.destroy(sessionId);
        setTerminalSessions((prev) => prev.filter((s) => s.id !== sessionId));
      },

      // Workspace actions
      removeRepositoryFromWorkspace: async (
        repositoryId: string,
        workspaceId: string
      ) => {
        console.info(
          '[PanelContext] Removing repository from workspace:',
          repositoryId,
          workspaceId
        );

        try {
          await WorkspaceService.removeRepositoryFromWorkspace(repositoryId, workspaceId);

          // Refresh the repositories list
          if (workspace?.id === workspaceId) {
            const repos = await WorkspaceService.getRepositoriesInWorkspace(workspaceId);
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
          console.error('[PanelContext] Failed to remove repository from workspace:', error);
          throw error;
        }
      },

      copyToClipboard: async (text: string) => {
        console.info('[PanelContext] Copying to clipboard');
        await navigator.clipboard.writeText(text);
      },
    }),
    [events, workspace]
  );

  // Create the extended context value with both framework and panel-specific properties
  const context: ExtendedPanelContextValue = useMemo(
    () => {
      console.info('[PanelContext] Creating context with repository:', repository);
      return {
        currentScope: {
          type: repository ? ('repository' as const) : ('workspace' as const),
          workspace,
          repository,
        },
        slices,
      getSlice: <T = unknown>(name: string): DataSlice<T> | undefined => {
        return slices.get(name) as DataSlice<T> | undefined;
      },
      getWorkspaceSlice: <T = unknown>(name: string): DataSlice<T> | undefined => {
        const slice = slices.get(name);
        return slice?.scope === 'workspace' ? (slice as DataSlice<T>) : undefined;
      },
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
      markdownFiles: [],
      fileTree: null,
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
      };
    },
    [workspace, repository, slices, terminalSessions]
  );

  // Combine context, actions, and events into provider value
  const value: PanelProviderValue = useMemo(
    () => ({
      context,
      actions,
      events,
    }),
    [context, actions, events]
  );

  return (
    <PanelContext.Provider value={value}>
      {children}
    </PanelContext.Provider>
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
