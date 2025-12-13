import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { PanelEventBus } from '@principal-ade/panel-framework-core';
import type {
  PanelContextValue,
  PanelActions,
  DataSlice,
  PanelEventEmitter,
} from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type {
  GitHubStarredSlice,
  GitHubStarredPanelActions,
  GitHubProjectsSlice,
  GitHubProjectsPanelActions,
  GitHubRepository,
  GitHubOrganization,
} from '@industry-theme/alexandria-panels';
import { GithubService } from '../main-process-api/GithubService';
import { WindowService } from '../main-process-api/WindowService';
import { AlexandriaService } from '../main-process-api/AlexandriaService';

/**
 * Combined actions for GitHub panels
 */
interface GitHubPanelActions
  extends PanelActions,
    GitHubStarredPanelActions,
    GitHubProjectsPanelActions {}

/**
 * Provider value containing context, actions, and events
 */
interface GitHubPanelProviderValue {
  context: PanelContextValue;
  actions: GitHubPanelActions;
  events: PanelEventEmitter;
}

const GitHubPanelContext = createContext<GitHubPanelProviderValue | null>(null);

interface GitHubPanelProviderProps {
  children: ReactNode;
}

export const GitHubPanelProvider: React.FC<GitHubPanelProviderProps> = ({
  children,
}) => {
  // Initialize event bus
  const events = useMemo(() => new PanelEventBus(), []);

  // State for starred repositories
  const [starredRepositories, setStarredRepositories] = useState<
    GitHubRepository[]
  >([]);
  const [starredLoading, setStarredLoading] = useState(true);
  const [starredError, setStarredError] = useState<string | undefined>();

  // State for user repositories (projects)
  const [userRepositories, setUserRepositories] = useState<GitHubRepository[]>(
    [],
  );
  const [organizations, setOrganizations] = useState<GitHubOrganization[]>([]);
  const [orgRepositories, setOrgRepositories] = useState<
    Record<string, GitHubRepository[]>
  >({});
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | undefined>();
  const [currentUser, setCurrentUser] = useState<string>('');

  // State for local repositories (to match cloned repos)
  const [localRepositories, setLocalRepositories] = useState<AlexandriaEntry[]>(
    [],
  );
  const [localRepositoriesLoading, setLocalRepositoriesLoading] =
    useState(true);

  // Fetch starred repositories
  const fetchStarred = useCallback(async () => {
    setStarredLoading(true);
    setStarredError(undefined);
    try {
      const starred = await GithubService.getUserStarredRepositories({
        perPage: 100,
        sort: 'updated',
        direction: 'desc',
      });
      setStarredRepositories(starred);
    } catch (error) {
      console.error(
        '[GitHubPanelProvider] Failed to fetch starred repositories:',
        error,
      );
      setStarredError(
        error instanceof Error
          ? error.message
          : 'Failed to load starred repositories from GitHub.',
      );
    } finally {
      setStarredLoading(false);
    }
  }, []);

  // Fetch user repositories and organizations
  const fetchProjects = useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError(undefined);
    try {
      // Fetch current user
      const user = await GithubService.getCurrentUser();
      if (user) {
        setCurrentUser(user.login);
      }

      // Fetch user's repositories and organizations in parallel
      const [userRepos, orgs] = await Promise.all([
        GithubService.getUserRepositories({
          perPage: 100,
          sort: 'updated',
          direction: 'desc',
        }),
        GithubService.getUserOrganizations(),
      ]);

      setUserRepositories(userRepos);
      setOrganizations(orgs);

      // Fetch repositories for each organization
      const orgReposMap: Record<string, GitHubRepository[]> = {};
      await Promise.all(
        orgs.map(async (org) => {
          try {
            const repos = await GithubService.getOrgRepositories(org.login, {
              perPage: 100,
              sort: 'updated',
              direction: 'desc',
            });
            orgReposMap[org.login] = repos;
          } catch (error) {
            console.error(
              `[GitHubPanelProvider] Failed to fetch repos for org ${org.login}:`,
              error,
            );
            orgReposMap[org.login] = [];
          }
        }),
      );
      setOrgRepositories(orgReposMap);
    } catch (error) {
      console.error('[GitHubPanelProvider] Failed to fetch projects:', error);
      setProjectsError(
        error instanceof Error
          ? error.message
          : 'Failed to load repositories from GitHub.',
      );
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  // Fetch local repositories
  const fetchLocalRepositories = useCallback(async () => {
    setLocalRepositoriesLoading(true);
    try {
      const repos = await AlexandriaService.getRepositories();
      setLocalRepositories(repos);
    } catch (error) {
      console.error(
        '[GitHubPanelProvider] Failed to fetch local repositories:',
        error,
      );
      setLocalRepositories([]);
    } finally {
      setLocalRepositoriesLoading(false);
    }
  }, []);

  // Fetch all data on mount
  useEffect(() => {
    void fetchStarred();
    void fetchProjects();
    void fetchLocalRepositories();

    // Listen for repository changes
    const unsubscribe = AlexandriaService.onRepositoryChange(() => {
      void fetchLocalRepositories();
    });

    return unsubscribe;
  }, [fetchStarred, fetchProjects, fetchLocalRepositories]);

  // Define data slices
  const slices = useMemo<Map<string, DataSlice>>(
    () =>
      new Map([
        [
          'alexandriaRepositories',
          {
            scope: 'global' as const,
            name: 'alexandriaRepositories',
            data: {
              repositories: localRepositories,
              loading: localRepositoriesLoading,
            },
            loading: localRepositoriesLoading,
            error: null,
            refresh: fetchLocalRepositories,
          },
        ],
        [
          'githubStarred',
          {
            scope: 'global' as const,
            name: 'githubStarred',
            data: {
              repositories: starredRepositories,
              loading: starredLoading,
              error: starredError,
            } as GitHubStarredSlice,
            loading: starredLoading,
            error: starredError ?? null,
            refresh: fetchStarred,
          },
        ],
        [
          'githubProjects',
          {
            scope: 'global' as const,
            name: 'githubProjects',
            data: {
              userRepositories,
              organizations,
              orgRepositories,
              loading: projectsLoading,
              error: projectsError,
              currentUser,
            } as GitHubProjectsSlice,
            loading: projectsLoading,
            error: projectsError ?? null,
            refresh: fetchProjects,
          },
        ],
      ]),
    [
      localRepositories,
      localRepositoriesLoading,
      fetchLocalRepositories,
      starredRepositories,
      starredLoading,
      starredError,
      fetchStarred,
      userRepositories,
      organizations,
      orgRepositories,
      projectsLoading,
      projectsError,
      currentUser,
      fetchProjects,
    ],
  );

  // Handle clone repository
  const handleCloneRepository = useCallback(
    async (repo: GitHubRepository) => {
      console.info(
        '[GitHubPanelProvider] Clone requested for:',
        repo.full_name,
      );
      // TODO: Open clone modal or trigger clone flow
      // For now, emit an event that the host app can handle
      events.emit({
        type: 'github:clone-requested',
        source: 'github-panel-provider',
        timestamp: Date.now(),
        payload: { repository: repo },
      });
    },
    [events],
  );

  // Handle open repository
  const handleOpenRepository = useCallback(
    async (localPath: string) => {
      console.info('[GitHubPanelProvider] Opening repository at:', localPath);
      // Find the local repo entry
      const entry = localRepositories.find((r) => r.path === localPath);
      if (entry) {
        await WindowService.openDevWorkspace({
          alexandriaEntry: entry,
        });
      }
    },
    [localRepositories],
  );

  // Define actions
  const actions: GitHubPanelActions = useMemo(
    () => ({
      openFile: (filePath: string) => {
        console.info('[GitHubPanelProvider] Opening file:', filePath);
        events.emit({
          type: 'file:opened',
          source: 'github-panel-provider',
          timestamp: Date.now(),
          payload: { filePath },
        });
      },

      navigateToPanel: (panelId: string) => {
        console.info('[GitHubPanelProvider] Navigating to panel:', panelId);
        events.emit({
          type: 'panel:focus',
          source: 'github-panel-provider',
          timestamp: Date.now(),
          payload: { panelId },
        });
      },

      // GitHubStarredPanel actions
      cloneRepository: handleCloneRepository,
      openRepository: handleOpenRepository,
      refreshStarred: fetchStarred,

      // GitHubProjectsPanel actions
      refreshProjects: fetchProjects,
    }),
    [
      events,
      handleCloneRepository,
      handleOpenRepository,
      fetchStarred,
      fetchProjects,
    ],
  );

  // Create context value
  const context: PanelContextValue = useMemo(
    () => ({
      currentScope: {
        type: 'global' as const,
        workspace: undefined,
        repository: undefined,
      },
      slices,
      adapters: {},
      getSlice: <T = unknown,>(name: string): DataSlice<T> | undefined => {
        return slices.get(name) as DataSlice<T> | undefined;
      },
      getWorkspaceSlice: <T = unknown,>(
        _name: string,
      ): DataSlice<T> | undefined => {
        return undefined; // No workspace scope in this context
      },
      getRepositorySlice: <T = unknown,>(
        _name: string,
      ): DataSlice<T> | undefined => {
        return undefined; // No repository scope in this context
      },
      hasSlice: (name: string, scope?: 'workspace' | 'repository'): boolean => {
        const slice = slices.get(name);
        if (!slice) return false;
        return scope ? slice.scope === scope : true;
      },
      isSliceLoading: (
        name: string,
        scope?: 'workspace' | 'repository',
      ): boolean => {
        const slice = slices.get(name);
        if (!slice) return false;
        if (scope && slice.scope !== scope) return false;
        return slice.loading;
      },
      refresh: async (
        scope?: 'workspace' | 'repository',
        sliceName?: string,
      ): Promise<void> => {
        const slicesToRefresh = Array.from(slices.values()).filter((slice) => {
          if (scope && slice.scope !== scope) return false;
          if (sliceName && slice.name !== sliceName) return false;
          return true;
        });

        await Promise.all(slicesToRefresh.map((slice) => slice.refresh()));
      },
    }),
    [slices],
  );

  // Combine into provider value
  const value: GitHubPanelProviderValue = useMemo(
    () => ({
      context,
      actions,
      events,
    }),
    [context, actions, events],
  );

  return (
    <GitHubPanelContext.Provider value={value}>
      {children}
    </GitHubPanelContext.Provider>
  );
};

export const useGitHubPanelProvider = (): GitHubPanelProviderValue => {
  const value = useContext(GitHubPanelContext);
  if (!value) {
    throw new Error(
      'useGitHubPanelProvider must be used within a GitHubPanelProvider',
    );
  }
  return value;
};

export default GitHubPanelContext;
