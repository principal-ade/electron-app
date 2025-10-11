/**
 * GitRemoteService - Handles git remote operations with proper timeouts
 * Uses GitExecutor for all git operations to avoid blocking
 */

import { GitCore } from '../shared/repository-core/GitCore';
import type { GitRemoteInfo } from './types';

export class GitRemoteService {
  /**
   * Build complete git remote info with parallel operations and timeouts
   */
  static async buildRemoteInfo(repoPath: string): Promise<GitRemoteInfo> {
    // Get remote URL (fast, local operation)
    const remoteUrl = await GitCore.getRemoteUrl(repoPath).catch(() => null);

    const remoteInfo: GitRemoteInfo = {
      remoteUrl: remoteUrl || '',
      remoteBranches: [],
      accessible: false,
      lastFetched: Date.now(),
    };

    // If no remote URL, return early
    if (!remoteUrl) {
      return remoteInfo;
    }

    // Run all network operations in parallel with short timeouts
    const results = await Promise.allSettled([
      this.fetchDefaultBranch(repoPath),
      this.fetchRemoteBranches(repoPath),
      this.checkRemoteAccessibility(repoPath),
    ]);

    // Process results
    const [defaultBranchResult, remoteBranchesResult, accessibilityResult] = results;

    if (defaultBranchResult.status === 'fulfilled' && defaultBranchResult.value) {
      remoteInfo.defaultBranch = defaultBranchResult.value;
    } else if (defaultBranchResult.status === 'rejected') {
      console.warn(`[GitRemoteService] Failed to fetch default branch:`, defaultBranchResult.reason);
    }

    if (remoteBranchesResult.status === 'fulfilled' && remoteBranchesResult.value) {
      remoteInfo.remoteBranches = remoteBranchesResult.value;
    } else if (remoteBranchesResult.status === 'rejected') {
      console.warn(`[GitRemoteService] Failed to fetch remote branches:`, remoteBranchesResult.reason);
    }

    if (accessibilityResult.status === 'fulfilled' && accessibilityResult.value) {
      remoteInfo.accessible = accessibilityResult.value;
    } else if (accessibilityResult.status === 'rejected') {
      console.warn(`[GitRemoteService] Failed to check accessibility:`, accessibilityResult.reason);
    }

    // Get upstream status from local git data (fast, no network)
    try {
      const upstreamStatus = await this.getUpstreamStatus(repoPath);
      if (upstreamStatus) {
        remoteInfo.upstreamStatus = upstreamStatus;
      }
    } catch (error) {
      console.warn(`[GitRemoteService] Failed to get upstream status:`, error);
    }

    return remoteInfo;
  }

  /**
   * Fetch default branch from remote with timeout
   * Uses ls-remote to check remote HEAD
   */
  private static async fetchDefaultBranch(repoPath: string): Promise<string | undefined> {
    const timeout = 3000; // 3 seconds

    const output = await this.execGitWithTimeout(
      ['ls-remote', '--symref', 'origin', 'HEAD'],
      repoPath,
      timeout
    );

    const match = output.match(/ref: refs\/heads\/(\S+)\s+HEAD/);
    return match?.[1];
  }

  /**
   * Fetch remote branches with timeout
   * Uses ls-remote to list all remote heads
   */
  private static async fetchRemoteBranches(repoPath: string): Promise<string[]> {
    const timeout = 3000; // 3 seconds

    const output = await this.execGitWithTimeout(
      ['ls-remote', '--heads', 'origin'],
      repoPath,
      timeout
    );

    if (!output) return [];

    return output
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const match = line.match(/refs\/heads\/(.+)$/);
        return match?.[1];
      })
      .filter((branch): branch is string => !!branch);
  }

  /**
   * Check if remote is accessible
   * Simply tries ls-remote with exit code check
   */
  private static async checkRemoteAccessibility(repoPath: string): Promise<boolean> {
    const timeout = 3000; // 3 seconds

    try {
      await this.execGitWithTimeout(
        ['ls-remote', '--exit-code', 'origin'],
        repoPath,
        timeout
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get upstream status from local git data (no network call)
   * This uses ahead/behind counts already in local repo
   */
  private static async getUpstreamStatus(repoPath: string): Promise<{
    ahead: number;
    behind: number;
    upToDate: boolean;
  } | undefined> {
    try {
      // This uses local data only, no network call
      const status = await GitCore.getDetailedStatus(repoPath);

      return {
        ahead: status.ahead,
        behind: status.behind,
        upToDate: status.ahead === 0 && status.behind === 0,
      };
    } catch (_error) {
      return undefined;
    }
  }

  /**
   * Execute git command with timeout using child_process.spawn
   * This is a lightweight implementation that doesn't block the event loop
   */
  private static execGitWithTimeout(args: string[], cwd: string, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');

      const child = spawn('git', args, {
        cwd,
        stdio: 'pipe',
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0', // Don't prompt for credentials
          GIT_ASKPASS: '/bin/echo', // Prevent password prompts
        },
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        reject(new Error(`Git command timed out after ${timeoutMs}ms: git ${args.join(' ')}`));
      }, timeoutMs);

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code: number) => {
        clearTimeout(timer);

        if (timedOut) return; // Already rejected

        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Git command failed with code ${code}: ${stderr || 'No error message'}`));
        }
      });

      child.on('error', (error: Error) => {
        clearTimeout(timer);
        if (!timedOut) {
          reject(error);
        }
      });
    });
  }
}
