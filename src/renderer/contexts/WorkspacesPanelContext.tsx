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
import type {
  WorkspacesSlice,
  WorkspacesListPanelActions,
  GitHubStarredSlice,
  GitHubStarredPanelActions,
  GitHubProjectsSlice,
  GitHubProjectsPanelActions,
  GitHubRepository,
  GitHubOrganization,
} from '@industry-theme/alexandria-panels';
import { WorkspaceService } from '../main-process-api/WorkspaceService';
import { WindowService } from '../main-process-api/WindowService';
import { AlexandriaService } from '../main-process-api/AlexandriaService';
import { FileSystemService } from '../main-process-api/FileSystemService';
import { GithubService } from '../main-process-api/GithubService';
import { GitHubArtifactService } from '../main-process-api/GitHubArtifactService';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';

/**
 * Extended actions for WorkspacesPanelProvider
 * Combines workspace list actions with repository actions and GitHub actions
 */
interface WorkspacesPanelActions
  extends PanelActions,
    WorkspacesListPanelActions,
    GitHubStarredPanelActions,
    GitHubProjectsPanelActions {
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
}

/**
 * Extended context interface for workspaces panels
 */
interface WorkspacesPanelContextValue extends PanelContextValue {
  // Selected workspace (for coordination between panels)
  selectedWorkspace: Workspace | null;
  setSelectedWorkspace: (workspace: Workspace | null) => void;
}

/**
 * Provider value containing context, actions, and events
 */
interface WorkspacesPanelProviderValue {
  context: WorkspacesPanelContextValue;
  actions: WorkspacesPanelActions;
  events: PanelEventEmitter;
}

const WorkspacesPanelContext =
  createContext<WorkspacesPanelProviderValue | null>(null);

interface WorkspacesPanelProviderProps {
  children: ReactNode;
  theme?: Theme;
}

