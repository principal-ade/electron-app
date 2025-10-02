/**
 * GitCore - Shared git operations without Electron dependencies
 * Can be used by both main process and utility processes
 */

import { execSync } from 'child_process';
import type { GitStatus } from '../types/repository.types';

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
    options: { throwOnError?: boolean } = {}
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
   */
  static async getStatus(repoPath: string): Promise<GitStatus> {
    try {
      const statusOutput = this.execGit(['status', '--porcelain'], repoPath);

      const staged: Array<{ path: string; lastModified?: string }> = [];
      const unstaged: Array<{ path: string; lastModified?: string }> = [];
      const untracked: Array<{ path: string; lastModified?: string }> = [];
      const deleted: Array<{ path: string; lastModified?: string }> = [];

      if (statusOutput) {
        const lines = statusOutput.split('\n').filter(line => line.trim());

        for (const line of lines) {
          const status = line.substring(0, 2);
          // Git porcelain format has either 1 or 2 spaces after the status codes
          // Find where the filename starts (after the status codes and space(s))
          const file = line.substring(2).trim();

          // First character is staged status
          if (status[0] !== ' ' && status[0] !== '?') {
            staged.push({ path: file });
          }

          // Check for deletions
          // D  = deleted from index
          // AD = added to index, deleted in working tree
          //  D = deleted in working tree
          if (status[0] === 'D' || status[1] === 'D') {
            deleted.push({ path: file });
          }

          // Second character is working tree status
          if (status[1] === 'M') {
            unstaged.push({ path: file });
          } else if (status[0] === '?' && status[1] === '?') {
            untracked.push({ path: file });
          }
        }
      }

      return { staged, unstaged, untracked, deleted };
    } catch (error) {
      console.warn(`[GitCore] Could not get status for ${repoPath}:`, error);
      return { staged: [], unstaged: [], untracked: [], deleted: [] };
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
      const result = this.execGit(['rev-parse', '--is-inside-work-tree'], repoPath);
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
   * Check if FSMonitor is supported (requires git >= 2.36.0)
   */
  static async isFSMonitorSupported(repoPath: string): Promise<boolean> {
    const version = await this.getGitVersion(repoPath);
    const [major, minor] = version.split('.').map(n => parseInt(n, 10));
    return major > 2 || (major === 2 && minor >= 36);
  }

  /**
   * Enable FSMonitor for a repository
   */
  static async enableFSMonitor(repoPath: string): Promise<boolean> {
    try {
      // Check if supported
      if (!await this.isFSMonitorSupported(repoPath)) {
        return false;
      }

      // Enable builtin FSMonitor
      this.execGit(['config', 'core.fsmonitor', 'builtin'], repoPath);

      // Enable untracked cache for better performance
      this.execGit(['config', 'core.untrackedcache', 'true'], repoPath);

      // Start the FSMonitor daemon if not already running
      try {
        const status = this.execGit(['fsmonitor--daemon', 'status'], repoPath);
        if (!status.includes('is watching')) {
          this.execGit(['fsmonitor--daemon', 'start'], repoPath);
        }
      } catch {
        // Status command returns non-zero if daemon is not running, so try to start it
        try {
          this.execGit(['fsmonitor--daemon', 'start'], repoPath);
        } catch (startError) {
          console.error(`[GitCore] Failed to start FSMonitor daemon:`, startError);
        }
      }

      // Verify FSMonitor actually works by checking daemon status
      try {
        const daemonStatus = this.execGit(['fsmonitor--daemon', 'status'], repoPath);

        if (!daemonStatus.includes('is watching')) {
          // Try to stop and restart the daemon
          try {
            this.execGit(['fsmonitor--daemon', 'stop'], repoPath);
          } catch {
            // Ignore stop errors
          }

          this.execGit(['fsmonitor--daemon', 'start'], repoPath);

          // Check status again
          const newStatus = this.execGit(['fsmonitor--daemon', 'status'], repoPath);
          if (!newStatus.includes('is watching')) {
            throw new Error('FSMonitor daemon failed to start');
          }
        }

        // Set core.fsmonitor to true (not 'builtin' which has issues)
        this.execGit(['config', 'core.fsmonitor', 'true'], repoPath);

        return true;
      } catch (error) {
        // FSMonitor not working properly
        console.warn(`[GitCore] FSMonitor not working properly: ${error}`);

        // Clean up any partial config
        try {
          this.execGit(['config', '--unset', 'core.fsmonitor'], repoPath);
          this.execGit(['fsmonitor--daemon', 'stop'], repoPath);
        } catch {
          // Ignore cleanup errors
        }

        return false;
      }
    } catch (error) {
      console.error(`[GitCore] Failed to enable FSMonitor for ${repoPath}:`, error);
      return false;
    }
  }

  /**
   * Check if FSMonitor is enabled
   */
  static async isFSMonitorEnabled(repoPath: string): Promise<boolean> {
    try {
      const value = this.execGit(['config', 'core.fsmonitor'], repoPath, { throwOnError: false });
      return value === 'builtin';
    } catch {
      return false;
    }
  }

  /**
   * Get number of commits ahead of upstream
   */
  static async getAheadCount(repoPath: string): Promise<number> {
    try {
      const result = this.execGit(['rev-list', '--count', '@{u}..HEAD'], repoPath, { throwOnError: false });
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
      const result = this.execGit(['rev-list', '--count', 'HEAD..@{u}'], repoPath, { throwOnError: false });
      return result ? parseInt(result, 10) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get ISO timestamp of the most recent commit on current branch
   */
  static async getMostRecentCommitTimestamp(repoPath: string): Promise<string | null> {
    try {
      const result = this.execGit(['log', '-1', '--format=%cI'], repoPath, { throwOnError: false });
      return result || null;
    } catch (error) {
      console.warn(`[GitCore] Could not get last commit time for ${repoPath}:`, error);
      return null;
    }
  }

  /**
   * Get remote URL for origin
   */
  static async getRemoteUrl(repoPath: string): Promise<string | null> {
    try {
      const result = this.execGit(['remote', 'get-url', 'origin'], repoPath, { throwOnError: false });
      return result || null;
    } catch (error) {
      console.warn(`[GitCore] Could not get remote URL for ${repoPath}:`, error);
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
      const result = this.execGit(['log', '-1', '--format=%H%n%an%n%s%n%cI'], repoPath, { throwOnError: false });
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
      console.warn(`[GitCore] Could not get last commit details for ${repoPath}:`, error);
      return null;
    }
  }

  /**
   * Get comprehensive git status for watching
   */
  static async getDetailedStatus(repoPath: string): Promise<{
    branch: string;
    isDirty: boolean;
    hasUntracked: boolean;
    hasStaged: boolean;
    ahead: number;
    behind: number;
    files?: GitStatus; // Include the file lists to avoid duplicate calls
  }> {
    try {
      const [branch, status, ahead, behind] = await Promise.all([
        this.getCurrentBranch(repoPath),
        this.getStatus(repoPath),
        this.getAheadCount(repoPath),
        this.getBehindCount(repoPath),
      ]);

      return {
        branch,
        isDirty: status.unstaged.length > 0 || status.staged.length > 0 || status.untracked.length > 0 || status.deleted.length > 0,
        hasUntracked: status.untracked.length > 0,
        hasStaged: status.staged.length > 0,
        ahead,
        behind,
        files: status, // Return the file status to avoid duplicate calls
      };
    } catch (error) {
      console.warn(`[GitCore] Could not get detailed status for ${repoPath}:`, error);
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