import { Repository } from '../../shared/types/repository.types';

export interface GitRemote {
  name: string;
  url: string;
  owner?: string;
  repo?: string;
}

export interface GitInfo {
  isRepository: boolean;
  root: string;
  remotes?: GitRemote[];
  currentBranch?: string;
  lastCommit?: string;
}

export interface GitBranchStatus {
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
  hasUpstream: boolean;
  canFastForward?: boolean;
  hasUncommittedChanges?: boolean;
}

export interface GitCommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitBranchInfo {
  branch: string;
  upstream?: string;
}

export class GitService {
  static async execCommand(
    directory: string,
    args: string[],
  ): Promise<{ stdout: string; stderr: string }> {
    return window.mainProcess.git.execCommand(directory, args);
  }

  static async getRepositoryInfo(
    directoryPath: string,
  ): Promise<GitInfo | null> {
    console.info(`[GitService] Getting repository info for: ${directoryPath}`);
    const info = await window.mainProcess.git.getRepositoryInfo(directoryPath);
    if (!info) return null;
    return {
      isRepository: info.isRepository,
      root: info.root,
      remotes: info.remotes,
      // These fields may need to be fetched separately if needed
      currentBranch: undefined,
      lastCommit: undefined,
    };
  }

  static async checkIfPrivateRepo(remoteUrl: string): Promise<boolean> {
    console.info(`[GitService] Checking if repo is private: ${remoteUrl}`);

    return window.mainProcess.git.checkIfPrivateRepo(remoteUrl);
  }

  static async cloneRepository(
    remoteUrl: string,
    targetPath: string,
  ): Promise<boolean> {
    console.info(
      `[GitService] Cloning repository ${remoteUrl} to ${targetPath}`,
    );
    return window.mainProcess.git.cloneRepository(remoteUrl, targetPath);
  }

  static async checkAuthMethods(remoteUrl: string): Promise<{
    ssh: { available: boolean; reason?: string };
    https: { available: boolean; reason?: string };
    suggestions: string[];
  }> {
    console.info(`[GitService] Checking auth methods for ${remoteUrl}`);
    return window.mainProcess.git.checkAuthMethods(remoteUrl);
  }

  static async deleteGitRepository(repoPath: string): Promise<{
    success: boolean;
    error?: string;
    hasUncommittedChanges?: boolean;
    unpushedCommits?: number;
    currentBranch?: string;
    requiresConfirmation?: boolean;
  }> {
    console.info(`[GitService] Deleting git repository: ${repoPath}`);
    return window.mainProcess.git.deleteGitRepository(repoPath);
  }

  static async forceDeleteGitRepository(repoPath: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    console.info(`[GitService] Force deleting git repository: ${repoPath}`);
    return window.mainProcess.git.forceDeleteGitRepository(repoPath);
  }

  /**
   * Scan a folder for git repositories
   * @param folderPath - Base folder to scan
   * @param maxDepth - Maximum depth to scan (default: 2)
   * @returns Array of absolute paths to git repositories
   */
  static async scanFolderForRepos(
    folderPath: string,
    maxDepth?: number,
  ): Promise<string[]> {
    console.info(
      `[GitService] Scanning folder for repos: ${folderPath} (depth: ${maxDepth ?? 2})`,
    );
    return window.mainProcess.git.scanFolderForRepos(folderPath, maxDepth);
  }

  /**
   * Get discovered (untracked) repositories in a folder
   * Filters out repositories already registered in Alexandria
   * @param basePath - Base folder to scan
   * @param maxDepth - Maximum depth to scan (default: 2)
   * @returns Array of discovered repositories not in Alexandria
   */
  static async getDiscoveredRepos(
    basePath: string,
    maxDepth?: number,
  ): Promise<Array<{ path: string; name: string; isTracked: false }>> {
    console.info(
      `[GitService] Getting discovered repos: ${basePath} (depth: ${maxDepth ?? 2})`,
    );
    return window.mainProcess.git.getDiscoveredRepos(basePath, maxDepth);
  }

  static async getCommitHistory(
    directory: string,
    limit = 50,
  ): Promise<GitCommitInfo[]> {
    console.info(
      `[GitService] Getting commit history for: ${directory} (limit=${limit})`,
    );
    return window.mainProcess.git.getCommitHistory(directory, limit);
  }

