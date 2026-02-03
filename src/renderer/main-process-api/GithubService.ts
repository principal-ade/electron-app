import type {
  RepositoryFetchOptions,
  GitHubRepository,
  GitHubOrganization,
  GitHubUser,
  TokenInfo,
  GitHubPullRequest,
  CreateIssueRequest,
  SSHKeysResponse,
  GitHubOrgMember,
  CreateRepositoryInput,
  GitHubRepositoryCreated,
  GitHubLicenseTemplate,
  GitHubRepositoryWithPermissions,
  ForkRepositoryOptions,
  InstallSkillOptions,
  InstallSkillResult,
} from '../../shared/main-process-api-interfaces/GitHubAPI';

export class GithubService {
  static async detectRepository(path: string) {
    const result = await window.mainProcess.github.detectRepository(path);
    return result;
  }

  static async fetchConfigFromGitHub(
    owner: string,
    repo: string,
    branch: string,
    path: string,
  ) {
    const result = await window.mainProcess.github.fetchGitHubConfig({
      owner,
      repo,
      branch,
      path,
    });
    return result;
  }

  static async getTree(owner: string, repo: string, branch: string) {
    const result = await window.mainProcess.github.getTree(owner, repo, branch);
    return result;
  }

  static async fetchRemoteConfig(url: string) {
    const result = await window.mainProcess.github.fetchRemoteConfig({ url });
    return result;
  }

  static async getIssues(owner: string, repo: string) {
    const result = await window.mainProcess.github.getIssues(owner, repo);
    return result || [];
  }

  static async getPullRequests(
    owner: string,
    repo: string,
  ): Promise<GitHubPullRequest[]> {
    const result = await window.mainProcess.github.getPullRequests(owner, repo);
    return result || [];
  }

  static async createIssue(
    owner: string,
    repo: string,
    issue: CreateIssueRequest,
  ) {
    const result = await window.mainProcess.github.createIssue(
      owner,
      repo,
      issue,
    );
    return result;
  }

  static async getFileContent(
    owner: string,
    repo: string,
    path: string,
    branch?: string,
  ) {
    const result = await window.mainProcess.github.getFileContent(
      owner,
      repo,
      path,
      branch,
    );
    return result;
  }

  static async checkAuthStatus() {
    const result = await window.mainProcess.github.checkAuthStatus();
    return result;
  }

  static async getUserRepositories(
    options?: RepositoryFetchOptions,
  ): Promise<GitHubRepository[]> {
    const result = await window.mainProcess.github.getUserRepositories(options);
    return result || [];
  }

  static async getUserStarredRepositories(
    options?: RepositoryFetchOptions,
  ): Promise<GitHubRepository[]> {
    const result =
      await window.mainProcess.github.getUserStarredRepositories(options);
    return result || [];
  }

  static async getOrgRepositories(
    org: string,
    options?: RepositoryFetchOptions,
  ): Promise<GitHubRepository[]> {
    const result = await window.mainProcess.github.getOrgRepositories(
      org,
      options,
    );
    return result || [];
  }

  static async getUserOrganizations(): Promise<GitHubOrganization[]> {
    const result = await window.mainProcess.github.getUserOrganizations();
    return result || [];
  }

  static async getTokenScopes(): Promise<string[]> {
    const result = await window.mainProcess.github.getTokenScopes();
    return result || [];
  }

  static async getCurrentUser(): Promise<GitHubUser | null> {
    const result = await window.mainProcess.github.getCurrentUser();
    return result;
  }

  static async getTokenInfo(): Promise<TokenInfo | null> {
    const result = await window.mainProcess.github.getTokenInfo();
    return result;
  }

  static async getUserSSHKeys(): Promise<SSHKeysResponse> {
    const result = await window.mainProcess.github.getUserSSHKeys();
    return result;
  }

  static async getRepositoryCommits(
    owner: string,
    repo: string,
    options?: { perPage?: number; page?: number },
  ): Promise<any[]> {
    const result = await window.mainProcess.github.getRepositoryCommits(
      owner,
      repo,
      options,
    );
    return result || [];
  }

  static async getUserFollowers(username?: string): Promise<GitHubUser[]> {
    const result = await window.mainProcess.github.getUserFollowers(username);
    return result || [];
  }

  static async getUserFollowing(username?: string): Promise<GitHubUser[]> {
    const result = await window.mainProcess.github.getUserFollowing(username);
    return result || [];
  }

  static async getOrgMembers(org: string): Promise<GitHubOrgMember[]> {
    const result = await window.mainProcess.github.getOrgMembers(org);
    return result || [];
  }

  static async getUser(username: string): Promise<GitHubUser | null> {
    const result = await window.mainProcess.github.getUser(username);
    return result;
  }

  static async getUserOrganizationsForUser(
    username: string,
  ): Promise<GitHubOrganization[]> {
    const result =
      await window.mainProcess.github.getUserOrganizationsForUser(username);
    return result || [];
  }

  static async getUserStarredRepositoriesForUser(
    username: string,
    options?: RepositoryFetchOptions,
  ): Promise<GitHubRepository[]> {
    const result =
      await window.mainProcess.github.getUserStarredRepositoriesForUser(
        username,
        options,
      );
    return result || [];
  }

  static async createRepository(
    owner: string,
    input: CreateRepositoryInput,
    isOrganization: boolean = true,
  ): Promise<GitHubRepositoryCreated> {
    const result = await window.mainProcess.github.createRepository(
      owner,
      input,
      isOrganization,
    );
    return result;
  }

  static async getGitignoreTemplates(): Promise<string[]> {
    const result = await window.mainProcess.github.getGitignoreTemplates();
    return result || [];
  }

  static async getLicenseTemplates(): Promise<GitHubLicenseTemplate[]> {
    const result = await window.mainProcess.github.getLicenseTemplates();
    return result || [];
  }

  /**
   * Get repository info including permissions
   * Returns null if repo not found or user doesn't have access
   */
  static async getRepository(
    owner: string,
    repo: string,
  ): Promise<GitHubRepositoryWithPermissions | null> {
    const result = await window.mainProcess.github.getRepository(owner, repo);
    return result;
  }

  /**
   * Fork a repository to the authenticated user's account or an organization
   */
  static async forkRepository(
    owner: string,
    repo: string,
    options?: ForkRepositoryOptions,
  ): Promise<GitHubRepositoryCreated | null> {
    const result = await window.mainProcess.github.forkRepository(
      owner,
      repo,
      options,
    );
    return result;
  }

  /**
   * Install a skill from GitHub to a local directory
   */
  static async installSkill(
    options: InstallSkillOptions,
  ): Promise<InstallSkillResult> {
    const result = await window.mainProcess.github.installSkill(options);
    return result;
  }
}
