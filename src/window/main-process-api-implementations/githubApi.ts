import { ipcRenderer } from 'electron';
import {
  type GitHubAPI,
  GitHubAPIEvent,
  ConfigFetchRequest,
  GitHubConfigRequest,
  CreateIssueRequest,
  CreateRepositoryInput,
} from '../../shared/main-process-api-interfaces/GitHubAPI';

export const githubAPI: GitHubAPI = {
  detectRepository: async (path: string) => {
    return ipcRenderer.invoke(GitHubAPIEvent.DETECT_REPOSITORY, path);
  },

  refreshData: async (owner: string, repo: string) => {
    return ipcRenderer.invoke(GitHubAPIEvent.REFRESH_DATA, owner, repo);
  },

  checkAuthStatus: async () => {
    return ipcRenderer.invoke(GitHubAPIEvent.CHECK_AUTH_STATUS);
  },

  getChangedFiles: async (directoryPath: string) => {
    return ipcRenderer.invoke(GitHubAPIEvent.GET_CHANGED_FILES, directoryPath);
  },

  getMarkdownDocuments: async (owner: string, repo: string) => {
    return ipcRenderer.invoke(
      GitHubAPIEvent.GET_MARKDOWN_DOCUMENTS,
      owner,
      repo,
    );
  },

  getFileContent: async (
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ) => {
    return ipcRenderer.invoke(
      GitHubAPIEvent.GET_FILE_CONTENT,
      owner,
      repo,
      path,
      ref,
    );
  },

  getFileAges: async (directoryPath: string) => {
    return ipcRenderer.invoke(GitHubAPIEvent.GET_FILE_AGES, directoryPath);
  },
  getTree: async (owner: string, repo: string, ref?: string) => {
    return ipcRenderer.invoke(GitHubAPIEvent.GET_TREE, owner, repo, ref);
  },

  getIssues: async (owner: string, repo: string) => {
    return ipcRenderer.invoke(GitHubAPIEvent.GET_ISSUES, owner, repo);
  },

  getPullRequests: async (owner: string, repo: string) => {
    return ipcRenderer.invoke(GitHubAPIEvent.GET_PULL_REQUESTS, owner, repo);
  },

  getRepositoryCommits: async (
    owner: string,
    repo: string,
    options?: { perPage?: number; page?: number },
  ) => {
    return ipcRenderer.invoke(
      GitHubAPIEvent.GET_REPOSITORY_COMMITS,
      owner,
      repo,
      options,
    );
  },

  createIssue: async (
    owner: string,
    repo: string,
    issue: CreateIssueRequest,
  ) => {
    return ipcRenderer.invoke(GitHubAPIEvent.CREATE_ISSUE, owner, repo, issue);
  },

  // Config fetching methods (formerly ConfigAPI)
  fetchRemoteConfig: async (request: ConfigFetchRequest) => {
    return ipcRenderer.invoke(GitHubAPIEvent.FETCH_REMOTE_CONFIG, request);
  },

  fetchGitHubConfig: async (request: GitHubConfigRequest) => {
    return ipcRenderer.invoke(GitHubAPIEvent.FETCH_GITHUB_CONFIG, request);
  },

  getUserRepositories: async (options) => {
    return ipcRenderer.invoke(GitHubAPIEvent.GET_USER_REPOSITORIES, options);
  },

  getUserStarredRepositories: async (options) => {
    return ipcRenderer.invoke(
      GitHubAPIEvent.GET_USER_STARRED_REPOSITORIES,
      options,
    );
  },

  getOrgRepositories: async (org, options) => {
    return ipcRenderer.invoke(
      GitHubAPIEvent.GET_ORG_REPOSITORIES,
      org,
      options,
    );
  },

  getUserOrganizations: async () => {
    return ipcRenderer.invoke(GitHubAPIEvent.GET_USER_ORGANIZATIONS);
  },

  getTokenScopes: async () => {
    return ipcRenderer.invoke(GitHubAPIEvent.GET_TOKEN_SCOPES);
  },

  getCurrentUser: async () => {
    return ipcRenderer.invoke(GitHubAPIEvent.GET_CURRENT_USER);
  },

  getTokenInfo: async () => {
    return ipcRenderer.invoke(GitHubAPIEvent.GET_TOKEN_INFO);
  },

  getUserSSHKeys: async () => {
    return ipcRenderer.invoke(GitHubAPIEvent.GET_USER_SSH_KEYS);
  },

  getUserFollowers: async (username) => {
    return ipcRenderer.invoke(GitHubAPIEvent.GET_USER_FOLLOWERS, username);
  },

  getUserFollowing: async (username) => {
    return ipcRenderer.invoke(GitHubAPIEvent.GET_USER_FOLLOWING, username);
  },

  getOrgMembers: async (org) => {
    return ipcRenderer.invoke(GitHubAPIEvent.GET_ORG_MEMBERS, org);
  },

  createRepository: async (
    owner: string,
    input: CreateRepositoryInput,
    isOrganization: boolean,
  ) => {
    return ipcRenderer.invoke(
      GitHubAPIEvent.CREATE_REPOSITORY,
      owner,
      input,
      isOrganization,
    );
  },

  getGitignoreTemplates: async () => {
    return ipcRenderer.invoke(GitHubAPIEvent.GET_GITIGNORE_TEMPLATES);
  },

  getLicenseTemplates: async () => {
    return ipcRenderer.invoke(GitHubAPIEvent.GET_LICENSE_TEMPLATES);
  },
};
