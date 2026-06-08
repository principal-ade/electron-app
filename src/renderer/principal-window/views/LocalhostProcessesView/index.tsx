import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { localhostProcessesPanels } from '../../../panels';
import { usePrincipalEvents } from '../../PrincipalEventContext';
import {
  LocalhostDetectionService,
  type RunningServer,
} from '../../../main-process-api/LocalhostDetectionService';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type {
  PanelContextValue,
  PanelActions,
  DataSlice,
} from '@principal-ade/panel-framework-core';

/**
 * A detected server enriched with the owner/repo metadata of the registered
 * Alexandria entry whose path contains the process working directory.
 */
type ResolvedServer = RunningServer & {
  ownerLogin?: string;
  ownerAvatarUrl?: string;
  repoName?: string;
};

/** Strip a single trailing slash so path comparisons are consistent. */
const normalizePath = (path: string): string =>
  path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;

/**
 * Find the registered Alexandria entry whose path best matches a process cwd.
 * Prefers an exact match, then the deepest ancestor path (handles dev servers
 * launched from a subdirectory of the repo, e.g. a monorepo package).
 */
const resolveEntryForCwd = (
  cwd: string | undefined,
  entries: AlexandriaEntry[],
): AlexandriaEntry | undefined => {
  if (!cwd) {
    return undefined;
  }
  const target = normalizePath(cwd);
  let best: AlexandriaEntry | undefined;
  for (const entry of entries) {
    const entryPath = normalizePath(entry.path);
    if (target === entryPath || target.startsWith(`${entryPath}/`)) {
      if (!best || entryPath.length > normalizePath(best.path).length) {
        best = entry;
      }
    }
  }
  return best;
};

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

  // Registered Alexandria repos, used to resolve a server's cwd to its owner.
  const [repoEntries, setRepoEntries] = useState<AlexandriaEntry[]>([]);

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

  // Load registered repos and keep them current as the registry changes, so
  // newly-registered repos resolve their owner without reopening the view.
  useEffect(() => {
    const loadRepos = () => {
      AlexandriaService.getRepositories()
        .then(setRepoEntries)
        .catch((err) => {
          console.error('[LocalhostProcessesView] Failed to load repos:', err);
        });
    };

    loadRepos();
    const unsubscribe = AlexandriaService.onRepositoryChange(loadRepos);
    return () => unsubscribe();
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

  // Enrich each detected server with its registered repo's owner/name.
  const resolvedServers = useMemo<ResolvedServer[]>(() => {
    return servers.map((server) => {
      const entry = resolveEntryForCwd(server.cwd, repoEntries);
      if (!entry) {
        return server;
      }
      const ownerLogin = entry.github?.owner;
      return {
        ...server,
        ownerLogin,
        ownerAvatarUrl: ownerLogin
          ? `https://github.com/${ownerLogin}.png?size=96`
          : undefined,
        repoName: entry.github?.name ?? entry.name,
      };
    });
  }, [servers, repoEntries]);

  // Create panel context with localhostServers slice
  const context: PanelContextValue = useMemo(() => {
    const localhostServersSlice: DataSlice<ResolvedServer[]> = {
      scope: 'workspace',
      name: 'localhostServers',
      data: resolvedServers,
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
  }, [resolvedServers, loading, error, fetchServers]);

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
