/**
 * FeedPanelFramework
 *
 * Panel framework for the FeedView, using ConfigurablePanelLayout
 * similar to DevWorkspacePanelFramework but simplified for the feed context.
 *
 * Layout:
 * - Left: ProjectsListPanel (repository list with filtering)
 * - Middle: TabbedTerminalPanel (terminal in HOME directory)
 * - Right: DetailsTabbedPanel (activity feed, profiles, etc.)
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { GitCommit, Users, Activity, FolderGit2, User, Building2 } from 'lucide-react';
import { SegmentedControl } from '../components/SegmentedControl';
import {
  ConfigurablePanelLayout,
  type PanelLayout,
  type ConfigurablePanelLayoutHandle,
} from '@principal-ade/panel-layouts';
import type { PanelEventEmitter, RepositoryMetadata } from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import {
  TerminalProvider,
  useTerminalProvider,
  useTerminalActivity,
} from '../contexts/TerminalContext';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import {
  TabbedTerminalPanel,
  type TerminalTab,
  type TerminalWorkingState,
  type TerminalPanelActions,
  type BaseTab,
} from '@industry-theme/xterm-terminal-panel';
import { ProjectsListPanel } from '../panels/ProjectsListPanel';
import { WatchedItemsPanel } from '../panels/WatchedItemsPanel';
import { ActivityFeedCardPanel } from '../panels/ActivityFeedCardPanel';
import { ReviewCommitPanel } from '../panels/ReviewCommitPanel';
import { RepositoryProfilePanel, type RepositoryProfileData } from '../panels/RepositoryProfilePanel';
import { LiveActivityTabContent } from '../components/LiveActivityTabContent';
import { OrganizationsListPanel } from '../panels/OrganizationsListPanel';
import { CoworkersListPanel } from '../panels/CoworkersListPanel';
import {
  UserProfilePanel,
  type UserProfilePanelContext,
  type UserProfilePanelActions,
} from '../panels/UserProfilePanel';
import {
  OrgProfilePanel,
  type OrgProfilePanelContext,
  type OrgProfilePanelActions,
} from '../panels/OrgProfilePanel';
import { useActivityFeed } from '../hooks/useActivityFeed';
import { useCommitHeatMap } from '../hooks/useCommitHeatMap';
import type { CommitTimestamp } from '../panels/ProjectsListPanel';
import type { ActivityCommit } from '../hooks/useActivityFeed';
import { GithubService } from '../main-process-api/GithubService';
import { ApiProxyService } from '../main-process-api/ApiProxyService';
import { PathsFileTreeBuilder } from '@principal-ai/repository-abstraction';
import { SecureAuthService } from '../services/SecureAuthService';
import { WebAdeService } from '../main-process-api/WebAdeService';

/**
 * User activity response from Principal ADE API
 */
interface UserActivityResponse {
  user: {
    login: string;
    name: string | null;
    avatarUrl: string;
    followersCount: number;
  };
  activity: Array<{
    id: string;
    type: 'commit' | 'pr_merged' | 'pr_opened' | 'issue_opened';
    timestamp: string;
    repository: string;
    metadata?: {
      commitCount?: number;
      additions?: number;
      deletions?: number;
    };
  }>;
  contributions: Array<{
    date: string;
    count: number;
  }>;
  contributedRepos?: Array<{
    nameWithOwner: string;
    owner: string;
    name: string;
    commitCount: number;
    lastContributedAt: string;
  }>;
}

/**
 * Commit review tab - displays diff for a specific commit
 */
export interface CommitReviewTab extends BaseTab {
  contentType: 'commit-review';
  repoPath: string;
  repoName: string;
  commit: ActivityCommit;
}

/**
 * Live activity tab - displays real-time presence and repository activity
 */
export interface LiveActivityTab extends BaseTab {
  contentType: 'live-activity';
}

/**
 * Activity feed tab - displays the main activity feed with repository cards
 */
export interface ActivityFeedTab extends BaseTab {
  contentType: 'activity-feed';
}

/**
 * Project info tab - displays repository details with heatmap and file city
 */
export interface ProjectInfoTab extends BaseTab {
  contentType: 'project-info';
  repository: AlexandriaEntry;
}

/**
 * User profile tab - displays user activity and profile information
 */
export interface UserProfileTab extends BaseTab {
  contentType: 'user-profile';
  username: string;
  email?: string;
}

/**
 * Organization profile tab - displays org activity and profile information
 */
export interface OrgProfileTab extends BaseTab {
  contentType: 'org-profile';
  orgName: string;
}

/**
 * Union type of all supported tab types in FeedView
 */
export type FeedTab = TerminalTab | CommitReviewTab | LiveActivityTab | ActivityFeedTab | ProjectInfoTab | UserProfileTab | OrgProfileTab;

