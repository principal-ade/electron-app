import { exec } from 'child_process';
import { promisify } from 'util';
import { gitClientFactory } from '../utils/gitClientFactory';
import type { BranchInfo } from '../../shared/types/git.types';

export type { BranchInfo } from '../../shared/types/git.types';

const execAsync = promisify(exec);

export class GitBranchService {
  /**
   * Get comprehensive branch information for a git repository
   * Uses multiple fallback methods to ensure we get the information
   */
  async getBranchInfo(directory: string): Promise<BranchInfo | null> {
    try {
      // First, ensure we're in a git repository
      const gitRoot = await this.getGitRoot(directory);
      if (!gitRoot) return null;

      const [
        currentBranch,
        defaultBranch,
        availableBranches,
        remotes,
        currentCommit,
      ] = await Promise.all([
        this.getCurrentBranch(gitRoot),
        this.getDefaultBranch(gitRoot),
        this.getAvailableBranches(gitRoot),
        this.getRemotes(gitRoot),
        this.getCurrentCommit(gitRoot),
      ]);

      // Get branch status if we have a current branch
      let branchStatus = undefined;
      if (currentBranch) {
        branchStatus = await this.getBranchStatus(gitRoot, currentBranch);
      }

      return {
        currentBranch,
        defaultBranch,
        availableBranches,
        remotes,
        currentCommit,
        branchStatus,
      };
    } catch (error) {
      console.error('[GitBranchService] Error getting branch info:', error);
      return null;
    }
  }

  /**
   * Get the git root directory
   */
  private async getGitRoot(directory: string): Promise<string | null> {
    // Use simple-git through GitClientFactory
    return await gitClientFactory.findGitRoot(directory);
  }

  /**
   * Get current branch using multiple methods
   */
  private async getCurrentBranch(gitRoot: string): Promise<string | undefined> {
    // Use simple-git through GitClientFactory - handles all the fallback logic internally
    return (await gitClientFactory.getCurrentBranch(gitRoot)) || undefined;
  }

  /**
   * Get default branch using multiple methods
   * This is crucial for repositories, especially private ones
   */
  private async getDefaultBranch(gitRoot: string): Promise<string | undefined> {
    // TODO: BLOCKING - All remote operations commented out
    // These should be moved to gitRemote cache slice
    // See: docs/design/GIT_REMOTE_INFORMATION_ARCHITECTURE.md

    // // Method 1: Try to get from remote HEAD (requires fetch)
    // try {
    //   const { stdout } = await execAsync(
    //     'git symbolic-ref refs/remotes/origin/HEAD',
    //     { cwd: gitRoot },
    //   );
    //   const branch = stdout.trim().replace('refs/remotes/origin/', '');
    //   if (branch) return branch;
    // } catch {
    //   // Remote HEAD not set, try to set it
    //   try {
    //     await execAsync('git remote set-head origin --auto', { cwd: gitRoot });
    //     const { stdout } = await execAsync(
    //       'git symbolic-ref refs/remotes/origin/HEAD',
    //       { cwd: gitRoot },
    //     );
    //     const branch = stdout.trim().replace('refs/remotes/origin/', '');
    //     if (branch) return branch;
    //   } catch {
    //     // Could not set remote HEAD
    //   }
    // }

    // // Method 2: Try to get from git ls-remote (works without fetch)
    // try {
    //   const { stdout } = await execAsync('git ls-remote --symref origin HEAD', {
    //     cwd: gitRoot,
    //   });
    //   const match = stdout.match(/ref: refs\/heads\/(\S+)\s+HEAD/);
    //   if (match) return match[1];
    // } catch {
    //   // ls-remote failed (maybe no network or auth issues)
    // }

    // // Method 3: Check common default branch names
    // try {
    //   const { stdout } = await execAsync('git branch -r', { cwd: gitRoot });
    //   const remoteBranches = stdout
    //     .split('\n')
    //     .map((b) => b.trim())
    //     .filter((b) => b && !b.includes('HEAD'))
    //     .map((b) => b.replace('origin/', ''));

    //   // Check for common default branch names in order of preference
    //   const commonDefaults = [
    //     'main',
    //     'master',
    //     'develop',
    //     'development',
    //     'trunk',
    //   ];
    //   for (const defaultName of commonDefaults) {
    //     if (remoteBranches.includes(defaultName)) {
    //       return defaultName;
    //     }
    //   }

    //   // If no common default found, use the first remote branch
    //   if (remoteBranches.length > 0) {
    //     return remoteBranches[0];
    //   }
    // } catch {
    //   // Could not list remote branches
    // }

    // Method 4: Check local branches if no remote info available
    try {
      const { stdout } = await execAsync('git branch', { cwd: gitRoot });
      const localBranches = stdout
        .split('\n')
        .map((b) => b.trim().replace('* ', ''))
        .filter((b) => b);

      // Check for common default branch names
      const commonDefaults = [
        'main',
        'master',
        'develop',
        'development',
        'trunk',
      ];
      for (const defaultName of commonDefaults) {
        if (localBranches.includes(defaultName)) {
          return defaultName;
        }
      }

      // Use the first local branch as fallback
      if (localBranches.length > 0) {
        return localBranches[0];
      }
    } catch {
      // Could not list local branches
    }

    // // Method 5: Try GitHub CLI if available (as last resort)
    // try {
    //   const remoteUrl = await this.getRemoteUrl(gitRoot);
    //   if (remoteUrl && remoteUrl.includes('github.com')) {
    //     const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    //     if (match) {
    //       const [, owner, repo] = match;
    //       try {
    //         const { stdout } = await execAsync(
    //           `gh api repos/${owner}/${repo} --jq .default_branch`,
    //           { cwd: gitRoot },
    //         );
    //         const branch = stdout.trim();
    //         if (branch) return branch;
    //       } catch {
    //         // GitHub CLI not available or not authenticated
    //       }
    //     }
    //   }
    // } catch {
    //   // Could not get remote URL or use GitHub CLI
    // }

    return undefined;
  }

