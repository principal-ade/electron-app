/**
 * Web-ADE TIPC Router Types
 *
 * Shared TypeScript types for web-ade TIPC router communication.
 * These types are used by both the main process router and renderer client.
 */

import type { ActionContext } from '@egoist/tipc/main';

// =============================================================================
// Input Types
// =============================================================================

export interface GetCommitQueueInput {
  limit: number;
}

export interface GetActivityHeatmapInput {
  hoursBack: number;
  authorLogins?: string[];
  repoIds?: string[];
}

export interface WatchUserInput {
  login: string;
  type?: 'User' | 'Organization';
}

export interface UnwatchUserInput {
  login: string;
}

export interface WatchRepoInput {
  owner: string;
  repo: string;
}

export interface UnwatchRepoInput {
  owner: string;
  repo: string;
}

export interface GetTreeInput {
  owner: string;
  repo: string;
  ref?: string;
}

export interface GetRepoContributionsInput {
  owner: string;
  repo: string;
}

export interface GetStarredCollectionsInput {
  includeItems?: boolean;
}

export interface AddRepoToCollectionInput {
  collectionId: string;
  owner: string;
  repo: string;
}

export interface RemoveRepoFromCollectionInput {
  collectionId: string;
  owner: string;
  repo: string;
}

export interface CreateCollectionInput {
  name: string;
  description?: string;
  icon?: string;
}

// =============================================================================
// Response Types
// =============================================================================

export interface CommitAuthor {
  login: string;
  avatarUrl?: string;
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: CommitAuthor;
  committedAt: string;
  url: string;
}

export interface CommitActivityCard {
  itemId: string; // "YYYY-MM-DD:HH:owner/repo"
  repo: {
    owner: string;
    name: string;
  };
  hour: number; // 0-23 UTC
  hourBucket: string; // ISO timestamp for hour start
  commits: CommitInfo[];
  commitCount: number;
  latestCommitAt: string;
}

export interface WatchedUser {
  login: string;
  watchedAt: string;
  type?: 'User' | 'Organization';
}

export interface WatchedRepo {
  owner: string;
  repo: string;
  watchedAt: string;
}

export interface FeedWatches {
  watchedUsers: WatchedUser[];
  watchedRepos: WatchedRepo[];
}

export interface WatchUserResponse {
  success: boolean;
  watchedUsers: WatchedUser[];
}

export interface UnwatchUserResponse {
  success: boolean;
  watchedUsers: WatchedUser[];
}

export interface WatchRepoResponse {
  success: boolean;
  watchedRepos: WatchedRepo[];
}

export interface UnwatchRepoResponse {
  success: boolean;
  watchedRepos: WatchedRepo[];
}

export interface HeatmapCommit {
  timestamp: string;
  repoId: string; // "owner/repo"
  authorLogin: string;
  authorAvatarUrl?: string;
}

export interface HeatmapAuthor {
  login: string;
  avatarUrl?: string;
  commitCount: number;
}

export interface HeatmapRepo {
  id: string; // "owner/repo"
  owner: string;
  name: string;
  commitCount: number;
}

export interface ActivityHeatmapResponse {
  commits: HeatmapCommit[];
  authors: HeatmapAuthor[];
  repos: HeatmapRepo[];
  timeRange: {
    start: string;
    end: string;
  };
}

export interface TreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number;
  url?: string;
}

export interface GetTreeResponse {
  sha: string;
  url: string;
  tree: TreeEntry[];
  truncated: boolean;
}

