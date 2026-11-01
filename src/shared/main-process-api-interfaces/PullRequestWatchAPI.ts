/**
 * Pull Request Watch API
 *
 * A "watched" pull request is one the user (or an agent via the Principal MCP
 * bridge) asked the app to keep an eye on. The main process polls GitHub and
 * keeps a small snapshot per PR so Home can show its state and notify on
 * transitions (checks finished, review decided, merged/closed).
 *
 * Identity is `owner/repo#number`; the OS has no part in it.
 */

export type WatchedPullRequestState = 'open' | 'closed' | 'merged';

export type PullRequestChecksStatus =
  | 'none'
  | 'pending'
  | 'success'
  | 'failure';

export type PullRequestReviewState =
  | 'none'
  | 'pending'
  | 'approved'
  | 'changes_requested';

export interface PullRequestChecksSummary {
  status: PullRequestChecksStatus;
  total: number;
  passed: number;
  failed: number;
  pending: number;
}

export interface WatchedPullRequest {
  /** `owner/repo#number`, lowercase owner and repo. */
  id: string;
  owner: string;
  repo: string;
  number: number;
  /** Browser URL for the pull request on GitHub. */
  url: string;
  title: string;
  author?: string;
  state: WatchedPullRequestState;
  draft: boolean;
  headSha?: string;
  headRef?: string;
  baseRef?: string;
  /** GitHub's mergeability computation; null while it is still calculating. */
  mergeable?: boolean | null;
  checks: PullRequestChecksSummary;
  review: PullRequestReviewState;
  /** When the watch was added. */
  addedAt: number;
  /** When the snapshot last changed. */
  updatedAt: number;
  /** When GitHub was last asked, regardless of outcome. */
  lastPolledAt?: number;
  /** When the PR reached a terminal state; the watch expires some time later. */
  closedAt?: number;
  /** Last polling failure, cleared on the next success. */
  pollError?: string;
}

export interface PullRequestWatchResult {
  success: boolean;
  error?: string;
  pullRequest?: WatchedPullRequest;
}

/** IPC channel names for the pull request watch list. */
export enum PullRequestWatchEvents {
  LIST = 'pr-watch:list',
  WATCH = 'pr-watch:watch',
  UNWATCH = 'pr-watch:unwatch',
  REFRESH = 'pr-watch:refresh',
  CHANGED = 'pr-watch:changed',
}

export interface PullRequestWatchAPI {
  /** Snapshot of every watched pull request. */
  list: () => Promise<WatchedPullRequest[]>;
  /** Watch a PR given a GitHub URL, `owner/repo#number`, or `owner/repo/pull/number`. */
  watch: (target: string) => Promise<PullRequestWatchResult>;
  /** Stop watching a PR by id. */
  unwatch: (id: string) => Promise<{ success: boolean; error?: string }>;
  /** Poll one PR (or all) now instead of waiting for the next tick. */
  refresh: (id?: string) => Promise<WatchedPullRequest[]>;
  /** Subscribe to watch list changes; returns an unsubscribe function. */
  onChanged: (
    callback: (pullRequests: WatchedPullRequest[]) => void,
  ) => () => void;
}