  /**
   * Get all available branches (local and remote)
   */
  private async getAvailableBranches(gitRoot: string): Promise<string[]> {
    const branches = new Set<string>();

    // Get local branches using simple-git
    try {
      const localBranches = await gitClientFactory.getLocalBranches(gitRoot);
      localBranches.forEach((branch) => branches.add(branch));
    } catch {
      // Could not get local branches
    }

    // TODO: BLOCKING - Remote branch fetching commented out
    // This should be moved to gitRemote cache slice
    // See: docs/design/GIT_REMOTE_INFORMATION_ARCHITECTURE.md

    // // Get remote branches using simple-git
    // try {
    //   const remoteBranches = await gitClientFactory.getRemoteBranches(gitRoot);
    //   remoteBranches.forEach((branch) => {
    //     if (!branch.includes('HEAD')) {
    //       // Remove 'remotes/origin/' prefix
    //       const branchName = branch.replace(/^remotes\/origin\//, '');
    //       branches.add(branchName);
    //     }
    //   });
    // } catch {
    //   // Could not get remote branches
    // }

    return Array.from(branches).sort();
  }

  /**
   * Get list of remotes
   */
  private async getRemotes(gitRoot: string): Promise<string[]> {
    try {
      const remotes = await gitClientFactory.getRemotes(gitRoot);
      return remotes.map((r) => r.name);
    } catch {
      return [];
    }
  }

  /**
   * Get the remote URL for origin
   */
  private async getRemoteUrl(gitRoot: string): Promise<string | undefined> {
    try {
      return (
        (await gitClientFactory.getConfig(gitRoot, 'remote.origin.url')) || ''
      );
    } catch {
      return undefined;
    }
  }

  /**
   * Get the current commit hash
   */
  private async getCurrentCommit(gitRoot: string): Promise<string | undefined> {
    try {
      return (await gitClientFactory.getCurrentCommit(gitRoot)) || '';
    } catch {
      return undefined;
    }
  }

  /**
   * Get branch status relative to remote
   */
  private async getBranchStatus(
    gitRoot: string,
    branch: string,
  ): Promise<
    | {
        ahead: number;
        behind: number;
        upToDate: boolean;
      }
    | undefined
  > {
    try {
      // First, check if we have a remote tracking branch
      const { stdout: trackingBranch } = await execAsync(
        `git rev-parse --abbrev-ref ${branch}@{upstream}`,
        { cwd: gitRoot },
      ).catch(() => ({ stdout: '' }));

      if (!trackingBranch.trim()) {
        // No remote tracking branch
        return undefined;
      }

      // Get ahead/behind counts
      const { stdout } = await execAsync(
        `git rev-list --left-right --count ${branch}...${trackingBranch.trim()}`,
        { cwd: gitRoot },
      );

      const [ahead, behind] = stdout
        .trim()
        .split('\t')
        .map((n) => parseInt(n, 10));

      return {
        ahead: ahead || 0,
        behind: behind || 0,
        upToDate: ahead === 0 && behind === 0,
      };
    } catch (error) {
      console.log('[GitBranchService] Could not get branch status:', error);
      return undefined;
    }
  }

  /**
   * Fetch latest information from remote (if possible)
   * This is useful to ensure we have the latest branch information
   */
  async fetchRemoteInfo(directory: string): Promise<boolean> {
    // TODO: BLOCKING - git fetch is a blocking network operation
    // This should be moved to gitRemote cache slice
    // See: docs/design/GIT_REMOTE_INFORMATION_ARCHITECTURE.md

    console.warn(
      '[GitBranchService] fetchRemoteInfo is currently disabled to prevent blocking operations',
    );
    return false;

    // try {
    //   const gitRoot = await this.getGitRoot(directory);
    //   if (!gitRoot) return false;

    //   // Try to fetch with a short timeout
    //   await execAsync('git fetch --timeout=5', { cwd: gitRoot });
    //   return true;
    // } catch {
    //   // Fetch failed (network issue, auth issue, etc.)
    //   return false;
    // }
  }
}
