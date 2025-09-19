import { GitBranchService } from './gitBranchService';
import { gitClientFactory } from '../utils/gitClientFactory';
import type { GitInfo } from '../../shared/types/git.types';

export class GitService {
  private gitInfoCache: Map<string, { info: GitInfo; timestamp: number }> =
    new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private branchService = new GitBranchService();

  /**
   * Get git information for a directory
   */
  async getGitInfo(directory: string): Promise<GitInfo | null> {
    console.log(`[GitService] Getting git info for directory: "${directory}"`);

    // Check cache
    const cached = this.gitInfoCache.get(directory);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log(`[GitService] Using cached git info for: "${directory}"`);
      return cached.info;
    }

    try {
      // Get git root using simple-git
      console.log(
        `[GitService] Finding git root for directory: "${directory}"`,
      );
      const root = await gitClientFactory.findGitRoot(directory);
      if (!root) {
        console.log(
          `[GitService] No git root found for directory: "${directory}"`,
        );
        return null;
      }
      console.log(
        `[GitService] Found git root: "${root}" for directory: "${directory}"`,
      );

      // Get comprehensive branch information
      const branchInfo = await this.branchService.getBranchInfo(root);

      // Get remote URL
      let remoteUrl: string | undefined;
      let owner: string | undefined;
      let repo: string | undefined;

      try {
        const remoteOut = await gitClientFactory.getConfig(
          root,
          'remote.origin.url',
        );
        if (remoteOut) {
          remoteUrl = this.normalizeGitUrl(remoteOut);
        }

        // Extract owner and repo from URL
        if (remoteUrl) {
          const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
          if (match) {
            owner = match[1];
            repo = match[2];
          }
        }
      } catch {
        // No remote configured
      }

      // Get HEAD commit SHA
      let headCommit: string | undefined;
      try {
        const git = await gitClientFactory.getClient(root);
        const revparse = await git.revparse(['HEAD']);
        if (revparse) {
          headCommit = revparse.trim();
        }
      } catch {
        // Unable to get HEAD commit
      }

      const info: GitInfo = {
        root,
        remoteUrl,
        branch: branchInfo?.currentBranch,
        defaultBranch: branchInfo?.defaultBranch,
        availableBranches: branchInfo?.availableBranches,
        owner,
        repo,
        headCommit,
      };

      // Cache the result
      this.gitInfoCache.set(directory, { info, timestamp: Date.now() });

      return info;
    } catch (error) {
      // Not a git repository
      console.log(`[GitService] Error getting git info for: "${directory}"`);
      console.log(`[GitService] Error details:`, error);
      return null;
    }
  }

  /**
   * Normalize git URL to https format
   */
  private normalizeGitUrl(url: string): string {
    // Convert SSH URLs to HTTPS
    if (url.startsWith('git@github.com:')) {
      return url
        .replace('git@github.com:', 'https://github.com/')
        .replace(/\.git$/, '');
    }

    // Remove .git suffix
    return url.replace(/\.git$/, '');
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.gitInfoCache.clear();
  }
}
