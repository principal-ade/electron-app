export enum GitHubAPIEvent {
  DETECT_REPOSITORY = 'github:detect-repository',
  GET_ISSUES = 'github:get-issues',
  CREATE_ISSUE = 'github:create-issue',
  //GET_PULL_REQUESTS = 'github:get-pull-requests',
  //GET_THREAD = 'github:get-thread',
  REFRESH_DATA = 'github:refresh-data',
  CHECK_AUTH_STATUS = 'github:check-auth-status',
  GET_CHANGED_FILES = 'github:get-changed-files',
  GET_MARKDOWN_DOCUMENTS = 'github:get-markdown-documents',
  GET_FILE_CONTENT = 'github:get-file-content', // (owner, repo, path, ref?)
  GET_FILE_AGES = 'github:get-file-ages',
  GET_TREE = 'github:get-tree',
  GET_USER_REPOSITORIES = 'github:get-user-repositories',
  GET_ORG_REPOSITORIES = 'github:get-org-repositories',
  GET_USER_ORGANIZATIONS = 'github:get-user-organizations',
  GET_TOKEN_SCOPES = 'github:get-token-scopes',
  GET_CURRENT_USER = 'github:get-current-user',
  GET_TOKEN_INFO = 'github:get-token-info',
  // Config fetching events (formerly ConfigAPI)
  FETCH_REMOTE_CONFIG = 'github:fetch-remote-config',
  FETCH_GITHUB_CONFIG = 'github:fetch-github-config',
}

// Config fetching types (formerly from ConfigAPI)
export interface ConfigFetchRequest {
  url: string;
}

export interface ConfigFetchResponse {
  content: string | null;
  error?: string;
}

export interface GitHubConfigRequest {
  owner: string;
  repo: string;
  branch: string;
  path: string;
}

// Git remote information
export interface GitRemote {
  name: string;
  url: string;
  owner?: string;
  repo?: string;
}

// Pull request reference
export interface PullRequestReference {
  url?: string;
  html_url?: string;
  diff_url?: string;
  patch_url?: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  body: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  labels: Array<{
    id: number;
    name: string;
    color: string;
  }>;
  comments: number;
  user: {
    login: string;
    avatar_url: string;
  };
  assignees: Array<{
    login: string;
    avatar_url: string;
  }>;
  pull_request?: PullRequestReference;
}

export interface CreateIssueRequest {
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
}

export interface CreateIssueResponse {
  success: boolean;
  issue?: GitHubIssue;
  error?: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  private: boolean;
  html_url: string;
  description: string | null;
  fork: boolean;
  clone_url: string;
  updated_at: string;
  pushed_at: string;
  language: string | null;
  default_branch: string;
}

export interface GitHubOrganization {
  login: string;
  id: number;
  avatar_url: string;
  description: string | null;
}

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  company: string | null;
  location: string | null;
  email: string | null;
  bio: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
  private_repos?: number;
  total_private_repos?: number;
  owned_private_repos?: number;
  collaborators?: number;
  two_factor_authentication?: boolean;
}

export interface TokenInfo {
  scopes: string[];
  organizations: GitHubOrganization[];
  user: GitHubUser;
  rateLimit: {
    limit: number;
    remaining: number;
    reset: Date;
  };
}

export interface RepositoryFetchOptions {
  type?: 'all' | 'owner' | 'public' | 'private' | 'member';
  sort?: 'created' | 'updated' | 'pushed' | 'full_name';
  direction?: 'asc' | 'desc';
  perPage?: number;
  page?: number;
}

export interface GitHubAPI {
  detectRepository: (path: string) => Promise<{
    isGitRepository: boolean;
    remotes: GitRemote[];
    owner?: string;
    repo?: string;
    isGitHub: boolean;
  } | null>;
  getIssues: (owner: string, repo: string) => Promise<GitHubIssue[]>;
  createIssue: (
    owner: string,
    repo: string,
    issue: CreateIssueRequest,
  ) => Promise<CreateIssueResponse>;
  //getPullRequests: (
  //  owner: string,
  //  repo: string,
  //  options?: any,
  //) => Promise<any[]>;
  //getThread: (owner: string, repo: string, number: number) => Promise<any>;
  refreshData: (owner: string, repo: string) => Promise<void>;
  checkAuthStatus: () => Promise<{
    isAuthenticated: boolean;
    method: string;
    username?: string;
  }>;
  getChangedFiles: (directoryPath: string) => Promise<
    {
      path: string;
      status: 'added' | 'modified' | 'deleted' | 'renamed';
      lastModified?: Date;
    }[]
  >;
  getMarkdownDocuments: (
    owner: string,
    repo: string,
  ) => Promise<
    Array<{
      path: string;
      name: string;
      lastModified: string; // ISO string
      gitLastModified?: string; // ISO string
      size: number;
      isTracked: boolean;
    }>
  >;
  getFileContent: (
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ) => Promise<string | null>;
  getFileAges: (directoryPath: string) => Promise<
    Array<{
      path: string;
      lastCommitDate: string; // ISO string
      daysSinceLastCommit: number;
    }>
  >;
  getTree: (
    owner: string,
    repo: string,
    ref?: string,
  ) => Promise<{
    success: boolean;
    data?: {
      sha: string;
      url: string;
      tree: Array<{
        path: string;
        mode: string;
        type: 'blob' | 'tree';
        sha: string;
        size?: number;
        url: string;
      }>;
      truncated: boolean;
    };
    error?: string;
  } | null>;
  // Config fetching methods (formerly ConfigAPI)
  fetchRemoteConfig: (
    request: ConfigFetchRequest,
  ) => Promise<ConfigFetchResponse>;
  fetchGitHubConfig: (
    request: GitHubConfigRequest,
  ) => Promise<ConfigFetchResponse>;
  getUserRepositories: (
    options?: RepositoryFetchOptions,
  ) => Promise<GitHubRepository[]>;
  getOrgRepositories: (
    org: string,
    options?: RepositoryFetchOptions,
  ) => Promise<GitHubRepository[]>;
  getUserOrganizations: () => Promise<GitHubOrganization[]>;
  getTokenScopes: () => Promise<string[]>;
  getCurrentUser: () => Promise<GitHubUser | null>;
  getTokenInfo: () => Promise<TokenInfo | null>;
}
