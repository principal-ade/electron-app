/**
 * GitClientFactory - Migration to electron-cli-bridge
 * This replaces the simple-git implementation with electron-cli-bridge
 */

import { electronCLI } from '../electron-cli-bridge';
import type { GitExecutor } from '../electron-cli-bridge';
import type { ExecuteResult } from '../electron-cli-bridge/types';
import { gitLensAdapter } from '../quality-lenses/GitLensAdapter';
import type { CommitInfo } from '../quality-lenses/GitLensAdapter';
import type { GitStatusWithFiles } from '@principal-ai/repository-abstraction';

/**
 * Git command execution options (for raw git commands)
 */
interface GitRawOptions {
  env?: Record<string, string>;
  timeout?: number;
  cwd?: string;
}

/**
 * Compatibility client interface that mimics simple-git API
 * Used during migration from simple-git to electron-cli-bridge
 */
interface GitCompatibilityClient {
  revparse: (args: string[]) => Promise<string>;
  status: () => Promise<{
    current: string | null;
    staged: string[];
    modified: string[];
    deleted: string[];
    not_added: string[];
  }>;
  branchLocal: () => Promise<{ all: string[] }>;
  branch: (args: string[]) => Promise<{ all: string[] }>;
  getRemotes: (verbose: boolean) => Promise<
    Array<{
      name: string;
      refs: { fetch: string; push: string };
    }>
  >;
  getConfig: (key: string) => Promise<{ value: string | null }>;
  raw: (args: string[], options?: GitRawOptions) => Promise<string>;
}

/**
 * Factory for Git operations using electron-cli-bridge
 * Provides compatibility layer for existing code while using new implementation
 */
export class GitClientFactory {
  private static gitExecutor: GitExecutor | null = null;

  /**
   * Initialize the git executor
   */
  private static async ensureInitialized(): Promise<GitExecutor> {
    if (!this.gitExecutor) {
      await electronCLI.initialize();
      this.gitExecutor = electronCLI.git;
    }
    return this.gitExecutor;
  }

  /**
   * Get client for compatibility (returns git executor)
   */
  static async getClient(_baseDir: string): Promise<GitCompatibilityClient> {
    const git = await this.ensureInitialized();

    // Return a compatibility object that mimics simple-git interface
    return {
      revparse: async (args: string[]) => {
        if (args[0] === '--show-toplevel') {
          const root = await git.findGitRoot(_baseDir);
          return root || '';
        }
        if (args[0] === '--is-inside-work-tree') {
          const isRepo = await git.isGitRepository(_baseDir);
          return isRepo ? 'true' : 'false';
        }
        if (args[0] === 'HEAD') {
          return (await git.getCurrentCommit(_baseDir)) || '';
        }
        if (args[0] === '--abbrev-ref' && args[1] === 'HEAD') {
          return (await git.getCurrentBranch(_baseDir)) || 'HEAD';
        }
        return '';
      },

      status: async () => {
        const status = await git.getStatus(_baseDir);
        return {
          current: await git.getCurrentBranch(_baseDir),
          staged: status.stagedFiles,
          modified: status.modifiedFiles,
          deleted: status.deletedFiles,
          not_added: status.untrackedFiles,
        };
      },

      branchLocal: async () => {
        const branches = await git.getLocalBranches(_baseDir);
        return { all: branches };
      },

      branch: async (args: string[]) => {
        if (args.includes('-r')) {
          const branches = await git.getRemoteBranches(_baseDir);
          return { all: branches };
        }
        return { all: [] };
      },

      getRemotes: async (_verbose: boolean) => {
        const remotes = await git.getRemotes(_baseDir);
        return remotes.map((r) => ({
          name: r.name,
          refs: {
            fetch: r.url,
            push: r.url,
          },
        }));
      },

      getConfig: async (key: string) => {
        const value = await git.getConfig(_baseDir, key);
        return { value };
      },

      raw: async (args: string[], options?: GitRawOptions) => {
        const buildError = (result: ExecuteResult): Error => {
          const baseMsg =
            result.stderr ||
            result.stdout ||
            `Command failed with exit code ${result.exitCode}`;
          // Tag with the bridge's reason if our own limits killed the child,
          // so callers can surface "timed out" / "output too large" instead
          // of pattern-matching truncated stderr.
          const prefix =
            result.failureReason === 'timeout'
              ? `Command timed out after ${result.duration}ms`
              : result.failureReason === 'buffer'
                ? `Command output exceeded buffer limit after ${result.duration}ms`
                : null;
          const err = new Error(prefix ? `${prefix}: ${baseMsg}` : baseMsg);
          return Object.assign(err, {
            failureReason: result.failureReason,
            signal: result.signal,
            duration: result.duration,
            exitCode: result.exitCode,
            stderr: result.stderr,
          });
        };

        try {
          const result = await git.raw(_baseDir, args, options);

          // Return stdout for successful commands
          if (result.success) {
            return result.stdout || '';
          }

          // Special case: git ls-remote with no refs returns exit code 2
          // This happens with empty repositories and is not an error
          if (
            args[0] === 'ls-remote' &&
            result.exitCode === 2 &&
            !result.stderr
          ) {
            return ''; // Return empty string for empty repo
          }

          throw buildError(result);
        } catch (error) {
          // If the error is the "object could not be cloned" error, it's an IPC issue
          if (
            error instanceof Error &&
            error.message.includes('An object could not be cloned')
          ) {
            // This means there's a serialization issue with the options object
            // Try again without the problematic options
            const simpleOptions = {
              env: options?.env,
              timeout: options?.timeout,
            };
            const result = await git.raw(_baseDir, args, simpleOptions);
            if (result.success) {
              return result.stdout || '';
            }
            throw buildError(result);
          }
          throw error;
        }
      },
    };
  }

