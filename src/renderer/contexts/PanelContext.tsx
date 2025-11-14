import React, {
  createContext,
  useContext,
  useMemo,
  useState,
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
  const actions: PanelActions = useMemo(
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
    }),
    [events]
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
      theme,
    }),
    [workspace, repository, actions, events, slices, theme]
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
