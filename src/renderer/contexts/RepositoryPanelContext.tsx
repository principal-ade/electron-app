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
} from '@principal-ade/panel-framework-core';
import { TerminalService } from '../main-process-api/TerminalService';
import type { TerminalInfo, TerminalOwnershipStatus, TerminalOwnershipResult, RequestDataPortResult, PortReadyData } from '../../shared/main-process-api-interfaces/TerminalService';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { FileSystemService } from '../main-process-api/FileSystemService';
import type { FileTree } from '@principal-ai/repository-abstraction';

// Extend PanelActions with terminal-specific and file system actions
interface RepositoryPanelActions extends PanelActions {
  createTerminalSession?: (options?: { cwd?: string; context?: string }) => Promise<string>;
  writeToTerminal?: (sessionId: string, data: string) => Promise<void>;
  resizeTerminal?: (
    sessionId: string,
    cols: number,
    rows: number
  ) => Promise<void>;
  destroyTerminalSession?: (sessionId: string) => Promise<void>;
  readFile?: (filePath: string) => Promise<string>;
  writeFile?: (filePath: string, content: string) => Promise<void>;
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

  // Fetch file tree when repository changes
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

      resizeTerminal: async (sessionId: string, cols: number, rows: number) => {
        await TerminalService.resize(sessionId, cols, rows);
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

      // Terminal ownership actions
      checkTerminalOwnership: async (sessionId: string) => {
        return TerminalService.checkOwnership(sessionId);
      },

      claimTerminalOwnership: async (sessionId: string, force?: boolean) => {
        return TerminalService.claimOwnership(sessionId, force);
      },

      releaseTerminalOwnership: async (sessionId: string) => {
        return TerminalService.releaseOwnership(sessionId);
      },

      // Listen for ownership lost events
      onOwnershipLost: (callback: (data: { sessionId: string; newOwnerWindowId: number }) => void) => {
        return TerminalService.onOwnershipLost(callback);
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
      ]),
    [repositoryPath, fileTreeData, fileTreeLoading],
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
    [repositoryPath, repository, terminalSessions, terminalContext, loading, slices],
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
