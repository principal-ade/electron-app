import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { Theme } from '@principal-ade/industry-theme';
import { PanelEventBus } from '@principal-ade/panel-framework-core';
import { getTracer } from '../telemetry';
import { SpanStatusCode } from '@opentelemetry/api';
import type {
  PanelContextValue,
  PanelActions,
  DataSlice,
  PanelEvent,
  PanelEventEmitter,
  RepositoryMetadata,
} from '@principal-ade/panel-framework-core';
import type {
  Workspace,
  AlexandriaEntry,
} from '@principal-ai/alexandria-core-library/types';
import type { GitStatusWithFiles } from '@principal-ai/repository-abstraction';
import type {
  WorkspacesSlice,
  GitHubStarredSlice,
  GitHubStarredPanelActions,
  GitHubProjectsSlice,
  GitHubProjectsPanelActions,
  GitHubRepository,
  GitHubOrganization,
  UserCollectionsSlice,
  UserCollectionsPanelActions,
  LocalProjectsPanelActions,
} from '@industry-theme/alexandria-panels';
import type { Collection } from '@principal-ai/alexandria-collections';
import { WorkspaceService } from '../main-process-api/WorkspaceService';
import { WindowService } from '../main-process-api/WindowService';
import { AlexandriaService } from '../main-process-api/AlexandriaService';
import { FileSystemService } from '../main-process-api/FileSystemService';
import { GithubService } from '../main-process-api/GithubService';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { CollectionsService } from '../main-process-api/CollectionsService';
import { GitService } from '../main-process-api/GitService';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import { FileCityImageService } from '../main-process-api/FileCityImageService';
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
    LocalProjectsPanelActions,
    GitHubStarredPanelActions,
    GitHubProjectsPanelActions,
    UserCollectionsPanelActions {
  // Workspace-specific actions
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
  // Add a repository to a collection (for drag-drop integration)
  addRepositoryToCollection?: (
    collectionId: string,
    repositoryPath: string,
    repositoryMetadata: RepositoryMetadata,
  ) => Promise<void>;
  // Track a discovered repository (add to Alexandria)
  trackRepository?: (name: string, path: string) => Promise<void>;
  // Select a repository without opening a new window (for ProjectInfoPanel)
  selectRepository?: (entry: AlexandriaEntry) => Promise<void>;
  // Stale repo review actions
  getStaleRepos?: () => Promise<StaleRepoInfo[]>;
  getRandomStaleRepo?: () => Promise<StaleRepoInfo | null>;
  snoozeStaleRepo?: (repoName: string) => Promise<void>;
  deleteStaleRepo?: (repoName: string) => Promise<void>;
  getStaleRepoCount?: () => number;
  shouldShowStaleBadge?: () => boolean;
  // Default branch analysis actions
  analyzeDefaultBranchStatus?: () => Promise<DefaultBranchInfo[]>;
  getDefaultBranchRepoCount?: () => number;
  clearDefaultBranchAnalysis?: () => void;
  // File City image action
  getFileCityImage: (repoPath: string) => Promise<string | null>;
}

/**
 * Information about a stale repository
 */
export interface StaleRepoInfo {
  entry: AlexandriaEntry;
  sizeBytes: number;
  mtime: string;
  daysSinceModified: number;
}

/**
 * Information about a repository not on its default branch
 */
export interface DefaultBranchInfo {
  entry: AlexandriaEntry;
  currentBranch: string;
  defaultBranch: string;
  behindCount: number;
  isOnDefaultBranch: boolean;
  hasRemote: boolean;
  error?: string;
}

/**
 * Projects page context type - contains only slice properties and custom state
 * Following the web-ade pattern
 */
