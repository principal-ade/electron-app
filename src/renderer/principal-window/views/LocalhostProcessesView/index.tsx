import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { localhostProcessesPanels } from '../../../panels';
import { usePrincipalEvents } from '../../PrincipalEventContext';
import {
  LocalhostDetectionService,
  type RunningServer,
} from '../../../main-process-api/LocalhostDetectionService';
import type {
  PanelContextValue,
  PanelActions,
  DataSlice,
} from '@principal-ade/panel-framework-core';

/**
 * LocalhostProcessesView - Displays running localhost development servers
 *
 * This view wraps the LocalhostProcessesPanel to show running
 * development servers in the principal window.
 */
export const LocalhostProcessesView: React.FC = () => {
  const { theme } = useTheme();
  const { events } = usePrincipalEvents();

  // State for server data
  const [servers, setServers] = useState<RunningServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch servers function
  const fetchServers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await LocalhostDetectionService.detectRunningServers();
      setServers(result.servers);
    } catch (err) {
      console.error('[LocalhostProcessesView] Failed to detect servers:', err);
      setError(
        err instanceof Error ? err : new Error('Failed to detect servers'),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and start watching
  useEffect(() => {
    fetchServers();

    // Subscribe to server updates
    const unsubscribe = LocalhostDetectionService.onServersUpdated((result) => {
      setServers(result.servers);
      setLoading(false);
    });

    // Start watching for changes
    let watchId: string | null = null;
    LocalhostDetectionService.startWatching(undefined, 5000)
      .then(({ watchId: id }) => {
        watchId = id;
      })
      .catch((err) => {
        console.error('Failed to start watching:', err);
      });

    return () => {
      unsubscribe();
      if (watchId) {
        LocalhostDetectionService.stopWatching(watchId).catch((err) => {
          console.error('Failed to stop watching:', err);
        });
      }
    };
  }, [fetchServers]);

  // Get the LocalhostProcessesPanel component
  const LocalhostProcessesPanel = localhostProcessesPanels[0]?.component;

  // Create panel context with localhostServers slice
  const context: PanelContextValue = useMemo(() => {
    const localhostServersSlice: DataSlice<RunningServer[]> = {
      scope: 'workspace',
      name: 'localhostServers',
      data: servers,
      loading,
      error,
      refresh: fetchServers,
    };

    const slices = new Map<string, DataSlice>();
    slices.set('localhostServers', localhostServersSlice as DataSlice);

    return {
      currentScope: {
        type: 'workspace' as const,
        workspace: {
          name: 'Principal',
          path: '',
        },
      },
      slices,
      isSliceLoading: (name: string): boolean => {
        const slice = slices.get(name);
        return slice?.loading ?? false;
      },
      refresh: async (): Promise<void> => {
        await fetchServers();
      },
      // Typed slice property for direct access
      localhostServers: localhostServersSlice,
    };
  }, [servers, loading, error, fetchServers]);

  // Create minimal panel actions
  const actions: PanelActions = useMemo(
    () => ({
      openFile: (filePath: string) => {
        console.info('[LocalhostProcessesView] openFile:', filePath);
      },
      navigateToPanel: (panelId: string) => {
        console.info('[LocalhostProcessesView] navigateToPanel:', panelId);
      },
    }),
    [],
  );

  if (!LocalhostProcessesPanel) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
          color: theme.colors.textSecondary,
        }}
      >
        Localhost panel not available
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        backgroundColor: theme.colors.background,
        overflow: 'auto',
      }}
    >
      <LocalhostProcessesPanel
        context={context}
        actions={actions}
        events={events}
      />
    </div>
  );
};

export default LocalhostProcessesView;
