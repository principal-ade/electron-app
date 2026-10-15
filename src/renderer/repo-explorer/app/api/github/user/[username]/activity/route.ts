/**
 * Type-only stub for web-ade's
 * `app/api/github/user/[username]/activity/route`.
 *
 * The ported page imports `UserActivityResponse` as a type only. The route
 * itself is a Next server handler; this file keeps the type import resolvable.
 */

export type ReactionContent =
  | 'THUMBS_UP'
  | 'THUMBS_DOWN'
  | 'LAUGH'
  | 'HOORAY'
  | 'CONFUSED'
  | 'HEART'
  | 'ROCKET'
  | 'EYES';

export interface ReactionCounts {
  totalCount: number;
  counts: Partial<Record<ReactionContent, number>>;
  viewerReactions: Partial<Record<ReactionContent, number>>;
  users: Partial<Record<ReactionContent, string[]>>;
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

export interface ContributedRepo {
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
    bio: string | null;
    company: string | null;
    location: string | null;
    websiteUrl: string | null;
    twitterUsername: string | null;
    htmlUrl: string;
    followersCount: number;
    followingCount: number;
  };
  activity: ActivityEvent[];
  contributions: DailyContribution[];
  contributedRepos: ContributedRepo[];
}
