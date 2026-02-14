import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import type { Theme } from '@principal-ade/industry-theme';
import { PanelEventBus } from '@principal-ade/panel-framework-core';
import type {
  PanelContextValue,
  PanelActions,
  DataSlice,
  PanelEvent,
  PanelEventEmitter,
} from '@principal-ade/panel-framework-core';
import type {
  Workspace,
  AlexandriaEntry,
} from '@principal-ai/alexandria-core-library/types';
import type { GitStatusWithFiles } from '@principal-ai/repository-abstraction';
import type {
  WorkspacesSlice,
  WorkspacesListPanelActions,
  GitHubStarredSlice,
  GitHubStarredPanelActions,
  GitHubProjectsSlice,
  GitHubProjectsPanelActions,
  GitHubRepository,
  GitHubOrganization,
  UserCollectionsSlice,
  UserCollectionsPanelActions,
  Collection,
} from '@industry-theme/alexandria-panels';
import { WorkspaceService } from '../main-process-api/WorkspaceService';
import { WindowService } from '../main-process-api/WindowService';
import { AlexandriaService } from '../main-process-api/AlexandriaService';
import { FileSystemService } from '../main-process-api/FileSystemService';
import { GithubService } from '../main-process-api/GithubService';
import { GitHubArtifactService } from '../main-process-api/GitHubArtifactService';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { CollectionsService } from '../main-process-api/CollectionsService';
import { GitService } from '../main-process-api/GitService';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import type { CollectionMembership } from '@principal-ai/alexandria-collections';
import type { DiscoveredRepository } from '@industry-theme/alexandria-panels';

/**
 * Extended actions for ProjectsPanelProvider
 * Combines workspace list actions with repository actions and GitHub actions
 * Note: UserCollectionsPanelActions.removeRepository conflicts with LocalProjectsPanel.removeRepository
 * so we omit it and provide collection-specific actions manually
 */
interface ProjectsPanelActions
  extends
    PanelActions,
    WorkspacesListPanelActions,
    GitHubStarredPanelActions,
    GitHubProjectsPanelActions,
    Omit<UserCollectionsPanelActions, 'removeRepository'> {
  removeRepositoryFromWorkspace?: (
    repositoryId: string,
    workspaceId: string,
  ) => Promise<void>;
  copyToClipboard?: (text: string) => Promise<void>;
  isRepositoryInWorkspaceDirectory?: (
    repository: AlexandriaEntry,
    workspaceId: string,
  ) => Promise<boolean | null>;
  moveRepositoryToWorkspaceDirectory?: (
    repository: AlexandriaEntry,
    workspaceId: string,
  ) => Promise<string>;
  // Collections-specific removeRepository (named differently to avoid conflict)
  removeCollectionRepository?: (
    collectionId: string,
    repositoryId: string,
  ) => Promise<void>;
  // Add a repository to a collection (for drag-drop integration)
  addRepositoryToCollection?: (
    collectionId: string,
    repositoryPath: string,
    repositoryMetadata: any,
  ) => Promise<void>;
  // Track a discovered repository (add to Alexandria)
  trackRepository?: (name: string, path: string) => Promise<void>;
  // Select a repository without opening a new window (for ProjectInfoPanel)
  selectRepository?: (entryOrPath: AlexandriaEntry | string) => Promise<void>;
}

/**
 * Extended context interface for workspaces panels
 */
interface ProjectsPanelContextValue extends PanelContextValue {
  // Selected workspace (for coordination between panels)
  selectedWorkspace: Workspace | null;
  setSelectedWorkspace: (workspace: Workspace | null) => void;
  // Selected collection (for coordination between panels)
  selectedCollection: Collection | null;
  setSelectedCollection: (collection: Collection | null) => void;
}

/**
 * Provider value containing context, actions, and events
 */
interface ProjectsPanelProviderValue {
  context: ProjectsPanelContextValue;
  actions: ProjectsPanelActions;
  events: PanelEventEmitter;
}

const ProjectsPanelContext =
  createContext<ProjectsPanelProviderValue | null>(null);

interface ProjectsPanelProviderProps {
  children: ReactNode;
  theme?: Theme;
}

export const ProjectsPanelProvider: React.FC<
  ProjectsPanelProviderProps
