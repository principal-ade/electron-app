/**
 * GitExecutor - Specialized executor for Git operations
 * Provides comprehensive git functionality through electron-cli-bridge
 */

import { BaseExecutor } from './BaseExecutor';
import type { ExecuteOptions, ExecuteResult } from '../types';

export interface GitStatus {
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

export interface GitRemote {
  name: string;
  url: string;
  owner?: string;
  repo?: string;
}

export interface GitDiffStats {
  files: Array<{
    additions: number;
    deletions: number;
    file: string;
  }>;
  totalAdditions: number;
  totalDeletions: number;
}

export class GitExecutor extends BaseExecutor {
  /**
   * Get git version
   */
  async getVersion(): Promise<string | null> {
    try {
      const result = await this.execute('git', ['--version']);

      if (result.success && result.stdout) {
        const match = result.stdout.match(/git version (\d+\.\d+\.\d+)/);
        return match ? match[1] : null;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if git is available
   */
  async checkAvailability(): Promise<{
    available: boolean;
    version?: string;
    error?: string;
  }> {
    try {
      const version = await this.getVersion();

      if (version) {
        return { available: true, version };
      }

      return { available: false, error: 'Git is not installed' };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Failed to detect Git',
      };
    }
  }

  /**
   * Find the git repository root
   */
  async findGitRoot(directory: string): Promise<string | null> {
    try {
      const result = await this.execute(
        'git',
        ['rev-parse', '--show-toplevel'],
        {
          cwd: directory,
        },
      );

      if (result.success && result.stdout) {
        return result.stdout.trim();
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if a directory is a git repository
   */
  async isGitRepository(directory: string): Promise<boolean> {
    try {
      const result = await this.execute(
        'git',
        ['rev-parse', '--is-inside-work-tree'],
        {
          cwd: directory,
        },
      );

      return result.success && result.stdout.trim() === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(directory: string): Promise<string | null> {
    try {
      // Try symbolic-ref first (works for normal branches)
      const result = await this.execute(
        'git',
        ['symbolic-ref', '--short', 'HEAD'],
        {
          cwd: directory,
        },
      );

      if (result.success && result.stdout) {
        return result.stdout.trim();
      }

      // Fallback for detached HEAD
      const fallbackResult = await this.execute(
        'git',
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        {
          cwd: directory,
        },
      );

      if (fallbackResult.success && fallbackResult.stdout) {
        const branch = fallbackResult.stdout.trim();
        return branch === 'HEAD' ? null : branch;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get git status
   */
  async getStatus(directory: string): Promise<GitStatus> {
    try {
      const result = await this.execute('git', ['status', '--porcelain=v1'], {
        cwd: directory,
      });

      if (!result.success || !result.stdout) {
        return { staged: [], unstaged: [], untracked: [] };
      }

      const staged: string[] = [];
      const unstaged: string[] = [];
      const untracked: string[] = [];

      this.parseLines(result.stdout).forEach((line) => {
        const status = line.substring(0, 2);
        const file = line.substring(3);

        // Index status (first character)
        if (
          status[0] === 'M' ||
          status[0] === 'A' ||
          status[0] === 'D' ||
          status[0] === 'R' ||
          status[0] === 'C'
        ) {
          staged.push(file);
        }

        // Working tree status (second character)
        if (status[1] === 'M' || status[1] === 'D') {
          unstaged.push(file);
        }

        // Untracked files
        if (status === '??') {
          untracked.push(file);
        }
      });

      return { staged, unstaged, untracked };
    } catch {
      return { staged: [], unstaged: [], untracked: [] };
    }
  }

  /**
   * Get remotes with parsed GitHub info
   */
  async getRemotes(directory: string): Promise<GitRemote[]> {
    try {
      const result = await this.execute('git', ['remote', '-v'], {
        cwd: directory,
      });

      if (!result.success || !result.stdout) {
        return [];
      }

      const remotes = new Map<string, GitRemote>();

      this.parseLines(result.stdout).forEach((line) => {
        const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)/);
        if (match) {
          const [, name, url] = match;

          if (!remotes.has(name)) {
            const remote: GitRemote = { name, url };

            // Parse GitHub URLs
            const githubMatch = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
            if (githubMatch) {
              remote.owner = githubMatch[1];
              remote.repo = githubMatch[2];
            }

            remotes.set(name, remote);
          }
        }
      });

      return Array.from(remotes.values());
    } catch {
      return [];
    }
  }

  /**
   * Get local branches
   */
  async getLocalBranches(directory: string): Promise<string[]> {
    try {
      // Try modern format first
      const result = await this.execute(
        'git',
        ['branch', '--format=%(refname:short)'],
        {
          cwd: directory,
        },
      );

      if (result.success && result.stdout) {
        return this.parseLines(result.stdout);
      }

      // Fallback for older git versions
      const fallbackResult = await this.execute('git', ['branch'], {
        cwd: directory,
      });

      if (fallbackResult.success && fallbackResult.stdout) {
        return this.parseLines(fallbackResult.stdout).map((line) =>
          line.replace(/^\*?\s+/, ''),
        );
      }

      return [];
    } catch {
      return [];
    }
  }

  /**
   * Get remote branches
   */
  async getRemoteBranches(directory: string): Promise<string[]> {
    try {
      // Try modern format first
      const result = await this.execute(
        'git',
        ['branch', '-r', '--format=%(refname:short)'],
        {
          cwd: directory,
        },
      );

      if (result.success && result.stdout) {
        return this.parseLines(result.stdout).filter(
          (branch) => !branch.includes('HEAD'),
        );
      }

      // Fallback for older git versions
      const fallbackResult = await this.execute('git', ['branch', '-r'], {
        cwd: directory,
      });

      if (fallbackResult.success && fallbackResult.stdout) {
        return this.parseLines(fallbackResult.stdout).filter(
          (branch) => !branch.includes('HEAD'),
        );
      }

      return [];
    } catch {
      return [];
    }
  }

  /**
   * Get current commit hash
   */
  async getCurrentCommit(directory: string): Promise<string | null> {
    try {
      const result = await this.execute('git', ['rev-parse', 'HEAD'], {
        cwd: directory,
      });

      if (result.success && result.stdout) {
        return result.stdout.trim();
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get config value
   */
  async getConfig(directory: string, key: string): Promise<string | null> {
    try {
      const result = await this.execute('git', ['config', '--get', key], {
        cwd: directory,
      });

      if (result.success && result.stdout) {
        return result.stdout.trim();
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Add files to staging
   */
  async add(directory: string, files: string[]): Promise<ExecuteResult> {
    return this.execute('git', ['add', ...files], { cwd: directory });
  }

  /**
   * Commit with message
   */
  async commit(directory: string, message: string): Promise<ExecuteResult> {
    return this.execute('git', ['commit', '-m', message], { cwd: directory });
  }

  /**
   * Get diff statistics
   */
  async getDiffStats(
    directory: string,
    cached: boolean = false,
  ): Promise<GitDiffStats> {
    const args = ['diff', '--numstat'];
    if (cached) {
      args.push('--cached');
    }

    try {
      const result = await this.execute('git', args, { cwd: directory });

      if (!result.success || !result.stdout) {
        return { files: [], totalAdditions: 0, totalDeletions: 0 };
      }

      const files: GitDiffStats['files'] = [];
      let totalAdditions = 0;
      let totalDeletions = 0;

      this.parseLines(result.stdout).forEach((line) => {
        const parts = line.split('\t');
        if (parts.length >= 3) {
          const additions = parseInt(parts[0]) || 0;
          const deletions = parseInt(parts[1]) || 0;
          const file = parts[2];

          files.push({ additions, deletions, file });
          totalAdditions += additions;
          totalDeletions += deletions;
        }
      });

      return { files, totalAdditions, totalDeletions };
    } catch {
      return { files: [], totalAdditions: 0, totalDeletions: 0 };
    }
  }

  /**
   * Get default branch
   */
  async getDefaultBranch(directory: string): Promise<string | null> {
    try {
      // Try to get from remote HEAD
      const result = await this.execute(
        'git',
        ['symbolic-ref', 'refs/remotes/origin/HEAD'],
        {
          cwd: directory,
        },
      );

      if (result.success && result.stdout) {
        const branch = result.stdout.trim().replace('refs/remotes/origin/', '');
        if (branch) return branch;
      }

      // Try ls-remote
      const lsRemoteResult = await this.execute(
        'git',
        ['ls-remote', '--symref', 'origin', 'HEAD'],
        {
          cwd: directory,
        },
      );

      if (lsRemoteResult.success && lsRemoteResult.stdout) {
        const match = lsRemoteResult.stdout.match(
          /ref: refs\/heads\/(\S+)\s+HEAD/,
        );
        if (match) return match[1];
      }

      // Check common defaults in local branches
      const localBranches = await this.getLocalBranches(directory);
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

      // Return first branch as fallback
      return localBranches.length > 0 ? localBranches[0] : null;
    } catch {
      return null;
    }
  }

  /**
   * Set remote HEAD
   */
  async setRemoteHead(
    directory: string,
    remote: string = 'origin',
  ): Promise<boolean> {
    try {
      const result = await this.execute(
        'git',
        ['remote', 'set-head', remote, '--auto'],
        {
          cwd: directory,
        },
      );

      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * Get branch tracking info
   */
  async getBranchTracking(
    directory: string,
    branch: string,
  ): Promise<string | null> {
    try {
      const result = await this.execute(
        'git',
        ['rev-parse', '--abbrev-ref', `${branch}@{upstream}`],
        {
          cwd: directory,
        },
      );

      if (result.success && result.stdout) {
        return result.stdout.trim();
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get ahead/behind counts
   */
  async getAheadBehind(
    directory: string,
    branch: string,
    upstream: string,
  ): Promise<{
    ahead: number;
    behind: number;
  } | null> {
    try {
      const result = await this.execute(
        'git',
        ['rev-list', '--left-right', '--count', `${branch}...${upstream}`],
        {
          cwd: directory,
        },
      );

      if (result.success && result.stdout) {
        const [ahead, behind] = result.stdout
          .trim()
          .split('\t')
          .map((n) => parseInt(n, 10));
        return { ahead: ahead || 0, behind: behind || 0 };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Fetch from remote
   */
  async fetch(
    directory: string,
    options?: { timeout?: number },
  ): Promise<boolean> {
    try {
      const args = ['fetch'];
      if (options?.timeout) {
        args.push(`--timeout=${options.timeout}`);
      }

      const result = await this.execute('git', args, { cwd: directory });
      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * Execute raw git command
   */
  async raw(directory: string, args: string[], options?: Partial<ExecuteOptions>): Promise<ExecuteResult> {
    return this.execute('git', args, {
      cwd: directory,
      ...options
    });
  }

  /**
   * Clone a repository
   */
  async clone(
    url: string,
    destination: string,
    options?: { depth?: number },
  ): Promise<boolean> {
    const args = ['clone', url, destination];

    if (options?.depth) {
      args.push('--depth', options.depth.toString());
    }

    try {
      const result = await this.execute('git', args);
      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * Pull changes
   */
  async pull(
    directory: string,
    options?: { rebase?: boolean },
  ): Promise<ExecuteResult> {
    const args = ['pull'];

    if (options?.rebase) {
      args.push('--rebase');
    }

    return this.execute('git', args, { cwd: directory });
  }

  /**
   * Push changes
   */
  async push(
    directory: string,
    options?: { force?: boolean; setUpstream?: string },
  ): Promise<ExecuteResult> {
    const args = ['push'];

    if (options?.force) {
      args.push('--force');
    }

    if (options?.setUpstream) {
      args.push('--set-upstream', 'origin', options.setUpstream);
    }

    return this.execute('git', args, { cwd: directory });
  }

  /**
   * Check out a branch
   */
  async checkout(
    directory: string,
    branch: string,
    options?: { create?: boolean },
  ): Promise<ExecuteResult> {
    const args = ['checkout'];

    if (options?.create) {
      args.push('-b');
    }

    args.push(branch);

    return this.execute('git', args, { cwd: directory });
  }

  /**
   * Stash changes
   */
  async stash(
    directory: string,
    options?: { message?: string },
  ): Promise<ExecuteResult> {
    const args = ['stash'];

    if (options?.message) {
      args.push('push', '-m', options.message);
    }

    return this.execute('git', args, { cwd: directory });
  }

  /**
   * Apply stash
   */
  async stashApply(
    directory: string,
    stashRef?: string,
  ): Promise<ExecuteResult> {
    const args = ['stash', 'apply'];

    if (stashRef) {
      args.push(stashRef);
    }

    return this.execute('git', args, { cwd: directory });
  }
}
