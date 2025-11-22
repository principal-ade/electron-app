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
} from '@principal-ade/panel-framework-core';
import { TerminalService } from '../main-process-api/TerminalService';
import type { TerminalInfo } from '../../shared/main-process-api-interfaces/TerminalService';

// Extend PanelActions with terminal-specific actions
interface RepositoryPanelActions extends PanelActions {
  createTerminalSession?: (options?: { cwd?: string }) => Promise<string>;
  writeToTerminal?: (sessionId: string, data: string) => Promise<void>;
  resizeTerminal?: (
    sessionId: string,
    cols: number,
    rows: number
  ) => Promise<void>;
  destroyTerminalSession?: (sessionId: string) => Promise<void>;
}

// Extended context for repository panels
interface RepositoryPanelContextValue extends PanelContextValue {
  repositoryPath: string;
  terminalSessions?: TerminalInfo[];
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
  terminalContext: string; // Required for terminal session identification
}

export const RepositoryPanelProvider: React.FC<RepositoryPanelProviderProps> = ({
  children,
  repositoryPath,
  terminalContext,
}) => {
  // Initialize event bus
  const events = useMemo(() => new PanelEventBus(), []);

  // Track active terminal sessions
  const [terminalSessions, setTerminalSessions] = useState<TerminalInfo[]>([]);

  // Track terminal session subscriptions for cleanup
  const terminalSubscriptionsRef = useRef<Map<string, () => void>>(new Map());

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

  // Create actions object
  const actions: RepositoryPanelActions = useMemo(
    () => ({
      notifyPanels: (event: PanelEvent) => {
        events.emit(event);
      },

      // Terminal actions
      createTerminalSession: async (options?: { cwd?: string }) => {
        const cwd = options?.cwd || repositoryPath;
        console.info('[RepositoryPanelProvider] createTerminalSession called with:', {
          optionsCwd: options?.cwd,
          repositoryPath,
          finalCwd: cwd,
          context: terminalContext,
        });
        const sessionId = await TerminalService.getOrCreate(cwd, terminalContext);

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
    }),
    [repositoryPath, terminalContext, events],
  );

  // Create context value
  const context: RepositoryPanelContextValue = useMemo(
    () => ({
      repositoryPath,
      terminalSessions,
      loading,
    }),
    [repositoryPath, terminalSessions, loading],
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
