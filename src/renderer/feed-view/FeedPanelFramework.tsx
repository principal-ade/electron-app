/**
 * FeedPanelFramework
 *
 * Panel framework for the FeedView, using ConfigurablePanelLayout
 * similar to DevWorkspacePanelFramework but simplified for the feed context.
 *
 * Layout:
 * - Left: FeedLeftPanel (feed mode selector and activity lists)
 * - Middle: TabbedTerminalPanel (terminal in HOME directory)
 * - Right: Placeholder panel (collapsed by default)
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { GitCommit, Users, Activity, FolderGit2, User, Building2, BookMarked, Radio, Wrench } from 'lucide-react';
import {
  ConfigurablePanelLayout,
  type PanelLayout,
  type ConfigurablePanelLayoutHandle,
} from '@principal-ade/panel-layouts';
import type { PanelEventEmitter, RepositoryMetadata } from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { AlexandriaEventType } from '../../shared/main-process-api-interfaces/AlexandriaAPI';
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
import { FeedLeftPanel } from '../panels/FeedLeftPanel';
import { ActivityFeedCardPanel } from '../panels/ActivityFeedCardPanel';
import { ReviewCommitPanel } from '../panels/ReviewCommitPanel';
import { RepositoryProfilePanel, type RepositoryProfileData } from '../panels/RepositoryProfilePanel';
import { ActivityCitiesPanel } from '../panels/ActivityCitiesPanel';
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
import type { CommitTimestamp } from '../panels/ProjectsList';
import type { ActivityCommit } from '../hooks/useActivityFeed';
import { GithubService } from '../main-process-api/GithubService';
import { GitService } from '../main-process-api/GitService';
import { WebAdeService } from '../main-process-api/WebAdeService';
import { ApiProxyService } from '../main-process-api/ApiProxyService';
import { PathsFileTreeBuilder } from '@principal-ai/repository-abstraction';
import { SecureAuthService } from '../services/SecureAuthService';
import { WindowService } from '../main-process-api/WindowService';
import { AlexandriaService } from '../main-process-api/AlexandriaService';
import { DeleteAlexandriaEntryModal } from '../panels/components/DeleteAlexandriaEntryModal';
import { CollectionProfilePanel } from '../panels/CollectionProfilePanel';
import { WatchedActivityPanel } from '../panels/WatchedActivityPanel';
import { watchedActivityPanelActions } from '../panels/watchedActivityPanelActions';
import { InProgressActivityPanel } from '../panels/InProgressActivityPanel';
import { inProgressActivityPanelActions } from '../panels/inProgressActivityPanelActions';
import type { StarredCollection } from '../../shared/tipc/webAdeRouterTypes';

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
  githubOwner?: string;
  githubRepoName?: string;
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
 * In-progress tab - displays repositories with uncommitted working-tree changes
 */
export interface InProgressActivityTab extends BaseTab {
  contentType: 'in-progress-activity';
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
 * Collection profile tab - displays a collection's repos and users
 */
export interface CollectionProfileTab extends BaseTab {
  contentType: 'collection-profile';
  collection: StarredCollection;
}

export interface WatchedOwnerActivityTab extends BaseTab {
  contentType: 'watched-owner-activity';
  login: string;
  accountType: 'User' | 'Organization';
}

export interface WatchedRepoActivityTab extends BaseTab {
  contentType: 'watched-repo-activity';
  owner: string;
  repo: string;
}

/**
 * Union type of all supported tab types in FeedView
 */
export type FeedTab = TerminalTab | CommitReviewTab | LiveActivityTab | ActivityFeedTab | InProgressActivityTab | ProjectInfoTab | UserProfileTab | OrgProfileTab | CollectionProfileTab | WatchedOwnerActivityTab | WatchedRepoActivityTab;

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
  feedMode?: 'my-activity' | 'collections' | 'organizations';
  /** Callback when feed mode changes */
  onFeedModeChange?: (mode: 'my-activity' | 'collections' | 'organizations') => void;
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
  feedMode?: 'my-activity' | 'collections' | 'organizations';
  onFeedModeChange?: (mode: 'my-activity' | 'collections' | 'organizations') => void;
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
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  // Use commit heatmap hook for local repos only
  const heatMapData = useCommitHeatMap(repository.path ?? null);