export interface ProjectsPanelContextType {
  // LocalProjectsPanelContext
  alexandriaRepositories: DataSlice<{
    repositories: AlexandriaEntry[];
    discoveredRepositories: DiscoveredRepository[];
    loading: boolean;
  }>;
  // WorkspacesListPanelContext
  workspaces: DataSlice<WorkspacesSlice>;
  // WorkspaceRepositoriesPanelContext
  workspace: DataSlice<{
    workspace: Workspace | null;
    loading: boolean;
  }>;
  // GitHubProjectsPanelContext
  githubProjects: DataSlice<GitHubProjectsSlice>;
  // GitHubStarredPanelContext
  githubStarred: DataSlice<GitHubStarredSlice>;
  // UserCollectionsPanelContext
  userCollections: DataSlice<UserCollectionsSlice>;
  // Git status for selected repository
  gitStatusWithFiles: DataSlice<GitStatusWithFiles | null>;
  // Additional properties for coordination between panels
  selectedWorkspace: Workspace | null;
  setSelectedWorkspace: (workspace: Workspace | null) => void;
  selectedCollection: Collection | null;
  setSelectedCollection: (collection: Collection | null) => void;
  // Stale repo review
  staleRepos: StaleRepoInfo[];
  // Default branch analysis
  defaultBranchRepos: DefaultBranchInfo[];
  defaultBranchAnalysisRunning: boolean;
}

/**
 * Provider value containing context, actions, and events
 */
interface ProjectsPanelProviderValue {
  context: PanelContextValue<ProjectsPanelContextType>;
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

  // State for stale repo review
  const [staleRepos, setStaleRepos] = useState<StaleRepoInfo[]>([]);
  const [staleRepoPrefsLoaded, setStaleRepoPrefsLoaded] = useState(false);
  const [staleRepoPrefs, setStaleRepoPrefs] = useState<{
    thresholdDays: number;
    snoozeDurationDays: number;
    snoozedRepos: Record<string, number>;
    lastBadgeShownDate?: string;
  }>({
    thresholdDays: 10,
    snoozeDurationDays: 10,
    snoozedRepos: {},
  });

  // State for default branch analysis
  const [defaultBranchRepos, setDefaultBranchRepos] = useState<DefaultBranchInfo[]>([]);
  const [defaultBranchAnalysisRunning, setDefaultBranchAnalysisRunning] = useState(false);

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

