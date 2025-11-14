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
} from '@principal-ade/panel-framework-core';
import { TerminalService } from '../main-process-api/TerminalService';
import type { TerminalInfo } from '../../shared/main-process-api-interfaces/TerminalService';

// Extend PanelActions with terminal-specific actions
interface ExtendedPanelActions extends PanelActions {
  createTerminalSession?: (options?: { cwd?: string }) => Promise<string>;
  writeToTerminal?: (sessionId: string, data: string) => Promise<void>;
  resizeTerminal?: (
    sessionId: string,
    cols: number,
    rows: number
  ) => Promise<void>;
  destroyTerminalSession?: (sessionId: string) => Promise<void>;
}

const PanelContext = createContext<PanelContextValue | null>(null);

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
  theme,
}) => {
  // Initialize event bus
  const events = useMemo(() => new PanelEventBus(), []);

  // Track active terminal sessions
  const [terminalSessions, setTerminalSessions] = useState<TerminalInfo[]>([]);

  // Wire up terminal events to panel event bus
  useEffect(() => {
    let unsubData: (() => void) | null = null;
    let unsubExit: (() => void) | null = null;

    // Forward terminal data events to panel event bus
    TerminalService.onData((terminalData) => {
      console.info('[PanelContext] Terminal data received:', terminalData);
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

  // Define data slices
  const [slices] = useState<Map<string, DataSlice>>(
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
            data: null,
            loading: false,
            error: null,
            refresh: async () => {
              // TODO: Implement workspace data fetching
              console.info('[PanelContext] Refreshing workspace data...');
            },
          },
        ],
        [
          'repositories',
          {
            scope: 'workspace' as const,
            name: 'repositories',
            data: null,
            loading: false,
            error: null,
            refresh: async () => {
              // TODO: Implement repositories data fetching
              console.info('[PanelContext] Refreshing repositories data...');
            },
          },
        ],
      ])
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
        console.info('[PanelContext] Creating terminal session:', options);
        console.info('[PanelContext] Repository path:', repository?.path);
        console.info('[PanelContext] Workspace path:', workspace.path);
        const cwd = options?.cwd || repository?.path || workspace.path;
        console.info('[PanelContext] Resolved cwd:', cwd);
        const sessionId = await TerminalService.create(cwd, 'alexandria-workspace');
        console.info('[PanelContext] Terminal session created:', sessionId);

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
    }),
    [events, repository, workspace]
  );

  const contextValue: PanelContextValue = useMemo(
    () => ({
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
      actions,
      events,
      workspace,
      repository,
      repositoryPath: repository?.path,
      theme,
      terminalSessions,
    }),
    [workspace, repository, actions, events, slices, theme, terminalSessions]
  );

  return (
    <PanelContext.Provider value={contextValue}>
      {children}
    </PanelContext.Provider>
  );
};

export const usePanelProvider = (): PanelContextValue => {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error('usePanelProvider must be used within a PanelProvider');
  }
  return context;
};

export default PanelContext;