  static async fastForwardMerge(
    directory: string,
  ): Promise<{ success: boolean; message: string }> {
    console.info(`[GitService] Attempting fast-forward merge for: ${directory}`);
    try {
      // First, ensure we have the latest remote info
      await window.mainProcess.git.execCommand(directory, ['fetch', 'origin']);

      // Perform fast-forward merge
      const result = await window.mainProcess.git.execCommand(directory, [
        'merge',
        '--ff-only',
        '@{u}',
      ]);

      return {
        success: true,
        message: result.stdout || 'Fast-forward successful',
      };
    } catch (error: unknown) {
      console.error('[GitService] Fast-forward failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Fast-forward failed',
      };
    }
  }

  static async getBranchStatus(directory: string): Promise<GitBranchStatus> {
    console.info(`[GitService] Getting branch status for: ${directory}`);
    try {
      // Get current branch and upstream tracking info
      const branchResult = await window.mainProcess.git.execCommand(directory, [
        'rev-parse',
        '--abbrev-ref',
        'HEAD',
      ]);
      const branch = branchResult.stdout.trim();

      // Get upstream branch
      const upstreamResult = await window.mainProcess.git
        .execCommand(directory, [
          'rev-parse',
          '--abbrev-ref',
          '--symbolic-full-name',
          '@{u}',
        ])
        .catch(() => ({ stdout: '', stderr: '' }));
      const upstream = upstreamResult.stdout.trim();

      if (!upstream) {
        return {
          branch,
          hasUpstream: false,
          ahead: 0,
          behind: 0,
        };
      }

      // Try to update remote tracking info (doesn't modify working files, only updates refs)
      try {
        await window.mainProcess.git.execCommand(directory, [
          'fetch',
          'origin',
          branch,
        ]);
      } catch (_fetchError) {
        // Ignore fetch errors - we'll use the local cached info
        console.info(
          '[GitService] Could not fetch remote info (may be offline), using cached info',
        );
      }

      // Get ahead/behind counts
      const countResult = await window.mainProcess.git.execCommand(directory, [
        'rev-list',
        '--left-right',
        '--count',
        `${upstream}...HEAD`,
      ]);
      const counts = countResult.stdout.trim().split('\t');
      const behind = parseInt(counts[0] || '0', 10);
      const ahead = parseInt(counts[1] || '0', 10);

      // Check for uncommitted changes
      let hasUncommittedChanges = false;
      try {
        const statusResult = await window.mainProcess.git.execCommand(
          directory,
          ['status', '--porcelain'],
        );
        hasUncommittedChanges = statusResult.stdout.trim().length > 0;
      } catch (_error) {
        console.info('[GitService] Could not check git status');
      }

      // Can fast-forward if: behind > 0, ahead == 0, and no uncommitted changes
      const canFastForward =
        behind > 0 && ahead === 0 && !hasUncommittedChanges;

      return {
        branch,
        upstream,
        hasUpstream: true,
        ahead,
        behind,
        canFastForward,
        hasUncommittedChanges,
      };
    } catch (error) {
      console.error('[GitService] Failed to get branch status:', error);
      return {
        branch: 'unknown',
        hasUpstream: false,
        ahead: 0,
        behind: 0,
      };
    }
  }

  static async fetchUpstream(
    directory: string,
  ): Promise<{ success: boolean; message: string }> {
    console.info(`[GitService] Fetching upstream for: ${directory}`);
    try {
      // First try to fetch from upstream remote
      try {
        await window.mainProcess.git.execCommand(directory, [
          'fetch',
          'upstream',
        ]);
        console.info('[GitService] Fetched from upstream remote');
        return {
          success: true,
          message: 'Fetched from upstream',
        };
      } catch (_upstreamError) {
        // If upstream doesn't exist, try origin
        console.info('[GitService] No upstream remote, trying origin');
        await window.mainProcess.git.execCommand(directory, [
          'fetch',
          'origin',
        ]);
        return {
          success: true,
          message: 'Fetched from origin',
        };
      }
    } catch (error: unknown) {
      console.error('[GitService] Fetch failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Fetch failed',
      };
    }
  }