  React.useEffect(() => {
    let cancelled = false;

    const fetchRepositoryData = async () => {
      setLoading(true);

      try {
        // Re-fetch from Alexandria on refresh to pick up updated localClones (e.g. after cloning)
        let repo: AlexandriaEntry = repository;
        if (refreshTrigger > 0) {
          const freshEntry = await AlexandriaService.getRepository(repository.name);
          if (freshEntry) repo = freshEntry;
        }

        if (cancelled) return;

        // Show avatar and basic info immediately before async fetches
        if (repo.github?.owner) {
          setRepositoryData((prev) => ({
            name: repo.name,
            fullName: `${repo.github!.owner}/${repo.github!.name || repo.name}`,
            owner: repo.github!.owner,
            ownerAvatarUrl: `https://github.com/${repo.github!.owner}.png`,
            description: repo.github?.description || undefined,
            stars: 0,
            forks: 0,
            watchers: 0,
            openIssues: 0,
            size: 0,
            activityData: prev?.activityData ?? new Map(),
            totalCommits: prev?.totalCommits ?? 0,
            defaultBranch: repo.github?.defaultBranch || 'main',
            createdAt: repo.registeredAt || new Date().toISOString(),
            updatedAt: repo.lastOpenedAt || new Date().toISOString(),
            htmlUrl: `https://github.com/${repo.github!.owner}/${repo.github!.name || repo.name}`,
            isPrivate: undefined,
            isLocal: !!repo.path,
            localClones: ('localClones' in repo && Array.isArray(repo.localClones)) ? repo.localClones : (repo.path ? [{ path: repo.path, addedAt: Date.now() }] : undefined),
            github: repo.github ? { ...repo.github } : undefined,
          }));
        }

        // Fetch activity data - local or remote
        const activityData = new Map<string, number>();
        let totalCommits = 0;

        if (repo.path) {
          // Local repository - use heatmap data from hook
          heatMapData.commits.forEach((commit) => {
            activityData.set(commit.date, commit.count);
          });
          activityData.forEach((count) => {
            totalCommits += count;
          });
        } else if (repo.github?.owner && repo.github?.name) {
          // Remote repository - fetch from web-ade
          try {
            const contributions = await WebAdeService.getRepoContributions(
              repo.github.owner,
              repo.github.name
            );
            contributions.contributions.forEach((day) => {
              activityData.set(day.date, day.count);
            });
            totalCommits = contributions.totalCommits;
            console.info('[RepositoryProfileTab] Fetched remote contributions:', contributions);
          } catch (err) {
            console.warn('[RepositoryProfileTab] Failed to fetch remote contributions:', err);
          }
        }

        // Fetch full repository data from GitHub API if available
        let ownerType: 'User' | 'Organization' | undefined = undefined;
        let githubCreatedAt: string | undefined = undefined;
        let githubUpdatedAt: string | undefined = undefined;
        let githubDefaultBranch: string | undefined = undefined;
        let githubIsPrivate: boolean | undefined = undefined;

        if (repo.github?.owner && repo.github?.name) {
          try {
            const githubRepo = await GithubService.getRepository(repo.github.owner, repo.github.name);
            console.info('[RepositoryProfileTab] Fetched GitHub repository:', githubRepo);
            ownerType = githubRepo?.owner.type;
            githubCreatedAt = githubRepo?.created_at;
            githubUpdatedAt = githubRepo?.updated_at;
            githubDefaultBranch = githubRepo?.default_branch || undefined;
            githubIsPrivate = githubRepo?.private;
          } catch (err) {
            console.warn('[RepositoryProfileTab] Failed to fetch GitHub repository:', err);
          }
        }

        // Fetch contributor count - local or from GitHub
        let contributors: number | undefined = undefined;
        if (repo.path) {
          // Local repository - use git
          try {
            contributors = await GitService.getContributorCount(repo.path);
            console.info('[RepositoryProfileTab] Contributor count (local):', contributors);
          } catch (err) {
            console.warn('[RepositoryProfileTab] Failed to fetch contributor count:', err);
          }
        } else if (repo.github?.owner && repo.github?.name) {
          // Remote repository - use GitHub API
          try {
            const githubContributors = await GithubService.getRepositoryContributors(
              repo.github.owner,
              repo.github.name
            );
            contributors = githubContributors.length;
            console.info('[RepositoryProfileTab] Contributor count (GitHub):', contributors);
          } catch (err) {
            console.warn('[RepositoryProfileTab] Failed to fetch GitHub contributors:', err);
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
          contributors,
          defaultBranch: githubDefaultBranch || repo.github?.defaultBranch || 'main',
          createdAt: githubCreatedAt || repo.registeredAt || new Date().toISOString(),
          updatedAt: githubUpdatedAt || repo.lastOpenedAt || new Date().toISOString(),
          htmlUrl: repo.github?.owner && repo.github?.name
            ? `https://github.com/${repo.github.owner}/${repo.github.name}`
            : undefined,
          isPrivate: githubIsPrivate,
          isLocal: !!repo.path,
          localClones: ('localClones' in repo && Array.isArray(repo.localClones)) ? repo.localClones : (repo.path ? [{ path: repo.path, addedAt: Date.now() }] : undefined),
          github: repo.github ? {
            ...repo.github,
            defaultBranch: githubDefaultBranch || repo.github.defaultBranch || undefined,
          } : undefined,
        };

        console.info('[RepositoryProfileTab] Final profile data with ownerType:', profileData.ownerType);

        if (!cancelled) {
          setRepositoryData(profileData);
          setLoading(false);
        }
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
  }, [heatMapData.commits, repository, refreshTrigger]);

  // Subscribe to Alexandria repository changes to update profile in real-time
  React.useEffect(() => {
    const unsubscribe = AlexandriaService.onRepositoryChange((event) => {
      if ((event.type !== AlexandriaEventType.UPDATED && event.type !== AlexandriaEventType.ADDED) || !event.repository) {
        return;
      }

      // Check if this update is for the repository we're currently viewing
      const isMatch =
        event.repository.name === repository.name ||
        event.repository.path === repository.path ||
        (event.repository.github?.id && repository.github?.id &&
         event.repository.github.id === repository.github.id);

      if (isMatch) {
        console.info('[RepositoryProfileTab] Repository updated, refreshing profile data:', event.repository.name);
        setRefreshTrigger(prev => prev + 1);
      }
    });

    return unsubscribe;
  }, [repository]);

  // Refresh when a clone is added from the profile panel
  React.useEffect(() => {
    const handleCloneCompleted = () => {
      setRefreshTrigger(prev => prev + 1);
    };
    events.on('repository-profile:clone-completed', handleCloneCompleted);
    return () => {
      events.off('repository-profile:clone-completed', handleCloneCompleted);
    };
  }, [events]);

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
    openRepository: async (entry: AlexandriaEntry) => {
      if (entry && entry.path) {
        await WindowService.openDevWorkspace({
          alexandriaEntry: entry,
        });
      }
    },
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

    isRepositoryWatched: async (owner: string, repo: string) => {
      const watches = await WebAdeService.getWatches();
      return watches.watchedRepos.some((r) => r.owner === owner && r.repo === repo);
    },

    watchRepository: async (owner: string, repo: string) => {
      const response = await WebAdeService.watchRepo(owner, repo);
      if (!response.success) {
        throw new Error('Failed to watch repository');
      }
    },

    unwatchRepository: async (owner: string, repo: string) => {
      const response = await WebAdeService.unwatchRepo(owner, repo);
      if (!response.success) {
        throw new Error('Failed to unwatch repository');
      }
    },

    isRepositoryStarred: async (owner: string, repo: string) => {
      return GithubService.isRepositoryStarred(owner, repo);
    },

    starRepository: async (owner: string, repo: string) => {
      await GithubService.starRepository(owner, repo);
    },

    unstarRepository: async (owner: string, repo: string) => {
      await GithubService.unstarRepository(owner, repo);
    },

    registerRepository: async (name: string, path: string) => {
      return AlexandriaService.registerRepository(name, path);
    },

    getContributors: async (owner: string, repo: string) => {
      return GithubService.getRepositoryContributors(owner, repo);
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
          return { recentCommits: [], contributions: [], contributedRepos: [] };
        }

        const activityResult = await ApiProxyService.call<UserActivityResponse>({
          endpoint: `https://app.principal-ade.com/api/github/user/${username}/activity?contributionDays=365&activityDays=1`,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${authResult.token}`,
          },
        });

        const activityResponse = activityResult?.data;

        // Extract contributions for heatmap
        const contributions: Array<{ date: string; count: number }> = [];
        if (activityResponse?.contributions) {
          activityResponse.contributions.forEach((contrib: { date: string; count: number }) => {
            contributions.push({ date: contrib.date, count: contrib.count });
          });
        }

        // Extract recent commits (filter activity to only commits)
        const recentCommits: Array<{
          id: string;
          timestamp: string;
          repository: string;
          repositoryUrl?: string;
          ownerType?: 'User' | 'Organization';
          isPrivate?: boolean;
          commitCount: number;
          additions?: number;
          deletions?: number;
        }> = [];

        if (activityResponse?.activity) {
          activityResponse.activity
            .filter((event) => event.type === 'commit')
            .forEach((event) => {
              recentCommits.push({
                id: event.id,
                timestamp: event.timestamp,
                repository: event.repository,
                // These fields may not be in the current interface but are optional
                repositoryUrl: undefined,
                ownerType: undefined,
                isPrivate: undefined,
                commitCount: event.metadata?.commitCount || 1,
                additions: event.metadata?.additions,
                deletions: event.metadata?.deletions,
              });
            });
        }

        // Extract contributed repos and add missing fields
        const contributedRepos: Array<{
          nameWithOwner: string;
          owner: string;
          name: string;
          url: string;
          commitCount: number;
          lastContributedAt: string;
          isPrivate: boolean;
          ownerType: 'User' | 'Organization';
        }> = (activityResponse?.contributedRepos || []).map((repo) => ({
          nameWithOwner: repo.nameWithOwner,
          owner: repo.owner,
          name: repo.name,
          url: `https://github.com/${repo.owner}/${repo.name}`,
          commitCount: repo.commitCount,
          lastContributedAt: repo.lastContributedAt,
          isPrivate: false, // API doesn't provide this, default to false
          ownerType: 'User', // API doesn't provide this, default to User
        }));

        return { recentCommits, contributions, contributedRepos };
      } catch (err) {
        console.error('Failed to fetch user activity:', err);
        return { recentCommits: [], contributions: [], contributedRepos: [] };
      }
    },