export interface FeedPanelFrameworkProps {
  /** List of repositories */
  repositories: AlexandriaEntry[];
  /** Collapsed state for left/right panels */
  collapsed: { left: boolean; right: boolean };
  /** Callback when collapsed state changes */
  onCollapsedChange: (collapsed: { left: boolean; right: boolean }) => void;
  /** Panel layout configuration */
  layout: PanelLayout;
  /** Callback when layout changes */
  onLayoutChange: (layout: PanelLayout) => void;
  /** Optional panel sizes */
  panelSizes?: { left: number; middle: number; right: number };
  /** Callback when panel sizes change */
  onPanelSizesChange?: (sizes: { left: number; middle: number; right: number }) => void;
  /** Event bus for panel communication */
  events: PanelEventEmitter;
  /** Callback to open a repository */
  onOpenRepository?: (entry: AlexandriaEntry) => void;
  /** Feed mode */
  feedMode?: 'my-activity' | 'watched-activity' | 'organizations' | 'coworkers';
  /** Callback when feed mode changes */
  onFeedModeChange?: (mode: 'my-activity' | 'watched-activity' | 'organizations' | 'coworkers') => void;
}

interface FeedPanelFrameworkInnerProps {
  repositories: AlexandriaEntry[];
  collapsed: { left: boolean; right: boolean };
  onCollapsedChange: (collapsed: { left: boolean; right: boolean }) => void;
  layout: PanelLayout;
  onLayoutChange: (layout: PanelLayout) => void;
  panelSizes?: { left: number; middle: number; right: number };
  onPanelSizesChange?: (sizes: { left: number; middle: number; right: number }) => void;
  events: PanelEventEmitter;
  onOpenRepository?: (entry: AlexandriaEntry) => void;
  feedMode?: 'my-activity' | 'watched-activity' | 'organizations' | 'coworkers';
  onFeedModeChange?: (mode: 'my-activity' | 'watched-activity' | 'organizations' | 'coworkers') => void;
}

/**
 * Wrapper component for repository profile tab content
 * Extracted to prevent remounting when switching tabs
 */
const RepositoryProfileTabContent: React.FC<{
  repository: AlexandriaEntry;
  events: PanelEventEmitter;
}> = ({ repository, events }) => {
  const [repositoryData, setRepositoryData] = React.useState<RepositoryProfileData | undefined>(undefined);
  const [loading, setLoading] = React.useState(true);

  // Use commit heatmap hook to get activity data
  const heatMapData = useCommitHeatMap(repository.path ?? null);

  React.useEffect(() => {
    let cancelled = false;

    const fetchRepositoryData = async () => {
      setLoading(true);

      try {
        const repo = repository;

        if (cancelled) return;

        // Transform activity data
        const activityData = new Map<string, number>();
        heatMapData.commits.forEach((commit) => {
          activityData.set(commit.date, commit.count);
        });

        // Calculate total commits
        let totalCommits = 0;
        activityData.forEach((count) => {
          totalCommits += count;
        });

        // Fetch full repository data from GitHub API if available
        let ownerType: 'User' | 'Organization' | undefined = undefined;
        let githubCreatedAt: string | undefined = undefined;
        let githubUpdatedAt: string | undefined = undefined;

        if (repo.github?.owner && repo.github?.name) {
          try {
            const githubRepo = await GithubService.getRepository(repo.github.owner, repo.github.name);
            console.log('[RepositoryProfileTab] Fetched GitHub repository:', githubRepo);
            console.log('[RepositoryProfileTab] Owner type:', githubRepo?.owner.type);
            console.log('[RepositoryProfileTab] Created at:', githubRepo?.created_at);
            ownerType = githubRepo?.owner.type;
            githubCreatedAt = githubRepo?.created_at;
            githubUpdatedAt = githubRepo?.updated_at;
          } catch (err) {
            console.warn('[RepositoryProfileTab] Failed to fetch GitHub repository:', err);
          }
        }

        const profileData: RepositoryProfileData = {
          name: repo.name,
          fullName: repo.github?.owner ? `${repo.github.owner}/${repo.github.name || repo.name}` : repo.name,
          owner: repo.github?.owner || 'local',
          ownerAvatarUrl: repo.github?.owner ? `https://github.com/${repo.github.owner}.png` : undefined,
          ownerType,
          description: repo.github?.description || undefined,
          language: undefined, // Not available in AlexandriaEntry
          stars: 0, // Not available for local repos
          forks: 0, // Not available for local repos
          watchers: 0, // Not available for local repos
          openIssues: 0, // Not available for local repos
          size: 0, // Could be calculated but not essential
          activityData,
          totalCommits: totalCommits || 0,
          defaultBranch: 'main', // Could fetch from git but using default
          createdAt: githubCreatedAt || repo.registeredAt || new Date().toISOString(),
          updatedAt: githubUpdatedAt || repo.lastOpenedAt || new Date().toISOString(),
          htmlUrl: repo.github?.owner && repo.github?.name
            ? `https://github.com/${repo.github.owner}/${repo.github.name}`
            : undefined,
          isPrivate: false,
          isLocal: true,
          localPath: repo.path || undefined,
          github: repo.github,
        };

        console.log('[RepositoryProfileTab] Final profile data with ownerType:', profileData.ownerType);

        setRepositoryData(profileData);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('[RepositoryProfileTab] Failed to fetch repository data:', err);
          setLoading(false);
        }
      }
    };

    fetchRepositoryData();

    return () => {
      cancelled = true;
    };
  }, [heatMapData.commits, repository]);

  console.log('[RepositoryProfileTab] heatMapData.commits length:', heatMapData.commits.length, 'repositoryData has activity?', !!repositoryData?.activityData?.size);

  // Create minimal context and actions
  // Memoize to prevent unnecessary re-renders and re-fetching
  const projectContext = React.useMemo(() => ({
    currentScope: {
      type: 'repository' as const,
      repository: (repositoryData || repository) as unknown as RepositoryMetadata
    },
    slices: new Map(),
    adapters: {},
    isSliceLoading: () => loading,
    refresh: async () => {},
    clearSlice: () => {},
  }), [repositoryData, repository, loading]);

  const projectActions = React.useMemo(() => ({
    openFile: async () => {},
    openRepository: async () => {},
    getLocalFileTree: (repoPath: string) => {
      return RepositoryMonitoringService.getFileTree(repoPath);
    },
    getRemoteFileTree: async (owner: string, name: string) => {
      try {
        // Get latest commit
        const latestCommit = await GithubService.getLatestCommit(owner, name);
        if (!latestCommit) {
          console.warn('[FeedPanelFramework] No commits found for', owner, name);
          return null;
        }

        // Get file tree at that commit
        const filePaths = await GithubService.getFileTreeAtCommit(owner, name, latestCommit.sha);

        // Build file tree from paths
        const builder = new PathsFileTreeBuilder();
        const fileTree = builder.build({
          files: filePaths,
          rootPath: name,
        });

        return fileTree;
      } catch (error) {
        console.error('[FeedPanelFramework] Failed to fetch remote file tree:', error);
        return null;
      }
    },
    getLineCounts: async (repoPath: string) => {
      // Use main process to get line counts
      if (window.mainProcess?.fileCityImage?.countLines) {
        return await window.mainProcess.fileCityImage.countLines(repoPath);
      }
      return {};
    },
  }), []);

  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <RepositoryProfilePanel
        context={projectContext}
        actions={projectActions}
        events={events}
      />
    </div>
  );
};

