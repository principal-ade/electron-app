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
  GitHubCommit,
} from '../../shared/main-process-api-interfaces/GitHubAPI';
import { githubClient } from '../tipc/githubClient';
import type { GetRepositoryCollaboratorsResponse } from '../../shared/tipc/githubRouterTypes';

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

  static async checkAuthStatus(): Promise<{ isAuthenticated: boolean; method: string; username?: string }> {
    return window.mainProcess.github.checkAuthStatus();
  }

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

  static async isRepositoryStarred(owner: string, repo: string): Promise<boolean> {
    return githubClient.isRepositoryStarred({ owner, repo });
  }

  static async starRepository(owner: string, repo: string): Promise<void> {
    return githubClient.starRepository({ owner, repo });
  }

  static async unstarRepository(owner: string, repo: string): Promise<void> {
    return githubClient.unstarRepository({ owner, repo });
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

  /**
   * Get repository commits with author avatar URLs
   */
  static async getRepositoryCommits(
    owner: string,
    repo: string,
    options?: { perPage?: number; page?: number },
  ): Promise<GitHubCommit[]> {
    const result = await window.mainProcess.github.getRepositoryCommits(
      owner,
      repo,
      options,
    );
    return result || [];
  }

  /**
   * Build a `GitHub login → primary git email` map by sampling recent commits.
   * The contributors endpoint omits emails; the commits endpoint is the only
   * place GitHub returns both fields side-by-side.
   * @param owner - Repo owner
   * @param repo - Repo name
   * @param perPage - Commits to sample (default 100; top contributors are
   *                 nearly always covered by the first page)
   * @returns Map<lowercased login, lowercased email>. First email seen per
   *          login wins.
   */
  static async getCommitAuthorEmailMap(
    owner: string,
    repo: string,
    perPage: number = 100,
  ): Promise<Map<string, string>> {
    try {
      const commits = await GithubService.getRepositoryCommits(owner, repo, { perPage });
      const map = new Map<string, string>();
      for (const c of commits) {
        const login = c.author?.login?.toLowerCase();
        const email = c.commit?.author?.email?.toLowerCase();
        if (login && email && !map.has(login)) {
          map.set(login, email);
        }
      }
      return map;
    } catch (error) {
      console.error('[GithubService] Failed to build commit author email map:', error);
      return new Map();
    }
  }

  /**
   * Get repository contributors from GitHub
   * Returns a list of contributors with their commit counts
   */
  static async getRepositoryContributors(
    owner: string,
    repo: string,
  ): Promise<Array<{ login: string; contributions: number; avatar_url: string }>> {
    try {
      const result = await window.mainProcess.github.getRepositoryContributors(
        owner,
        repo,
      );
      return result || [];
    } catch (error) {
      console.error('[GithubService] Failed to fetch contributors:', error);
      return [];
    }
  }

  static async getUserFollowers(username?: string): Promise<GitHubUser[]> {
    const result = await window.mainProcess.github.getUserFollowers(username);
    return result || [];
  }

  static async getUserFollowing(username?: string): Promise<GitHubUser[]> {
    const result = await window.mainProcess.github.getUserFollowing(username);
    return result || [];
  }

  static async isFollowingUser(username: string): Promise<boolean> {
    return githubClient.isFollowingUser({ username });
  }

  static async followUser(username: string): Promise<void> {
    return githubClient.followUser({ username });
  }

  static async unfollowUser(username: string): Promise<void> {
    return githubClient.unfollowUser({ username });
  }

  static async getOrgMembers(org: string): Promise<GitHubOrgMember[]> {
    const result = await window.mainProcess.github.getOrgMembers(org);
    return result || [];
  }

  static async getUser(username: string): Promise<GitHubUser | null> {
    const result = await window.mainProcess.github.getUser(username);
    return result;
  }

  /**
   * List the collaborators (people with access) on a repository.
   * GitHub gates this behind write/maintain/admin access; a reader gets
   * `forbidden: true` with an empty list so callers can fall back to
   * manual recipient entry.
   */
  static async getRepositoryCollaborators(
    owner: string,
    repo: string,
  ): Promise<GetRepositoryCollaboratorsResponse> {
    try {
      return await githubClient.getRepositoryCollaborators({ owner, repo });
    } catch (error) {
      console.error('[GithubService] Failed to fetch collaborators:', error);
      return { collaborators: [], forbidden: false };
    }
  }

  /**
   * Search for GitHub users
   */
  static async searchUsers(
    query: string,
    options?: { perPage?: number },
  ): Promise<{ users: GitHubUser[]; totalCount: number }> {
    // TIPC migration: using type-safe githubClient
    const result = await githubClient.searchUsers({ query, perPage: options?.perPage });
    return result;
  }

  /**
   * Search for GitHub repositories
   */
  static async searchRepos(
    query: string,
    options?: { perPage?: number },
  ): Promise<{ repos: GitHubRepository[]; totalCount: number }> {
    // TIPC migration: using type-safe githubClient
    const result = await githubClient.searchRepos({ query, perPage: options?.perPage });
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

  // ============================================================================
  // Commit Data Methods for ProjectInfoPanel (Remote Repositories)
  // ============================================================================

  /**
   * Get commit dates aggregated by day for heat map visualization
   */
  static async getCommitDatesForHeatMap(
    owner: string,
    repo: string,
    days?: number,
  ): Promise<{ date: string; count: number }[]> {
    const result = await window.mainProcess.github.getCommitDatesForHeatMap(
      owner,
      repo,
      days,
    );
    return result || [];
  }

  /**
   * Get all commits in a date range (for playback)
   */
  static async getCommitsInDateRange(
    owner: string,
    repo: string,
    startDate: string,
    endDate: string,
  ): Promise<GitHubCommit[]> {
    const result = await window.mainProcess.github.getCommitsInDateRange(
      owner,
      repo,
      startDate,
      endDate,
    );
    return result || [];
  }

  /**
   * Get the most recent commit
   */
  static async getLatestCommit(
    owner: string,
    repo: string,
  ): Promise<GitHubCommit | null> {
    const result = await window.mainProcess.github.getLatestCommit(owner, repo);
    return result;
  }

  /**
   * Get file tree at a specific commit (for historical File City)
   */
  static async getFileTreeAtCommit(
    owner: string,
    repo: string,
    sha: string,
  ): Promise<string[]> {
    const result = await window.mainProcess.github.getFileTreeAtCommit(
      owner,
      repo,
      sha,
    );
    return result || [];
  }

  /**
   * Get changed files for a specific commit (for highlight layers)
   * Returns file info including status and line counts
   */
  static async getOwnerActivity(login: string, type: 'User' | 'Organization', days?: number) {
    return githubClient.getOwnerActivity({ login, type, days });
  }

  static async getRepoActivity(owner: string, repo: string, days?: number) {
    return githubClient.getRepoActivity({ owner, repo, days });
  }

  static async getChangedFilesForCommit(
    owner: string,
    repo: string,
    sha: string,
  ): Promise<Map<string, { status: 'added' | 'modified' | 'deleted' | 'renamed'; additions: number; deletions: number }>> {
    const result = await window.mainProcess.github.getChangedFilesForCommit(
      owner,
      repo,
      sha,
    );
    // Convert plain object back to Map
    return new Map(Object.entries(result || {})) as Map<
      string,
      { status: 'added' | 'modified' | 'deleted' | 'renamed'; additions: number; deletions: number }
    >;
  }

  static async getCommitDiff(owner: string, repo: string, sha: string): Promise<string> {
    return window.mainProcess.github.getCommitDiff(owner, repo, sha);
  }

  static async resolveAuthorProfiles(
    owner: string,
    repo: string,
    emails: string[],
  ): Promise<Map<string, { login: string; avatarUrl: string }>> {
    const result = await window.mainProcess.github.resolveAuthorProfiles(
      owner,
      repo,
      emails,
    );
    return new Map(Object.entries(result || {}));
  }
}
