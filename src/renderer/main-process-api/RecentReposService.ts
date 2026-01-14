import type { RecentRepo } from '../../shared/main-process-api-interfaces/RecentReposAPI';

export class RecentReposService {
  static async getRecentRepos(): Promise<RecentRepo[]> {
    return window.mainProcess.recentRepos.getRecentRepos();
  }

  static async addRecentRepo(repo: Omit<RecentRepo, 'lastVisited'>): Promise<{ success: boolean; error?: string }> {
    return window.mainProcess.recentRepos.addRecentRepo(repo);
  }

  static async removeRecentRepo(owner: string, repo: string): Promise<{ success: boolean; error?: string }> {
    return window.mainProcess.recentRepos.removeRecentRepo(owner, repo);
  }

  static async clearRecentRepos(): Promise<{ success: boolean; error?: string }> {
    return window.mainProcess.recentRepos.clearRecentRepos();
  }
}
