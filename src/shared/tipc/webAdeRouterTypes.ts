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
// Trail Inbox + Recently Visited (web-ade per-user trail feeds)
// =============================================================================

/**
 * One trail in a user's "recently visited" manifest.
 * Mirrors web-ade `src/lib/trails/types.ts`.
 */
export interface TrailRecentlyVisitedEntry {
  id: string;
  title: string;
  owner: string;
  repo: string;
  /** The trail's own updatedAt, snapshotted at visit time. */
  updatedAt: string;
  /** ISO 8601 — when this user last opened the trail. */
  lastVisitedAt: string;
  /** Times this user has opened the trail since tracking began. */
  visitCount: number;
  /** Creator's GitHub login, for "{login}'s trail" subtitles. */
  createdByLogin?: string;
}

export interface ListRecentlyVisitedTrailsResponse {
  entries: TrailRecentlyVisitedEntry[];
}

/**
 * Minimal snapshot of the underlying shared trail carried on an inbox row,
 * so the list renders without a per-row fan-out. Subset of web-ade's
 * `SharedTrailIndexEntry`.
 */
export interface InboxTrailSnapshot {
  id: string;
  title: string;
  owner: string;
  repo: string;
  updatedAt: string;
}

/**
 * One delivered shared trail in a recipient's inbox.
 * Mirrors web-ade `src/lib/trails/types.ts`.
 */
export interface InboxIndexEntry {
  /** Trail id — foreign key into `/api/trails/by-id/{id}`. */
  trailId: string;
  /** Sender identity at send-time. */
  sender: { githubId: number; githubLogin: string };
  /** Optional sender note ("why I'm sharing this"). */
  comment?: string;
  /** ISO 8601 — server-stamped on send, refreshed on resend. */
  sentAt: string;
  /** ISO 8601 — server-stamped when the recipient marks the entry read. */
  readAt: string | null;
  /** Snapshot of the live trail entry at send-time. */
  snapshot: InboxTrailSnapshot;
  /** Resolved owner/repo for the trail — duplicated for fast list rendering. */
  owner: string;
  repo: string;
}

export interface GetInboxInput {
  /** Page size (server clamps to 1..100, default 50). */
  limit?: number;
  /** Opaque pagination cursor from a prior response. */
  cursor?: string;
  /** Only return unread entries. */
  unreadOnly?: boolean;
}

export interface ListInboxResponse {
  entries: InboxIndexEntry[];
  /** Total unread across the whole inbox (independent of filters/paging). */
  unreadCount: number;
  /** Present when more pages remain. */
  cursor?: string;
}

export interface InboxUnreadCountResponse {
  count: number;
}

/**
 * Send a shared trail to one or more GitHub-login recipients.
 * `shareId` is the web-ade share id (parsed from the share URL), NOT the
 * local trail-index id.
 */
export interface SendTrailInput {
  shareId: string;
  /** GitHub logins to deliver to (server caps at 50). */
  recipients: string[];
  /** Optional sender note (server caps at 500 chars). */
  comment?: string;
}

export interface SendTrailResponse {
  delivered: Array<{ login: string; githubId: number }>;
  failed: Array<{ login: string; reason: 'unknown_user' | 'invalid_login' }>;
}

/** A recipient a trail has been sent to. */
export interface OutboxRecipient {
  githubId: number;
  githubLogin: string;
}

/**
 * One trail the signed-in user has shared, in their outbox ("Sent").
 * Mirrors web-ade `src/lib/trails/types.ts`. One row per trail; recipients
 * accumulate across resends.
 */
export interface OutboxIndexEntry {
  /** Trail id — foreign key into `/api/trails/by-id/{id}`. */
  trailId: string;
  /** Everyone this trail has been delivered to, deduped by githubId. */
  recipients: OutboxRecipient[];
  /** Optional sender note from the most recent send. */
  comment?: string;
  /** ISO 8601 — most recent send/resend time. */
  sentAt: string;
  /** Snapshot of the live trail entry at send-time. */
  snapshot: InboxTrailSnapshot;
  /** Resolved owner/repo for the trail — duplicated for fast list rendering. */
  owner: string;
  repo: string;
}

export interface GetSentInput {
  /** Page size (server clamps to 1..100, default 50). */
  limit?: number;
  /** Opaque pagination cursor from a prior response. */
  cursor?: string;
}

export interface ListSentResponse {
  entries: OutboxIndexEntry[];
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
  getRecentlyVisitedTrails: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<ListRecentlyVisitedTrailsResponse>;
  };
  getInbox: {
    action: (args: {
      context: ActionContext;
      input: GetInboxInput;
    }) => Promise<ListInboxResponse>;
  };
  getInboxUnreadCount: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<InboxUnreadCountResponse>;
  };
  sendTrail: {
    action: (args: {
      context: ActionContext;
      input: SendTrailInput;
    }) => Promise<SendTrailResponse>;
  };
  getSent: {
    action: (args: {
      context: ActionContext;
      input: GetSentInput;
    }) => Promise<ListSentResponse>;
  };
};
