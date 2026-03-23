/**
 * FeedView
 *
 * The default view showing cross-repository activity feed.
 * Uses a simplified provider that only includes what the feed needs.
 */

import React, { useMemo, useState, useEffect, createContext, useContext } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { PanelEventBus } from '@principal-ade/panel-framework-core';
import type {
  PanelContextValue,
  PanelActions,
  DataSlice,
  PanelEventEmitter,
} from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import { FileCityImageService } from '../../../main-process-api/FileCityImageService';
import { WindowService } from '../../../main-process-api/WindowService';
import { ActivityFeedPanel } from '../../../panels/ActivityFeedPanel';

/**
 * Feed-specific actions
 */
interface FeedPanelActions extends PanelActions {
  getFileCityImage: (repoPath: string) => Promise<string | null>;
  selectRepository?: (entry: AlexandriaEntry) => Promise<void>;
  openLocalRepository?: (entry: AlexandriaEntry) => Promise<void>;
}

/**
 * Feed-specific context type
 */
interface FeedPanelContextType {
  alexandriaRepositories: DataSlice<{
    repositories: AlexandriaEntry[];
    loading: boolean;
  }>;
}

/**
 * Provider value
 */
interface FeedPanelProviderValue {
  context: PanelContextValue<FeedPanelContextType>;
  actions: FeedPanelActions;
  events: PanelEventEmitter;
}

const FeedPanelContext = createContext<FeedPanelProviderValue | null>(null);

const useFeedPanelProvider = (): FeedPanelProviderValue => {
  const value = useContext(FeedPanelContext);
  if (!value) {
    throw new Error('useFeedPanelProvider must be used within a FeedPanelProvider');
  }
  return value;
};

/**
 * Lightweight provider for the feed view
 */
const FeedPanelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const events = useMemo(() => new PanelEventBus(), []);

  // State for repositories
  const [repositories, setRepositories] = useState<AlexandriaEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch repositories on mount
  useEffect(() => {
    const fetchRepositories = async () => {
      setLoading(true);
      try {
        const repos = await AlexandriaService.getRepositories();
        // Sort by lastOpenedAt (most recent first)
        const sorted = repos.sort((a, b) => {
          if (a.lastOpenedAt && !b.lastOpenedAt) return -1;
          if (!a.lastOpenedAt && b.lastOpenedAt) return 1;
          const aTime = a.lastOpenedAt || a.registeredAt;
          const bTime = b.lastOpenedAt || b.registeredAt;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });
        setRepositories(sorted);
      } catch (error) {
        console.error('[FeedPanelProvider] Failed to fetch repositories:', error);
        setRepositories([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRepositories();

    // Listen for repository changes
    const unsubscribe = AlexandriaService.onRepositoryChange(() => {
      fetchRepositories();
    });

    return unsubscribe;
  }, []);

  // Create repositories slice
  const alexandriaRepositoriesSlice = useMemo<DataSlice<{
    repositories: AlexandriaEntry[];
    loading: boolean;
  }>>(
    () => ({
      scope: 'global' as const,
      name: 'alexandriaRepositories',
      data: {
        repositories,
        loading,
      },
      loading,
      error: null,
      refresh: async () => {
        setLoading(true);
        try {
          const repos = await AlexandriaService.getRepositories();
          setRepositories(repos);
        } catch (error) {
          console.error('[FeedPanelProvider] Failed to refresh repositories:', error);
        } finally {
          setLoading(false);
        }
      },
    }),
    [repositories, loading]
  );

  // Define actions
  const actions: FeedPanelActions = useMemo(
    () => ({
      openFile: () => {},
      openGitDiff: () => {},
      navigateToPanel: () => {},
      notifyPanels: (event) => events.emit(event),

      getFileCityImage: async (repoPath: string) => {
        return FileCityImageService.getImage(repoPath);
      },

      selectRepository: async (entry: AlexandriaEntry) => {
        // Emit event for navigation - will be handled by IntegratedShell
        events.emit({
          type: 'feed:repository-selected',
          source: 'feed-view',
          timestamp: Date.now(),
          payload: { repository: entry },
        });
      },

      openLocalRepository: async (entry: AlexandriaEntry) => {
        await WindowService.openDevWorkspace({
          alexandriaEntry: entry,
        });
        events.emit({
          type: 'repository:opened',
          source: 'feed-view',
          timestamp: Date.now(),
          payload: { repositoryId: entry.name, repository: entry },
        });
      },
    }),
    [events]
  );

  // Create context value
  const context = useMemo(
    () => ({
      currentScope: { type: 'workspace' as const },
      slices: new Map(),
      adapters: {},
      getSlice: () => undefined,
      getWorkspaceSlice: () => undefined,
      getRepositorySlice: () => undefined,
      hasSlice: () => false,
      isSliceLoading: () => false,
      refresh: async () => {},
      alexandriaRepositories: alexandriaRepositoriesSlice,
    }),
    [alexandriaRepositoriesSlice]
  );

  const value: FeedPanelProviderValue = useMemo(
    () => ({ context, actions, events }),
    [context, actions, events]
  );

  return (
    <FeedPanelContext.Provider value={value}>
      {children}
    </FeedPanelContext.Provider>
  );
};

/**
 * FeedViewContent - inner content that uses the provider
 */
const FeedViewContent: React.FC = () => {
  const { theme } = useTheme();
  const { context, actions, events } = useFeedPanelProvider();

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: theme.colors.background,
      }}
    >
      <ActivityFeedPanel
        context={context}
        actions={actions}
        events={events}
      />
    </div>
  );
};

/**
 * FeedView - the main exported component
 */
export const FeedView: React.FC = () => {
  return (
    <FeedPanelProvider>
      <FeedViewContent />
    </FeedPanelProvider>
  );
};
