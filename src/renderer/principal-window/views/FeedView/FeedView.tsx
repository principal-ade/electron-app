/**
 * FeedView
 *
 * The default view showing cross-repository activity feed with
 * integrated search for local, GitHub, and starred repositories.
 */

import React, { useMemo, useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { PanelEventBus } from '@principal-ade/panel-framework-core';
import type {
  PanelContextValue,
  PanelActions,
  DataSlice,
  PanelEventEmitter,
} from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { GitHubRepository } from '../../../../shared/main-process-api-interfaces/GitHubAPI';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import { GithubService } from '../../../main-process-api/GithubService';
import { FileCityImageService } from '../../../main-process-api/FileCityImageService';
import { WindowService } from '../../../main-process-api/WindowService';
import { ActivityFeedPanel, type SearchResult } from '../../../panels/ActivityFeedPanel';

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
  const {
    context,
    actions,
    events,
    searchQuery,
    setSearchQuery,
    searchResults,
    searchLoading,
  } = useFeedPanelProvider();

  // Handle search result selection
  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      if (result.source === 'local' && result.entry) {
        // Open local repository in dev workspace
        actions.openLocalRepository?.(result.entry);
      }
      // For GitHub/starred, we could add clone functionality later
    },
    [actions],
  );

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
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchResults={searchResults}
        onSelectSearchResult={handleSelectResult}
        searchLoading={searchLoading}
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
