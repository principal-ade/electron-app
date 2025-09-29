import type {
  RepositoryFetchOptions,
  GitHubRepository,
  GitHubOrganization,
  GitHubUser,
  TokenInfo
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
    const result = await window.mainProcess.github.getTree(
      owner,
      repo,
      branch,
    );
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

  static async createIssue(owner: string, repo: string, issue: any) {
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

  static async getUserRepositories(options?: RepositoryFetchOptions): Promise<GitHubRepository[]> {
    const result = await window.mainProcess.github.getUserRepositories(options);
    return result || [];
  }

  static async getOrgRepositories(
    org: string,
    options?: RepositoryFetchOptions
  ): Promise<GitHubRepository[]> {
    const result = await window.mainProcess.github.getOrgRepositories(org, options);
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
}
