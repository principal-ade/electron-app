import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import { TerminalService } from '../main-process-api/TerminalService';
import type { TerminalInfo } from '../../shared/main-process-api-interfaces/TerminalService';
import type {
  TerminalPanelActions,
  TerminalSessionInfo,
} from '@industry-theme/xterm-terminal-panel';
import {
  terminalClient,
  onActivitySync,
  type TerminalActivityState,
  type UpdateActivityInput,
} from '../tipc/terminalClient';

/**
 * Terminal context value
 */
export interface TerminalContextValue {
  terminalSessions: TerminalInfo[];
  terminalContext: string;
  repositoryPath: string;
  /** Terminal activity states from all windows (broadcast from main process) */
  terminalActivities: TerminalActivityState[];
}

/**
 * Activity tracking actions
 */
export interface TerminalActivityActions {
  /** Update activity state for a terminal session (sends to main, broadcasts to all windows) */
  updateActivity: (input: UpdateActivityInput) => Promise<void>;
  /** Get activity state for a specific session (from local state) */
  getActivityForSession: (sessionId: string) => TerminalActivityState | undefined;
  /** Check if a session is currently working */
  isSessionWorking: (sessionId: string) => boolean;
}

/**
 * Combined provider value
 */
export interface TerminalProviderValue {
  context: TerminalContextValue;
  actions: TerminalPanelActions;
  activityActions: TerminalActivityActions;
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

  // Track terminal activity states (broadcast from main process across all windows)
  const [terminalActivities, setTerminalActivities] = useState<TerminalActivityState[]>([]);

  // Track terminal session subscriptions for cleanup
  const terminalSubscriptionsRef = useRef<Map<string, () => void>>(new Map());

  // Forward terminal exit events and update session list
  useEffect(() => {
    let unsubExit: (() => void) | null = null;
    const subscriptions = terminalSubscriptionsRef.current;

    TerminalService.onExit((terminalExit) => {
      // Remove this session from our list
      setTerminalSessions((prev) =>
        prev.filter((session) => session.id !== terminalExit.sessionId),
      );

      // Clean up subscription for this terminal
      const unsubscribe = subscriptions.get(terminalExit.sessionId);
      if (unsubscribe) {
        unsubscribe();
        subscriptions.delete(terminalExit.sessionId);
      }
    }).then((unsub) => {
      unsubExit = unsub;
    });

    return () => {
      if (unsubExit) {
        unsubExit();
      }
      // Clean up all terminal subscriptions
      subscriptions.forEach((unsub) => unsub());
      subscriptions.clear();
    };
  }, []);

  // Listen for terminal activity sync broadcasts from main process
  useEffect(() => {
    // Fetch initial activity state
    terminalClient
      .getActivityState()
      .then((activities) => {
        console.info(
          '[TerminalProvider] Loaded initial activity state:',
          activities.length,
          'active sessions',
        );
        setTerminalActivities(activities);
      })
      .catch((error) => {
        console.error(
          '[TerminalProvider] Failed to load initial activity state:',
          error,
        );
      });

    // Subscribe to activity sync broadcasts
    const unsubscribe = onActivitySync((activities) => {
      console.info(
        '[TerminalProvider] Activity sync received:',
        activities.length,
        'active sessions',
      );
      setTerminalActivities(activities);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Fetch terminal sessions on mount
  useEffect(() => {
    const loadTerminalSessions = async () => {
      try {
        const sessions = await TerminalService.list();
        console.info('[TerminalProvider] Loaded terminal sessions:', sessions.map(s => ({
          id: s.id,
          directory: s.directory,
          context: s.context,
        })));
        console.info('[TerminalProvider] Expected terminalContext:', terminalContext);
        setTerminalSessions(sessions);
      } catch (error) {
        console.error(
          '[TerminalProvider] Failed to load terminal sessions:',
          error,
        );
      }
    };

    loadTerminalSessions();

    // Listen for external session creation events
    const handleSessionCreated = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.info('[TerminalProvider] Detected new terminal session:', customEvent.detail);
      console.info('[TerminalProvider] Refreshing list...');
      loadTerminalSessions();
    };

    window.addEventListener('terminal-session-created', handleSessionCreated);

    return () => {
      window.removeEventListener('terminal-session-created', handleSessionCreated);
    };
  }, [terminalContext]);

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

      clearTerminal: (sessionId: string) => {
        // Send ANSI escape sequence to clear screen and reset cursor
        // \x1bc is the reset escape sequence (ESC c)
        TerminalService.write(sessionId, '\x1bc');
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
        console.info(
          `[TerminalActions] claimTerminalOwnership called: sessionId=${sessionId}, force=${force}`,
        );
        const result = await TerminalService.claimOwnership(sessionId, force);
        console.info(`[TerminalActions] claimTerminalOwnership result:`, result);
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
        console.info('[TerminalActions] onOwnershipLost: registering callback');
        const unsubscribe = TerminalService.onOwnershipLost((data) => {
          console.info(
            '[TerminalActions] onOwnershipLost: received event from TerminalService:',
            data,
          );
          callback(data);
        });
        return () => {
          console.info('[TerminalActions] onOwnershipLost: unsubscribing');
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

  // Activity tracking actions
  const updateActivity = useCallback(async (input: UpdateActivityInput) => {
    console.info('[TerminalProvider] Updating activity:', input);
    await terminalClient.updateActivity(input);
  }, []);

  const getActivityForSession = useCallback(
    (sessionId: string) => {
      return terminalActivities.find((a) => a.sessionId === sessionId);
    },
    [terminalActivities],
  );

  const isSessionWorking = useCallback(
    (sessionId: string) => {
      const activity = terminalActivities.find((a) => a.sessionId === sessionId);
      return activity?.isWorking ?? false;
    },
    [terminalActivities],
  );

  const activityActions: TerminalActivityActions = useMemo(
    () => ({
      updateActivity,
      getActivityForSession,
      isSessionWorking,
    }),
    [updateActivity, getActivityForSession, isSessionWorking],
  );

  // Create context value
  const context: TerminalContextValue = useMemo(
    () => ({
      terminalSessions,
      terminalContext,
      repositoryPath,
      terminalActivities,
    }),
    [terminalSessions, terminalContext, repositoryPath, terminalActivities],
  );

  // Provider value
  const value: TerminalProviderValue = useMemo(
    () => ({
      context,
      actions,
      activityActions,
    }),
    [context, actions, activityActions],
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

/**
 * Hook to access terminal activity tracking
 */
export const useTerminalActivity = (): {
  activities: TerminalActivityState[];
  actions: TerminalActivityActions;
} => {
  const { context, activityActions } = useTerminalProvider();
  return {
    activities: context.terminalActivities,
    actions: activityActions,
  };
};

// Re-export types for convenience
export type { TerminalActivityState, UpdateActivityInput };

export default TerminalContext;
