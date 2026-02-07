/**
 * GitLensAdapter - Minimal adapter to use GitLens from codebase-quality-lenses package
 * for Git operations in the electron app
 */

import { GitLens } from '@principal-ai/codebase-quality-lenses';
import { ElectronCLIBridgeExecutor } from './ElectronCLIBridgeExecutor';
import type { GitStatusWithFiles } from '@principal-ai/repository-abstraction';
import { createHash } from 'crypto';

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
    } catch (_error) {
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
  public async getLastCommitInfo(
    directory: string,
  ): Promise<CommitInfo | null> {
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
    } catch (_error) {
      // Silently return null if not a git repo or no commits
      return null;
    }
  }

  /**
   * Get git status for a directory
   * Returns full GitStatusWithFiles with metadata and file lists
   *
   * @param directory - The directory to get git status for
   * @returns GitStatusWithFiles with all metadata and file arrays
   */
  public async getGitStatus(directory: string): Promise<GitStatusWithFiles> {
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

      // Extract file arrays as string[] (GitLens already provides them as string[])
      const stagedFiles: string[] = gitInfo.staged || [];
      const modifiedFiles: string[] = gitInfo.modified || [];
      const untrackedFiles: string[] = gitInfo.untracked || [];
      const deletedFiles: string[] = gitInfo.deleted || [];

      // Get branch name
      const branch = gitInfo.branch || 'main';

      // Note: GitLens doesn't provide ahead/behind counts, defaulting to 0
      // For accurate counts, use GitCore or GitExecutor directly
      const ahead = 0;
      const behind = 0;

      // Calculate derived metadata
      const isDirty =
        stagedFiles.length > 0 ||
        modifiedFiles.length > 0 ||
        untrackedFiles.length > 0 ||
        deletedFiles.length > 0;
      const hasUntracked = untrackedFiles.length > 0;
      const hasStaged = stagedFiles.length > 0;

      // Generate stable hash for React memoization
      const contentForHash = JSON.stringify({
        staged: stagedFiles.sort(),
        modified: modifiedFiles.sort(),
        untracked: untrackedFiles.sort(),
        deleted: deletedFiles.sort(),
      });
      const hash = createHash('sha256').update(contentForHash).digest('hex');

      return {
        repoPath: directory,
        branch,
        isDirty,
        hasUntracked,
        hasStaged,
        ahead,
        behind,
        watchingEnabled: false, // Not managed at this level
        modifiedFiles,
        untrackedFiles,
        stagedFiles,
        createdFiles: untrackedFiles, // All untracked files are considered created
        deletedFiles,
        hash,
      };
    } catch (_error) {
      // Return empty status with default values if not a git repo or error
      const emptyHash = createHash('sha256').update('empty').digest('hex');
      return {
        repoPath: directory,
        branch: 'main',
        isDirty: false,
        hasUntracked: false,
        hasStaged: false,
        ahead: 0,
        behind: 0,
        watchingEnabled: false,
        modifiedFiles: [],
        untrackedFiles: [],
        stagedFiles: [],
        createdFiles: [],
        deletedFiles: [],
        hash: emptyHash,
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
    } catch (_error) {
      // Return null if not a git repo or error
      return null;
    }
  }
}

// Export singleton instance for convenience
export const gitLensAdapter = GitLensAdapter.getInstance();