  // Additional methods needed by GitSyncManager
  static async getCurrentBranch(directory: string): Promise<GitBranchInfo> {
    console.info(`[GitService] Getting current branch for: ${directory}`);
    try {
      const branch = await window.mainProcess.git.execCommand(directory, [
        'rev-parse',
        '--abbrev-ref',
        'HEAD',
      ]);

      // Try to get upstream tracking branch
      let upstream: string | undefined;
      try {
        const upstreamResult = await window.mainProcess.git.execCommand(
          directory,
          ['rev-parse', '--abbrev-ref', '@{u}'],
        );
        upstream = upstreamResult.stdout;
      } catch {
        // No upstream tracking branch
      }

      return {
        branch: branch.stdout.trim(),
        upstream: upstream?.trim(),
      };
    } catch (error: unknown) {
      console.error('[GitService] Failed to get current branch:', error);
      return { branch: 'unknown' };
    }
  }

  static async getLatestCommit(directory: string): Promise<GitCommitInfo> {
    console.info(`[GitService] Getting latest commit for: ${directory}`);
    try {
      const hash = await window.mainProcess.git.execCommand(directory, [
        'rev-parse',
        'HEAD',
      ]);

      const message = await window.mainProcess.git.execCommand(directory, [
        'log',
        '-1',
        '--pretty=%B',
      ]);

      const author = await window.mainProcess.git.execCommand(directory, [
        'log',
        '-1',
        '--pretty=%an',
      ]);

      const date = await window.mainProcess.git.execCommand(directory, [
        'log',
        '-1',
        '--pretty=%ai',
      ]);

      return {
        hash: hash.stdout.trim(),
        message: message.stdout.trim(),
        author: author.stdout.trim(),
        date: date.stdout.trim(),
      };
    } catch (error: unknown) {
      console.error('[GitService] Failed to get latest commit:', error);
      return {
        hash: '',
        message: '',
        author: '',
        date: '',
      };
    }
  }

  static async commitChanges(
    directory: string,
    message: string,
    files: string[],
  ): Promise<{ success: boolean; message: string }> {
    console.info(`[GitService] Committing changes in: ${directory}`);
    try {
      // Add specified files
      if (files.length > 0) {
        await window.mainProcess.git.execCommand(directory, ['add', ...files]);
      }

      // Commit
      await window.mainProcess.git.execCommand(directory, [
        'commit',
        '-m',
        message,
      ]);

      return {
        success: true,
        message: 'Changes committed successfully',
      };
    } catch (error: unknown) {
      console.error('[GitService] Commit failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Commit failed',
      };
    }
  }

  static async fetch(
    directory: string,
  ): Promise<{ success: boolean; message: string }> {
    console.info(`[GitService] Fetching for: ${directory}`);
    try {
      await window.mainProcess.git.execCommand(directory, ['fetch', 'origin']);

      return {
        success: true,
        message: 'Fetched successfully',
      };
    } catch (error: unknown) {
      console.error('[GitService] Fetch failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Fetch failed',
      };
    }
  }

  static async merge(
    directory: string,
    branch: string,
  ): Promise<{ success: boolean; message: string }> {
    console.info(`[GitService] Merging ${branch} in: ${directory}`);
    try {
      await window.mainProcess.git.execCommand(directory, ['merge', branch]);

      return {
        success: true,
        message: `Merged ${branch} successfully`,
      };
    } catch (error: unknown) {
      console.error('[GitService] Merge failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Merge failed',
      };
    }
  }