  // Fetch all local repositories on mount
  useEffect(() => {
    const tracer = getTracer('principal-ade-principal-window');

    const fetchLocalRepositories = async (_trigger?: string) => {
      const span = tracer.startSpan('alexandria.context.repositories_fetched');
      setLocalRepositoriesLoading(true);
      try {
        const repos = await AlexandriaService.getRepositories();

        // Sort by lastOpenedAt (most recent first)
        const withTimestamp = repos.filter((r) => r.lastOpenedAt).length;
        span.addEvent('alexandria.context.repositories_sorted', {
          total_count: repos.length,
          with_timestamp_count: withTimestamp,
        });

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

        span.setAttributes({
          total_count: repos.length,
          with_last_opened_count: withTimestamp,
        });

        // UI display event - projects will be rendered with this data
        span.addEvent('alexandria.ui.local_projects_displayed', {
          repository_count: repos.length,
          has_recently_opened: withTimestamp > 0,
        });

        span.setStatus({ code: SpanStatusCode.OK });
        setLocalRepositories(sorted);
      } catch (error) {
        console.error(
          '[ProjectsPanelProvider] Failed to fetch local repositories:',
          error,
        );
        span.recordException(
          error instanceof Error ? error : new Error(String(error)),
        );
        span.setStatus({ code: SpanStatusCode.ERROR });
        setLocalRepositories([]);
      } finally {
        span.end();
        setLocalRepositoriesLoading(false);
      }
    };

    fetchLocalRepositories('mount');

    // Listen for repository changes
    const unsubscribe = AlexandriaService.onRepositoryChange((event) => {
      const changeSpan = tracer.startSpan(
        'alexandria.context.change_listener_triggered',
      );
      changeSpan.setAttribute('trigger', 'repository_change_event');

      // Track re-sort event for recently opened project
      if (event?.repository?.name) {
        changeSpan.addEvent('alexandria.ui.projects_resorted', {
          newly_opened_project: event.repository.name,
          new_position: 0, // After re-sort, the updated project moves to top
        });
      }

      changeSpan.end();
      fetchLocalRepositories('repository_change');
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

        // Just update discovered repositories list
        // (auto-registration happens in a separate mount-only effect)
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

    // Listen for preference changes to update when baseDefaultDirectory changes
    const unsubscribe = UserPreferencesService.onPreferencesUpdated(
      async (preferences) => {
        const newBasePath = preferences.baseDefaultDirectory;
        if (newBasePath !== baseDefaultDirectory) {
          setBaseDefaultDirectory(newBasePath || null);
          if (newBasePath) {
            // Just refresh discovered list, the useEffect will handle it
            try {
              const discovered = await GitService.getDiscoveredRepos(
                newBasePath,
                2,
              );
              setDiscoveredRepositories(discovered);
            } catch (error) {
              console.error(
                '[ProjectsPanelProvider] Failed to refresh discovered repos:',
                error,
              );
            }
          } else {
            setDiscoveredRepositories([]);
          }
        }
      },
    );

    return unsubscribe;
  }, [localRepositories, baseDefaultDirectory]); // Re-run when local repos change to update discovered list

  // Auto-register discovered repositories on initial mount only
  useEffect(() => {
    const autoRegisterOnMount = async () => {
      const preferences = await UserPreferencesService.getPreferences();
      const basePath = preferences.baseDefaultDirectory;

      if (!basePath) return;

      try {
        const discovered = await GitService.getDiscoveredRepos(basePath, 2);

        if (discovered.length > 0) {
          console.info(
            `[ProjectsPanelProvider] Auto-registering ${discovered.length} discovered repositories on mount...`,
          );
          let successCount = 0;
          let failCount = 0;

          for (const repo of discovered) {
            try {
              await AlexandriaService.registerRepository(repo.name, repo.path);
              successCount++;
            } catch (error) {
              // If repo already exists, treat as success (desired end state)
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              if (errorMessage.includes('already exists')) {
                console.info(
                  `[ProjectsPanelProvider] ${repo.name} already registered, skipping`,
                );
                successCount++;
              } else {
                console.warn(
                  `[ProjectsPanelProvider] Failed to auto-register ${repo.name}:`,
                  error,
                );
                failCount++;
              }
            }
          }

          console.info(
            `[ProjectsPanelProvider] Auto-registration complete: ${successCount} succeeded, ${failCount} failed`,
          );

          // Refresh local repositories list
          const repos = await AlexandriaService.getRepositories();
          setLocalRepositories(repos);
        }
      } catch (error) {
        console.error(
          '[ProjectsPanelProvider] Failed to auto-register on mount:',
          error,
        );
      }
    };

    autoRegisterOnMount();
  }, []); // Empty deps = run only once on mount

  // Load stale repo preferences on mount
  useEffect(() => {
    const loadStaleRepoPrefs = async () => {
      try {
        const prefs = await UserPreferencesService.getPreferences();
        if (prefs.staleRepoReview) {
          setStaleRepoPrefs(prefs.staleRepoReview);
        }
        setStaleRepoPrefsLoaded(true);
        console.info('[ProjectsPanelProvider] Stale repo prefs loaded:', prefs.staleRepoReview || 'using defaults');
      } catch (error) {
        console.error('[ProjectsPanelProvider] Failed to load stale repo prefs:', error);
        setStaleRepoPrefsLoaded(true); // Still mark as loaded to allow check to proceed
      }
    };
    loadStaleRepoPrefs();

    // Subscribe to preference updates
    const unsubscribe = UserPreferencesService.onPreferencesUpdated((prefs) => {
      if (prefs.staleRepoReview) {
        setStaleRepoPrefs(prefs.staleRepoReview);
      }
    });

    return unsubscribe;
  }, []);

  // Auto-check for stale repos when local repositories are loaded and prefs are ready
  useEffect(() => {
    console.info('[ProjectsPanelProvider] Stale repo check effect:', {
      repoCount: localRepositories.length,
      loading: localRepositoriesLoading,
      prefsLoaded: staleRepoPrefsLoaded,
    });
    if (localRepositories.length > 0 && !localRepositoriesLoading && staleRepoPrefsLoaded) {
      console.info('[ProjectsPanelProvider] Starting stale repo check...');
      // Small delay to avoid blocking initial render
      const timer = setTimeout(async () => {
        const staleList = await getStaleReposInternal();
        console.info('[ProjectsPanelProvider] Stale repo check complete:', {
          staleCount: staleList.length,
          staleRepos: staleList.map(r => r.entry.name),
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [localRepositories, localRepositoriesLoading, staleRepoPrefsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Internal function to identify stale repos (used by useEffect and exported callback)
  const getStaleReposInternal = async (): Promise<StaleRepoInfo[]> => {
    const now = Date.now();
    const thresholdMs = staleRepoPrefs.thresholdDays * 24 * 60 * 60 * 1000;
    const staleList: StaleRepoInfo[] = [];
    const orphanedEntries: string[] = [];

    console.info('[ProjectsPanelProvider] getStaleReposInternal:', {
      repoCount: localRepositories.length,
      thresholdDays: staleRepoPrefs.thresholdDays,
      snoozedRepos: Object.keys(staleRepoPrefs.snoozedRepos),
    });

    for (const repo of localRepositories) {
      // Skip if snoozed
      const snoozeUntil = staleRepoPrefs.snoozedRepos[repo.name];
      if (snoozeUntil && snoozeUntil > now) {
        continue;
      }

      // Get directory info
      try {
        const dirInfo = await FileSystemService.getDirectoryInfo(repo.path);
        const epochTime = new Date(0).toISOString();

        // Check if directory info is invalid (doesn't exist or failed to read)
        if (!dirInfo || dirInfo.mtime === epochTime) {
          // Directory doesn't exist or can't be read - mark for cleanup
          orphanedEntries.push(repo.name);
          continue;
        }

        const mtime = new Date(dirInfo.mtime).getTime();
        const daysSinceModified = Math.floor((now - mtime) / (24 * 60 * 60 * 1000));

        // Sanity check - if days is unreasonable (> 10 years), skip it
        if (daysSinceModified > 3650) {
          console.warn(`[ProjectsPanelProvider] Suspicious mtime for ${repo.path}: ${daysSinceModified} days`);
          continue;
        }

        // Check if stale based on mtime
        if (now - mtime > thresholdMs) {
          staleList.push({
            entry: repo,
            sizeBytes: dirInfo.sizeBytes,
            mtime: dirInfo.mtime,
            daysSinceModified,
          });
        }
      } catch {
        // Directory doesn't exist - mark for cleanup
        orphanedEntries.push(repo.name);
      }
    }

    // Clean up orphaned entries (folders that no longer exist)
    if (orphanedEntries.length > 0) {
      console.info(`[ProjectsPanelProvider] Cleaning up ${orphanedEntries.length} orphaned Alexandria entries`);
      for (const name of orphanedEntries) {
        try {
          await AlexandriaService.removeRepository(name, false);
        } catch (error) {
          console.warn(`[ProjectsPanelProvider] Failed to clean up orphaned entry ${name}:`, error);
        }
      }
      // Refresh local repositories after cleanup
      const repos = await AlexandriaService.getRepositories();
      setLocalRepositories(repos);
    }

    // Sort by oldest first
    staleList.sort((a, b) => a.daysSinceModified - b.daysSinceModified);
    setStaleRepos(staleList);
    return staleList;
  };

  // Callback to identify stale repos (wraps internal function)
  const getStaleRepos = useCallback(async (): Promise<StaleRepoInfo[]> => {
    return getStaleReposInternal();
  }, [localRepositories, staleRepoPrefs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get a random stale repo for review
  const getRandomStaleRepo = useCallback(async (): Promise<StaleRepoInfo | null> => {
    const repos = await getStaleRepos();
    if (repos.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * repos.length);
    return repos[randomIndex];
  }, [getStaleRepos]);

  // Analyze default branch status for all repositories
  const analyzeDefaultBranchStatus = useCallback(async (): Promise<
    DefaultBranchInfo[]
  > => {
    console.info('[ProjectsPanelProvider] Starting default branch analysis...');
    setDefaultBranchAnalysisRunning(true);

    const results: DefaultBranchInfo[] = [];
    let fetchSuccessCount = 0;
    let fetchFailCount = 0;

    try {
      // Fetch from all remotes in parallel
      console.info(
        `[ProjectsPanelProvider] Fetching from ${localRepositories.length} repositories...`,
      );

      await Promise.allSettled(
        localRepositories.map(async repo => {
          try {
            const result = await GitService.fetch(repo.path);
            if (result.success) {
              fetchSuccessCount++;
            } else {
              fetchFailCount++;
            }
          } catch {
            fetchFailCount++;
          }
        }),
      );

      console.info(
        `[ProjectsPanelProvider] Fetch complete: ${fetchSuccessCount} succeeded, ${fetchFailCount} failed`,
      );

      // Analyze each repository
      let analysisCount = 0;

      for (const repo of localRepositories) {
        const analysis = await GitService.analyzeDefaultBranchStatus(repo);

        if (analysis) {
          analysisCount++;

          // Include repos that need attention
          if (
            !analysis.isOnDefaultBranch ||
            analysis.behindCount > 0 ||
            analysis.error
          ) {
            results.push(analysis);
          }
        }
      }

      console.info(
        `[ProjectsPanelProvider] Analysis complete: ${analysisCount} analyzed`,
      );

      // Sort: not on default first, then by behind count
      results.sort((a, b) => {
        if (a.error && !b.error) return 1;
        if (!a.error && b.error) return -1;
        if (a.isOnDefaultBranch !== b.isOnDefaultBranch) {
          return a.isOnDefaultBranch ? 1 : -1;
        }
        return b.behindCount - a.behindCount;
      });

      setDefaultBranchRepos(results);

      const notOnDefault = results.filter(
        r => !r.isOnDefaultBranch && !r.error,
      ).length;
      const behind = results.filter(
        r => r.isOnDefaultBranch && r.behindCount > 0,
      ).length;

      console.info('[ProjectsPanelProvider] Summary:', {
        total: localRepositories.length,
        needsAttention: results.length,
        notOnDefault,
        behind,
      });

      return results;
    } catch (error) {
      console.error('[ProjectsPanelProvider] Analysis failed:', error);
      return [];
    } finally {
      setDefaultBranchAnalysisRunning(false);
    }
  }, [localRepositories]);

  // Fetch GitHub starred repositories
  const fetchStarredRepositories = useCallback(async () => {
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
  }, []);

  // Fetch GitHub projects (user repos + org repos)
  const fetchGitHubProjects = useCallback(async () => {
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
  }, []);

  // Fetch user collections
  const fetchCollections = useCallback(async () => {
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
  }, []);

  // Fetch GitHub data on mount (these will silently fail if not authenticated)
  useEffect(() => {
    void fetchStarredRepositories();
    void fetchGitHubProjects();
    void fetchCollections();
  }, [fetchStarredRepositories, fetchGitHubProjects, fetchCollections]);

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
    });

    return unsubscribe;
  }, []);

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

  // Listen for repository-selected events from GitHub panels (GitHubProjectsPanel, GitHubStarredPanel)
  useEffect(() => {
    // Handler to convert GitHubRepository to AlexandriaEntry-like object for ProjectInfoPanel
    const handleGitHubRepoSelected = (event: {
      payload?: { repository?: { name: string; owner: { login: string }; full_name: string; description?: string | null; html_url: string; private: boolean } };
    }) => {
      const repo = event.payload?.repository;
      if (repo) {
        console.info('[ProjectsPanelProvider] GitHub repository selected:', repo.full_name);
        // Create an AlexandriaEntry-like object with github metadata for remote repos
        const entry = {
          name: repo.name,
          path: '', // Empty path indicates remote-only repo
          remoteUrl: repo.html_url,
          github: {
            owner: repo.owner.login,
            name: repo.name,
          },
          description: repo.description,
          isPrivate: repo.private,
        } as unknown as AlexandriaEntry;
        setSelectedRepository(entry);
      } else {
        console.info('[ProjectsPanelProvider] GitHub repository deselected');
        setSelectedRepository(null);
      }
    };

    const unsub1 = events.on('industry-theme.github-projects:repository-selected', handleGitHubRepoSelected);
    const unsub2 = events.on('industry-theme.github-starred:repository-selected', handleGitHubRepoSelected);

    return () => {
      unsub1();
      unsub2();
    };
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

  // Explicit DataSlice: alexandriaRepositories
  const alexandriaRepositoriesSlice = useMemo<DataSlice<{
    repositories: AlexandriaEntry[];
    discoveredRepositories: DiscoveredRepository[];
    loading: boolean;
  }>>(
    () => ({
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
    }),
    [localRepositories, discoveredRepositories, localRepositoriesLoading, baseDefaultDirectory],
  );

  // Explicit DataSlice: workspaces
  const workspacesSlice = useMemo<DataSlice<WorkspacesSlice>>(
    () => ({
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
    }),
    [workspaces, defaultWorkspaceId, workspacesLoading],
  );

  // Explicit DataSlice: workspace
  const workspaceSlice = useMemo<DataSlice<{
    workspace: Workspace | null;
    loading: boolean;
  }>>(
    () => ({
      scope: 'workspace' as const,
      name: 'workspace',
      data: {
        workspace: selectedWorkspace,
        loading: false,
      },
      loading: false,
      error: null,
      refresh: async () => {
        // No-op, workspace is selected by user
      },
    }),
    [selectedWorkspace],
  );

  // Explicit DataSlice: githubStarred
  const githubStarredSlice = useMemo<DataSlice<GitHubStarredSlice>>(
    () => ({
      scope: 'global' as const,
      name: 'githubStarred',
      data: {
        repositories: starredRepositories,
        loading: starredLoading,
        error: starredError,
      } as GitHubStarredSlice,
      loading: starredLoading,
      error: starredError ? new Error(starredError) : null,
      refresh: fetchStarredRepositories,
    }),
    [starredRepositories, starredLoading, starredError, fetchStarredRepositories],
  );

  // Explicit DataSlice: githubProjects
  const githubProjectsSlice = useMemo<DataSlice<GitHubProjectsSlice>>(
    () => ({
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
      error: projectsError ? new Error(projectsError) : null,
      refresh: fetchGitHubProjects,
    }),
    [
      userRepositories,
      organizations,
      orgRepositories,
      projectsLoading,
      projectsError,
      currentUser,
      fetchGitHubProjects,
    ],
  );

  // Explicit DataSlice: userCollections
  const userCollectionsSlice = useMemo<DataSlice<UserCollectionsSlice>>(
    () => ({
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
      error: collectionsError ? new Error(collectionsError) : null,
      refresh: fetchCollections,
    }),
    [
      collections,
      collectionMemberships,
      collectionsLoading,
      collectionsSaving,
      collectionsError,
      collectionsGitHubRepoExists,
      collectionsGitHubRepoUrl,
      fetchCollections,
    ],
  );

  // Explicit DataSlice: collectionRepositories
  const _collectionRepositoriesSlice = useMemo<DataSlice<unknown>>(
    () => ({
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
    }),
    [selectedCollection, collectionMemberships, collectionsLoading, fetchCollections],
  );

  // Explicit DataSlice: gitStatusWithFiles
  const gitStatusWithFilesSlice = useMemo<DataSlice<GitStatusWithFiles | null>>(
    () => ({
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
    }),
    [gitStatusWithFiles, gitStatusLoading, selectedRepository],
  );

  // Empty slices Map for backward compatibility with PanelContextValue interface
  const slices = useMemo<Map<string, DataSlice>>(() => new Map(), []);

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

      removeLocalRepository: async (name: string, deleteLocal: boolean) => {
        console.info(
          '[ProjectsPanelProvider] Removing local repository:',
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
      selectRepository: async (entry: AlexandriaEntry) => {
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

      // openLocalRepository - accepts AlexandriaEntry as required by LocalProjectsPanelActions
      openLocalRepository: async (entry: AlexandriaEntry) => {
        const tracer = getTracer('principal-ade-principal-window');
        const span = tracer.startSpan('alexandria.action.open_local_repository');
        span.setAttributes({
          repository_name: entry.name,
          repository_path: entry.path,
        });

        // Record user action event
        span.addEvent('alexandria.user.project_opened', {
          project_name: entry.name,
          had_previous_open: !!entry.lastOpenedAt,
        });

        console.info(
          '[ProjectsPanelProvider] Opening local repository:',
          entry.name,
        );

        // Also select the repository for the info panel
        setSelectedRepository(entry);

        // Note: lastOpenedAt is updated centrally in openDevWorkspaceWindow
        await WindowService.openDevWorkspace({
          alexandriaEntry: entry,
        });

        span.addEvent('alexandria.window.dev_workspace_opened', {
          repository_name: entry.name,
        });
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();

        events.emit({
          type: 'repository:opened',
          source: 'projects-view',
          timestamp: Date.now(),
          payload: { repositoryId: entry.name, repository: entry },
        });
      },

      // openRepository - for GitHub panels (takes string path)
      openRepository: async (localPath: string) => {
        const tracer = getTracer('principal-ade-principal-window');
        const span = tracer.startSpan('alexandria.action.open_local_repository');

        // Find the local repo entry by path
        const entry = localRepositories.find((r) => r.path === localPath);
        if (!entry) {
          console.error(
            '[ProjectsPanelProvider] Could not find repository at path:',
            localPath,
          );
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: 'Repository not found',
          });
          span.end();
          return;
        }

        span.setAttributes({
          repository_name: entry.name,
          repository_path: entry.path,
        });

        // Record user action event
        span.addEvent('alexandria.user.project_opened', {
          project_name: entry.name,
          had_previous_open: !!entry.lastOpenedAt,
        });

        console.info(
          '[ProjectsPanelProvider] Opening repository from path:',
          entry.name,
        );

        // Also select the repository for the info panel
        setSelectedRepository(entry);

        // Note: lastOpenedAt is updated centrally in openDevWorkspaceWindow
        await WindowService.openDevWorkspace({
          alexandriaEntry: entry,
        });

        span.addEvent('alexandria.window.dev_workspace_opened', {
          repository_name: entry.name,
        });
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();

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

      // removeRepositoryFromCollection - from UserCollectionsPanelActions
      removeRepositoryFromCollection: async (
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
        repositoryMetadata: RepositoryMetadata,
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
          const github = repositoryMetadata?.github as { owner?: string } | undefined;
          const repositoryId =
            github?.owner && repositoryMetadata?.name
              ? `${github.owner}/${repositoryMetadata.name}`
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

      // Stale repo review actions
      getStaleRepos,
      getRandomStaleRepo,

      snoozeStaleRepo: async (repoName: string) => {
        console.info('[ProjectsPanelProvider] Snoozing stale repo:', repoName);
        const snoozeUntil = Date.now() + staleRepoPrefs.snoozeDurationDays * 24 * 60 * 60 * 1000;
        const updatedSnoozed = {
          ...staleRepoPrefs.snoozedRepos,
          [repoName]: snoozeUntil,
        };

        await UserPreferencesService.updatePreferences({
          staleRepoReview: {
            ...staleRepoPrefs,
            snoozedRepos: updatedSnoozed,
          },
        });

        // Update local state
        setStaleRepoPrefs((prev) => ({
          ...prev,
          snoozedRepos: updatedSnoozed,
        }));

        // Remove from stale repos list
        setStaleRepos((prev) => prev.filter((r) => r.entry.name !== repoName));
      },

      deleteStaleRepo: async (repoName: string) => {
        console.info('[ProjectsPanelProvider] Deleting stale repo:', repoName);
        // Delete from disk (deleteLocal = true)
        await AlexandriaService.removeRepository(repoName, true);

        // Remove from stale repos list
        setStaleRepos((prev) => prev.filter((r) => r.entry.name !== repoName));

        // Refresh local repositories
        const repos = await AlexandriaService.getRepositories();
        setLocalRepositories(repos);
      },

      getStaleRepoCount: () => staleRepos.length,

      shouldShowStaleBadge: () => {
        // Only show badge once per day
        const today = new Date().toISOString().split('T')[0];
        if (staleRepoPrefs.lastBadgeShownDate === today) {
          return false;
        }
        return staleRepos.length > 0;
      },

      // Default branch analysis actions
      analyzeDefaultBranchStatus,

      getDefaultBranchRepoCount: () => defaultBranchRepos.length,

      clearDefaultBranchAnalysis: () => {
        console.info('[ProjectsPanelProvider] Clearing default branch analysis');
        setDefaultBranchRepos([]);
      },

      // File City image action
      getFileCityImage: async (repoPath: string) => {
        return FileCityImageService.getImage(repoPath);
      },
    }),
    [events, selectedWorkspace, localRepositories, fetchStarredRepositories, fetchGitHubProjects, fetchCollections, getStaleRepos, getRandomStaleRepo, staleRepoPrefs, staleRepos, analyzeDefaultBranchStatus, defaultBranchRepos],
  );

  // Create context value following web-ade pattern
  const context: PanelContextValue<ProjectsPanelContextType> = useMemo(
    () => ({
      // PanelContextValue core properties
      currentScope: {
        type: 'workspace' as const,
        workspace: selectedWorkspace
          ? {
              id: selectedWorkspace.id,
              name: selectedWorkspace.name,
              path: selectedWorkspace.suggestedClonePath || '',
            }
          : undefined,
        // Pass full selectedRepository (AlexandriaEntry) instead of just {name, path}
        // This allows panels like ProjectInfoPanel to use openRepository action
        // AlexandriaEntry is compatible with RepositoryMetadata (has name, path, and index signature allows extras)
        repository: (selectedRepository as unknown as RepositoryMetadata) || undefined,
      },
      slices,
      adapters: {},
      isSliceLoading: (
        _name: string,
        _scope?: 'workspace' | 'repository',
      ): boolean => {
        // No-op: Moving away from dynamic slice checking
        // Panels should access typed properties directly (context.userCollections.loading)
        return false;
      },
      refresh: async (
        _scope?: 'workspace' | 'repository',
        _sliceName?: string,
      ): Promise<void> => {
        // No-op: Actions handle their own data refreshing
        // React's reactivity handles UI updates automatically
        // Any actual refresh should be triggered via actions, not context.refresh()
      },
      // Custom state properties
      selectedWorkspace,
      setSelectedWorkspace,
      selectedCollection,
      setSelectedCollection,
      staleRepos,
      defaultBranchRepos,
      defaultBranchAnalysisRunning,
      // Explicit typed slice properties
      alexandriaRepositories: alexandriaRepositoriesSlice,
      workspaces: workspacesSlice,
      workspace: workspaceSlice,
      githubProjects: githubProjectsSlice,
      githubStarred: githubStarredSlice,
      userCollections: userCollectionsSlice,
      gitStatusWithFiles: gitStatusWithFilesSlice,
    }),
    [
      slices,
      selectedWorkspace,
      selectedCollection,
      selectedRepository,
      staleRepos,
      defaultBranchRepos,
      defaultBranchAnalysisRunning,
      alexandriaRepositoriesSlice,
      workspacesSlice,
      workspaceSlice,
      githubProjectsSlice,
      githubStarredSlice,
      userCollectionsSlice,
      gitStatusWithFilesSlice,
    ],
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
