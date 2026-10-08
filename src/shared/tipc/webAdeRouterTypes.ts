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

export interface GetOwnerStarredCollectionsInput {
  owner: string;
  includeItems?: boolean;
}

export interface OwnerStarredCollectionsResponse {
  owner: {
    login: string;
    id: number;
    avatar_url: string;
    name: string | null;
    type: 'User' | 'Organization';
  };
  collections: StarredCollection[];
  version: number;
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

/** Unread count returned by the topic inbox endpoint. */
export interface TopicInboxUnreadCountResponse {
  count: number;
}

// =============================================================================
// Topic Inbox (web-ade per-user topic delivery feed)
// =============================================================================

/**
 * Minimal snapshot of the underlying topic carried on a topic-inbox row, so
 * the list renders without a per-row fetch. Mirrors web-ade's
 * `TopicByUserEntry` (`src/lib/topics/types.ts`).
 */
export interface TopicInboxSnapshot {
  id: string;
  title: string;
  /** First ~140 chars of the topic description, plaintext. */
  descriptionPreview: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * One delivered topic in a recipient's topic inbox.
 * Mirrors web-ade `src/lib/topics/types.ts` `TopicInboxIndexEntry`.
 */
export interface TopicInboxIndexEntry {
  /** Topic id — foreign key into `/api/topics/by-id/{id}`. */
  topicId: string;
  /** Sender identity at send-time. */
  sender: { githubId: number; githubLogin: string };
  /** Optional sender note ("why I'm sharing this"). */
  comment?: string;
  /** ISO 8601 — server-stamped on send, refreshed on resend. */
  sentAt: string;
  /** ISO 8601 — server-stamped when the recipient marks the entry read. */
  readAt: string | null;
  /** Slim topic summary at send-time. */
  snapshot: TopicInboxSnapshot;
}

export interface GetTopicInboxInput {
  /** Page size (server clamps to 1..100, default 50). */
  limit?: number;
  /** Opaque pagination cursor from a prior response. */
  cursor?: string;
  /** Only return unread entries. */
  unreadOnly?: boolean;
}

export interface ListTopicInboxResponse {
  entries: TopicInboxIndexEntry[];
  /** Total unread across the whole topic inbox (independent of filters/paging). */
  unreadCount: number;
  /** Present when more pages remain. */
  cursor?: string;
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
  {
    action: (args: {
      context: ActionContext;
      input: unknown;
    }) => Promise<unknown>;
  }
> & {
  isAuthenticated: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<boolean>;
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
  getOwnerStarredCollections: {
    action: (args: {
      context: ActionContext;
      input: GetOwnerStarredCollectionsInput;
    }) => Promise<OwnerStarredCollectionsResponse>;
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
  getTopicInbox: {
    action: (args: {
      context: ActionContext;
      input: GetTopicInboxInput;
    }) => Promise<ListTopicInboxResponse>;
  };
  getTopicInboxUnreadCount: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<TopicInboxUnreadCountResponse>;
  };
};