  static async push(
    directory: string,
    options?: {
      branch?: string;
      remote?: string;
      force?: boolean;
      setUpstream?: boolean;
    },
  ): Promise<{ success: boolean; message: string }> {
    console.info(`[GitService] Pushing changes from: ${directory}`);
    try {
      const args = ['push'];

      if (options?.force) {
        args.push('--force-with-lease'); // Safer than --force
      }

      if (options?.setUpstream) {
        args.push('--set-upstream');
      }

      args.push(options?.remote || 'origin');

      if (options?.branch) {
        args.push(options.branch);
      }

      const result = await window.mainProcess.git.execCommand(directory, args);

      return {
        success: true,
        message: result.stdout || 'Push successful',
      };
    } catch (error: unknown) {
      console.error('[GitService] Push failed:', error);

      // Parse common push errors
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'object' &&
              error !== null &&
              'stderr' in error &&
              typeof (error as { stderr: unknown }).stderr === 'string'
            ? (error as { stderr: string }).stderr
            : 'Push failed';

      if (errorMessage.includes('no upstream branch')) {
        return {
          success: false,
          message: 'No upstream branch set. Use --set-upstream to configure.',
        };
      }

      if (errorMessage.includes('rejected')) {
        if (errorMessage.includes('non-fast-forward')) {
          return {
            success: false,
            message:
              'Push rejected: Remote has changes. Pull first or force push.',
          };
        }
        return {
          success: false,
          message: 'Push rejected by remote.',
        };
      }

      if (errorMessage.includes('Could not read from remote repository')) {
        return {
          success: false,
          message: 'Authentication failed. Check your credentials.',
        };
      }

      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  static async isPushSafe(directory: string): Promise<{
    safe: boolean;
    reason?: string;
    hasUpstream: boolean;
    needsUpstream: boolean;
  }> {
    console.info(`[GitService] Checking if push is safe for: ${directory}`);
    try {
      // Get branch status
      const status = await this.getBranchStatus(directory);

      if (!status.hasUpstream) {
        // Check if there are any commits
        try {
          await window.mainProcess.git.execCommand(directory, [
            'rev-parse',
            'HEAD',
          ]);
          return {
            safe: true,
            hasUpstream: false,
            needsUpstream: true,
            reason: 'No upstream branch. Will set upstream on push.',
          };
        } catch {
          return {
            safe: false,
            hasUpstream: false,
            needsUpstream: false,
            reason: 'No commits to push.',
          };
        }
      }

      // If we're behind, push is not safe
      if (status.behind > 0) {
        return {
          safe: false,
          hasUpstream: true,
          needsUpstream: false,
          reason: `Cannot push: ${status.behind} commit${status.behind > 1 ? 's' : ''} behind remote.`,
        };
      }

      // If we're ahead, push is safe
      if (status.ahead > 0) {
        return {
          safe: true,
          hasUpstream: true,
          needsUpstream: false,
          reason: `Ready to push ${status.ahead} commit${status.ahead > 1 ? 's' : ''}.`,
        };
      }

      // If we're up to date, nothing to push
      return {
        safe: false,
        hasUpstream: true,
        needsUpstream: false,
        reason: 'Already up to date with remote.',
      };
    } catch (error: unknown) {
      console.error('[GitService] Failed to check push safety:', error);
      return {
        safe: false,
        hasUpstream: false,
        needsUpstream: false,
        reason: 'Failed to check push status.',
      };
    }
  }

  /**
   * Subscribe to repository updated events
   * @returns Unsubscribe function
   */
  static onRepositoryUpdated(
    callback: (updatedRepo: Repository) => void,
  ): () => void {
    return window.mainProcess.git.onRepositoryUpdated(callback);
  }

  /**
   * Subscribe to repository clone added events
   * @returns Unsubscribe function
   */
  static onRepositoryCloneAdded(
    callback: (data: { repository: Repository; clonePath: string }) => void,
  ): () => void {
    return window.mainProcess.git.onRepositoryCloneAdded(callback);
  }

  /**
   * Subscribe to repository clone removed events
   * @returns Unsubscribe function
   */
  static onRepositoryCloneRemoved(
    callback: (data: { repository: Repository; clonePath: string }) => void,
  ): () => void {
    return window.mainProcess.git.onRepositoryCloneRemoved(callback);
  }

  /**
   * Subscribe to local clone missing events
   * @returns Unsubscribe function
   */
  static onLocalCloneMissing(
    callback: (data: { repoPath: string }) => void,
  ): () => void {
    return window.mainProcess.git.onLocalCloneMissing(callback);
  }

  /**
   * Set the URL for a remote
   * @param directory - Repository directory
   * @param remoteName - Name of the remote (e.g., 'origin')
   * @param url - New URL for the remote
   */
  static async setRemoteUrl(
    directory: string,
    remoteName: string,
    url: string,
  ): Promise<{ success: boolean; message: string }> {
    console.info(`[GitService] Setting remote ${remoteName} URL to: ${url}`);
    try {
      await window.mainProcess.git.execCommand(directory, [
        'remote',
        'set-url',
        remoteName,
        url,
      ]);
      return {
        success: true,
        message: `Remote ${remoteName} URL updated successfully`,
      };
    } catch (error: unknown) {
      console.error('[GitService] Failed to set remote URL:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to set remote URL',
      };
    }
  }
}