/**
 * Wrapper component for user profile tab content
 * Extracted to prevent remounting when switching tabs
 */
const UserProfileTabContent: React.FC<{
  username: string;
  email?: string;
  events: PanelEventEmitter;
  repositories: AlexandriaEntry[];
}> = ({ username, email, events, repositories }) => {
  // Memoize context to prevent unnecessary re-renders
  const userContext: UserProfilePanelContext = React.useMemo(() => ({
    currentScope: {
      type: 'workspace' as const,
      user: {
        username,
      },
    },
    refresh: async () => {},
  }), [username]);

  // Memoize actions to prevent re-fetching on every render
  const userActions: UserProfilePanelActions = React.useMemo(() => ({
    getUserProfile: async (username: string) => {
      const githubUser = await GithubService.getUser(username);

      if (!githubUser) {
        throw new Error('User not found');
      }

      const githubUserExtended = githubUser as typeof githubUser & {
        twitter_username?: string | null;
        blog?: string | null;
      };

      return {
        username: githubUser.login,
        name: githubUser.name || undefined,
        email: githubUser.email || email,
        avatarUrl: githubUser.avatar_url,
        bio: githubUser.bio || undefined,
        location: githubUser.location || undefined,
        company: githubUser.company || undefined,
        twitterHandle: githubUserExtended.twitter_username || undefined,
        websiteUrl: githubUserExtended.blog || undefined,
        activityData: new Map(),
        totalCommits: 0,
        totalRepos: githubUser.public_repos || 0,
        followers: githubUser.followers || 0,
        following: githubUser.following || 0,
        joinedDate: githubUser.created_at || new Date().toISOString(),
      };
    },

    getUserActivity: async (username: string) => {
      try {
        const authService = SecureAuthService.getInstance();
        const authResult = await authService.checkAuth();

        if (!authResult.authenticated || !authResult.token) {
          return new Map<string, number>();
        }

        const activityResult = await ApiProxyService.call<UserActivityResponse>({
          endpoint: `https://app.principal-ade.com/api/github/user/${username}/activity?contributionDays=365&activityDays=1`,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${authResult.token}`,
          },
        });

        const activityResponse = activityResult?.data;
        const activityData = new Map<string, number>();
        if (activityResponse?.contributions) {
          activityResponse.contributions.forEach((contrib: { date: string; count: number }) => {
            activityData.set(contrib.date, contrib.count);
          });
        }

        return activityData;
      } catch (err) {
        console.error('Failed to fetch user activity:', err);
        return new Map<string, number>();
      }
    },

    getUserRepositories: async (username: string) => {
      try {
        const result = await GithubService.searchRepos(
          `user:${username} sort:updated`,
          { perPage: 50 }
        );

        return result.repos.map((repo) => {
          // Try to find matching local Alexandria entry
          const alexandriaEntry = repositories.find(
            entry => entry.github?.owner === repo.owner.login &&
                     entry.github?.name === repo.name
          );

          return {
            repoName: repo.name,
            repoPath: alexandriaEntry?.path,
            githubOwner: repo.owner.login,
            githubRepoName: repo.name,
            description: repo.description ?? undefined,
            language: repo.language ?? undefined,
            stars: repo.stargazers_count,
            createdAt: repo.created_at,
            isOwnerOrg: false,
            topContributors: [],
            alexandriaEntry,
          };
        });
      } catch (err) {
        console.error('Failed to fetch user repositories:', err);
        return [];
      }
    },

    getRepositoryFileTree: async (owner: string, repoName: string) => {
      try {
        const treeResponse = await WebAdeService.getGithubTree(owner, repoName, 'HEAD');
        const files = treeResponse.tree
          .filter((entry) => entry.type === 'blob')
          .map((entry) => entry.path);

        const builder = new PathsFileTreeBuilder();
        return builder.build({ files, rootPath: repoName });
      } catch (err) {
        console.error(`Failed to fetch file tree for ${owner}/${repoName}:`, err);
        return null;
      }
    },

    openFile: async () => {},
  }), [email, repositories]);

  return (
    <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
      <UserProfilePanel context={userContext} actions={userActions} events={events} />
    </div>
  );
};

/**
 * Wrapper component for org profile tab content
 * Extracted to prevent remounting when switching tabs
 */
const OrgProfileTabContent: React.FC<{
  orgName: string;
  events: PanelEventEmitter;
  repositories: AlexandriaEntry[];
}> = ({ orgName, events, repositories }) => {
  // Memoize context to prevent unnecessary re-renders
  const orgContext: OrgProfilePanelContext = React.useMemo(() => ({
    currentScope: {
      type: 'workspace' as const,
      org: {
        orgName,
      },
    },
    refresh: async () => {},
  }), [orgName]);

  // Memoize actions to prevent re-fetching on every render
  const orgActions: OrgProfilePanelActions = React.useMemo(() => ({
    getOrgProfile: async (orgName: string) => {
      const githubOrg = await GithubService.getUser(orgName);

      if (!githubOrg) {
        throw new Error('Organization not found');
      }

      const githubOrgExtended = githubOrg as typeof githubOrg & {
        twitter_username?: string | null;
        blog?: string | null;
      };

      let memberCount = 0;
      try {
        const members = await GithubService.getOrgMembers(orgName);
        memberCount = members.length;
      } catch (error) {
        console.warn(`Failed to fetch org members for ${orgName}:`, error);
      }

      return {
        orgName: githubOrg.login,
        name: githubOrg.name || undefined,
        email: githubOrg.email || undefined,
        avatarUrl: githubOrg.avatar_url,
        description: githubOrg.bio || undefined,
        location: githubOrg.location || undefined,
        twitterHandle: githubOrgExtended.twitter_username || undefined,
        websiteUrl: githubOrgExtended.blog || undefined,
        activityData: new Map(),
        totalCommits: 0,
        publicRepos: githubOrg.public_repos || 0,
        members: memberCount,
        createdDate: githubOrg.created_at || new Date().toISOString(),
      };
    },

    getOrgActivity: async (orgName: string) => {
      try {
        const authService = SecureAuthService.getInstance();
        const authResult = await authService.checkAuth();

        if (!authResult.authenticated || !authResult.token) {
          return new Map<string, number>();
        }

        const activityResult = await ApiProxyService.call<UserActivityResponse>({
          endpoint: `https://app.principal-ade.com/api/github/org/${orgName}/activity?contributionDays=365&activityDays=1`,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${authResult.token}`,
          },
        });

        const activityResponse = activityResult?.data;
        const activityData = new Map<string, number>();
        if (activityResponse?.contributions) {
          activityResponse.contributions.forEach((contrib: { date: string; count: number }) => {
            activityData.set(contrib.date, contrib.count);
          });
        }

        return activityData;
      } catch (err) {
        console.error('Failed to fetch org activity:', err);
        return new Map<string, number>();
      }
    },

    getOrgRepositories: async (orgName: string) => {
      try {
        const repos = await GithubService.getOrgRepositories(orgName, { perPage: 50 });

        return repos.map((repo) => {
          // Try to find matching local Alexandria entry
          const alexandriaEntry = repositories.find(
            entry => entry.github?.owner === repo.owner.login &&
                     entry.github?.name === repo.name
          );

          return {
            repoName: repo.name,
            repoPath: alexandriaEntry?.path,
            githubOwner: repo.owner.login,
            githubRepoName: repo.name,
            description: repo.description ?? undefined,
            language: repo.language ?? undefined,
            stars: repo.stargazers_count,
            createdAt: repo.created_at,
            isOwnerOrg: true,
            topContributors: [],
            alexandriaEntry,
          };
        });
      } catch (err) {
        console.error('Failed to fetch org repositories:', err);
        return [];
      }
    },

    getRepositoryFileTree: async (owner: string, repoName: string) => {
      try {
        const treeResponse = await WebAdeService.getGithubTree(owner, repoName, 'HEAD');
        const files = treeResponse.tree
          .filter((entry) => entry.type === 'blob')
          .map((entry) => entry.path);

        const builder = new PathsFileTreeBuilder();
        return builder.build({ files, rootPath: repoName });
      } catch (err) {
        console.error(`Failed to fetch file tree for ${owner}/${repoName}:`, err);
        return null;
      }
    },

    openFile: async () => {},
  }), [repositories]);

  return (
    <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
      <OrgProfilePanel context={orgContext} actions={orgActions} events={events} />
    </div>
  );
};