export const WorkspacesPanelProvider: React.FC<
  WorkspacesPanelProviderProps
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
          '[WorkspacesPanelProvider] Failed to fetch workspaces:',
          error,
        );
      } finally {
        setWorkspacesLoading(false);
      }
    };

    fetchWorkspaces();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
          '[WorkspacesPanelProvider] Failed to fetch workspace repositories:',
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
        setLocalRepositories(repos);
      } catch (error) {
        console.error(
          '[WorkspacesPanelProvider] Failed to fetch local repositories:',
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
        '[WorkspacesPanelProvider] Failed to fetch starred repositories:',
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

      // Cast to panels package types (structurally compatible)
      setUserRepositories(userRepos as unknown as GitHubRepository[]);
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
              `[WorkspacesPanelProvider] Failed to fetch repos for org ${org.login}:`,
              error,
            );
            orgReposMap[org.login] = [];
          }
        }),
      );
      setOrgRepositories(orgReposMap);
    } catch (error) {
      console.error(
        '[WorkspacesPanelProvider] Failed to fetch GitHub projects:',
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

  // Fetch GitHub data on mount (these will silently fail if not authenticated)
  useEffect(() => {
    void fetchStarredRepositories();
    void fetchGitHubProjects();
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
            const gitStatus =
              await RepositoryMonitoringService.getGitStatus(repo.path);
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
                `[WorkspacesPanelProvider] Quality loaded for ${repo.name}`,
              );
            }
          } catch (error) {
            console.error(
              `[WorkspacesPanelProvider] Failed to fetch quality for ${repo.name}:`,
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
      console.info('[WorkspacesPanelProvider] Workspace change event:', event);

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
          '[WorkspacesPanelProvider] Workspace selected event:',
          workspace,
        );
        setSelectedWorkspace(workspace);
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
          '[WorkspacesPanelProvider] Workspace opened event:',
          workspace,
        );

        // Open workspace in Alexandria workspace window
        WindowService.openAlexandriaWorkspace(workspace.id).catch(
          console.error,
        );
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
        '[WorkspacesPanelProvider] Repository opened event:',
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
              loading: localRepositoriesLoading,
            },
            loading: localRepositoriesLoading,
            error: null,
            refresh: async () => {
              setLocalRepositoriesLoading(true);
              try {
                const repos = await AlexandriaService.getRepositories();
                setLocalRepositories(repos);
              } catch (error) {
                console.error(
                  '[WorkspacesPanelProvider] Failed to refresh local repositories:',
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
                  '[WorkspacesPanelProvider] Failed to refresh workspaces:',
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
                    '[WorkspacesPanelProvider] Failed to refresh repositories:',
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
                      `[WorkspacesPanelProvider] Failed to refresh quality for ${repo.name}:`,
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
    ],
  );

  // Define actions
  const actions: WorkspacesPanelActions = useMemo(
    () => ({
      openFile: (filePath: string) => {
        console.info('[WorkspacesPanelProvider] Opening file:', filePath);
        events.emit({
          type: 'file:opened',
          source: 'workspaces-view',
          timestamp: Date.now(),
          payload: { filePath },
        });
      },

      openGitDiff: (filePath: string, status?: string) => {
        console.info(
          '[WorkspacesPanelProvider] Opening git diff:',
          filePath,
          status,
        );
        events.emit({
          type: 'git:diff',
          source: 'workspaces-view',
          timestamp: Date.now(),
          payload: { filePath, status },
        });
      },

      navigateToPanel: (panelId: string) => {
        console.info('[WorkspacesPanelProvider] Navigating to panel:', panelId);
        events.emit({
          type: 'panel:focus',
          source: 'workspaces-view',
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
          '[WorkspacesPanelProvider] Registering repository:',
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
          '[WorkspacesPanelProvider] Removing repository:',
          name,
          deleteLocal,
        );
        await AlexandriaService.removeRepository(name, deleteLocal);

        // Refresh local repositories
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
        console.info('[WorkspacesPanelProvider] Creating workspace:', name);
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
          '[WorkspacesPanelProvider] Updating workspace:',
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
          '[WorkspacesPanelProvider] Deleting workspace:',
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
          '[WorkspacesPanelProvider] Setting default workspace:',
          workspaceId,
        );
        await WorkspaceService.setDefaultWorkspace(workspaceId);
        setDefaultWorkspaceId(workspaceId);
      },

      openWorkspace: async (workspaceId: string) => {
        console.info(
          '[WorkspacesPanelProvider] Opening workspace:',
          workspaceId,
        );
        await WindowService.openAlexandriaWorkspace(workspaceId);
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
          '[WorkspacesPanelProvider] Removing repository from workspace:',
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
          source: 'workspaces-view',
          timestamp: Date.now(),
          payload: { repositoryId, workspaceId, action: 'removed' },
        });
      },

      copyToClipboard: async (text: string) => {
        console.info('[WorkspacesPanelProvider] Copying to clipboard');
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
          source: 'workspaces-view',
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
          '[WorkspacesPanelProvider] Clone requested for:',
          repo.full_name,
        );
        // Emit event for clone modal to handle
        events.emit({
          type: 'github:clone-requested',
          source: 'workspaces-view',
          timestamp: Date.now(),
          payload: { repository: repo },
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
              '[WorkspacesPanelProvider] Could not find repository at path:',
              entryOrPath,
            );
            return;
          }
        } else {
          entry = entryOrPath;
        }

        console.info(
          '[WorkspacesPanelProvider] Opening repository:',
          entry.name,
        );
        await WindowService.openDevWorkspace({
          alexandriaEntry: entry,
        });
        events.emit({
          type: 'repository:opened',
          source: 'workspaces-view',
          timestamp: Date.now(),
          payload: { repositoryId: entry.name, repository: entry },
        });
      },

      refreshStarred: fetchStarredRepositories,

      refreshProjects: fetchGitHubProjects,
    }),
    [events, selectedWorkspace, localRepositories],
  );

  // Create context value
  const context: WorkspacesPanelContextValue = useMemo(
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
        repository: undefined,
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
    }),
    [slices, selectedWorkspace],
  );

  // Combine into provider value
  const value: WorkspacesPanelProviderValue = useMemo(
    () => ({
      context,
      actions,
      events,
    }),
    [context, actions, events],
  );

  return (
    <WorkspacesPanelContext.Provider value={value}>
      {children}
    </WorkspacesPanelContext.Provider>
  );
};

export const useWorkspacesPanelProvider = (): WorkspacesPanelProviderValue => {
  const value = useContext(WorkspacesPanelContext);
  if (!value) {
    throw new Error(
      'useWorkspacesPanelProvider must be used within a WorkspacesPanelProvider',
    );
  }
  return value;
};

export default WorkspacesPanelContext;