    getUserRepositories: async (username: string) => {
      try {
        const result = await GithubService.searchRepos(
          `user:${username} sort:updated`,
          { perPage: 100 }
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
            isPrivate: repo.private,
            createdAt: repo.created_at,
            updatedAt: repo.updated_at,
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

    isUserWatched: async (username: string) => {
      const watches = await WebAdeService.getWatches();
      return watches.watchedUsers.some((u) => u.login === username);
    },

    watchUser: async (username: string) => {
      const response = await WebAdeService.watchUser(username, 'User');
      if (!response.success) {
        throw new Error('Failed to watch user');
      }
    },

    unwatchUser: async (username: string) => {
      const response = await WebAdeService.unwatchUser(username);
      if (!response.success) {
        throw new Error('Failed to unwatch user');
      }
    },

    getUserOrgs: async (username: string) => {
      return GithubService.getUserOrganizationsForUser(username);
    },

    getPinnedRepositories: async (username: string) => {
      return WebAdeService.getPinnedRepositories(username);
    },

    openFile: async () => {},
  }), [email, repositories]);

  return (
    <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
      <UserProfilePanel context={userContext} actions={userActions} events={events} watchedActivityActions={watchedActivityPanelActions} />
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
        const repos = await GithubService.getOrgRepositories(orgName, { perPage: 100 });

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
            isPrivate: repo.private,
            createdAt: repo.created_at,
            updatedAt: repo.updated_at,
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

    isOrgWatched: async (orgName: string) => {
      const watches = await WebAdeService.getWatches();
      return watches.watchedUsers.some((u) => u.login === orgName);
    },

    watchOrg: async (orgName: string) => {
      const response = await WebAdeService.watchUser(orgName, 'Organization');
      if (!response.success) {
        throw new Error('Failed to watch organization');
      }
    },

    unwatchOrg: async (orgName: string) => {
      const response = await WebAdeService.unwatchUser(orgName);
      if (!response.success) {
        throw new Error('Failed to unwatch organization');
      }
    },

    getOrgMembers: async (orgName: string) => {
      return GithubService.getOrgMembers(orgName);
    },

    getPinnedRepositories: async (username: string) => {
      return WebAdeService.getPinnedRepositories(username);
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

  // Tab management - Initialize with activity feed tab.
  // If any repo has uncommitted changes when the view mounts, a one-shot
  // effect below swaps this for an in-progress tab so the user lands on
  // their work-in-flight by default.
  const [tabs, setTabs] = useState<FeedTab[]>([
    {
      id: 'activity-feed',
      contentType: 'activity-feed',
      label: 'Recent Activity',
    } as ActivityFeedTab,
  ]);
  const [activeTabId, setActiveTabId] = useState<string | null>('activity-feed');
  const didCheckInitialDirtyRef = useRef(false);

  useEffect(() => {
    if (didCheckInitialDirtyRef.current) return;
    if (repositories.length === 0) return;
    didCheckInitialDirtyRef.current = true;

    let cancelled = false;
    (async () => {
      const paths = repositories.filter((r) => r.path).map((r) => String(r.path));
      for (const path of paths) {
        const status = await RepositoryMonitoringService.getGitStatusWithFiles(path);
        if (cancelled) return;
        if (status && (status.isDirty || status.ahead > 0)) {
          setTabs((prev) => {
            // Only swap if the user hasn't added other tabs or switched away.
            if (prev.length !== 1 || prev[0]?.id !== 'activity-feed') return prev;
            return [
              {
                id: 'in-progress-activity',
                contentType: 'in-progress-activity',
                label: 'In Progress',
              } as InProgressActivityTab,
            ];
          });
          setActiveTabId((curr) => (curr === 'activity-feed' ? 'in-progress-activity' : curr));
          return;
        }
      }
    })().catch((err) => {
      console.warn('[FeedPanelFramework] initial dirty-check failed:', err);
    });

    return () => {
      cancelled = true;
    };
  }, [repositories]);

  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<AlexandriaEntry | null>(null);
  const [deleteGitStatus, setDeleteGitStatus] = useState<{
    hasUncommittedChanges: boolean;
    uncommittedCount: number;
    unpushedCommits: number;
    currentBranch: string;
  } | null>(null);

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
      payload: {
        repoPath: string;
        repoName: string;
        githubOwner?: string;
        githubRepoName?: string;
        commit: ActivityCommit;
      };
    }) => {
      if (event.type === 'commit:review-selected') {
        const { repoPath, repoName, githubOwner, githubRepoName, commit } = event.payload;
        const sourceKey = repoPath || (githubOwner && githubRepoName ? `${githubOwner}/${githubRepoName}` : repoName);
        const tabId = `commit-review-${sourceKey}-${commit.hash}`;

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
          githubOwner,
          githubRepoName,
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
        const owner = repository.github?.owner;
        const tabId = owner ? `project-info-${owner}/${repository.name}` : `project-info-${repository.name}`;

        // Check if tab already exists
        const existingTab = tabs.find(tab => tab.id === tabId);
        if (existingTab) {
          setActiveTabId(tabId);
          return;
        }

        // Create new project info tab
        const newTab: ProjectInfoTab = {
          id: tabId,
          label: owner ? `${owner}/${repository.name}` : repository.name,
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

  // Listen for collection selection events to open collection profile tab
  useEffect(() => {
    const handleCollectionSelected = (event: {
      type: string;
      payload: { collection: StarredCollection }
    }) => {
      if (event.type === 'feed:collection-selected') {
        const { collection } = event.payload;
        const tabId = `collection-profile-${collection.id}`;

        const existingTab = tabs.find(tab => tab.id === tabId);
        if (existingTab) {
          setActiveTabId(tabId);
          return;
        }

        const newTab: CollectionProfileTab = {
          id: tabId,
          label: collection.name,
          contentType: 'collection-profile',
          closable: true,
          collection,
        };

        setTabs(prevTabs => [...prevTabs, newTab]);
        setActiveTabId(tabId);
      }
    };

    events.on('feed:collection-selected', handleCollectionSelected);
    return () => {
      events.off('feed:collection-selected', handleCollectionSelected);
    };
  }, [events, tabs]);

  // Listen for watched owner activity tab requests
  useEffect(() => {
    const handleOwnerActivity = (event: {
      type: string;
      payload: { login: string; accountType: 'User' | 'Organization' };
    }) => {
      if (event.type !== 'feed:watched-owner-activity-requested') return;
      const { login, accountType } = event.payload;
      const tabId = `watched-owner-activity-${login}`;
      const existing = tabs.find(t => t.id === tabId);
      if (existing) { setActiveTabId(tabId); return; }
      const newTab: WatchedOwnerActivityTab = {
        id: tabId,
        label: `@${login}`,
        contentType: 'watched-owner-activity',
        closable: true,
        login,
        accountType,
      };
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(tabId);
    };
    events.on('feed:watched-owner-activity-requested', handleOwnerActivity);
    return () => { events.off('feed:watched-owner-activity-requested', handleOwnerActivity); };
  }, [events, tabs]);

  // Listen for watched repo activity tab requests
  useEffect(() => {
    const handleRepoActivity = (event: {
      type: string;
      payload: { owner: string; repo: string };
    }) => {
      if (event.type !== 'feed:watched-repo-activity-requested') return;
      const { owner, repo } = event.payload;
      const tabId = `watched-repo-activity-${owner}/${repo}`;
      const existing = tabs.find(t => t.id === tabId);
      if (existing) { setActiveTabId(tabId); return; }
      const newTab: WatchedRepoActivityTab = {
        id: tabId,
        label: `${owner}/${repo}`,
        contentType: 'watched-repo-activity',
        closable: true,
        owner,
        repo,
      };
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(tabId);
    };
    events.on('feed:watched-repo-activity-requested', handleRepoActivity);
    return () => { events.off('feed:watched-repo-activity-requested', handleRepoActivity); };
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

  // Handle repository delete requests
  useEffect(() => {
    const handleDeleteRequest = async (event: {
      type: string;
      payload: { repository: RepositoryProfileData }
    }) => {
      if (event.type === 'repository-profile:delete-requested') {
        const { repository } = event.payload;

        // Convert RepositoryProfileData to AlexandriaEntry
        // Find the matching entry in repositories
        const entry = repositories.find(r => r.name === repository.name && r.path === repository.localClones?.[0]?.path);

        if (entry) {
          // Check git status if this is a local repository
          let gitStatus = null;
          if (entry.path) {
            try {
              // Get branch status for unpushed commits
              const branchStatus = await GitService.getBranchStatus(entry.path);

              // Get working directory status for uncommitted changes
              const statusResult = await GitService.execCommand(entry.path, [
                'status',
                '--porcelain',
              ]);

              const hasUncommittedChanges = statusResult.stdout.trim().length > 0;
              const uncommittedCount = statusResult.stdout.trim().split('\n').filter(Boolean).length;

              gitStatus = {
                hasUncommittedChanges,
                uncommittedCount,
                unpushedCommits: branchStatus.ahead,
                currentBranch: branchStatus.branch,
              };
            } catch (error) {
              console.warn('[FeedPanelFramework] Failed to check git status:', error);
            }
          }

          setEntryToDelete(entry);
          setDeleteGitStatus(gitStatus);
          setIsDeleteModalOpen(true);
        } else {
          console.warn('[FeedPanelFramework] Could not find repository to delete:', repository.name);
        }
      }
    };

    events.on('repository-profile:delete-requested', handleDeleteRequest);
    return () => {
      events.off('repository-profile:delete-requested', handleDeleteRequest);
    };
  }, [events, repositories]);

  // Handle repository clone delete requests
  useEffect(() => {
    const handleDeleteCloneRequest = async (event: {
      type: string;
      payload: { repository: RepositoryProfileData; clonePath: string }
    }) => {
      if (event.type === 'repository-profile:delete-clone-requested') {
        const { repository, clonePath } = event.payload;

        // Find the matching entry in repositories by clone path
        const entry = repositories.find(r =>
          r.name === repository.name &&
          (r.path === clonePath ||
           ('localClones' in r && Array.isArray(r.localClones) && r.localClones.some(clone => clone.path === clonePath)))
        );

        if (entry) {
          // Check git status for the specific clone path
          let gitStatus = null;
          try {
            // Get branch status for unpushed commits
            const branchStatus = await GitService.getBranchStatus(clonePath);

            // Get working directory status for uncommitted changes
            const statusResult = await GitService.execCommand(clonePath, [
              'status',
              '--porcelain',
            ]);

            const hasUncommittedChanges = statusResult.stdout.trim().length > 0;
            const uncommittedCount = statusResult.stdout.trim().split('\n').filter(Boolean).length;

            gitStatus = {
              hasUncommittedChanges,
              uncommittedCount,
              unpushedCommits: branchStatus.ahead,
              currentBranch: branchStatus.branch,
            };
          } catch (error) {
            console.warn('[FeedPanelFramework] Failed to check git status:', error);
          }

          setEntryToDelete(entry);
          setDeleteGitStatus(gitStatus);
          setIsDeleteModalOpen(true);
        } else {
          console.warn('[FeedPanelFramework] Could not find repository clone to delete:', repository.name, clonePath);
        }
      }
    };

    events.on('repository-profile:delete-clone-requested', handleDeleteCloneRequest);
    return () => {
      events.off('repository-profile:delete-clone-requested', handleDeleteCloneRequest);
    };
  }, [events, repositories]);

  // Handle delete modal close
  const handleCloseDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(false);
    setEntryToDelete(null);
    setDeleteGitStatus(null);
  }, []);

  // Handle delete confirmation
  const handleConfirmDelete = useCallback(
    async (deleteLocal: boolean) => {
      if (!entryToDelete) return;

      try {
        await AlexandriaService.removeRepository(entryToDelete.name, deleteLocal);

        // Update the project info tab for this repository if it's open
        // Convert it to remote-only instead of closing it
        const openTab = tabs.find(
          tab => tab.contentType === 'project-info' &&
          (tab as ProjectInfoTab).repository.name === entryToDelete.name
        ) as ProjectInfoTab | undefined;

        if (openTab && entryToDelete.github) {
          // Update the tab to show it as a remote-only repository
          setTabs(prevTabs => prevTabs.map(tab => {
            if (tab.id === openTab.id) {
              // Create a remote-only version of the repository
              const { path: _path, ...repoWithoutPath } = entryToDelete;
              const remoteOnlyRepo: Partial<AlexandriaEntry> = {
                ...repoWithoutPath,
                // Keep GitHub info so it can still show as remote
              };
              return {
                ...openTab,
                repository: remoteOnlyRepo as AlexandriaEntry,
              };
            }
            return tab;
          }));
        } else if (openTab && !entryToDelete.github) {
          // If there's no GitHub info, we can't show it as remote-only, so close the tab
          setTabs(prevTabs => prevTabs.filter(tab => tab.id !== openTab.id));
          if (activeTabId === openTab.id) {
            setActiveTabId('activity-feed');
          }
        }

        // Refresh would happen automatically via Alexandria service events
        // but we can emit an event to notify other panels
        events.emit({
          type: 'feed:repository-deleted',
          source: 'feed-panel-framework',
          timestamp: Date.now(),
          payload: { repositoryName: entryToDelete.name },
        });
      } catch (error) {
        console.error('[FeedPanelFramework] Failed to delete repository:', error);
        throw error; // Re-throw so modal knows it failed
      }
    },
    [entryToDelete, tabs, activeTabId, events]
  );

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
      case 'in-progress-activity':
        return <Wrench size={14} />;
      case 'project-info':
        return <FolderGit2 size={14} />;
      case 'user-profile':
        return <User size={14} />;
      case 'org-profile':
        return <Building2 size={14} />;
      case 'collection-profile':
        return <BookMarked size={14} />;
      case 'watched-owner-activity':
      case 'watched-repo-activity':
        return <Radio size={14} />;
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
              githubOwner={reviewTab.githubOwner}
              githubRepoName={reviewTab.githubRepoName}
              commit={reviewTab.commit}
            />
          );
        }
        case 'live-activity': {
          return <ActivityCitiesPanel />;
        }
        case 'activity-feed': {
          return (
            <ActivityFeedCardPanel
              key={`activity-feed-${repositories.length}`}
              repositories={repositories}
              events={eventsRef.current}
              onOpenRepository={onOpenRepositoryRef.current}
            />
          );
        }
        case 'in-progress-activity': {
          return (
            <InProgressActivityPanel
              key={`in-progress-${repositories.length}`}
              repositories={repositories}
              events={eventsRef.current}
              onOpenRepository={onOpenRepositoryRef.current}
              actions={inProgressActivityPanelActions}
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
        case 'collection-profile': {
          const collectionTab = tab as CollectionProfileTab;
          return (
            <CollectionProfilePanel
              key={collectionTab.collection.id}
              collection={collectionTab.collection}
              events={eventsRef.current}
            />
          );
        }
        case 'watched-owner-activity': {
          const ownerTab = tab as WatchedOwnerActivityTab;
          return (
            <WatchedActivityPanel
              key={ownerTab.id}
              source={{ kind: 'owner', login: ownerTab.login, accountType: ownerTab.accountType }}
              events={eventsRef.current}
              actions={watchedActivityPanelActions}
            />
          );
        }
        case 'watched-repo-activity': {
          const repoTab = tab as WatchedRepoActivityTab;
          return (
            <WatchedActivityPanel
              key={repoTab.id}
              source={{ kind: 'repo', owner: repoTab.owner, repo: repoTab.repo }}
              events={eventsRef.current}
              actions={watchedActivityPanelActions}
            />
          );
        }
        default:
          return null;
      }
    },
    // NOTE: renderTabContent uses refs for events/onOpenRepository/feedMode to avoid recreating
    // this callback unnecessarily, but includes repositories to ensure activity feed updates properly
    [repositories]
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

  // Define all panels (must have 3 to position terminal in middle)
  const allPanels = useMemo(
    () => [
      {
        id: 'heatmap',
        label: feedMode === 'collections' ? 'Social' :
               feedMode === 'organizations' ? 'Team' : 'Activity',
        content: (
          <FeedLeftPanel
            repositories={repositories}
            events={events}
            feedMode={feedMode}
            onFeedModeChange={onFeedModeChange || (() => {})}
            commits={heatmapCommits}
            selectedBlock={selectedBlock}
            activityCommits={activityFeed.commits}
          />
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
      activityFeed.commits,
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
      theme,
    ]
  );

  return (
    <>
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

      {/* Delete Repository Modal */}
      <DeleteAlexandriaEntryModal
        isOpen={isDeleteModalOpen}
        entry={entryToDelete}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
        gitStatus={deleteGitStatus}
      />
    </>
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