  /**
   * Clear cache (no-op for compatibility)
   */
  static clearCache(): void {
    // No cache to clear
  }

  /**
   * Check if Git is available on the system
   */
  static async checkGitAvailability(): Promise<{
    available: boolean;
    version?: string;
    error?: string;
  }> {
    const git = await this.ensureInitialized();
    return await git.checkAvailability();
  }

  /**
   * Find the git root for a given path
   */
  static async findGitRoot(filePath: string): Promise<string | null> {
    const git = await this.ensureInitialized();
    return await git.findGitRoot(filePath);
  }

  /**
   * Check if a directory is a git repository
   */
  static async isGitRepository(directory: string): Promise<boolean> {
    const git = await this.ensureInitialized();
    return await git.isGitRepository(directory);
  }

  /**
   * Get git status for a directory
   * Now uses GitLens for consistency with other Git operations
   */
  static async getGitStatus(directory: string): Promise<GitStatusWithFiles> {
    // Use GitLens adapter which now returns GitStatusWithFiles format
    return await gitLensAdapter.getGitStatus(directory);
  }

  /**
   * Get git remotes for a directory
   */
  static async getRemotes(directory: string): Promise<
    Array<{
      name: string;
      url: string;
      owner?: string;
      repo?: string;
    }>
  > {
    const git = await this.ensureInitialized();
    return await git.getRemotes(directory);
  }

  /**
   * Get current branch name
   * Now uses GitLens for consistency with other Git operations
   */
  static async getCurrentBranch(directory: string): Promise<string | null> {
    // Use GitLens adapter instead of electron-cli-bridge
    return await gitLensAdapter.getCurrentBranch(directory);
  }

  /**
   * Get all local branches
   */
  static async getLocalBranches(directory: string): Promise<string[]> {
    const git = await this.ensureInitialized();
    return await git.getLocalBranches(directory);
  }

  /**
   * Get all remote branches
   */
  static async getRemoteBranches(directory: string): Promise<string[]> {
    const git = await this.ensureInitialized();
    return await git.getRemoteBranches(directory);
  }

  /**
   * Get current commit hash
   * Now uses GitLens for consistency with other Git operations
   */
  static async getCurrentCommit(directory: string): Promise<string | null> {
    // Use GitLens adapter instead of electron-cli-bridge
    return await gitLensAdapter.getCurrentCommit(directory);
  }

  /**
   * Get detailed information about the last commit
   * Includes date, author, message - useful for sorting repositories by last activity
   */
  static async getLastCommitInfo(
    directory: string,
  ): Promise<CommitInfo | null> {
    return await gitLensAdapter.getLastCommitInfo(directory);
  }

  /**
   * Get git configuration value
   */
  static async getConfig(
    directory: string,
    key: string,
  ): Promise<string | null> {
    const git = await this.ensureInitialized();
    return await git.getConfig(directory, key);
  }

  /**
   * Get file content at a specific git revision
   * @param directory - Git repository directory
   * @param filePath - Path to file relative to repository root
   * @param revision - Git revision (default: 'HEAD')
   * @returns File content or null if file doesn't exist at that revision
   */
  static async getFileContentAtRevision(
    directory: string,
    filePath: string,
    revision: string = 'HEAD',
  ): Promise<string | null> {
    const git = await this.ensureInitialized();
    return await git.getFileContentAtRevision(directory, filePath, revision);
  }
}

// Export a singleton instance for convenience (maintains compatibility)
export const gitClientFactory = GitClientFactory;
