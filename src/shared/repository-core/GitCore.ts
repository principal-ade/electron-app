/**
 * GitCore - Shared git operations without Electron dependencies
 * Can be used by both main process and utility processes
 */

import { execSync } from 'child_process';
import { createHash } from 'crypto';
import type { GitStatusWithFiles } from '@principal-ai/repository-abstraction';

export interface GitInfo {
  currentCommit: string;
  branch: string;
  isDirty: boolean;
}

// GitStatus is now imported from repository.types

/**
 * Core git operations shared between processes
 * Uses child_process.execSync directly like universal-worker.cjs
 */
export class GitCore {
  /**
   * Execute a git command and return the output
   */
  private static execGit(
    args: string[],
    cwd: string,
    options: { throwOnError?: boolean } = {},
  ): string {
    const { throwOnError = true } = options;

    try {
      const result = execSync(`git ${args.join(' ')}`, {
        cwd,
        encoding: 'utf8',
        stdio: 'pipe',
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });
      // Preserve leading whitespace while removing trailing newlines added by git
      return result.replace(/[\r\n]+$/, '');
    } catch (error: unknown) {
      if (throwOnError) {
        throw error;
      }
      // Return empty string on error when not throwing
      return '';
    }
  }

  /**
   * Get current commit SHA
   */
  static async getCurrentCommit(repoPath: string): Promise<string> {
    try {
      return this.execGit(['rev-parse', 'HEAD'], repoPath);
    } catch {
      return 'HEAD';
    }
  }

  /**
   * Get current branch name
   */
  static async getCurrentBranch(repoPath: string): Promise<string> {
    try {
      return this.execGit(['rev-parse', '--abbrev-ref', 'HEAD'], repoPath);
    } catch {
      return 'main';
    }
  }