/**
 * Inner component that uses TerminalProvider context
 */
const FeedPanelFrameworkInner: React.FC<FeedPanelFrameworkInnerProps> = ({
  repositories,
  collapsed,
  onCollapsedChange,
  layout,
  onLayoutChange: _onLayoutChange,
  panelSizes,
  onPanelSizesChange,
  events,
  onOpenRepository,
  feedMode = 'my-activity',
  onFeedModeChange,
}) => {
  const { theme } = useTheme();
  const panelLayoutRef = useRef<ConfigurablePanelLayoutHandle>(null);

  // Terminal context
  const { context: terminalCtx, actions: terminalActions, activityActions } = useTerminalProvider();
  const { activities: terminalActivities } = useTerminalActivity();

  // Local collapsed state tracking
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(collapsed.left);

  // Base directory from user preferences
  const [baseDefaultDirectory, setBaseDefaultDirectory] = useState<string | null>(null);

  // Use refs for provider values to avoid recreating renderTabContent callback
  // This prevents unnecessary remounts when switching windows
  const eventsRef = React.useRef(events);
  const repositoriesRef = React.useRef(repositories);
  const onOpenRepositoryRef = React.useRef(onOpenRepository);
  const feedModeRef = React.useRef(feedMode);

  // Update refs on every render (refs don't trigger re-renders)
  React.useEffect(() => {
    eventsRef.current = events;
    repositoriesRef.current = repositories;
    onOpenRepositoryRef.current = onOpenRepository;
    feedModeRef.current = feedMode;
  });

  // Time filter state for heatmap selection
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);

  // Tab management - Initialize with activity feed tab
  const [tabs, setTabs] = useState<FeedTab[]>([
    {
      id: 'activity-feed',
      contentType: 'activity-feed',
      label: 'Recent Activity',
    } as ActivityFeedTab,
  ]);
  const [activeTabId, setActiveTabId] = useState<string | null>('activity-feed');

  // Activity feed data
  const activityFeed = useActivityFeed(repositories, 20, 10, 100);

  // Create a set of Alexandria repository paths for efficient lookup
  const alexandriaRepoPaths = useMemo(
    () => new Set(repositories.filter(r => r.path).map(r => String(r.path))),
    [repositories]
  );

  // Store refresh function in ref to avoid recreating callback
  const refreshFnRef = useRef(activityFeed.refresh);
  useEffect(() => {
    refreshFnRef.current = activityFeed.refresh;
  }, [activityFeed.refresh]);

  // Debounced refresh for git status changes
  // Longer delay (2000ms) to give git time to finalize commits and make them queryable
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(() => {
      refreshFnRef.current();
    }, 2000); // Increased to 2000ms to ensure git has finalized the commit
  }, []); // No dependencies - uses ref

  // Store Alexandria paths in ref to avoid recreating subscription
  const alexandriaRepoPathsRef = useRef(alexandriaRepoPaths);
  useEffect(() => {
    alexandriaRepoPathsRef.current = alexandriaRepoPaths;
  }, [alexandriaRepoPaths]);

  // Subscribe to git status changes across all repositories (passive - no watch acquisition)
  // We only receive events for repositories that are already being watched by other windows
  useEffect(() => {
    const unsubscribe = RepositoryMonitoringService.onGitStatusChanged(
      (status) => {
        const repoPathStr = String(status.repoPath);
        const isAlexandria = alexandriaRepoPathsRef.current.has(repoPathStr);

        // Only refresh if this repo is in Alexandria registry
        if (isAlexandria) {
          debouncedRefresh();
          // Emit event to notify all panels that activity should refresh
          events.emit({
            type: 'feed:activity-refresh-requested',
            source: 'feed-panel-framework',
            timestamp: Date.now(),
            payload: { repoPath: repoPathStr },
          });
        }
      }
    );

    return () => {
      unsubscribe();
      // Don't clear timeout here - let it complete
    };
  }, [debouncedRefresh, events]); // Only debouncedRefresh and events

  // Load base directory from user preferences
  useEffect(() => {
    const loadBaseDirectory = async () => {
      const preferences = await UserPreferencesService.getPreferences();
      setBaseDefaultDirectory(preferences.baseDefaultDirectory || null);
    };

    loadBaseDirectory();

    const unsubscribe = UserPreferencesService.onPreferencesUpdated(
      (preferences) => {
        setBaseDefaultDirectory(preferences.baseDefaultDirectory || null);
      },
    );

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Transform commits for heatmap
  const heatmapCommits = useMemo<CommitTimestamp[]>(() => {
    const transformed = activityFeed.commits.map((commit) => ({
      timestamp: new Date(commit.date),
      repoId: commit.repoPath,
    }));
    return transformed;
  }, [activityFeed.commits]);

  // Listen for time filter events to update selected block
  useEffect(() => {
    const handleTimeFilter = (event: { type: string; payload: { start: Date; end: Date } | null }) => {
      if (event.type === 'feed:time-filter-changed') {
        setSelectedBlock(event.payload?.start.toISOString() ?? null);
      }
    };

    events.on('feed:time-filter-changed', handleTimeFilter);
    return () => {
      events.off('feed:time-filter-changed', handleTimeFilter);
    };
  }, [events]);

  // Listen for commit review events to open review tabs
  useEffect(() => {
    const handleCommitReview = (event: {
      type: string;
      payload: { repoPath: string; repoName: string; commit: ActivityCommit }
    }) => {
      if (event.type === 'commit:review-selected') {
        const { repoPath, repoName, commit } = event.payload;
        const tabId = `commit-review-${repoPath}-${commit.hash}`;

        // Check if tab already exists
        const existingTab = tabs.find(tab => tab.id === tabId);
        if (existingTab) {
          setActiveTabId(tabId);
          return;
        }

        // Create new commit review tab
        const newTab: CommitReviewTab = {
          id: tabId,
          label: `${commit.hash.substring(0, 7)} - ${repoName}`,
          contentType: 'commit-review',
          closable: true,
          repoPath,
          repoName,
          commit,
        };

        setTabs(prevTabs => [...prevTabs, newTab]);
        setActiveTabId(tabId);
      }
    };

    events.on('commit:review-selected', handleCommitReview);
    return () => {
      events.off('commit:review-selected', handleCommitReview);
    };
  }, [events, tabs]);

  // Listen for live activity events to open live activity tab
  useEffect(() => {
    const handleLiveActivity = (event: { type: string }) => {
      if (event.type === 'live-activity:open') {
        const tabId = 'live-activity';

        // Check if tab already exists
        const existingTab = tabs.find(tab => tab.id === tabId);
        if (existingTab) {
          setActiveTabId(tabId);
          return;
        }

        // Create new live activity tab
        const newTab: LiveActivityTab = {
          id: tabId,
          label: 'Live Activity',
          contentType: 'live-activity',
          closable: true,
        };

        setTabs(prevTabs => [...prevTabs, newTab]);
        setActiveTabId(tabId);
      }
    };

    events.on('live-activity:open', handleLiveActivity);
    return () => {
      events.off('live-activity:open', handleLiveActivity);
    };
  }, [events, tabs]);

  // Listen for repository selection events to open project info tab
  useEffect(() => {
    const handleRepositorySelected = (event: {
      type: string;
      payload: { repository: AlexandriaEntry }
    }) => {
      if (event.type === 'feed:repository-selected') {
        const { repository } = event.payload;
        const tabId = `project-info-${repository.name}`;

        // Check if tab already exists
        const existingTab = tabs.find(tab => tab.id === tabId);
        if (existingTab) {
          setActiveTabId(tabId);
          return;
        }

        // Create new project info tab
        const newTab: ProjectInfoTab = {
          id: tabId,
          label: repository.name,
          contentType: 'project-info',
          closable: true,
          repository,
        };

        setTabs(prevTabs => [...prevTabs, newTab]);
        setActiveTabId(tabId);
      }
    };

    events.on('feed:repository-selected', handleRepositorySelected);
    return () => {
      events.off('feed:repository-selected', handleRepositorySelected);
    };
  }, [events, tabs]);

  // Listen for user profile selection events to open user profile tab
  useEffect(() => {
    const handleUserSelected = (event: {
      type: string;
      payload: { username: string; email?: string }
    }) => {
      if (event.type === 'user:profile-selected') {
        const { username, email } = event.payload;
        const tabId = `user-profile-${username}`;

        // Check if tab already exists
        const existingTab = tabs.find(tab => tab.id === tabId);
        if (existingTab) {
          setActiveTabId(tabId);
          return;
        }

        // Create new user profile tab
        const newTab: UserProfileTab = {
          id: tabId,
          label: `@${username}`,
          contentType: 'user-profile',
          closable: true,
          username,
          email,
        };

        setTabs(prevTabs => [...prevTabs, newTab]);
        setActiveTabId(tabId);
      }
    };

    events.on('user:profile-selected', handleUserSelected);
    return () => {
      events.off('user:profile-selected', handleUserSelected);
    };
  }, [events, tabs]);

  // Listen for owner selection events from repo cards (could be user or org)
  useEffect(() => {
    const handleOwnerSelected = (event: {
      type: string;
      payload: { owner: string; isOrg: boolean }
    }) => {
      if (event.type === 'feed:owner-selected') {
        const { owner, isOrg } = event.payload;
        const tabId = isOrg ? `org-profile-${owner}` : `user-profile-${owner}`;

        // Check if tab already exists
        const existingTab = tabs.find(tab => tab.id === tabId);
        if (existingTab) {
          setActiveTabId(tabId);
          return;
        }

        // Create appropriate profile tab based on owner type
        if (isOrg) {
          const newTab: OrgProfileTab = {
            id: tabId,
            label: `@${owner}`,
            contentType: 'org-profile',
            closable: true,
            orgName: owner,
          };
          setTabs(prevTabs => [...prevTabs, newTab]);
          setActiveTabId(tabId);
        } else {
          const newTab: UserProfileTab = {
            id: tabId,
            label: `@${owner}`,
            contentType: 'user-profile',
            closable: true,
            username: owner,
          };
          setTabs(prevTabs => [...prevTabs, newTab]);
          setActiveTabId(tabId);
        }
      }
    };

    events.on('feed:owner-selected', handleOwnerSelected);
    return () => {
      events.off('feed:owner-selected', handleOwnerSelected);
    };
  }, [events, tabs]);

  // Handle user profile panel events
  useEffect(() => {
    const handleOpenLink = (event: { type: string; payload: { url: string; type: string } }) => {
      if (event.type === 'user-profile:open-link') {
        window.open(event.payload.url, '_blank');
      }
    };

    events.on('user-profile:open-link', handleOpenLink);
    return () => {
      events.off('user-profile:open-link', handleOpenLink);
    };
  }, [events]);

  // Handle org profile panel events
  useEffect(() => {
    const handleOpenLink = (event: { type: string; payload: { url: string; type: string } }) => {
      if (event.type === 'org-profile:open-link') {
        window.open(event.payload.url, '_blank');
      }
    };

    events.on('org-profile:open-link', handleOpenLink);
    return () => {
      events.off('org-profile:open-link', handleOpenLink);
    };
  }, [events]);

  // Convert terminal activities to workingStates record
  const workingStates = useMemo(() => {
    const states: Record<string, TerminalWorkingState> = {};
    for (const activity of terminalActivities) {
      states[activity.sessionId] = {
        isWorking: activity.isWorking,
        message: activity.workingMessage,
        subtitle: activity.workingSubtitle,
      };
    }
    return states;
  }, [terminalActivities]);

  // Terminal context for the panel
  const terminalPanelContext = useMemo(
    () => ({
      currentScope: { type: 'workspace' as const },
      terminalSessions: terminalCtx.terminalSessions,
      terminalContext: terminalCtx.terminalContext,
      refresh: async () => {},
      // Terminal slice for TerminalPanelContext
      terminal: {
        scope: 'workspace' as const,
        name: 'terminal',
        data: terminalCtx.terminalSessions.map((session) => ({
          id: session.id,
          pid: 0,
          cwd: session.directory || '',
          shell: '',
          createdAt: session.createdAt || Date.now(),
          lastActivity: Date.now(),
        })),
        loading: false,
        error: null,
        refresh: async () => {},
      },
    }),
    [terminalCtx.terminalSessions, terminalCtx.terminalContext]
  );

  // Terminal directory - use baseDefaultDirectory from preferences, fallback to HOME
  const terminalDirectory = baseDefaultDirectory || process.env.HOME || '/';

  // Tab rendering callbacks
  const renderTabIcon = useCallback((tab: FeedTab) => {
    switch (tab.contentType) {
      case 'commit-review':
        return <GitCommit size={14} />;
      case 'live-activity':
        return <Users size={14} />;
      case 'activity-feed':
        return <Activity size={14} />;
      case 'project-info':
        return <FolderGit2 size={14} />;
      case 'user-profile':
        return <User size={14} />;
      case 'org-profile':
        return <Building2 size={14} />;
      default:
        return null;
    }
  }, []);

  const renderTabContent = useCallback(
    (tab: FeedTab, _isActive: boolean) => {
      switch (tab.contentType) {
        case 'commit-review': {
          const reviewTab = tab as CommitReviewTab;
          return (
            <ReviewCommitPanel
              repoPath={reviewTab.repoPath}
              repoName={reviewTab.repoName}
              commit={reviewTab.commit}
            />
          );
        }
        case 'live-activity': {
          return <LiveActivityTabContent />;
        }
        case 'activity-feed': {
          return (
            <ActivityFeedCardPanel
              repositories={repositoriesRef.current}
              events={eventsRef.current}
              onOpenRepository={onOpenRepositoryRef.current}
              feedMode={feedModeRef.current}
            />
          );
        }
        case 'project-info': {
          const projectTab = tab as ProjectInfoTab;
          return (
            <RepositoryProfileTabContent
              key={projectTab.repository.path || tab.id}
              repository={projectTab.repository}
              events={eventsRef.current}
            />
          );
        }
        case 'user-profile': {
          const userTab = tab as UserProfileTab;
          return (
            <UserProfileTabContent
              key={userTab.username}
              username={userTab.username}
              email={userTab.email}
              events={eventsRef.current}
              repositories={repositories}
            />
          );
        }
        case 'org-profile': {
          const orgTab = tab as OrgProfileTab;
          return (
            <OrgProfileTabContent
              key={orgTab.orgName}
              orgName={orgTab.orgName}
              events={eventsRef.current}
              repositories={repositories}
            />
          );
        }
        default:
          return null;
      }
    },
    // NOTE: renderTabContent intentionally uses refs for repositories/events/onOpenRepository/feedMode
    // to avoid recreating this callback when those values change, which would cause unnecessary re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Handle panel resize
  const handlePanelResize = useCallback(
    (sizes: { left: number; middle: number; right: number }) => {
      // Detect collapse via resize (only left panel now)
      const leftCollapsed = sizes.left < 5;

      if (leftCollapsed !== isLeftCollapsed) {
        setIsLeftCollapsed(leftCollapsed);
        onCollapsedChange({ left: leftCollapsed, right: false });
      }

      onPanelSizesChange?.(sizes);
    },
    [isLeftCollapsed, onCollapsedChange, onPanelSizesChange]
  );

  // Listen for terminal activity events
  useEffect(() => {
    const handleActivityChanged = (event: { type: string; payload: { sessionId: string; isWorking: boolean } }) => {
      if (event.type === 'terminal:activity-changed') {
        activityActions.updateActivity({
          sessionId: event.payload.sessionId,
          isWorking: event.payload.isWorking,
        });
      }
    };

    events.on('terminal:activity-changed', handleActivityChanged);
    return () => {
      events.off('terminal:activity-changed', handleActivityChanged);
    };
  }, [events, activityActions]);

  // Open Live Activity tab
  const handleNavigateToActivityCities = useCallback(() => {
    events.emit({
      type: 'live-activity:open',
      source: 'feed-panel-framework',
      timestamp: Date.now(),
      payload: null,
    });
  }, [events]);

  // Theme spacing helpers
  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
  };

  // Define all panels (must have 3 to position terminal in middle)
  const allPanels = useMemo(
    () => [
      {
        id: 'heatmap',
        label: feedMode === 'watched-activity' ? 'Watched' :
               feedMode === 'organizations' ? 'Organizations' :
               feedMode === 'coworkers' ? 'Coworkers' : 'Activity',
        content: (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header with controls */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: spacing.xs,
                padding: spacing.sm,
                borderBottom: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
                flexShrink: 0,
              }}
            >
              {/* Feed mode toggle */}
              <SegmentedControl
                options={[
                  { value: 'my-activity', label: 'My Activity' },
                  { value: 'watched-activity', label: 'Watching' },
                  { value: 'organizations', label: 'Organizations' },
                  { value: 'coworkers', label: 'Coworkers' },
                ]}
                value={feedMode}
                onChange={(value) => onFeedModeChange?.(value as 'my-activity' | 'watched-activity' | 'organizations' | 'coworkers')}
                theme={theme}
              />

              {/* Live Activity button */}
              <button
                onClick={handleNavigateToActivityCities}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
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

            {/* Panel content */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {feedMode === 'watched-activity' ? (
                <WatchedItemsPanel events={events} />
              ) : feedMode === 'organizations' ? (
                <OrganizationsListPanel events={events} />
              ) : feedMode === 'coworkers' ? (
                <CoworkersListPanel events={events} />
              ) : (
                <ProjectsListPanel
                  commits={heatmapCommits}
                  repositories={repositories}
                  events={events}
                  selectedBlock={selectedBlock}
                />
              )}
            </div>
          </div>
        ),
      },
      {
        id: 'terminal',
        label: 'Terminal',
        content: (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <TabbedTerminalPanel<FeedTab>
              context={terminalPanelContext}
              actions={terminalActions as TerminalPanelActions}
              events={events}
              terminalContext={terminalCtx.terminalContext}
              directory={terminalDirectory}
              defaultScrollLocked={false}
              workingStates={workingStates}
              initialTabs={tabs}
              onTabsChange={setTabs}
              activeTabId={activeTabId}
              onActiveTabChange={setActiveTabId}
              renderTabContent={renderTabContent}
              renderTabIcon={renderTabIcon}
            />
          </div>
        ),
      },
      {
        id: 'placeholder',
        label: 'Details',
        content: (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: theme.colors.background,
            }}
          />
        ),
      },
    ],
    [
      heatmapCommits,
      events,
      selectedBlock,
      terminalPanelContext,
      terminalActions,
      terminalCtx.terminalContext,
      terminalDirectory,
      workingStates,
      repositories,
      tabs,
      activeTabId,
      renderTabContent, // includes onOpenRepository
      renderTabIcon,
      feedMode,
      onFeedModeChange,
      handleNavigateToActivityCities,
      spacing,
      theme,
    ]
  );

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: theme.colors.background,
      }}
    >
      <ConfigurablePanelLayout
        ref={panelLayoutRef}
        panels={allPanels}
        layout={layout}
        collapsiblePanels={{ left: true, right: true }}
        defaultSizes={panelSizes || { left: 25, middle: 75, right: 0 }}
        collapsed={{ left: collapsed.left, right: true }}
        showCollapseButtons={false}
        theme={theme}
        onPanelResize={handlePanelResize}
      />
    </div>
  );
};

/**
 * FeedPanelFramework - Main component with TerminalProvider wrapper
 */
export const FeedPanelFramework: React.FC<FeedPanelFrameworkProps> = ({
  repositories,
  collapsed,
  onCollapsedChange,
  layout,
  onLayoutChange,
  panelSizes,
  onPanelSizesChange,
  events,
  onOpenRepository,
  feedMode,
  onFeedModeChange,
}) => {
  return (
    <TerminalProvider
      repositoryPath=""
      terminalContext="terminal:feed"
      repoName="Feed"
    >
      <FeedPanelFrameworkInner
        repositories={repositories}
        collapsed={collapsed}
        onCollapsedChange={onCollapsedChange}
        layout={layout}
        onLayoutChange={onLayoutChange}
        panelSizes={panelSizes}
        onPanelSizesChange={onPanelSizesChange}
        events={events}
        onOpenRepository={onOpenRepository}
        feedMode={feedMode}
        onFeedModeChange={onFeedModeChange}
      />
    </TerminalProvider>
  );
};

export default FeedPanelFramework;
