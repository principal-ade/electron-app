/**
 * Shared types for Web-ADE data shapes.
 *
 * The hosted Web-ADE API (app.principal-ade.com) has been removed. These types
 * remain as data-shape definitions used by panel interfaces. Panel actions that
 * previously called the hosted API now return empty/null stubs.
 */

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
  // Optional aggregated metadata added by the feed pipeline
  totalCommits?: number;
  languages?: string[];
  insertions?: number;
  deletions?: number;
}

export interface TreeEntry {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
  sha?: string;
}

export interface GetTreeResponse {
  sha: string;
  tree: TreeEntry[];
  truncated?: boolean;
}

export interface DailyContribution {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface RepoContributionsResponse {
  contributions: DailyContribution[];
  totalCommits: number;
}

export interface RecentCommitActivity {
  sha: string;
  message: string;
  repo: string;
  committedAt: string;
  url: string;
}

export interface ContributedRepository {
  name: string;
  owner: string;
  url: string;
  description?: string;
  stars?: number;
  lastCommitAt?: string;
}

export interface UserActivityResponse {
  user: {
    login: string;
    avatarUrl?: string;
    url?: string;
  };
  recentCommits: RecentCommitActivity[];
  contributions: DailyContribution[];
  contributedRepositories?: ContributedRepository[];
}

export interface GetUserActivityInput {
  username: string;
  contributionDays?: number;
  activityDays?: number;
}

export interface GetPinnedRepositoriesInput {
  username: string;
}

export interface ExplainCommitData {
  sha: string;
  explanation: string;
}

export interface ExplainCommitsInput {
  commits: ExplainCommitData[];
  audienceLevel: 'maintainer' | 'non-technical';
  repoName: string;
}

export interface ExplainCommitsResponse {
  text: string;
  commits?: ExplainCommitData[];
}

export type WorkingChangeStatus =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'untracked';

export interface WorkingChangeData {
  path: string;
  oldPath?: string;
  status: WorkingChangeStatus;
  insertions: number;
  deletions: number;
  explicación?: string;
}

export interface ExplainWorkingChangesInput {
  repoPath: string;
  audienceLevel: 'maintainer' | 'non-technical';
}

export interface ExplainWorkingChangesResponse {
  text: string;
  changes?: WorkingChangeData[];
}
