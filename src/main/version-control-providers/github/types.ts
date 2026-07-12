/**
 * GitHub Adapter Types
 *
 * Type definitions for the GitHub integration layer.
 */

// Re-export types from shared interfaces that are used throughout
export type {
  GitHubAPIEvent,
  ConfigFetchRequest,
  ConfigFetchResponse,
  GitHubConfigRequest,
  GitHubRepository,
  GitHubOrganization,
  RepositoryFetchOptions,
  CreateRepositoryInput,
  GitHubRepositoryCreated,
  GitHubLicenseTemplate,
  InstallSkillOptions,
  InstallSkillResult,
  CreateIssueRequest,
  CreateIssueResponse,
  GitHubUser,
  GitHubSSHKey,
  SSHKeysResponse,
  ForkRepositoryOptions,
  GitHubIssue,
  GitHubPullRequest,
  GitHubCommit,
  GitHubOrgMember,
  GitHubRepositoryWithPermissions,
} from '../../../shared/main-process-api-interfaces/GitHubAPI';

// =============================================================================
// Git Repository Types
// =============================================================================

export interface GitRepositoryInfo {
  path: string;
  isGitRepository: boolean;
  remotes: GitRemoteInfo[];
  owner?: string;
  repo?: string;
  isGitHub: boolean;
  currentBranch?: string;
  defaultBranch?: string;
}

export interface GitRemoteInfo {
  name: string;
  url: string;
  owner?: string;
  repo?: string;
  isGitHub: boolean;
  provider?: 'github' | 'gitlab' | 'bitbucket' | 'other';
}

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface AuthStatus {
  isAuthenticated: boolean;
  method: 'cli' | 'token' | 'none';
  username?: string;
  scope?: string[];
  rateLimit?: {
    remaining: number;
    total: number;
    resetTime: Date;
  };
}

// =============================================================================
// API Types (for internal use)
// =============================================================================

/** JSON payload sent in API request body */
export type GitHubAPIRequestBody = unknown;

/** Response data from GitHub API (could be JSON object, array, or text) */
export type GitHubAPIResponseData = unknown;

/** HTTP response headers as key-value pairs */
export type GitHubAPIResponseHeaders = Record<string, string>;

/** Raw API response object from GitHub (before type validation) */
export type RawGitHubAPIResponse = Record<string, unknown>;

// =============================================================================
// Raw API Response Types (before mapping to our types)
// =============================================================================

/** Raw GitHub API repository response (before mapping to our types) */
export interface RawGitHubRepositoryResponse {
  id: unknown;
  name: unknown;
  full_name: unknown;
  owner: {
    login: unknown;
    avatar_url: unknown;
  };
  private: unknown;
  html_url: unknown;
  description: unknown;
  fork: unknown;
  clone_url: unknown;
  updated_at: unknown;
  pushed_at: unknown;
  language: unknown;
  default_branch: unknown;
  stargazers_count?: unknown;
  license?: {
    spdx_id: string;
  } | null;
  permissions?: {
    admin: boolean;
    maintain?: boolean;
    push: boolean;
    triage?: boolean;
    pull: boolean;
  };
}

/** Raw GitHub API organization response */
export interface RawGitHubOrganizationResponse {
  login: unknown;
  id: unknown;
  avatar_url: unknown;
  description: unknown;
  /** Present on full org profiles (`GET /orgs/{org}`), not always on list endpoints. */
  name?: unknown;
}

/** Raw GitHub API license template response */
export interface RawGitHubLicenseTemplateResponse {
  key: unknown;
  name: unknown;
  spdx_id: unknown;
  url: unknown;
}

/** Raw GitHub API commit info response (before type validation) */
export type GitHubCommitInfoResponse = {
  commit?: {
    author?: {
      name?: string;
      email?: string;
      date?: string;
    };
    committer?: {
      name?: string;
      email?: string;
      date?: string;
    };
    message?: string;
  };
  author?: Record<string, unknown>;
} | null;

// =============================================================================
// Content Types
// =============================================================================

/** Markdown document file info (local or remote) */
export interface MarkdownDocumentFile {
  path: string;
  name: string;
  size: number;
  lastModified: Date;
  gitLastModified?: Date;
  isTracked: boolean;
}

/** GitHub API tree response */
export interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: Array<{
    path: string;
    mode: string;
    type: 'blob' | 'tree';
    sha: string;
    size?: number;
    url?: string;
  }>;
  truncated: boolean;
}

/** Partial tree entry for git tree building (before full tree response) */
export interface PartialTreeEntry {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
}

// =============================================================================
// Cache Types
// =============================================================================

export interface CacheEntry {
  value: unknown;
  timestamp: number;
}

// =============================================================================
// API Call Result Types
// =============================================================================

export interface GitHubAPICallResult {
  success: boolean;
  data?: GitHubAPIResponseData;
  headers?: GitHubAPIResponseHeaders;
  status?: number;
  statusText?: string;
  error?: string;
}
