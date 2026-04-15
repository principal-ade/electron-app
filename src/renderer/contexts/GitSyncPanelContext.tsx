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
import type {
  UserProfileSlice,
  UserProfilePanelActions,
  GitHubRepository,
} from '@industry-theme/alexandria-panels';
import type { GitHubSocialSliceData, PresenceSliceData } from '@industry-theme/git-sync-panels';
import type {
  GitHubUser as LocalGitHubUser,
  GitHubOrganization as LocalGitHubOrganization,
  GitHubOrgMember as LocalGitHubOrgMember,
  GitHubRepository as LocalGitHubRepository,
} from '../../shared/main-process-api-interfaces/GitHubAPI';
import type {
  UserPresence as LocalUserPresence,
  RepositorySession,
} from '../../shared/main-process-api-interfaces/PresenceAPI';
import { GithubService } from '../main-process-api/GithubService';
import { PresenceService } from '../main-process-api/PresenceService';
import { ApiProxyService } from '../main-process-api/ApiProxyService';
import { useGitSyncConnection } from '../hooks/useGitSyncConnection';
import { useAuthState } from '../hooks/useAuthState';
import { SecureAuthService } from '../services/SecureAuthService';

// Local types that match the package's expected structure
interface SocialData {
  following: LocalGitHubUser[];
  followers: LocalGitHubUser[];
  organizations: LocalGitHubOrganization[];
  orgMembers: Map<string, LocalGitHubOrgMember[]>;
}

// Types for user activity API response
export interface UserActivityResponse {
  user: {
    login: string;
    name: string | null;
    avatarUrl: string;
    followersCount: number;
  };
  activity: ActivityEvent[];
  contributions: DailyContribution[];
}

export interface ActivityEvent {
  id: string;
  type: 'commit' | 'pr_merged' | 'pr_opened' | 'issue_opened';
  timestamp: string;
  repository: string;
  repositoryUrl?: string;
  ownerType?: 'User' | 'Organization';
  isPrivate?: boolean;
  title?: string;
  url?: string;
  metadata?: {
    commitCount?: number;
    additions?: number;
    deletions?: number;
    prNumber?: number;
    issueNumber?: number;
    isClosed?: boolean;
    closedBy?: string;
    reactions?: ReactionCounts;
  };
}

export interface DailyContribution {
  date: string;
  count: number;
}

interface ReactionCounts {
  totalCount: number;
  counts: Partial<Record<ReactionContent, number>>;
  viewerReactions: Partial<Record<ReactionContent, number>>;
  users: Partial<Record<ReactionContent, string[]>>;
}

type ReactionContent =
  | 'THUMBS_UP'
  | 'THUMBS_DOWN'
  | 'LAUGH'
  | 'HOORAY'
  | 'CONFUSED'
  | 'HEART'
  | 'ROCKET'
  | 'EYES';

// Selected user profile data for the UserProfilePanel
interface SelectedUserProfile {
  user: LocalGitHubUser | null;
  organizations: LocalGitHubOrganization[];
  starredRepositories: LocalGitHubRepository[];
  presence?: {
    status: 'online' | 'away' | 'offline';
    lastSeen?: number;
    statusMessage?: string;
    activeRepository?: string;
  };
}

/**
 * GitSync context type - contains only slice properties
 * Following the web-ade pattern
 */
export interface GitSyncPanelContextType {
  // All explicit slices for GitSync
  githubSocial: DataSlice<GitHubSocialSliceData>;
  presence: DataSlice<PresenceSliceData>;
  userProfile: DataSlice<UserProfileSlice>;
  userActivity: DataSlice<UserActivityResponse | null>;
  currentProjects: DataSlice<unknown>;
}

/**
 * Extended actions for GitSyncPanelProvider
 */
interface GitSyncPanelActions extends PanelActions, UserProfilePanelActions {
  login?: () => Promise<void>;
  toggleVisibility?: () => Promise<void>;
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
  // Additional UserProfilePanel actions
  selectUser?: (username: string) => Promise<void>;
  openInBrowser?: (url: string) => Promise<void>;
}

/**
 * Provider value containing context, actions, and events
 */
