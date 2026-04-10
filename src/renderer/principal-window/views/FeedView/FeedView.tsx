/**
 * FeedView
 *
 * The default view showing cross-repository activity feed with
 * integrated search for local, GitHub, and starred repositories.
 */

import React, { useMemo, useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { PanelEventBus } from '@principal-ade/panel-framework-core';
import { Users } from 'lucide-react';
import { usePrincipalEvents } from '../../PrincipalEventContext';
import type {
  PanelContextValue,
  PanelActions,
  DataSlice,
  PanelEventEmitter,
} from '@principal-ade/panel-framework-core';
import type { PanelLayout } from '@principal-ade/panel-layouts';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { GitHubRepository } from '../../../../shared/main-process-api-interfaces/GitHubAPI';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import { GithubService } from '../../../main-process-api/GithubService';
import { FileCityImageService } from '../../../main-process-api/FileCityImageService';
import { WindowService } from '../../../main-process-api/WindowService';
import { FeedPanelFramework } from '../../../feed-view/FeedPanelFramework';

// Keep SearchResult type for backwards compatibility
export type SearchResultSource = 'local' | 'github' | 'starred';

export interface SearchResult {
  id: string;
  name: string;
  fullName: string;
  description?: string | null;
  source: SearchResultSource;
  entry?: AlexandriaEntry;
  repository?: GitHubRepository;
}

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
  // Search-related state
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: SearchResult[];
  searchLoading: boolean;
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

  // State for local repositories
  const [repositories, setRepositories] = useState<AlexandriaEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // State for GitHub repositories
  const [userRepositories, setUserRepositories] = useState<GitHubRepository[]>([]);
  const [starredRepositories, setStarredRepositories] = useState<GitHubRepository[]>([]);
  const [githubLoading, setGithubLoading] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch local repositories on mount
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
        console.info('[FeedPanelProvider] Fetched repositories:', {
          count: sorted.length,
          repos: sorted.map(r => ({ name: r.name, path: r.path })),
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

  // Fetch GitHub repositories on mount (fail silently if not authenticated)
  useEffect(() => {
    const fetchGitHubData = async () => {
      setGithubLoading(true);
      try {
        const [userRepos, starred] = await Promise.all([
          GithubService.getUserRepositories({ perPage: 100, sort: 'updated', direction: 'desc' }),
          GithubService.getUserStarredRepositories({ perPage: 100, sort: 'updated', direction: 'desc' }),
        ]);
        setUserRepositories(userRepos);
        setStarredRepositories(starred);
      } catch {
        // User may not be authenticated - fail silently
      } finally {
        setGithubLoading(false);
      }
    };

    fetchGitHubData();
  }, []);

  // Compute search results
  const searchResults = useMemo((): SearchResult[] => {
    const trimmedQuery = searchQuery.trim().toLowerCase();
    if (!trimmedQuery) return [];

    const results: SearchResult[] = [];

    // Search local repositories
    repositories
      .filter((r) => r.name.toLowerCase().includes(trimmedQuery))
      .forEach((r) =>
        results.push({
          id: `local-${r.name}`,
          name: r.name,
          fullName: r.name,
          description: r.github?.description,
          source: 'local',
          entry: r,
        }),
      );

    // Search user's GitHub repositories
    userRepositories
      .filter((r) => r.name.toLowerCase().includes(trimmedQuery) || r.full_name.toLowerCase().includes(trimmedQuery))
      .forEach((r) =>
        results.push({
          id: `github-${r.id}`,
          name: r.name,
          fullName: r.full_name,
          description: r.description,
          source: 'github',
          repository: r,
        }),
      );

    // Search starred repositories
    starredRepositories
      .filter((r) => r.name.toLowerCase().includes(trimmedQuery) || r.full_name.toLowerCase().includes(trimmedQuery))
      .forEach((r) =>
        results.push({
          id: `starred-${r.id}`,
          name: r.name,
          fullName: r.full_name,
          description: r.description,
          source: 'starred',
          repository: r,
        }),
      );

    return results;
  }, [searchQuery, repositories, userRepositories, starredRepositories]);

  const searchLoading = loading || githubLoading;

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
    () => ({
      context,
      actions,
      events,
      searchQuery,
      setSearchQuery,
      searchResults,
      searchLoading,
    }),
    [context, actions, events, searchQuery, searchResults, searchLoading]
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
  const { events: principalEvents } = usePrincipalEvents();
  const {
    context,
    actions,
    events,
  } = useFeedPanelProvider();

  // Panel layout state
  const [layout, setLayout] = useState<PanelLayout>({
    left: 'heatmap',
    middle: 'terminal',
    right: 'activityFeed',
  });

  // Collapsed state
  const [collapsed, setCollapsed] = useState({ left: false, right: false });

  // Panel sizes
  const [panelSizes, setPanelSizes] = useState({ left: 25, middle: 50, right: 25 });

  // Get repositories from context
  const repositories = context.alexandriaRepositories?.data?.repositories ?? [];

  // Handle opening a repository
  const handleOpenRepository = useCallback(
    (entry: AlexandriaEntry) => {
      actions.openLocalRepository?.(entry);
    },
    [actions],
  );

  // Navigate to Activity Cities view
  const handleNavigateToActivityCities = useCallback(() => {
    principalEvents?.emit({
      type: 'panel:switch',
      source: 'feed-view',
      timestamp: Date.now(),
      payload: { view: 'activity-cities' },
    });
  }, [principalEvents]);

  // Theme spacing helpers
  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
  };

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
      {/* Header with Live Activity button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: `${spacing.xs}px ${spacing.sm}px`,
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.background,
          flexShrink: 0,
        }}
      >
        <button
          onClick={handleNavigateToActivityCities}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.xs,
            padding: `${spacing.xs}px ${spacing.sm}px`,
            backgroundColor: 'transparent',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radii?.[1] || 4,
            color: theme.colors.textSecondary,
            fontSize: theme.fontSizes[0],
            fontFamily: theme.fonts.monospace,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
            e.currentTarget.style.color = theme.colors.text;
            e.currentTarget.style.borderColor = theme.colors.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = theme.colors.textSecondary;
            e.currentTarget.style.borderColor = theme.colors.border;
          }}
        >
          <Users size={14} />
          <span>Live Activity</span>
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <FeedPanelFramework
          repositories={repositories}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          layout={layout}
          onLayoutChange={setLayout}
          panelSizes={panelSizes}
          onPanelSizesChange={setPanelSizes}
          events={events}
          onOpenRepository={handleOpenRepository}
        />
      </div>
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