  /**
   * Check if repository has uncommitted changes
   */
  static async isDirty(repoPath: string): Promise<boolean> {
    try {
      const status = this.execGit(['status', '--porcelain'], repoPath);
      return status.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get repository status
   * Returns GitStatusWithFiles from @principal-ai/repository-abstraction
   */
  static async getStatus(repoPath: string): Promise<GitStatusWithFiles> {
    try {
      const statusOutput = this.execGit(['status', '--porcelain'], repoPath);

      const stagedPaths: string[] = [];
      const modifiedPaths: string[] = [];
      const untrackedPaths: string[] = [];
      const deletedPaths: string[] = [];

      if (statusOutput) {
        const lines = statusOutput.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          const status = line.substring(0, 2);
          // Git porcelain format has either 1 or 2 spaces after the status codes
          // Find where the filename starts (after the status codes and space(s))
          let file = line.substring(2).trim();

          // Git wraps filenames with special characters (spaces, quotes, etc.) in double quotes
          // and escapes special characters within them. Remove the quotes and unescape.
          if (file.startsWith('"') && file.endsWith('"')) {
            file = file.slice(1, -1); // Remove surrounding quotes
            // Unescape common git escape sequences
            file = file
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\')
              .replace(/\\t/g, '\t')
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, '\r');
          }

          // First character is staged status
          if (status[0] !== ' ' && status[0] !== '?') {
            stagedPaths.push(file);
          }

          // Check for deletions
          // D  = deleted from index
          // AD = added to index, deleted in working tree
          //  D = deleted in working tree
          if (status[0] === 'D' || status[1] === 'D') {
            deletedPaths.push(file);
          }

          // Second character is working tree status
          if (status[1] === 'M') {
            modifiedPaths.push(file);
          } else if (status[0] === '?' && status[1] === '?') {
            untrackedPaths.push(file);
          }
        }
      }

      // Get metadata using existing helper methods
      const [branch, ahead, behind] = await Promise.all([
        this.getCurrentBranch(repoPath),
        this.getAheadCount(repoPath),
        this.getBehindCount(repoPath),
      ]);

      // Generate stable hash for React memoization
      const contentForHash = JSON.stringify({
        staged: stagedPaths.sort(),
        modified: modifiedPaths.sort(),
        untracked: untrackedPaths.sort(),
        deleted: deletedPaths.sort(),
      });
      const hash = createHash('sha256').update(contentForHash).digest('hex');

      return {
        repoPath,
        branch,
        isDirty:
          stagedPaths.length > 0 ||
          modifiedPaths.length > 0 ||
          untrackedPaths.length > 0 ||
          deletedPaths.length > 0,
        hasUntracked: untrackedPaths.length > 0,
        hasStaged: stagedPaths.length > 0,
        ahead,
        behind,
        watchingEnabled: false, // Not managed at this level
        modifiedFiles: modifiedPaths,
        untrackedFiles: untrackedPaths,
        stagedFiles: stagedPaths,
        createdFiles: untrackedPaths, // All untracked files are considered created
        deletedFiles: deletedPaths,
        hash,
      };
    } catch (error) {
      console.warn(`[GitCore] Could not get status for ${repoPath}:`, error);
      const emptyHash = createHash('sha256').update('empty').digest('hex');
      return {
        repoPath,
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
   * Get git information for a repository
   * Compatible with FileTreeBuilder.getGitInfo
   */
  static async getGitInfo(repoPath: string): Promise<GitInfo> {
    try {
      const [currentCommit, branch, isDirty] = await Promise.all([
        this.getCurrentCommit(repoPath),
        this.getCurrentBranch(repoPath),
        this.isDirty(repoPath),
      ]);

      return {
        currentCommit: currentCommit || 'HEAD',
        branch: branch || 'main',
        isDirty,
      };
    } catch (error) {
      console.warn(`[GitCore] Could not get git info for ${repoPath}:`, error);
      // Return defaults for non-git repositories
      return {
        currentCommit: 'HEAD',
        branch: 'main',
        isDirty: false,
      };
    }
  }

  /**
   * Check if a directory is a git repository
   */
  static async isGitRepository(repoPath: string): Promise<boolean> {
    try {
      const result = this.execGit(
        ['rev-parse', '--is-inside-work-tree'],
        repoPath,
      );
      return result === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Get git version
   */
  static async getGitVersion(repoPath: string): Promise<string> {
    try {
      const result = this.execGit(['--version'], repoPath);
      const match = result.match(/git version (\d+\.\d+\.\d+)/);
      return match ? match[1] : '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  /**
   * Get number of commits ahead of upstream
   */
  static async getAheadCount(repoPath: string): Promise<number> {
    try {
      const result = this.execGit(
        ['rev-list', '--count', '@{u}..HEAD'],
        repoPath,
        { throwOnError: false },
      );
      return result ? parseInt(result, 10) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get number of commits behind upstream
   */
  static async getBehindCount(repoPath: string): Promise<number> {
    try {
      const result = this.execGit(
        ['rev-list', '--count', 'HEAD..@{u}'],
        repoPath,
        { throwOnError: false },
      );
      return result ? parseInt(result, 10) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get ISO timestamp of the most recent commit on current branch
   */
  static async getMostRecentCommitTimestamp(
    repoPath: string,
  ): Promise<string | null> {
    try {
      const result = this.execGit(['log', '-1', '--format=%cI'], repoPath, {
        throwOnError: false,
      });
      return result || null;
    } catch (error) {
      console.warn(
        `[GitCore] Could not get last commit time for ${repoPath}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get remote URL for origin
   */
  static async getRemoteUrl(repoPath: string): Promise<string | null> {
    try {
      const result = this.execGit(['remote', 'get-url', 'origin'], repoPath, {
        throwOnError: false,
      });
      return result || null;
    } catch (error) {
      console.warn(
        `[GitCore] Could not get remote URL for ${repoPath}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get last commit details
   */
  static async getLastCommitDetails(repoPath: string): Promise<{
    hash: string;
    author: string;
    message: string;
    timestamp: string;
  } | null> {
    try {
      const result = this.execGit(
        ['log', '-1', '--format=%H%n%an%n%s%n%cI'],
        repoPath,
        { throwOnError: false },
      );
      if (!result) return null;

      const lines = result.split('\n');
      if (lines.length < 4) return null;

      return {
        hash: lines[0],
        author: lines[1],
        message: lines[2],
        timestamp: lines[3],
      };
    } catch (error) {
      console.warn(
        `[GitCore] Could not get last commit details for ${repoPath}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get comprehensive git status for watching
   * Note: getStatus() now returns GitStatusWithFiles which includes all this info
   */
  static async getDetailedStatus(repoPath: string): Promise<{
    branch: string;
    isDirty: boolean;
    hasUntracked: boolean;
    hasStaged: boolean;
    ahead: number;
    behind: number;
    files?: GitStatusWithFiles; // Include the file lists to avoid duplicate calls
  }> {
    try {
      const status = await this.getStatus(repoPath);

      return {
        branch: status.branch,
        isDirty: status.isDirty,
        hasUntracked: status.hasUntracked,
        hasStaged: status.hasStaged,
        ahead: status.ahead,
        behind: status.behind,
        files: status, // Return the file status to avoid duplicate calls
      };
    } catch (error) {
      console.warn(
        `[GitCore] Could not get detailed status for ${repoPath}:`,
        error,
      );
      return {
        branch: 'main',
        isDirty: false,
        hasUntracked: false,
        hasStaged: false,
        ahead: 0,
        behind: 0,
      };
    }
  }
}