interface GitSyncPanelProviderValue {
  context: PanelContextValue<GitSyncPanelContextType>;
  actions: GitSyncPanelActions;
  events: PanelEventEmitter;
  /** Whether connected to presence server (for conditional panel rendering) */
  isConnected: boolean;
}

const GitSyncPanelContext = createContext<GitSyncPanelProviderValue | null>(
  null,
);

interface GitSyncPanelProviderProps {
  children: ReactNode;
}

export const GitSyncPanelProvider: React.FC<GitSyncPanelProviderProps> = ({
  children,
}) => {
  // Initialize event bus
  const events = useMemo(() => new PanelEventBus(), []);

  // Auth state
  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    isLoggingIn,
    login,
    loginError,
    user,
  } = useAuthState();

  // Connection state
  const { isConnected } = useGitSyncConnection();

  // Visibility state
  const [isVisible, setIsVisible] = useState(true);

  // Social data state
  const [socialData, setSocialData] = useState<SocialData>({
    following: [],
    followers: [],
    organizations: [],
    orgMembers: new Map(),
  });
  const [socialDataLoading, setSocialDataLoading] = useState(false);
  const [socialDataError, setSocialDataError] = useState<string | null>(null);

  // Presence data state
  const [presenceData, setPresenceData] = useState<LocalUserPresence[]>([]);
  const [presenceLoading, setPresenceLoading] = useState(false);

  // Current user's open projects (for current-projects slice)
  const [currentUserSessions, setCurrentUserSessions] = useState<
    RepositorySession[]
  >([]);
  const [activeRepository, setActiveRepository] = useState<
    string | undefined
  >();

  // Selected user profile state (for UserProfilePanel)
  const [selectedUserProfile, setSelectedUserProfile] =
    useState<SelectedUserProfile>({
      user: null,
      organizations: [],
      starredRepositories: [],
    });
  const [selectedUserLoading, setSelectedUserLoading] = useState(false);
  const [selectedUserError, setSelectedUserError] = useState<string | null>(
    null,
  );

  // Selected user activity state (for UserFeedPanel)
  const [selectedUserActivity, setSelectedUserActivity] =
    useState<UserActivityResponse | null>(null);
  const [selectedUserActivityLoading, setSelectedUserActivityLoading] =
    useState(false);
  const [selectedUserActivityError, setSelectedUserActivityError] =
    useState<string | null>(null);

  // Fetch social data when authenticated
  const fetchSocialData = useCallback(async () => {
    if (!isAuthenticated) {
      setSocialData({
        following: [],
        followers: [],
        organizations: [],
        orgMembers: new Map(),
      });
      return;
    }

    setSocialDataLoading(true);
    setSocialDataError(null);

    try {
      // Fetch following, followers, and organizations in parallel
      const [following, followers, organizations] = await Promise.all([
        GithubService.getUserFollowing(),
        GithubService.getUserFollowers(),
        GithubService.getUserOrganizations(),
      ]);

      // Fetch members for each organization
      const orgMembersMap = new Map<string, LocalGitHubOrgMember[]>();
      await Promise.all(
        organizations.map(async (org: LocalGitHubOrganization) => {
          try {
            const members = await GithubService.getOrgMembers(org.login);
            orgMembersMap.set(org.login, members);
          } catch (err) {
            console.error(
              `[GitSyncPanelContext] Failed to load members for ${org.login}`,
              err,
            );
          }
        }),
      );

      setSocialData({
        following: following as LocalGitHubUser[],
        followers: followers as LocalGitHubUser[],
        organizations: organizations as LocalGitHubOrganization[],
        orgMembers: orgMembersMap,
      });
    } catch (err) {
      console.error('[GitSyncPanelContext] Failed to load social data', err);
      setSocialDataError(
        err instanceof Error
          ? err.message
          : 'Failed to load social data from GitHub.',
      );
    } finally {
      setSocialDataLoading(false);
    }
  }, [isAuthenticated]);

  // Fetch social data when auth state changes
  useEffect(() => {
    if (isAuthenticated) {
      void fetchSocialData();
    }
  }, [isAuthenticated, fetchSocialData]);

  // Fetch selected user's profile data
  const fetchUserProfile = useCallback(async (username: string) => {
    setSelectedUserLoading(true);
    setSelectedUserError(null);

    try {
      // Fetch user profile, their organizations, and starred repos in parallel
      const [userProfile, userOrgs, userStarred] = await Promise.all([
        GithubService.getUser(username),
        GithubService.getUserOrganizationsForUser(username),
        GithubService.getUserStarredRepositoriesForUser(username),
      ]);

      setSelectedUserProfile({
        user: userProfile as LocalGitHubUser,
        organizations: userOrgs as LocalGitHubOrganization[],
        starredRepositories: userStarred as LocalGitHubRepository[],
        // Note: presence will be updated separately when presence data changes
      });
    } catch (err) {
      console.error('[GitSyncPanelContext] Failed to load user profile:', err);
      setSelectedUserError(
        err instanceof Error
          ? err.message
          : 'Failed to load user profile from GitHub.',
      );
    } finally {
      setSelectedUserLoading(false);
    }
  }, []); // No dependencies - doesn't need presence data during fetch

  // Fetch selected user's activity data from principal-ade API
  const fetchUserActivity = useCallback(async (username: string) => {
    setSelectedUserActivityLoading(true);
    setSelectedUserActivityError(null);

    try {
      // Get the GitHub token for auth
      const authService = SecureAuthService.getInstance();
      const authResult = await authService.checkAuth();

      if (!authResult.authenticated || !authResult.token) {
        throw new Error('Not authenticated with GitHub');
      }

      // Use ApiProxyService to avoid CORS issues
      const result = await ApiProxyService.call<UserActivityResponse>({
        endpoint: `https://app.principal-ade.com/api/github/user/${username}/activity`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authResult.token}`,
        },
      });

      if (!result.success || !result.data) {
        throw new Error(result.error ?? `Failed to fetch user activity: ${result.status}`);
      }

      setSelectedUserActivity(result.data);
    } catch (err) {
      console.error('[GitSyncPanelContext] Failed to load user activity:', err);
      setSelectedUserActivityError(
        err instanceof Error
          ? err.message
          : 'Failed to load user activity.',
      );
    } finally {
      setSelectedUserActivityLoading(false);
    }
  }, []);

  // Fetch and subscribe to presence data
  useEffect(() => {
    if (!isConnected) {
      setPresenceData([]);
      setCurrentUserSessions([]);
      setActiveRepository(undefined);
      return;
    }

    const fetchPresence = async () => {
      setPresenceLoading(true);
      try {
        const data = await PresenceService.getUsers();
        const users = (data.users || []) as LocalUserPresence[];
        setPresenceData(users);

        // Extract current user's sessions for the current-projects slice
        if (user?.login) {
          const currentUserPresence = users.find(
            (u) => u.userId === user.login || u.userId === String(user.id),
          );
          if (currentUserPresence) {
            setCurrentUserSessions(currentUserPresence.openRepositories || []);
            setActiveRepository(currentUserPresence.activeRepository);
          } else {
            setCurrentUserSessions([]);
            setActiveRepository(undefined);
          }
        }
      } catch (err) {
        console.error('[GitSyncPanelContext] Failed to fetch presence:', err);
      } finally {
        setPresenceLoading(false);
      }
    };

    // Initial fetch
    void fetchPresence();

    // Subscribe to presence updates
    const unsubscribe = PresenceService.onPresenceEvent(() => {
      // Refetch presence data when any presence event occurs
      void fetchPresence();
    });

    return () => {
      unsubscribe();
    };
  }, [isConnected, user]);

  // Listen for user selection events from GitHubSocialPanel
  useEffect(() => {
    const unsubscribe = events.on('user:selected', (event) => {
      const { username } = event.payload as { username: string };
      if (username) {
        void fetchUserProfile(username);
        void fetchUserActivity(username);
      }
    });

    return unsubscribe;
  }, [events, fetchUserProfile, fetchUserActivity]);

  // Handle visibility toggle
  const handleVisibilityToggle = useCallback(async () => {
    try {
      const newVisibility = !isVisible;
      const result = await PresenceService.setVisibility(newVisibility);
      if (result.success) {
        setIsVisible(newVisibility);
      } else {
        console.error(
          '[GitSyncPanelContext] Failed to set visibility:',
          result.message,
        );
      }
    } catch (err) {
      console.error('[GitSyncPanelContext] Failed to set visibility:', err);
    }
  }, [isVisible]);

  // Handle connect
  const handleConnect = useCallback(async () => {
    try {
      const authService = SecureAuthService.getInstance();
      const authResult = await authService.checkAuth();

      if (!authResult.authenticated || !authResult.token) {
        console.error(
          '[GitSyncPanelContext] Cannot connect: not authenticated',
        );
        return;
      }

      const result = await PresenceService.connectToPresence(authResult.token);
      if (!result.success) {
        console.error('[GitSyncPanelContext] Failed to connect:', result.error);
      }
    } catch (err) {
      console.error('[GitSyncPanelContext] Failed to connect:', err);
    }
  }, []);

  // Explicit DataSlice: githubSocial
  const githubSocialSlice = useMemo<DataSlice<GitHubSocialSliceData>>(
    () => ({
      scope: 'global' as const,
      name: 'github-social',
      data: {
        isAuthenticated: isAuthenticated ?? false,
        isAuthLoading,
        isLoggingIn: isLoggingIn ?? false,
        loginError: loginError ?? null,
        user: user as GitHubSocialSliceData['user'],
        socialData: socialData as GitHubSocialSliceData['socialData'],
        isLoading: socialDataLoading,
        error: socialDataError,
      },
      loading: socialDataLoading || isAuthLoading,
      error: socialDataError ? new Error(socialDataError) : null,
      refresh: fetchSocialData,
    }),
    [
      isAuthenticated,
      isAuthLoading,
      isLoggingIn,
      loginError,
      user,
      socialData,
      socialDataLoading,
      socialDataError,
      fetchSocialData,
    ],
  );

  // Explicit DataSlice: presence
  const presenceSlice = useMemo<DataSlice<PresenceSliceData>>(
    () => ({
      scope: 'global' as const,
      name: 'presence',
      data: {
        isConnected,
        isVisible,
        users: presenceData,
      },
      loading: presenceLoading,
      error: null,
      refresh: async () => {
        if (isConnected) {
          setPresenceLoading(true);
          try {
            const data = await PresenceService.getUsers();
            setPresenceData((data.users || []) as LocalUserPresence[]);
          } catch (err) {
            console.error(
              '[GitSyncPanelContext] Failed to refresh presence:',
              err,
            );
          } finally {
            setPresenceLoading(false);
          }
        }
      },
    }),
    [isConnected, isVisible, presenceData, presenceLoading],
  );

  // Explicit DataSlice: userProfile
  const userProfileSlice = useMemo<DataSlice<UserProfileSlice>>(
    () => ({
      scope: 'global' as const,
      name: 'userProfile',
      data: {
        user: selectedUserProfile.user,
        collections: [], // Collections managed by ProjectsPanelContext
        repositories: [], // Repositories managed by ProjectsPanelContext
        starredRepositories: selectedUserProfile.starredRepositories,
        presence: selectedUserProfile.presence,
        loading: selectedUserLoading,
        error: selectedUserError ?? undefined,
      },
      loading: selectedUserLoading,
      error: selectedUserError ? new Error(selectedUserError) : null,
      refresh: async () => {
        if (selectedUserProfile.user?.login) {
          await fetchUserProfile(selectedUserProfile.user.login);
        }
      },
    }),
    [
      selectedUserProfile,
      selectedUserLoading,
      selectedUserError,
      fetchUserProfile,
    ],
  );

  // Explicit DataSlice: userActivity
  const userActivitySlice = useMemo<DataSlice<UserActivityResponse | null>>(
    () => ({
      scope: 'global' as const,
      name: 'userActivity',
      data: selectedUserActivity,
      loading: selectedUserActivityLoading,
      error: selectedUserActivityError
        ? new Error(selectedUserActivityError)
        : null,
      refresh: async () => {
        if (selectedUserActivity?.user?.login) {
          await fetchUserActivity(selectedUserActivity.user.login);
        }
      },
    }),
    [
      selectedUserActivity,
      selectedUserActivityLoading,
      selectedUserActivityError,
      fetchUserActivity,
    ],
  );

  // Explicit DataSlice: currentProjects
  const currentProjectsSlice = useMemo<DataSlice<unknown>>(
    () => ({
      scope: 'global' as const,
      name: 'current-projects',
      data: {
        projects: currentUserSessions.map((session) => ({
          ...session,
          agentId: 'desktop-client',
          clientType: 'desktop' as const,
        })),
        activeProject: activeRepository,
        currentActivity: undefined, // TODO: Add activity tracking
        isLoading: presenceLoading,
        error: null,
      },
      loading: presenceLoading,
      error: null,
      refresh: async () => {
        // Presence data refreshes automatically via subscription
        console.info(
          '[GitSyncPanelContext] Current projects slice refresh triggered',
        );
      },
    }),
    [currentUserSessions, activeRepository, presenceLoading],
  );

  // Empty slices Map for backward compatibility with PanelContextValue interface
  const slices = useMemo<Map<string, DataSlice<unknown>>>(() => new Map(), []);

  // Define actions
  const actions: GitSyncPanelActions = useMemo(
    () => ({
      openFile: (filePath: string) => {
        events.emit({
          type: 'file:opened',
          source: 'git-sync-view',
          timestamp: Date.now(),
          payload: { filePath },
        });
      },

      navigateToPanel: (panelId: string) => {
        events.emit({
          type: 'panel:focus',
          source: 'git-sync-view',
          timestamp: Date.now(),
          payload: { panelId },
        });
      },

      login: async () => {
        await login();
      },

      toggleVisibility: handleVisibilityToggle,

      connect: handleConnect,

      // UserProfilePanel actions
      selectUser: async (username: string) => {
        await fetchUserProfile(username);
      },

      viewOrganization: async (orgLogin: string) => {
        // Emit event for navigation - host app can handle this
        events.emit({
          type: 'organization:selected',
          source: 'git-sync-view',
          timestamp: Date.now(),
          payload: { orgLogin },
        });
      },

      viewRepository: async (owner: string, repo: string) => {
        // Emit event for navigation - host app can handle this
        events.emit({
          type: 'repository:selected',
          source: 'git-sync-view',
          timestamp: Date.now(),
          payload: { owner, repo },
        });
      },

      cloneRepository: async (repository: GitHubRepository) => {
        events.emit({
          type: 'github:clone-requested',
          source: 'git-sync-view',
          timestamp: Date.now(),
          payload: { repository },
        });
      },

      openInBrowser: async (url: string) => {
        window.open(url, '_blank');
      },
    }),
    [events, login, handleVisibilityToggle, handleConnect, fetchUserProfile],
  );

  // Create context value following web-ade pattern
  const context: PanelContextValue<GitSyncPanelContextType> = useMemo(
    () => ({
      // PanelContextValue core properties
      currentScope: {
        type: 'workspace' as const,
        workspace: undefined,
        repository: undefined,
      },
      slices,
      adapters: {},
      isSliceLoading: () => false,
      refresh: async () => {
        // No-op: Actions handle refreshing, React handles reactivity
      },
      // Typed slice properties for direct access (all explicit slices)
      githubSocial: githubSocialSlice,
      presence: presenceSlice,
      userProfile: userProfileSlice,
      userActivity: userActivitySlice,
      currentProjects: currentProjectsSlice,
    }),
    [slices, githubSocialSlice, presenceSlice, userProfileSlice, userActivitySlice, currentProjectsSlice],
  );

  // Combine into provider value
  const value: GitSyncPanelProviderValue = useMemo(
    () => ({
      context,
      actions,
      events,
      isConnected,
    }),
    [context, actions, events, isConnected],
  );

  return (
    <GitSyncPanelContext.Provider value={value}>
      {children}
    </GitSyncPanelContext.Provider>
  );
};

export const useGitSyncPanelProvider = (): GitSyncPanelProviderValue => {
  const value = useContext(GitSyncPanelContext);
  if (!value) {
    throw new Error(
      'useGitSyncPanelProvider must be used within a GitSyncPanelProvider',
    );
  }
  return value;
};

export default GitSyncPanelContext;
