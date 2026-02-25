import type {
  RepositoryFetchOptions,
  GitHubRepository,
  GitHubOrganization,
  GitHubUser,
  TokenInfo,
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
import { githubClient } from '../tipc/githubClient';

// DELETED: detectRepository - unused (0 calls)
// DELETED: fetchConfigFromGitHub - unused (0 calls)
// DELETED: fetchRemoteConfig - unused (0 calls)
// DELETED: getIssues - unused (0 calls)
// DELETED: getPullRequests - unused (0 calls)
// DELETED: createIssue - unused (0 calls)

export class GithubService {
  static async getTree(owner: string, repo: string, branch: string) {
    const result = await window.mainProcess.github.getTree(owner, repo, branch);
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

  // DELETED: checkAuthStatus - unused (0 calls)

  static async getUserRepositories(
    options?: RepositoryFetchOptions,
  ): Promise<GitHubRepository[]> {
    // TIPC migration: using type-safe githubClient
    const result = await githubClient.getUserRepositories({ options });
    return result || [];
  }

  static async getUserStarredRepositories(
    options?: RepositoryFetchOptions,
  ): Promise<GitHubRepository[]> {
    // TIPC migration: using type-safe githubClient
    const result = await githubClient.getUserStarredRepositories({ options });
    return result || [];
  }

  static async getOrgRepositories(
    org: string,
    options?: RepositoryFetchOptions,
  ): Promise<GitHubRepository[]> {
    // TIPC migration: using type-safe githubClient
    const result = await githubClient.getOrgRepositories({ org, options });
    return result || [];
  }

  static async getUserOrganizations(): Promise<GitHubOrganization[]> {
    // TIPC migration: using type-safe githubClient
    const result = await githubClient.getUserOrganizations();
    return result || [];
  }

  // DELETED: getTokenScopes - unused (0 calls)

  static async getCurrentUser(): Promise<GitHubUser | null> {
    // TIPC migration: using type-safe githubClient
    const result = await githubClient.getCurrentUser();
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

  // DELETED: getRepositoryCommits - unused (0 calls)

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
