/**
 * GitLensAdapter - Minimal adapter to use GitLens from codebase-quality-lenses package
 * for Git operations in the electron app
 */

import { GitLens } from '@principal-ai/codebase-quality-lenses';
import { ElectronCLIBridgeExecutor } from './ElectronCLIBridgeExecutor';

// Use the CommitInfo type from GitLens
export type CommitInfo = {
  hash: string;
  shortHash: string;
  author: string;
  authorEmail: string;
  date: string;
  message: string;
  files?: number;
  insertions?: number;
  deletions?: number;
};

/**
 * Singleton adapter for GitLens operations
 * Provides a bridge between the electron app's Git needs and the GitLens implementation
 */
export class GitLensAdapter {
  private static instance: GitLensAdapter;
  private gitLens: GitLens;
  private executor: ElectronCLIBridgeExecutor;

  private constructor() {
    // Initialize our custom executor that uses electron-cli-bridge
    this.executor = new ElectronCLIBridgeExecutor();

    // Initialize GitLens
    this.gitLens = new GitLens();
    this.gitLens.setExecutor(this.executor);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): GitLensAdapter {
    if (!GitLensAdapter.instance) {
      GitLensAdapter.instance = new GitLensAdapter();
    }
    return GitLensAdapter.instance;
  }

  /**
   * Get current commit hash for a directory
   * Replaces GitClientFactory.getCurrentCommit()
   *
   * @param directory - The directory to get commit hash for
   * @returns Full commit hash or null if not a git repo or no commits
   */
  public async getCurrentCommit(directory: string): Promise<string | null> {
    try {
      // Configure GitLens for this directory
      this.gitLens.configure({
        cwd: directory,
        tool: {
          name: 'git',
          command: 'git',
          args: [], // Git commands are specified internally by GitLens
          cwd: directory,
          available: true,
        },
        includeCommitDetails: false, // We just need the hash
      });

      // Execute git commands
      const executeResult = await this.gitLens.execute();

      // Parse the raw results to get full hash (not shortened)
      const results = JSON.parse(executeResult.stdout);
      return results.commit || null;
    } catch (error) {
      // Silently return null if not a git repo or no commits
      return null;
    }
  }

  /**
   * Get detailed information about the last commit
   * This is useful for sorting repositories by last activity
   *
   * @param directory - The directory to get commit info for
   * @returns Commit details including date, author, message, or null if not available
   */
  public async getLastCommitInfo(directory: string): Promise<CommitInfo | null> {
    try {
      // Configure GitLens with commit details enabled
      this.gitLens.configure({
        cwd: directory,
        tool: {
          name: 'git',
          command: 'git',
          args: [], // Git commands are specified internally by GitLens
          cwd: directory,
          available: true,
        },
        includeCommitDetails: true, // Get full commit details
      });

      // Execute git commands
      const executeResult = await this.gitLens.execute();

      // Parse the results
      const gitInfo = this.gitLens.parse(executeResult);

      // Return the commit details (includes date for sorting)
      return gitInfo.commitDetails || null;
    } catch (error) {
      // Silently return null if not a git repo or no commits
      return null;
    }
  }

  /**
   * Get git status for a directory
   * Returns files categorized as staged, unstaged (modified), and untracked
   *
   * @param directory - The directory to get git status for
   * @returns Object with staged, unstaged, and untracked file arrays
   */
  public async getGitStatus(directory: string): Promise<{
    staged: string[];
    unstaged: string[];
    untracked: string[];
  }> {
    try {
      // Configure GitLens for this directory
      this.gitLens.configure({
        cwd: directory,
        tool: {
          name: 'git',
          command: 'git',
          args: [], // Git commands are specified internally by GitLens
          cwd: directory,
          available: true,
        },
        includeCommitDetails: false, // We don't need commit details for status
      });

      // Execute git commands
      const executeResult = await this.gitLens.execute();

      // Parse the results
      const gitInfo = this.gitLens.parse(executeResult);

      // Map GitLens results to our expected format
      // GitLens uses "modified" for unstaged changes
      return {
        staged: gitInfo.staged || [],
        unstaged: gitInfo.modified || [],
        untracked: gitInfo.untracked || [],
      };
    } catch (error) {
      // Return empty arrays if not a git repo or error
      return {
        staged: [],
        unstaged: [],
        untracked: [],
      };
    }
  }

  /**
   * Get current branch name for a directory
   *
   * @param directory - The directory to get branch name for
   * @returns Current branch name or null if not a git repo or detached HEAD
   */
  public async getCurrentBranch(directory: string): Promise<string | null> {
    try {
      // Configure GitLens for this directory
      this.gitLens.configure({
        cwd: directory,
        tool: {
          name: 'git',
          command: 'git',
          args: [], // Git commands are specified internally by GitLens
          cwd: directory,
          available: true,
        },
        includeCommitDetails: false, // We don't need commit details for branch
      });

      // Execute git commands
      const executeResult = await this.gitLens.execute();

      // Parse the results
      const gitInfo = this.gitLens.parse(executeResult);

      // Return the branch name
      return gitInfo.branch || null;
    } catch (error) {
      // Return null if not a git repo or error
      return null;
    }
  }
}

// Export singleton instance for convenience
export const gitLensAdapter = GitLensAdapter.getInstance();