export interface DailyContribution {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface RepoContributionsResponse {
  contributions: DailyContribution[];
  timeRange: {
    start: string;
    end: string;
  };
  totalCommits: number;
  pagesFetched: number;
  contributorsUsed: number;
}

export interface StarredCollectionRepo {
  owner: string;
  repo: string;
  addedAt: string;
}

export interface StarredCollectionUser {
  login: string;
  addedAt: string;
}

export interface StarredCollection {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  ownerType?: 'user' | 'org';
  ownerLogin?: string;
  repos: StarredCollectionRepo[];
  users: StarredCollectionUser[];
  createdAt: string;
  updatedAt: string;
}

export interface StarredCollectionsResponse {
  collections: StarredCollection[];
}

// =============================================================================
// User Activity Types (Commit-focused)
// =============================================================================

export interface RecentCommitActivity {
  id: string;
  timestamp: string;
  repository: string;
  repositoryUrl?: string;
  ownerType?: 'User' | 'Organization';
  isPrivate?: boolean;
  commitCount: number;
  additions?: number;
  deletions?: number;
}

export interface ContributedRepository {
  nameWithOwner: string;
  owner: string;
  name: string;
  url: string;
  commitCount: number;
  lastContributedAt: string;
  isPrivate: boolean;
  ownerType: 'User' | 'Organization';
}

export interface UserActivityResponse {
  user: {
    login: string;
    name: string | null;
    avatarUrl: string;
    followersCount: number;
  };
  recentCommits: RecentCommitActivity[]; // Last 24 hours of commits
  contributions: DailyContribution[]; // For heatmap (365 days)
  contributedRepos: ContributedRepository[]; // Repos contributed to (past ~5 months)
}

export interface GetUserActivityInput {
  username: string;
  contributionDays?: number; // Days of contribution heatmap data (default: 365)
  activityDays?: number; // Days of recent commit activity (default: 1)
}

export interface GetPinnedRepositoriesInput {
  username: string;
}

export interface ExplainCommitData {
  sha: string;
  message: string;
  author: string;
  additions?: number;
  deletions?: number;
  filesChanged?: number;
}

export interface ExplainCommitsInput {
  commits: ExplainCommitData[];
  audienceLevel: 'maintainer' | 'non-technical';
  repoName: string;
}

export interface ExplainCommitsResponse {
  text: string;
}

export type WorkingChangeStatus =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'untracked';

export interface WorkingChangeData {
  path: string;
  status: WorkingChangeStatus;
  additions?: number;
  deletions?: number;
  staged: boolean;
}

export interface ExplainWorkingChangesInput {
  changes: WorkingChangeData[];
  audienceLevel: 'maintainer' | 'non-technical';
  repoName: string;
  branch?: string;
}

export interface ExplainWorkingChangesResponse {
  text: string;
}

// =============================================================================
// Router Type Definition
// =============================================================================

/**
 * Web-ADE router type definition for TIPC.
 * Defines the methods available via IPC and their input/output types.
 * Compatible with TIPC RouterType.
 */
export type WebAdeRouterType = Record<
  string,
  { action: (args: { context: ActionContext; input: unknown }) => Promise<unknown> }
> & {
  isAuthenticated: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<boolean>;
  };
  getCommitQueue: {
    action: (args: {
      context: ActionContext;
      input: GetCommitQueueInput;
    }) => Promise<CommitActivityCard[]>;
  };
  getWatches: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<FeedWatches>;
  };
  getActivityHeatmap: {
    action: (args: {
      context: ActionContext;
      input: GetActivityHeatmapInput;
    }) => Promise<ActivityHeatmapResponse>;
  };
  watchUser: {
    action: (args: {
      context: ActionContext;
      input: WatchUserInput;
    }) => Promise<WatchUserResponse>;
  };
  unwatchUser: {
    action: (args: {
      context: ActionContext;
      input: UnwatchUserInput;
    }) => Promise<UnwatchUserResponse>;
  };
  watchRepo: {
    action: (args: {
      context: ActionContext;
      input: WatchRepoInput;
    }) => Promise<WatchRepoResponse>;
  };
  unwatchRepo: {
    action: (args: {
      context: ActionContext;
      input: UnwatchRepoInput;
    }) => Promise<UnwatchRepoResponse>;
  };
  getGithubTree: {
    action: (args: {
      context: ActionContext;
      input: GetTreeInput;
    }) => Promise<GetTreeResponse>;
  };
  getRepoContributions: {
    action: (args: {
      context: ActionContext;
      input: GetRepoContributionsInput;
    }) => Promise<RepoContributionsResponse>;
  };
  getStarredCollections: {
    action: (args: {
      context: ActionContext;
      input: GetStarredCollectionsInput;
    }) => Promise<StarredCollection[]>;
  };
  createCollection: {
    action: (args: {
      context: ActionContext;
      input: CreateCollectionInput;
    }) => Promise<StarredCollection>;
  };
  addRepoToCollection: {
    action: (args: {
      context: ActionContext;
      input: AddRepoToCollectionInput;
    }) => Promise<void>;
  };
  removeRepoFromCollection: {
    action: (args: {
      context: ActionContext;
      input: RemoveRepoFromCollectionInput;
    }) => Promise<void>;
  };
  getUserActivity: {
    action: (args: {
      context: ActionContext;
      input: GetUserActivityInput;
    }) => Promise<UserActivityResponse>;
  };
  getPinnedRepositories: {
    action: (args: {
      context: ActionContext;
      input: GetPinnedRepositoriesInput;
    }) => Promise<string[]>;
  };
  explainCommits: {
    action: (args: {
      context: ActionContext;
      input: ExplainCommitsInput;
    }) => Promise<ExplainCommitsResponse>;
  };
  explainWorkingChanges: {
    action: (args: {
      context: ActionContext;
      input: ExplainWorkingChangesInput;
    }) => Promise<ExplainWorkingChangesResponse>;
  };
};