> = ({ children, theme: _theme }) => {
  // Initialize event bus
  const events = useMemo(() => new PanelEventBus(), []);

  // State for workspaces
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [defaultWorkspaceId, setDefaultWorkspaceId] = useState<string | null>(
    null,
  );

  // State for selected workspace
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(
    null,
  );

  // State for selected collection
  const [selectedCollection, setSelectedCollection] =
    useState<Collection | null>(null);

  // State for selected repository (for ProjectInfoPanel)
  const [selectedRepository, setSelectedRepository] =
    useState<AlexandriaEntry | null>(null);

  // State for git status of selected repository
  const [gitStatusWithFiles, setGitStatusWithFiles] = useState<GitStatusWithFiles | null>(null);
  const [gitStatusLoading, setGitStatusLoading] = useState(false);

  // State for workspace repositories
  const [workspaceRepositories, setWorkspaceRepositories] = useState<
    AlexandriaEntry[]
  >([]);
  const [repositoriesLoading, setRepositoriesLoading] = useState(false);

  // State for all local repositories (for LocalProjectsPanel)
  const [localRepositories, setLocalRepositories] = useState<AlexandriaEntry[]>(
    [],
  );
  const [localRepositoriesLoading, setLocalRepositoriesLoading] =
    useState(true);

  // State for discovered (untracked) repositories
  const [discoveredRepositories, setDiscoveredRepositories] = useState<
    DiscoveredRepository[]
  >([]);
  const [baseDefaultDirectory, setBaseDefaultDirectory] = useState<
    string | null
  >(null);

  // State for GitHub starred repositories
  const [starredRepositories, setStarredRepositories] = useState<
    GitHubRepository[]
  >([]);
  const [starredLoading, setStarredLoading] = useState(false);
  const [starredError, setStarredError] = useState<string | undefined>();

  // State for quality metrics (keyed by repository path)
  const [qualityDataByRepo, setQualityDataByRepo] = useState<
    Record<
      string,
      {
        packages: Array<{
          name: string;
          version?: string;
          metrics: Record<string, number>;
        }>;
        lastUpdated: string;
      }
    >
  >({});
  const [qualityLoading, setQualityLoading] = useState(false);

  // State for GitHub projects (user repos + org repos)
  const [userRepositories, setUserRepositories] = useState<GitHubRepository[]>(
    [],
  );
  const [organizations, setOrganizations] = useState<GitHubOrganization[]>([]);
  const [orgRepositories, setOrgRepositories] = useState<
    Record<string, GitHubRepository[]>
  >({});
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | undefined>();
  const [currentUser, setCurrentUser] = useState<string>('');

  // State for user collections
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionMemberships, setCollectionMemberships] = useState<
    CollectionMembership[]
  >([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [collectionsSaving, setCollectionsSaving] = useState(false);
  const [collectionsError, setCollectionsError] = useState<string | undefined>();
  const [collectionsGitHubRepoExists, setCollectionsGitHubRepoExists] =
    useState<boolean | undefined>();
  const [collectionsGitHubRepoUrl, setCollectionsGitHubRepoUrl] = useState<
    string | null | undefined
  >();

  // Fetch workspaces on mount
  useEffect(() => {
    const fetchWorkspaces = async () => {
      setWorkspacesLoading(true);
      try {
        const [allWorkspaces, defaultWs] = await Promise.all([
          WorkspaceService.getWorkspaces(),
          WorkspaceService.getDefaultWorkspace(),
        ]);
        setWorkspaces(allWorkspaces);
        setDefaultWorkspaceId(defaultWs?.id ?? null);

        // Auto-select default workspace if none selected
        if (!selectedWorkspace && defaultWs) {
          setSelectedWorkspace(defaultWs);
        }
      } catch (error) {
        console.error(
          '[ProjectsPanelProvider] Failed to fetch workspaces:',
          error,
        );
      } finally {
        setWorkspacesLoading(false);
      }
    };

    fetchWorkspaces();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch git status when selected repository changes
  useEffect(() => {
    const fetchGitStatus = async () => {
      if (!selectedRepository) {
        setGitStatusWithFiles(null);
        return;
      }

      setGitStatusLoading(true);
      try {
        const status = await RepositoryMonitoringService.getGitStatusWithFiles(
          selectedRepository.path,
        );
        setGitStatusWithFiles(status);
      } catch (error) {
        console.error(
          '[ProjectsPanelProvider] Failed to fetch git status:',
          error,
        );
        setGitStatusWithFiles(null);
      } finally {
        setGitStatusLoading(false);
      }
    };

    void fetchGitStatus();
  }, [selectedRepository]);

  // Fetch repositories when selected workspace changes
  useEffect(() => {
    const fetchRepositories = async () => {
      if (!selectedWorkspace) {
        setWorkspaceRepositories([]);
        return;
      }

      setRepositoriesLoading(true);
      try {
        const repos = await WorkspaceService.getRepositoriesInWorkspace(
          selectedWorkspace.id,
        );
        setWorkspaceRepositories(repos);
      } catch (error) {
        console.error(
          '[ProjectsPanelProvider] Failed to fetch workspace repositories:',
          error,
        );
        setWorkspaceRepositories([]);
      } finally {
        setRepositoriesLoading(false);
      }
    };

    fetchRepositories();
  }, [selectedWorkspace]);

  // Fetch all local repositories on mount
  useEffect(() => {
    const fetchLocalRepositories = async () => {
      setLocalRepositoriesLoading(true);
      try {
        const repos = await AlexandriaService.getRepositories();

        // Sort by lastOpenedAt (most recent first)
        const sorted = repos.sort((a, b) => {
          // Projects with lastOpenedAt come before those without
          if (a.lastOpenedAt && !b.lastOpenedAt) return -1;
          if (!a.lastOpenedAt && b.lastOpenedAt) return 1;

          // If both have lastOpenedAt or both don't, sort by timestamp
          const aTime = a.lastOpenedAt || a.registeredAt;
          const bTime = b.lastOpenedAt || b.registeredAt;

          // Sort by timestamp (most recent first)
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });

        setLocalRepositories(sorted);
      } catch (error) {
        console.error(
          '[ProjectsPanelProvider] Failed to fetch local repositories:',
          error,
        );
        setLocalRepositories([]);
      } finally {
        setLocalRepositoriesLoading(false);
      }
    };

    fetchLocalRepositories();

    // Listen for repository changes
    const unsubscribe = AlexandriaService.onRepositoryChange(() => {
      fetchLocalRepositories();
    });

    return unsubscribe;
  }, []);

  // Fetch discovered repositories when baseDefaultDirectory changes
  useEffect(() => {
    const fetchDiscoveredRepositories = async () => {
      // First get the baseDefaultDirectory from preferences
      const preferences = await UserPreferencesService.getPreferences();
      const basePath = preferences.baseDefaultDirectory;
      setBaseDefaultDirectory(basePath || null);

      if (!basePath) {
        setDiscoveredRepositories([]);
        return;
      }

      try {
        console.info(
          '[ProjectsPanelProvider] Scanning for discovered repositories in:',
          basePath,
        );
        const discovered = await GitService.getDiscoveredRepos(basePath, 2);
        console.info(
          '[ProjectsPanelProvider] Found discovered repositories:',
          discovered.length,
        );
        setDiscoveredRepositories(discovered);
      } catch (error) {
        console.error(
          '[ProjectsPanelProvider] Failed to fetch discovered repositories:',
          error,
        );
        setDiscoveredRepositories([]);
      }
    };

    fetchDiscoveredRepositories();

    // Also refetch when local repositories change (a repo may have been tracked)
    // Listen for preference changes to update when baseDefaultDirectory changes
    const unsubscribe = UserPreferencesService.onPreferencesUpdated(
      (preferences) => {
        const newBasePath = preferences.baseDefaultDirectory;
        if (newBasePath !== baseDefaultDirectory) {
          setBaseDefaultDirectory(newBasePath || null);
          if (newBasePath) {
            GitService.getDiscoveredRepos(newBasePath, 2)
              .then(setDiscoveredRepositories)
              .catch((error) => {
                console.error(
                  '[ProjectsPanelProvider] Failed to refresh discovered repos:',
                  error,
                );
              });
          } else {
            setDiscoveredRepositories([]);
          }
        }
      },
    );

    return unsubscribe;
  }, [localRepositories, baseDefaultDirectory]); // Re-run when local repos change to update discovered list

  // Fetch GitHub starred repositories
  const fetchStarredRepositories = async () => {
    setStarredLoading(true);
    setStarredError(undefined);
    try {
      const starred = await GithubService.getUserStarredRepositories({
        perPage: 100,
        sort: 'updated',
        direction: 'desc',
      });
      // Cast to panels package type (structurally compatible)
      setStarredRepositories(starred as unknown as GitHubRepository[]);
    } catch (error) {
      console.error(
        '[ProjectsPanelProvider] Failed to fetch starred repositories:',
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
  };

  // Fetch GitHub projects (user repos + org repos)
  const fetchGitHubProjects = async () => {
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

      // Filter to only include repos owned by the current user (not org repos)
      // GitHub's /user/repos returns all repos the user can access, including org repos
      const personalRepos = user
        ? userRepos.filter((repo) => repo.owner?.login === user.login)
        : userRepos;

      // Cast to panels package types (structurally compatible)
      setUserRepositories(personalRepos as unknown as GitHubRepository[]);
      setOrganizations(orgs as unknown as GitHubOrganization[]);

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
            // Cast to panels package type (structurally compatible)
            orgReposMap[org.login] = repos as unknown as GitHubRepository[];
          } catch (error) {
            console.error(
              `[ProjectsPanelProvider] Failed to fetch repos for org ${org.login}:`,
              error,
            );
            orgReposMap[org.login] = [];
          }
        }),
      );
      setOrgRepositories(orgReposMap);
    } catch (error) {
      console.error(
        '[ProjectsPanelProvider] Failed to fetch GitHub projects:',
        error,
      );
      setProjectsError(
        error instanceof Error
          ? error.message
          : 'Failed to load repositories from GitHub.',
      );
    } finally {
      setProjectsLoading(false);
    }
  };

  // Fetch user collections
  const fetchCollections = async () => {
    setCollectionsLoading(true);
    setCollectionsError(undefined);
    try {
      // Check if GitHub repo exists first
      const repoStatusResult = await CollectionsService.checkGitHubRepo();
      if (repoStatusResult.success && repoStatusResult.data) {
        setCollectionsGitHubRepoExists(repoStatusResult.data.exists);
        setCollectionsGitHubRepoUrl(repoStatusResult.data.repoUrl);
      }

      // Load collections
      const collectionsResult = await CollectionsService.getCollections();
      if (collectionsResult.success && collectionsResult.data) {
        setCollections(collectionsResult.data.collections as Collection[]);
        setCollectionMemberships(collectionsResult.data.memberships);
      } else {
        // No collections yet - start empty
        setCollections([]);
        setCollectionMemberships([]);
      }
    } catch (error) {
      console.error(
        '[ProjectsPanelProvider] Failed to fetch collections:',
        error,
      );
      setCollectionsError(
        error instanceof Error
          ? error.message
          : 'Failed to load collections.',
      );
    } finally {
      setCollectionsLoading(false);
    }
  };

  // Fetch GitHub data on mount (these will silently fail if not authenticated)
  useEffect(() => {
    void fetchStarredRepositories();
    void fetchGitHubProjects();
    void fetchCollections();
  }, []);

  // Helper to extract owner/repo from git remote URL
  const parseGitHubRemote = (
    remoteUrl: string,
  ): { owner: string; repo: string } | null => {
    // Handle SSH format: git@github.com:owner/repo.git
    const sshMatch = remoteUrl.match(/git@github\.com:([^/]+)\/([^.]+)/);
    if (sshMatch) {
      return { owner: sshMatch[1], repo: sshMatch[2] };
    }
    // Handle HTTPS format: https://github.com/owner/repo.git
    const httpsMatch = remoteUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
    if (httpsMatch) {
      return { owner: httpsMatch[1], repo: httpsMatch[2] };
    }
    return null;
  };

  // Clear quality data when workspace changes
  useEffect(() => {
    setQualityDataByRepo({});
  }, [selectedWorkspace?.id]);

  // Fetch quality metrics for all repositories in the selected workspace
  useEffect(() => {
    // Track if this effect is still current (for race condition handling)
    let isCurrent = true;

    const fetchQualityForWorkspaceRepos = async () => {
      if (!selectedWorkspace || workspaceRepositories.length === 0) {
        return;
      }

      setQualityLoading(true);
      const newQualityData: typeof qualityDataByRepo = {};

      // Fetch quality for each repository in parallel
      await Promise.all(
        workspaceRepositories.map(async (repo) => {
          try {
            if (!repo.path) return;

            // Get git remote info
            const remoteInfo =
              await RepositoryMonitoringService.getGitRemoteInfo(repo.path);
            if (!remoteInfo?.remoteUrl) return;

            const githubInfo = parseGitHubRemote(remoteInfo.remoteUrl);
            if (!githubInfo) return;

            // Get current branch
            const gitStatus = await RepositoryMonitoringService.getGitStatus(
              repo.path,
            );
            const branch = gitStatus?.branch || 'main';

            // Fetch quality metrics
            const artifactData =
              await GitHubArtifactService.getLatestQualityMetrics(
                githubInfo.owner,
                githubInfo.repo,
                branch,
              );

            if (artifactData) {
              const packages = artifactData.qualityMetrics.packages.map(
                (pkg) => ({
                  name: pkg.name,
                  metrics: pkg.hexagon as unknown as Record<string, number>,
                }),
              );

              newQualityData[repo.path] = {
                packages,
                lastUpdated: artifactData.timestamp,
              };

              console.info(
                `[ProjectsPanelProvider] Quality loaded for ${repo.name}`,
              );
            }
          } catch (error) {
            console.error(
              `[ProjectsPanelProvider] Failed to fetch quality for ${repo.name}:`,
              error,
            );
          }
        }),
      );

      // Only update state if this effect is still current
      if (isCurrent) {
        setQualityDataByRepo(newQualityData);
        setQualityLoading(false);
      }
    };

    fetchQualityForWorkspaceRepos();

    // Cleanup: mark this effect as stale if a new one starts
    return () => {
      isCurrent = false;
    };
    // Using selectedWorkspace?.id instead of selectedWorkspace to avoid re-runs on object reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkspace?.id, workspaceRepositories]);

  // Listen for workspace changes from other parts of the app
  useEffect(() => {
    const unsubscribe = WorkspaceService.onWorkspaceChange((event) => {
      console.info('[ProjectsPanelProvider] Workspace change event:', event);

      if (
        event.type === 'added' ||
        event.type === 'updated' ||
        event.type === 'deleted'
      ) {
        // Refetch all workspaces
        WorkspaceService.getWorkspaces()
          .then(setWorkspaces)
          .catch(console.error);
      }

      if (
        event.type === 'membership-changed' &&
        event.workspaceId &&
        event.workspaceId === selectedWorkspace?.id
      ) {
        // Refetch repositories for current workspace
        WorkspaceService.getRepositoriesInWorkspace(event.workspaceId)
          .then(setWorkspaceRepositories)
          .catch(console.error);
      }
    });

    return unsubscribe;
  }, [selectedWorkspace?.id]);

  // Listen for workspace:selected events from panels
  useEffect(() => {
    const unsubscribe = events.on(
      'industry-theme.workspaces-list:workspace:selected',
      (event) => {
        const { workspace } = event.payload as {
          workspaceId: string;
          workspace: Workspace;
        };
        console.info(
          '[ProjectsPanelProvider] Workspace selected event:',
          workspace,
        );
        setSelectedWorkspace(workspace);
        // Clear collection selection when workspace is selected
        setSelectedCollection(null);
      },
    );

    return unsubscribe;
  }, [events]);

  // Listen for collection:selected events from UserCollectionsPanel
  useEffect(() => {
    const unsubscribe = events.on(
      'industry-theme.user-collections:collection:selected',
      (event) => {
        const { collection } = event.payload as {
          collectionId: string;
          collection: Collection;
        };
        console.info(
          '[ProjectsPanelProvider] Collection selected event:',
          collection,
        );
        setSelectedCollection(collection);
        // Clear workspace selection when collection is selected
        setSelectedWorkspace(null);
      },
    );

    return unsubscribe;
  }, [events]);

  // Listen for workspace:opened events to open in new window
  useEffect(() => {
    const unsubscribe = events.on(
      'industry-theme.workspaces-list:workspace:opened',
      (event) => {
        const { workspace } = event.payload as {
          workspaceId: string;
          workspace: Workspace;
        };
        console.info(
          '[ProjectsPanelProvider] Workspace opened event:',
          workspace,
        );

        // Open workspace in Alexandria workspace window
        WindowService.openAlexandriaWorkspace({ workspaceId: workspace.id }).catch(
          console.error,
        );
      },
    );

    return unsubscribe;
  }, [events]);

  // Listen for repository:selected events from LocalProjectsPanel to select repository for ProjectInfoPanel
  useEffect(() => {
    const unsubscribe = events.on<{ entry: AlexandriaEntry }>(
      'industry-theme.local-projects:repository-selected',
      (event) => {
        const entry = event.payload?.entry;
        if (entry) {
          console.info('[ProjectsPanelProvider] Repository selected:', entry.name);
          setSelectedRepository(entry);
        } else {
          console.info('[ProjectsPanelProvider] Repository deselected');
          setSelectedRepository(null);
        }
      },
    );

    return unsubscribe;
  }, [events]);

  // Listen for repository:opened events to open dev workspace
  useEffect(() => {
    const unsubscribe = events.on('repository:opened', (event) => {
      const { repository } = event.payload as {
        repositoryId: string;
        repository: AlexandriaEntry;
      };
      console.info(
        '[ProjectsPanelProvider] Repository opened event:',
        repository,
      );

      if (repository) {
        WindowService.openDevWorkspace({
          alexandriaEntry: repository,
        }).catch(console.error);
      }
    });

    return unsubscribe;
  }, [events]);

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
              discoveredRepositories,
              loading: localRepositoriesLoading,
            },
            loading: localRepositoriesLoading,
            error: null,
            refresh: async () => {
              setLocalRepositoriesLoading(true);
              try {
                const repos = await AlexandriaService.getRepositories();
                setLocalRepositories(repos);

                // Also refresh discovered repositories
                if (baseDefaultDirectory) {
                  const discovered = await GitService.getDiscoveredRepos(
                    baseDefaultDirectory,
                    2,
                  );
                  setDiscoveredRepositories(discovered);
                }
              } catch (error) {
                console.error(
                  '[ProjectsPanelProvider] Failed to refresh local repositories:',
                  error,
                );
              } finally {
                setLocalRepositoriesLoading(false);
              }
            },
          },
        ],
        [
          'workspaces',
          {
            scope: 'global' as const,
            name: 'workspaces',
            data: {
              workspaces,
              defaultWorkspaceId,
              loading: workspacesLoading,
            } as WorkspacesSlice,
            loading: workspacesLoading,
            error: null,
            refresh: async () => {
              setWorkspacesLoading(true);
              try {
                const [allWorkspaces, defaultWs] = await Promise.all([
                  WorkspaceService.getWorkspaces(),
                  WorkspaceService.getDefaultWorkspace(),
                ]);
                setWorkspaces(allWorkspaces);
                setDefaultWorkspaceId(defaultWs?.id ?? null);
              } catch (error) {
                console.error(
                  '[ProjectsPanelProvider] Failed to refresh workspaces:',
                  error,
                );
              } finally {
                setWorkspacesLoading(false);
              }
            },
          },
        ],
        [
          'workspace',
          {
            scope: 'workspace' as const,
            name: 'workspace',
            data: selectedWorkspace,
            loading: false,
            error: null,
            refresh: async () => {
              // No-op, workspace is selected by user
            },
          },
        ],
        [
          'workspaceRepositories',
          {
            scope: 'workspace' as const,
            name: 'workspaceRepositories',
            data: workspaceRepositories,
            loading: repositoriesLoading,
            error: null,
            refresh: async () => {
              if (selectedWorkspace) {
                setRepositoriesLoading(true);
                try {
                  const repos =
                    await WorkspaceService.getRepositoriesInWorkspace(
                      selectedWorkspace.id,
                    );
                  setWorkspaceRepositories(repos);
                } catch (error) {
                  console.error(
                    '[ProjectsPanelProvider] Failed to refresh repositories:',
                    error,
                  );
                } finally {
                  setRepositoriesLoading(false);
                }
              }
            },
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
            error: (starredError ?? null) as string | null,
            refresh: fetchStarredRepositories,
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
            error: (projectsError ?? null) as string | null,
            refresh: fetchGitHubProjects,
          },
        ],
        [
          'repositoriesQuality',
          {
            scope: 'workspace' as const,
            name: 'repositoriesQuality',
            // Format data for RepositoryQualityGridPanel
            // Expects: { repositories: RepositoryQualityItem[] }
            data: {
              repositories: Object.entries(qualityDataByRepo).map(
                ([repoPath, repoData]) => ({
                  id: repoPath,
                  name: repoPath.split('/').pop() || repoPath,
                  path: repoPath,
                  packages: repoData.packages.map((pkg) => ({
                    name: pkg.name,
                    version: pkg.version,
                    metrics: pkg.metrics,
                  })),
                }),
              ),
            },
            loading: qualityLoading,
            error: null,
            refresh: async () => {
              if (!selectedWorkspace || workspaceRepositories.length === 0) {
                return;
              }

              setQualityLoading(true);
              const newQualityData: typeof qualityDataByRepo = {};

              await Promise.all(
                workspaceRepositories.map(async (repo) => {
                  try {
                    if (!repo.path) return;

                    const remoteInfo =
                      await RepositoryMonitoringService.getGitRemoteInfo(
                        repo.path,
                      );
                    if (!remoteInfo?.remoteUrl) return;

                    const githubInfo = parseGitHubRemote(remoteInfo.remoteUrl);
                    if (!githubInfo) return;

                    const gitStatus =
                      await RepositoryMonitoringService.getGitStatus(repo.path);
                    const branch = gitStatus?.branch || 'main';

                    // Clear cache and fetch fresh
                    await GitHubArtifactService.clearCache();
                    const artifactData =
                      await GitHubArtifactService.getLatestQualityMetrics(
                        githubInfo.owner,
                        githubInfo.repo,
                        branch,
                      );

                    if (artifactData) {
                      const packages = artifactData.qualityMetrics.packages.map(
                        (pkg) => ({
                          name: pkg.name,
                          metrics: pkg.hexagon as unknown as Record<
                            string,
                            number
                          >,
                        }),
                      );
                      newQualityData[repo.path] = {
                        packages,
                        lastUpdated: artifactData.timestamp,
                      };
                    }
                  } catch (error) {
                    console.error(
                      `[ProjectsPanelProvider] Failed to refresh quality for ${repo.name}:`,
                      error,
                    );
                  }
                }),
              );

              setQualityDataByRepo(newQualityData);
              setQualityLoading(false);
            },
          },
        ],
        [
          'userCollections',
          {
            scope: 'global' as const,
            name: 'userCollections',
            data: {
              collections,
              memberships: collectionMemberships,
              loading: collectionsLoading,
              saving: collectionsSaving,
              error: collectionsError,
              gitHubRepoExists: collectionsGitHubRepoExists,
              gitHubRepoUrl: collectionsGitHubRepoUrl,
            } as UserCollectionsSlice,
            loading: collectionsLoading,
            error: (collectionsError ?? null) as string | null,
            refresh: fetchCollections,
          },
        ],
        [
          'collectionRepositories',
          {
            scope: 'global' as const,
            name: 'collectionRepositories',
            data: {
              collection: selectedCollection,
              // Get repository IDs for the selected collection
              repositoryIds: selectedCollection
                ? collectionMemberships
                    .filter((m) => m.collectionId === selectedCollection.id)
                    .map((m) => m.repositoryId)
                : [],
            },
            loading: collectionsLoading,
            error: null,
            refresh: fetchCollections,
          },
        ],
        [
          'gitStatusWithFiles',
          {
            scope: 'repository' as const,
            name: 'gitStatusWithFiles',
            data: gitStatusWithFiles,
            loading: gitStatusLoading,
            error: null,
            refresh: async () => {
              if (selectedRepository) {
                setGitStatusLoading(true);
                try {
                  const status = await RepositoryMonitoringService.getGitStatusWithFiles(
                    selectedRepository.path,
                  );
                  setGitStatusWithFiles(status);
                } catch (error) {
                  console.error(
                    '[ProjectsPanelProvider] Failed to refresh git status:',
                    error,
                  );
                  setGitStatusWithFiles(null);
                } finally {
                  setGitStatusLoading(false);
                }
              }
            },
          },
        ],
      ]) as Map<string, DataSlice>,
    [
      workspaces,
      defaultWorkspaceId,
      workspacesLoading,
      selectedWorkspace,
      workspaceRepositories,
      repositoriesLoading,
      localRepositories,
      localRepositoriesLoading,
      discoveredRepositories,
      baseDefaultDirectory,
      starredRepositories,
      starredLoading,
      starredError,
      userRepositories,
      organizations,
      orgRepositories,
      projectsLoading,
      projectsError,
      currentUser,
      qualityDataByRepo,
      qualityLoading,
      collections,
      collectionMemberships,
      collectionsLoading,
      collectionsSaving,
      collectionsError,
      collectionsGitHubRepoExists,
      collectionsGitHubRepoUrl,
      selectedCollection,
      selectedRepository,
      gitStatusWithFiles,
      gitStatusLoading,
    ],
  );

  // Define actions
  const actions: ProjectsPanelActions = useMemo(
    () => ({
      openFile: (filePath: string) => {
        console.info('[ProjectsPanelProvider] Opening file:', filePath);
        events.emit({
          type: 'file:opened',
          source: 'projects-view',
          timestamp: Date.now(),
          payload: { filePath },
        });
      },

      openGitDiff: (filePath: string, status?: string) => {
        console.info(
          '[ProjectsPanelProvider] Opening git diff:',
          filePath,
          status,
        );
        events.emit({
          type: 'git:diff',
          source: 'projects-view',
          timestamp: Date.now(),
          payload: { filePath, status },
        });
      },

      navigateToPanel: (panelId: string) => {
        console.info('[ProjectsPanelProvider] Navigating to panel:', panelId);
        events.emit({
          type: 'panel:focus',
          source: 'projects-view',
          timestamp: Date.now(),
          payload: { panelId },
        });
      },

      notifyPanels: (event: PanelEvent) => {
        events.emit(event);
      },

      // LocalProjectsPanel actions
      selectDirectory: async () => {
        const result = await FileSystemService.selectDirectory({
          title: 'Select Repository Directory',
          buttonLabel: 'Select',
          properties: ['openDirectory'],
        });

        if (!result || result.canceled || !result.filePaths?.[0]) {
          return null;
        }

        const path = result.filePaths[0];
        const name = path.split('/').pop() || path;
        return { path, name };
      },

      registerRepository: async (name: string, path: string) => {
        console.info(
          '[ProjectsPanelProvider] Registering repository:',
          name,
          path,
        );
        await AlexandriaService.registerRepository(name, path);

        // Refresh local repositories
        const repos = await AlexandriaService.getRepositories();
        setLocalRepositories(repos);
      },

      removeRepository: async (name: string, deleteLocal: boolean) => {
        console.info(
          '[ProjectsPanelProvider] Removing repository:',
          name,
          deleteLocal,
        );
        await AlexandriaService.removeRepository(name, deleteLocal);

        // Refresh local repositories
        const repos = await AlexandriaService.getRepositories();
        setLocalRepositories(repos);
      },

      // Track a discovered repository (add to Alexandria)
      trackRepository: async (name: string, path: string) => {
        console.info(
          '[ProjectsPanelProvider] Tracking repository:',
          name,
          path,
        );
        await AlexandriaService.registerRepository(name, path);

        // Refresh local repositories (this will also trigger discovered repos refresh)
        const repos = await AlexandriaService.getRepositories();
        setLocalRepositories(repos);
      },

      // Workspace actions
      createWorkspace: async (
        name: string,
        options?: {
          description?: string;
          icon?: string;
          theme?: string;
          suggestedClonePath?: string;
        },
      ) => {
        console.info('[ProjectsPanelProvider] Creating workspace:', name);
        const workspace = await WorkspaceService.createWorkspace({
          name,
          description: options?.description,
          icon: options?.icon,
          theme: options?.theme,
          suggestedClonePath: options?.suggestedClonePath,
        });

        // Refresh workspaces list
        const allWorkspaces = await WorkspaceService.getWorkspaces();
        setWorkspaces(allWorkspaces);

        return workspace;
      },

      updateWorkspace: async (
        workspaceId: string,
        updates: Partial<Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>>,
      ) => {
        console.info(
          '[ProjectsPanelProvider] Updating workspace:',
          workspaceId,
          updates,
        );
        await WorkspaceService.updateWorkspace(workspaceId, updates);

        // Refresh workspaces list
        const allWorkspaces = await WorkspaceService.getWorkspaces();
        setWorkspaces(allWorkspaces);

        // Update selected workspace if it's the one being updated
        if (selectedWorkspace?.id === workspaceId) {
          const updated = allWorkspaces.find((w) => w.id === workspaceId);
          if (updated) {
            setSelectedWorkspace(updated);
          }
        }
      },

      deleteWorkspace: async (workspaceId: string) => {
        console.info(
          '[ProjectsPanelProvider] Deleting workspace:',
          workspaceId,
        );
        await WorkspaceService.deleteWorkspace(workspaceId);

        // Refresh workspaces list
        const allWorkspaces = await WorkspaceService.getWorkspaces();
        setWorkspaces(allWorkspaces);

        // Clear selection if deleted workspace was selected
        if (selectedWorkspace?.id === workspaceId) {
          setSelectedWorkspace(null);
        }
      },

      setDefaultWorkspace: async (workspaceId: string) => {
        console.info(
          '[ProjectsPanelProvider] Setting default workspace:',
          workspaceId,
        );
        await WorkspaceService.setDefaultWorkspace(workspaceId);
        setDefaultWorkspaceId(workspaceId);
      },

      openWorkspace: async (workspaceId: string) => {
        console.info(
          '[ProjectsPanelProvider] Opening workspace:',
          workspaceId,
        );
        await WindowService.openAlexandriaWorkspace({ workspaceId });
      },

      getWorkspaceRepositories: async (workspaceId: string) => {
        const repos =
          await WorkspaceService.getRepositoriesInWorkspace(workspaceId);
        return repos.map((r) => ({ name: r.name }));
      },

      // Repository actions
      removeRepositoryFromWorkspace: async (
        repositoryId: string,
        workspaceId: string,
      ) => {
        console.info(
          '[ProjectsPanelProvider] Removing repository from workspace:',
          repositoryId,
          workspaceId,
        );
        await WorkspaceService.removeRepositoryFromWorkspace(
          repositoryId,
          workspaceId,
        );

        // Refresh repositories if this is the selected workspace
        if (selectedWorkspace?.id === workspaceId) {
          const repos =
            await WorkspaceService.getRepositoriesInWorkspace(workspaceId);
          setWorkspaceRepositories(repos);
        }

        events.emit({
          type: 'workspace:membership-changed',
          source: 'projects-view',
          timestamp: Date.now(),
          payload: { repositoryId, workspaceId, action: 'removed' },
        });
      },

      copyToClipboard: async (text: string) => {
        console.info('[ProjectsPanelProvider] Copying to clipboard');
        await navigator.clipboard.writeText(text);
      },

      isRepositoryInWorkspaceDirectory: async (
        repository: AlexandriaEntry,
        workspaceId: string,
      ) => {
        return WorkspaceService.isRepositoryInWorkspaceDirectory(
          repository,
          workspaceId,
        );
      },

      moveRepositoryToWorkspaceDirectory: async (
        repository: AlexandriaEntry,
        workspaceId: string,
      ) => {
        const newPath =
          await WorkspaceService.moveRepositoryToWorkspaceDirectory(
            repository,
            workspaceId,
          );

        // Refresh repositories
        if (selectedWorkspace?.id === workspaceId) {
          const repos =
            await WorkspaceService.getRepositoriesInWorkspace(workspaceId);
          setWorkspaceRepositories(repos);
        }

        events.emit({
          type: 'repository:moved',
          source: 'projects-view',
          timestamp: Date.now(),
          payload: {
            repositoryId: repository.github?.id || repository.name,
            workspaceId,
            newPath,
          },
        });

        return newPath;
      },

      // GitHub panel actions
      cloneRepository: async (repo: GitHubRepository) => {
        console.info(
          '[ProjectsPanelProvider] Clone requested for:',
          repo.full_name,
        );
        // Emit event for clone modal to handle
        events.emit({
          type: 'github:clone-requested',
          source: 'projects-view',
          timestamp: Date.now(),
          payload: { repository: repo },
        });
      },

      // selectRepository - Sets the current repository without opening a new window
      selectRepository: async (entryOrPath: AlexandriaEntry | string) => {
        let entry: AlexandriaEntry | undefined;

        if (typeof entryOrPath === 'string') {
          // Find the local repo entry by path
          entry = localRepositories.find((r) => r.path === entryOrPath);
          if (!entry) {
            console.error(
              '[ProjectsPanelProvider] Could not find repository at path:',
              entryOrPath,
            );
            return;
          }
        } else {
          entry = entryOrPath;
        }

        console.info(
          '[ProjectsPanelProvider] Selecting repository:',
          entry.name,
        );

        setSelectedRepository(entry);
        events.emit({
          type: 'repository:selected',
          source: 'projects-view',
          timestamp: Date.now(),
          payload: { repositoryId: entry.name, repository: entry },
        });
      },

      // openRepository for GitHub panels (takes localPath string)
      // Note: This overloads the existing openRepository that takes AlexandriaEntry
      // The GitHub panels call this with a path string, so we find the matching entry
      openRepository: async (entryOrPath: AlexandriaEntry | string) => {
        let entry: AlexandriaEntry | undefined;

        if (typeof entryOrPath === 'string') {
          // Find the local repo entry by path
          entry = localRepositories.find((r) => r.path === entryOrPath);
          if (!entry) {
            console.error(
              '[ProjectsPanelProvider] Could not find repository at path:',
              entryOrPath,
            );
            return;
          }
        } else {
          entry = entryOrPath;
        }

        console.info(
          '[ProjectsPanelProvider] Opening repository:',
          entry.name,
        );

        // Also select the repository for the info panel
        setSelectedRepository(entry);

        // Update lastOpenedAt timestamp
        try {
          await AlexandriaService.updateLastOpened(entry.name);
        } catch (error) {
          console.error(
            '[ProjectsPanelProvider] Failed to update lastOpenedAt:',
            error,
          );
          // Don't block opening the project if update fails
        }

        await WindowService.openDevWorkspace({
          alexandriaEntry: entry,
        });
        events.emit({
          type: 'repository:opened',
          source: 'projects-view',
          timestamp: Date.now(),
          payload: { repositoryId: entry.name, repository: entry },
        });
      },

      refreshStarred: fetchStarredRepositories,

      refreshProjects: fetchGitHubProjects,

      // Collections actions
      createCollection: async (
        name: string,
        description?: string,
        icon?: string,
      ) => {
        console.info('[ProjectsPanelProvider] Creating collection:', name);
        setCollectionsSaving(true);
        try {
          const result = await CollectionsService.createCollection({
            name,
            description,
            icon,
          });

          // Refresh collections to get updated list
          await fetchCollections();

          if (result.success && result.data) {
            events.emit({
              type: 'industry-theme.user-collections:collection:created',
              source: 'projects-view',
              timestamp: Date.now(),
              payload: { collectionId: result.data.id, collection: result.data },
            });
            return result.data as Collection;
          }
          return null;
        } catch (error) {
          console.error(
            '[ProjectsPanelProvider] Failed to create collection:',
            error,
          );
          throw error;
        } finally {
          setCollectionsSaving(false);
        }
      },

      updateCollection: async (
        collectionId: string,
        updates: Partial<Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>>,
      ) => {
        console.info(
          '[ProjectsPanelProvider] Updating collection:',
          collectionId,
          updates,
        );
        setCollectionsSaving(true);
        try {
          await CollectionsService.updateCollection(collectionId, updates);
          await fetchCollections();
        } catch (error) {
          console.error(
            '[ProjectsPanelProvider] Failed to update collection:',
            error,
          );
          throw error;
        } finally {
          setCollectionsSaving(false);
        }
      },

      deleteCollection: async (collectionId: string) => {
        console.info(
          '[ProjectsPanelProvider] Deleting collection:',
          collectionId,
        );
        setCollectionsSaving(true);
        try {
          await CollectionsService.deleteCollection(collectionId);
          await fetchCollections();

          events.emit({
            type: 'industry-theme.user-collections:collection:deleted',
            source: 'projects-view',
            timestamp: Date.now(),
            payload: { collectionId },
          });
        } catch (error) {
          console.error(
            '[ProjectsPanelProvider] Failed to delete collection:',
            error,
          );
          throw error;
        } finally {
          setCollectionsSaving(false);
        }
      },

      addRepository: async (
        collectionId: string,
        repositoryId: string,
        metadata?: { pinned?: boolean; notes?: string },
      ) => {
        console.info(
          '[ProjectsPanelProvider] Adding repository to collection:',
          repositoryId,
          collectionId,
        );
        setCollectionsSaving(true);
        try {
          await CollectionsService.addRepository({
            collectionId,
            repositoryId,
            metadata,
          });
          await fetchCollections();

          events.emit({
            type: 'industry-theme.user-collections:collection:repository-added',
            source: 'projects-view',
            timestamp: Date.now(),
            payload: { collectionId, repositoryId },
          });
        } catch (error) {
          console.error(
            '[ProjectsPanelProvider] Failed to add repository to collection:',
            error,
          );
          throw error;
        } finally {
          setCollectionsSaving(false);
        }
      },

      // Note: removeRepository conflicts with LocalProjectsPanel's removeRepository
      // The panel interface needs updating to use a unique name like removeCollectionRepository
      removeCollectionRepository: async (
        collectionId: string,
        repositoryId: string,
      ) => {
        console.info(
          '[ProjectsPanelProvider] Removing repository from collection:',
          repositoryId,
          collectionId,
        );
        setCollectionsSaving(true);
        try {
          await CollectionsService.removeRepository(collectionId, repositoryId);
          await fetchCollections();

          events.emit({
            type: 'industry-theme.user-collections:collection:repository-removed',
            source: 'projects-view',
            timestamp: Date.now(),
            payload: { collectionId, repositoryId },
          });
        } catch (error) {
          console.error(
            '[ProjectsPanelProvider] Failed to remove repository from collection:',
            error,
          );
          throw error;
        } finally {
          setCollectionsSaving(false);
        }
      },

      addRepositoryToCollection: async (
        collectionId: string,
        repositoryPath: string,
        repositoryMetadata: any,
      ) => {
        console.info(
          '[ProjectsPanelProvider] Adding repository to collection:',
          repositoryPath,
          collectionId,
          repositoryMetadata,
        );
        setCollectionsSaving(true);
        try {
          // Determine repository ID from metadata
          // Format: "owner/repo" or just "name"
          const repositoryId =
            repositoryMetadata?.github?.owner && repositoryMetadata?.name
              ? `${repositoryMetadata.github.owner}/${repositoryMetadata.name}`
              : repositoryMetadata?.name || repositoryPath;

          await CollectionsService.addRepository({
            collectionId,
            repositoryId,
            metadata: repositoryMetadata,
          });
          await fetchCollections();

          events.emit({
            type: 'industry-theme.user-collections:collection:repository-added',
            source: 'worlds-view',
            timestamp: Date.now(),
            payload: { collectionId, repositoryId, repositoryPath },
          });
        } catch (error) {
          console.error(
            '[ProjectsPanelProvider] Failed to add repository to collection:',
            error,
          );
          throw error;
        } finally {
          setCollectionsSaving(false);
        }
      },

      enableGitHubSync: async () => {
        console.info('[ProjectsPanelProvider] Enabling GitHub sync');
        setCollectionsSaving(true);
        try {
          await CollectionsService.enableGitHubSync();
          await fetchCollections();
        } catch (error) {
          console.error(
            '[ProjectsPanelProvider] Failed to enable GitHub sync:',
            error,
          );
          throw error;
        } finally {
          setCollectionsSaving(false);
        }
      },

      refreshCollections: fetchCollections,

      navigateToRepository: (repositoryId: string) => {
        console.info(
          '[ProjectsPanelProvider] Navigating to repository:',
          repositoryId,
        );
        // Open in browser
        const url = `https://github.com/${repositoryId}`;
        window.open(url, '_blank');
      },
    }),
    [events, selectedWorkspace, localRepositories],
  );

  // Create context value
  const context: ProjectsPanelContextValue = useMemo(
    () => ({
      currentScope: {
        type: 'workspace' as const,
        workspace: selectedWorkspace
          ? {
              id: selectedWorkspace.id,
              name: selectedWorkspace.name,
              path: selectedWorkspace.suggestedClonePath || '',
            }
          : undefined,
        repository: selectedRepository || undefined,
      },
      slices,
      adapters: {},
      getSlice: <T = unknown,>(name: string): DataSlice<T> | undefined => {
        return slices.get(name) as DataSlice<T> | undefined;
      },
      getWorkspaceSlice: <T = unknown,>(
        name: string,
      ): DataSlice<T> | undefined => {
        const slice = slices.get(name);
        return slice?.scope === 'workspace'
          ? (slice as DataSlice<T>)
          : undefined;
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
      // Extended properties
      selectedWorkspace,
      setSelectedWorkspace,
      selectedCollection,
      setSelectedCollection,
    }),
    [slices, selectedWorkspace, selectedCollection, selectedRepository],
  );

  // Combine into provider value
  const value: ProjectsPanelProviderValue = useMemo(
    () => ({
      context,
      actions,
      events,
    }),
    [context, actions, events],
  );

  return (
    <ProjectsPanelContext.Provider value={value}>
      {children}
    </ProjectsPanelContext.Provider>
  );
};

export const useProjectsPanelProvider = (): ProjectsPanelProviderValue => {
  const value = useContext(ProjectsPanelContext);
  if (!value) {
    throw new Error(
      'useProjectsPanelProvider must be used within a ProjectsPanelProvider',
    );
  }
  return value;
};

export default ProjectsPanelContext;
