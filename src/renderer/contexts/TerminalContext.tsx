import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { TerminalService } from '../main-process-api/TerminalService';
import type { TerminalInfo } from '../../shared/main-process-api-interfaces/TerminalService';
import type {
  TerminalPanelActions,
  TerminalSessionInfo,
} from '@industry-theme/xterm-terminal-panel';

/**
 * Terminal context value
 */
export interface TerminalContextValue {
  terminalSessions: TerminalInfo[];
  terminalContext: string;
  repositoryPath: string;
}

/**
 * Combined provider value
 */
export interface TerminalProviderValue {
  context: TerminalContextValue;
  actions: TerminalPanelActions;
}

const TerminalContext = createContext<TerminalProviderValue | null>(null);

interface TerminalProviderProps {
  children: ReactNode;
  repositoryPath: string;
  terminalContext: string;
}

/**
 * TerminalProvider - Manages terminal session state separately from panel data
 *
 * This context is split from RepositoryPanelContext to prevent terminal state changes
 * (like creating/destroying tabs) from causing re-renders of unrelated panels.
 */
export const TerminalProvider: React.FC<TerminalProviderProps> = ({
  children,
  repositoryPath,
  terminalContext,
}) => {
  // Track active terminal sessions
  const [terminalSessions, setTerminalSessions] = useState<TerminalInfo[]>([]);

  // Track terminal session subscriptions for cleanup
  const terminalSubscriptionsRef = useRef<Map<string, () => void>>(new Map());

  // Forward terminal exit events and update session list
  useEffect(() => {
    let unsubExit: (() => void) | null = null;

    TerminalService.onExit((terminalExit) => {
      // Remove this session from our list
      setTerminalSessions((prev) =>
        prev.filter((session) => session.id !== terminalExit.sessionId),
      );

      // Clean up subscription for this terminal
      const unsubscribe = terminalSubscriptionsRef.current.get(
        terminalExit.sessionId,
      );
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
  }, []);

  // Fetch terminal sessions on mount
  useEffect(() => {
    const loadTerminalSessions = async () => {
      try {
        const sessions = await TerminalService.list();
        setTerminalSessions(sessions);
      } catch (error) {
        console.error(
          '[TerminalProvider] Failed to load terminal sessions:',
          error,
        );
      }
    };

    loadTerminalSessions();
  }, []);

  // Create actions object matching TerminalPanelActions interface
  const actions: TerminalPanelActions = useMemo(
    () => ({
      createTerminalSession: async (options?: {
        cwd?: string;
        context?: string;
      }) => {
        const cwd = options?.cwd || repositoryPath;
        const sessionContext = options?.context
          ? `${terminalContext}:${options.context}`
          : terminalContext;

        // Check existing sessions before creating
        const existingSessions = await TerminalService.list();
        const existingSession = existingSessions.find(
          (s) => s.context === sessionContext,
        );

        console.info('[TerminalProvider] createTerminalSession called with:', {
          optionsCwd: options?.cwd,
          optionsContext: options?.context,
          repositoryPath,
          finalCwd: cwd,
          context: sessionContext,
          existingSession: existingSession
            ? {
                id: existingSession.id,
                directory: existingSession.directory,
                context: existingSession.context,
              }
            : null,
          allSessions: existingSessions.map((s) => ({
            id: s.id,
            directory: s.directory,
            context: s.context,
          })),
        });
        const sessionId = await TerminalService.getOrCreate(
          cwd,
          sessionContext,
        );

        // Subscribe to this terminal's data channel
        if (!terminalSubscriptionsRef.current.has(sessionId)) {
          const unsubscribe = TerminalService.onDataForSession(
            sessionId,
            (_data) => {
              // Data is handled by individual terminal components via onTerminalData
            },
          );

          terminalSubscriptionsRef.current.set(sessionId, unsubscribe);
        }

        // Update terminal sessions list
        const terminals = await TerminalService.list();
        setTerminalSessions(terminals);
        return sessionId;
      },

      // Note: TerminalPanelActions expects void return, but we call async method
      writeToTerminal: (sessionId: string, data: string) => {
        TerminalService.write(sessionId, data);
      },

      // Note: TerminalPanelActions expects void return, but we call async method
      resizeTerminal: (
        sessionId: string,
        cols: number,
        rows: number,
        force?: boolean,
      ) => {
        TerminalService.resize(sessionId, cols, rows, force);
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

      checkTerminalOwnership: async (sessionId: string) => {
        return TerminalService.checkOwnership(sessionId);
      },

      claimTerminalOwnership: async (sessionId: string, force?: boolean) => {
        console.log(
          `[TerminalActions] claimTerminalOwnership called: sessionId=${sessionId}, force=${force}`,
        );
        const result = await TerminalService.claimOwnership(sessionId, force);
        console.log(`[TerminalActions] claimTerminalOwnership result:`, result);
        return result;
      },

      releaseTerminalOwnership: async (sessionId: string) => {
        return TerminalService.releaseOwnership(sessionId);
      },

      onOwnershipLost: (
        callback: (data: {
          sessionId: string;
          newOwnerWindowId: number;
        }) => void,
      ) => {
        console.log('[TerminalActions] onOwnershipLost: registering callback');
        const unsubscribe = TerminalService.onOwnershipLost((data) => {
          console.log(
            '[TerminalActions] onOwnershipLost: received event from TerminalService:',
            data,
          );
          callback(data);
        });
        return () => {
          console.log('[TerminalActions] onOwnershipLost: unsubscribing');
          unsubscribe();
        };
      },

      refreshTerminal: async (sessionId: string) => {
        return TerminalService.refresh(sessionId);
      },

      listTerminalSessions: async (): Promise<TerminalSessionInfo[]> => {
        const sessions = await TerminalService.list();
        // Map TerminalInfo to TerminalSessionInfo
        return sessions.map((s) => ({
          id: s.id,
          pid: 0, // TerminalInfo doesn't include pid
          cwd: s.directory || '',
          shell: '', // TerminalInfo doesn't include shell
          createdAt: s.createdAt || Date.now(),
          lastActivity: s.lastActivity || Date.now(),
          context: s.context,
        }));
      },

      onTerminalData: (sessionId: string, callback: (data: string) => void) => {
        console.info(
          '[TerminalContext] onTerminalData called for session:',
          sessionId,
        );

        // First claim ownership, then request data port, then refresh terminal
        TerminalService.claimOwnership(sessionId)
          .then((ownershipResult) => {
            console.info(
              '[TerminalContext] Claimed ownership for session:',
              sessionId,
              'result:',
              ownershipResult,
            );

            // Request the data port regardless of ownership result
            return TerminalService.requestDataPort(sessionId);
          })
          .then((portResult) => {
            console.info(
              '[TerminalContext] Requested data port for session:',
              sessionId,
              'result:',
              portResult,
            );

            // After port is ready, force a refresh to redraw the terminal
            setTimeout(() => {
              TerminalService.refresh(sessionId)
                .then(() => {
                  console.info(
                    '[TerminalContext] Refreshed terminal for session:',
                    sessionId,
                  );
                })
                .catch((err) => {
                  console.warn(
                    '[TerminalContext] Failed to refresh terminal:',
                    err,
                  );
                });
            }, 100);
          })
          .catch((err) => {
            console.warn('[TerminalContext] Failed during reconnection:', err);
          });

        return TerminalService.onDataForSession(sessionId, callback);
      },

      requestTerminalDataPort: async (sessionId: string) => {
        return TerminalService.requestDataPort(sessionId);
      },

      onTerminalPortReady: (callback) => {
        return TerminalService.onPortReady(callback);
      },
    }),
    [repositoryPath, terminalContext],
  );

  // Create context value
  const context: TerminalContextValue = useMemo(
    () => ({
      terminalSessions,
      terminalContext,
      repositoryPath,
    }),
    [terminalSessions, terminalContext, repositoryPath],
  );

  // Provider value
  const value: TerminalProviderValue = useMemo(
    () => ({
      context,
      actions,
    }),
    [context, actions],
  );

  return (
    <TerminalContext.Provider value={value}>
      {children}
    </TerminalContext.Provider>
  );
};

export const useTerminalProvider = (): TerminalProviderValue => {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error(
      'useTerminalProvider must be used within a TerminalProvider',
    );
  }
  return context;
};

/**
 * Hook to access just terminal actions (for components that don't need session state)
 */
export const useTerminalActions = (): TerminalPanelActions => {
  const { actions } = useTerminalProvider();
  return actions;
};

/**
 * Hook to access terminal session list
 */
export const useTerminalSessions = (): TerminalInfo[] => {
  const { context } = useTerminalProvider();
  return context.terminalSessions;
};

export default TerminalContext;
