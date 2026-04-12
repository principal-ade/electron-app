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
};
