export enum GitHubAPIEvent {
  DETECT_REPOSITORY = 'github:detect-repository',
  GET_ISSUES = 'github:get-issues',
  CREATE_ISSUE = 'github:create-issue',
  GET_PULL_REQUESTS = 'github:get-pull-requests',
  GET_REPOSITORY_COMMITS = 'github:get-repository-commits',
  //GET_THREAD = 'github:get-thread',
  REFRESH_DATA = 'github:refresh-data',
  CHECK_AUTH_STATUS = 'github:check-auth-status',
  GET_CHANGED_FILES = 'github:get-changed-files',
  GET_MARKDOWN_DOCUMENTS = 'github:get-markdown-documents',
  GET_FILE_CONTENT = 'github:get-file-content', // (owner, repo, path, ref?)
  GET_FILE_AGES = 'github:get-file-ages',
  GET_TREE = 'github:get-tree',
  GET_USER_REPOSITORIES = 'github:get-user-repositories',
  GET_USER_STARRED_REPOSITORIES = 'github:get-user-starred-repositories',
  GET_ORG_REPOSITORIES = 'github:get-org-repositories',
  GET_USER_ORGANIZATIONS = 'github:get-user-organizations',
  GET_TOKEN_SCOPES = 'github:get-token-scopes',
  GET_CURRENT_USER = 'github:get-current-user',
  GET_TOKEN_INFO = 'github:get-token-info',
  GET_USER_SSH_KEYS = 'github:get-user-ssh-keys',
  GET_USER_FOLLOWERS = 'github:get-user-followers',
  GET_USER_FOLLOWING = 'github:get-user-following',
  GET_ORG_MEMBERS = 'github:get-org-members',
  GET_USER = 'github:get-user',
  GET_USER_ORGANIZATIONS_FOR_USER = 'github:get-user-organizations-for-user',
  GET_USER_STARRED_REPOSITORIES_FOR_USER = 'github:get-user-starred-repositories-for-user',
  // Config fetching events (formerly ConfigAPI)
  FETCH_REMOTE_CONFIG = 'github:fetch-remote-config',
  FETCH_GITHUB_CONFIG = 'github:fetch-github-config',
  // Repository creation events
  CREATE_REPOSITORY = 'github:create-repository',
  GET_GITIGNORE_TEMPLATES = 'github:get-gitignore-templates',
  GET_LICENSE_TEMPLATES = 'github:get-license-templates',
  // Repository info and forking
  GET_REPOSITORY = 'github:get-repository',
  FORK_REPOSITORY = 'github:fork-repository',
  // Skill installation
  INSTALL_SKILL = 'github:install-skill',
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

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  body: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  draft?: boolean;
  comments: number;
  review_comments: number;
  user: {
    login: string;
    avatar_url: string;
  };
  head: {
    ref: string;
  };
  base: {
    ref: string;
  };
}

export interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  author?: {
    login: string;
    avatar_url: string;
  };
  committer?: {
    login: string;
    avatar_url: string;
  };
  html_url: string;
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
    avatar_url: string;
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
  stargazers_count?: number;
  /** License SPDX identifier (e.g., "MIT", "Apache-2.0") */
  license?: string | null;
}

export interface GitHubRepositoryPermissions {
  admin: boolean;
  maintain?: boolean;
  push: boolean;
  triage?: boolean;
  pull: boolean;
}

export interface GitHubRepositoryWithPermissions extends GitHubRepository {
  permissions?: GitHubRepositoryPermissions;
  parent?: GitHubRepository; // Present if this is a fork
  source?: GitHubRepository; // The root repo if this is a fork of a fork
}

export interface ForkRepositoryOptions {
  /** Organization to fork to (optional, defaults to user) */
  organization?: string;
  /** Name for the forked repo (optional, defaults to original name) */
  name?: string;
  /** Whether to fork only the default branch */
  default_branch_only?: boolean;
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

export interface GitHubOrgMember {
  login: string;
  id: number;
  avatar_url: string;
  type: 'User' | 'Bot';
  site_admin: boolean;
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

export interface GitHubSSHKey {
  id: number;
  key: string;
  title: string;
  created_at: string;
  verified: boolean;
  read_only: boolean;
}

export interface SSHKeysResponse {
  success: boolean;
  data?: GitHubSSHKey[];
  error?: string;
  needsPermission?: boolean;
}

export interface RepositoryFetchOptions {
  type?: 'all' | 'owner' | 'public' | 'private' | 'member';
  sort?: 'created' | 'updated' | 'pushed' | 'full_name';
  direction?: 'asc' | 'desc';
  perPage?: number;
  page?: number;
}

export interface CreateRepositoryInput {
  name: string;
  description?: string;
  private?: boolean;
  auto_init?: boolean;
  gitignore_template?: string;
  license_template?: string;
  has_issues?: boolean;
  has_projects?: boolean;
  has_wiki?: boolean;
  allow_squash_merge?: boolean;
  allow_merge_commit?: boolean;
  allow_rebase_merge?: boolean;
}

export interface GitHubRepositoryCreated extends GitHubRepository {
  clone_url: string;
  ssh_url: string;
  git_url: string;
  created_at: string;
  updated_at: string;
  default_branch: string;
}

export interface GitHubLicenseTemplate {
  key: string;
  name: string;
  spdx_id?: string;
  url?: string;
}

// Skill installation types
export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
}

export interface InstallSkillOptions {
  githubUrl: string;
  skillPath: string;
  destination: 'global-universal' | 'global-claude' | 'global-opencode' | 'global-cursor' | 'global-windsurf' | 'project-universal' | 'project-claude';
  repositoryPath?: string;
  skillName?: string;
}

export interface InstallSkillResult {
  success: boolean;
  installedPath?: string;
  filesInstalled?: string[];
  error?: string;
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
  getPullRequests: (
    owner: string,
    repo: string,
  ) => Promise<GitHubPullRequest[]>;
  getRepositoryCommits: (
    owner: string,
    repo: string,
    options?: { perPage?: number; page?: number },
  ) => Promise<GitHubCommit[]>;
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
  getUserStarredRepositories: (
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
  getUserSSHKeys: () => Promise<SSHKeysResponse>;
  getUserFollowers: (username?: string) => Promise<GitHubUser[]>;
  getUserFollowing: (username?: string) => Promise<GitHubUser[]>;
  getOrgMembers: (org: string) => Promise<GitHubOrgMember[]>;
  /** Get a specific user's profile */
  getUser: (username: string) => Promise<GitHubUser | null>;
  /** Get a specific user's public organizations */
  getUserOrganizationsForUser: (
    username: string,
  ) => Promise<GitHubOrganization[]>;
  /** Get a specific user's starred repositories */
  getUserStarredRepositoriesForUser: (
    username: string,
    options?: RepositoryFetchOptions,
  ) => Promise<GitHubRepository[]>;
  createRepository: (
    owner: string,
    input: CreateRepositoryInput,
    isOrganization: boolean,
  ) => Promise<GitHubRepositoryCreated>;
  getGitignoreTemplates: () => Promise<string[]>;
  getLicenseTemplates: () => Promise<GitHubLicenseTemplate[]>;
  /** Get repository info including permissions */
  getRepository: (
    owner: string,
    repo: string,
  ) => Promise<GitHubRepositoryWithPermissions | null>;
  /** Fork a repository */
  forkRepository: (
    owner: string,
    repo: string,
    options?: ForkRepositoryOptions,
  ) => Promise<GitHubRepositoryCreated | null>;
  /** Install a skill from GitHub to local directory */
  installSkill: (options: InstallSkillOptions) => Promise<InstallSkillResult>;
}
