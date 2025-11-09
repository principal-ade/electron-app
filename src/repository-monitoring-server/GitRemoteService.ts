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
    const [defaultBranchResult, remoteBranchesResult, accessibilityResult] =
      results;

    if (
      defaultBranchResult.status === 'fulfilled' &&
      defaultBranchResult.value
    ) {
      remoteInfo.defaultBranch = defaultBranchResult.value;
    } else if (defaultBranchResult.status === 'rejected') {
      console.warn(
        `[GitRemoteService] Failed to fetch default branch:`,
        defaultBranchResult.reason,
      );
    }

    if (
      remoteBranchesResult.status === 'fulfilled' &&
      remoteBranchesResult.value
    ) {
      remoteInfo.remoteBranches = remoteBranchesResult.value;
    } else if (remoteBranchesResult.status === 'rejected') {
      console.warn(
        `[GitRemoteService] Failed to fetch remote branches:`,
        remoteBranchesResult.reason,
      );
    }

    if (
      accessibilityResult.status === 'fulfilled' &&
      accessibilityResult.value
    ) {
      remoteInfo.accessible = accessibilityResult.value;
    } else if (accessibilityResult.status === 'rejected') {
      console.warn(
        `[GitRemoteService] Failed to check accessibility:`,
        accessibilityResult.reason,
      );
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
  private static async fetchDefaultBranch(
    repoPath: string,
  ): Promise<string | undefined> {
    const timeout = 3000; // 3 seconds

    const output = await this.execGitWithTimeout(
      ['ls-remote', '--symref', 'origin', 'HEAD'],
      repoPath,
      timeout,
    );

    const match = output.match(/ref: refs\/heads\/(\S+)\s+HEAD/);
    return match?.[1];
  }

  /**
   * Fetch remote branches with timeout
   * Uses ls-remote to list all remote heads
   */
  private static async fetchRemoteBranches(
    repoPath: string,
  ): Promise<string[]> {
    const timeout = 3000; // 3 seconds

    const output = await this.execGitWithTimeout(
      ['ls-remote', '--heads', 'origin'],
      repoPath,
      timeout,
    );

    if (!output) return [];

    return output
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const match = line.match(/refs\/heads\/(.+)$/);
        return match?.[1];
      })
      .filter((branch): branch is string => !!branch);
  }

  /**
   * Check if remote is accessible
   * Simply tries ls-remote with exit code check
   */
  private static async checkRemoteAccessibility(
    repoPath: string,
  ): Promise<boolean> {
    const timeout = 3000; // 3 seconds

    try {
      await this.execGitWithTimeout(
        ['ls-remote', '--exit-code', 'origin'],
        repoPath,
        timeout,
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
  private static async getUpstreamStatus(repoPath: string): Promise<
    | {
        ahead: number;
        behind: number;
        upToDate: boolean;
      }
    | undefined
  > {
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
   * Check authentication methods for a git URL
   * Tests both SSH and HTTPS access in parallel
   */
  static async checkAuthMethods(url: string): Promise<{
    ssh: { available: boolean; reason: string };
    https: { available: boolean; reason: string };
  }> {
    // Extract owner/repo and service from ANY input format
    let service = '';
    let owner = '';
    let repo = '';

    // First, normalize if it's a browser URL (remove /tree/, /blob/, etc)
    let cleanUrl = url.replace(/\/+$/, '');
    const patterns = [
      '/tree/',
      '/blob/',
      '/commits/',
      '/pulls',
      '/issues',
      '/wiki',
      '/settings',
      '/actions',
    ];
    for (const pattern of patterns) {
      const index = cleanUrl.indexOf(pattern);
      if (index !== -1) {
        cleanUrl = cleanUrl.substring(0, index);
        break;
      }
    }

    // Try to extract from SSH format (git@service:owner/repo.git)
    let match = cleanUrl.match(/git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/);
    if (match) {
      service = match[1];
      owner = match[2];
      repo = match[3].replace(/\.git$/, '');
    }

    // Try to extract from HTTPS format (https://service/owner/repo.git)
    if (!owner) {
      match = cleanUrl.match(/https?:\/\/([^/]+)\/([^/]+)\/([^/.]+)(?:\.git)?/);
      if (match) {
        service = match[1];
        owner = match[2];
        repo = match[3].replace(/\.git$/, '');
      }
    }

    // Try SSH with protocol format (ssh://git@service/owner/repo.git)
    if (!owner) {
      match = cleanUrl.match(/ssh:\/\/git@([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/);
      if (match) {
        service = match[1];
        owner = match[2];
        repo = match[3].replace(/\.git$/, '');
      }
    }

    // If we couldn't extract owner/repo, return error
    if (!owner || !repo || !service) {
      return {
        ssh: { available: false, reason: 'Could not parse repository URL' },
        https: { available: false, reason: 'Could not parse repository URL' },
      };
    }

    // Construct both SSH and HTTPS URLs from the extracted info
    const httpsUrl = `https://${service}/${owner}/${repo}.git`;
    const sshUrl = `git@${service}:${owner}/${repo}.git`;

    // Test both URLs in parallel with 5-second timeout
    const [httpsResult, sshResult] = await Promise.allSettled([
      this.testGitAccess(httpsUrl),
      this.testGitAccess(sshUrl),
    ]);

    const result = {
      ssh: { available: false, reason: '' },
      https: { available: false, reason: '' },
    };

    // Process HTTPS result
    if (httpsResult.status === 'fulfilled') {
      result.https = httpsResult.value;
    } else {
      result.https = {
        available: false,
        reason: httpsResult.reason?.message || 'Unknown error',
      };
    }

    // Process SSH result
    if (sshResult.status === 'fulfilled') {
      result.ssh = sshResult.value;
    } else {
      result.ssh = {
        available: false,
        reason: sshResult.reason?.message || 'Unknown error',
      };
    }

    return result;
  }

  /**
   * Test if a git URL is accessible
   * Uses ls-remote with a short timeout
   * Relies on git's configured credential helper for HTTPS authentication
   */
  private static async testGitAccess(
    url: string,
  ): Promise<{ available: boolean; reason: string }> {
    try {
      // Use a temporary directory for the test (no actual clone)
      const os = require('os');
      const tmpDir = os.tmpdir();

      const timeout = 5000; // 5 seconds

      // Git will use configured credential helper (set up by GitCredentialHelper)
      await this.execGitWithTimeout(['ls-remote', url], tmpDir, timeout);

      return {
        available: true,
        reason: 'Repository is accessible',
      };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
        return {
          available: false,
          reason: 'Connection timed out',
        };
      }

      if (
        errorMsg.includes('Repository not found') ||
        errorMsg.includes('404')
      ) {
        return { available: false, reason: 'Repository not found or private' };
      }

      if (errorMsg.includes('Authentication') || errorMsg.includes('authentication')) {
        return { available: false, reason: 'Authentication required' };
      }

      if (errorMsg.includes('Permission denied')) {
        return {
          available: false,
          reason: 'Permission denied - check authentication',
        };
      }

      if (errorMsg.includes('Host key verification failed')) {
        return {
          available: false,
          reason:
            'SSH host key verification failed - run: ssh-keyscan github.com >> ~/.ssh/known_hosts',
        };
      }

      return {
        available: false,
        reason: `Connection failed: ${errorMsg.substring(0, 100)}`,
      };
    }
  }

  /**
   * Execute git command with timeout using child_process.spawn
   * This is a lightweight implementation that doesn't block the event loop
   */
  private static execGitWithTimeout(
    args: string[],
    cwd: string,
    timeoutMs: number,
    extraEnv: NodeJS.ProcessEnv = {},
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');

      const child = spawn('git', args, {
        cwd,
        stdio: 'pipe',
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: extraEnv.GIT_TERMINAL_PROMPT ?? '0', // Don't prompt for credentials
          GIT_ASKPASS: extraEnv.GIT_ASKPASS ?? '/bin/echo', // Prevent password prompts
          GCM_INTERACTIVE: extraEnv.GCM_INTERACTIVE ?? 'never',
          ...extraEnv,
        },
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        reject(
          new Error(
            `Git command timed out after ${timeoutMs}ms: git ${args.join(' ')}`,
          ),
        );
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
          reject(
            new Error(
              `Git command failed with code ${code}: ${stderr || 'No error message'}`,
            ),
          );
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
