import { Repository, GitStatus as GitWatcherStatus } from '../../shared/types/repository.types';

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

// GitStatus is now imported from repository.types

export interface GitDetailedChanges {
  created: string[];
  modified: string[];
  deleted: string[];
  renamed: Array<{ from: string; to: string }>;
  stats: { additions: number; deletions: number };
  fileStats: Record<string, { additions: number; deletions: number }>;
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
    console.log(`[GitService] Getting repository info for: ${directoryPath}`);
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
    console.log(`[GitService] Checking if repo is private: ${remoteUrl}`);

    return window.mainProcess.git.checkIfPrivateRepo(remoteUrl);
  }

  static async cloneRepository(
    remoteUrl: string,
    targetPath: string,
  ): Promise<boolean> {
    console.log(
      `[GitService] Cloning repository ${remoteUrl} to ${targetPath}`,
    );
    return window.mainProcess.git.cloneRepository(remoteUrl, targetPath);
  }

  static async checkAuthMethods(remoteUrl: string): Promise<{
    ssh: { available: boolean; reason?: string };
    https: { available: boolean; reason?: string };
    suggestions: string[];
  }> {
    console.log(`[GitService] Checking auth methods for ${remoteUrl}`);
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
    console.log(`[GitService] Deleting git repository: ${repoPath}`);
    return window.mainProcess.git.deleteGitRepository(repoPath);
  }

  static async forceDeleteGitRepository(repoPath: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    console.log(`[GitService] Force deleting git repository: ${repoPath}`);
    return window.mainProcess.git.forceDeleteGitRepository(repoPath);
  }

  static async getStatus(directory: string): Promise<GitWatcherStatus> {
    console.log(`[GitService] Getting git status for: ${directory}`);
    return window.mainProcess.git.getStatus(directory);
  }

  static async getDetailedChanges(
    directory: string,
    files?: string[],
  ): Promise<GitDetailedChanges> {
    console.log(`[GitService] Getting detailed changes for: ${directory}`);
    return window.mainProcess.git.getDetailedChanges(directory, files);
  }

  static async getUncommittedChanges(directory: string): Promise<string[]> {
    console.log(`[GitService] Getting uncommitted changes for: ${directory}`);
    return window.mainProcess.git.getUncommittedChanges(directory);
  }

  static async fastForwardMerge(
    directory: string,
  ): Promise<{ success: boolean; message: string }> {
    console.log(`[GitService] Attempting fast-forward merge for: ${directory}`);
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
    } catch (error: any) {
      console.error('[GitService] Fast-forward failed:', error);
      return {
        success: false,
        message: error.message || 'Fast-forward failed',
      };
    }
  }

  static async getBranchStatus(directory: string): Promise<GitBranchStatus> {
    console.log(`[GitService] Getting branch status for: ${directory}`);
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
      } catch (fetchError) {
        // Ignore fetch errors - we'll use the local cached info
        console.log(
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
      } catch (error) {
        console.log('[GitService] Could not check git status');
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
    console.log(`[GitService] Fetching upstream for: ${directory}`);
    try {
      // First try to fetch from upstream remote
      try {
        await window.mainProcess.git.execCommand(directory, [
          'fetch',
          'upstream',
        ]);
        console.log('[GitService] Fetched from upstream remote');
        return {
          success: true,
          message: 'Fetched from upstream',
        };
      } catch (upstreamError) {
        // If upstream doesn't exist, try origin
        console.log('[GitService] No upstream remote, trying origin');
        await window.mainProcess.git.execCommand(directory, [
          'fetch',
          'origin',
        ]);
        return {
          success: true,
          message: 'Fetched from origin',
        };
      }
    } catch (error: any) {
      console.error('[GitService] Fetch failed:', error);
      return {
        success: false,
        message: error.message || 'Fetch failed',
      };
    }
  }

  // Additional methods needed by GitSyncManager
  static async getCurrentBranch(directory: string): Promise<GitBranchInfo> {
    console.log(`[GitService] Getting current branch for: ${directory}`);
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
    } catch (error: any) {
      console.error('[GitService] Failed to get current branch:', error);
      return { branch: 'unknown' };
    }
  }

  static async getLatestCommit(directory: string): Promise<GitCommitInfo> {
    console.log(`[GitService] Getting latest commit for: ${directory}`);
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
    } catch (error: any) {
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
    console.log(`[GitService] Committing changes in: ${directory}`);
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
    } catch (error: any) {
      console.error('[GitService] Commit failed:', error);
      return {
        success: false,
        message: error.message || 'Commit failed',
      };
    }
  }

  static async fetch(
    directory: string,
  ): Promise<{ success: boolean; message: string }> {
    console.log(`[GitService] Fetching for: ${directory}`);
    try {
      await window.mainProcess.git.execCommand(directory, ['fetch', 'origin']);

      return {
        success: true,
        message: 'Fetched successfully',
      };
    } catch (error: any) {
      console.error('[GitService] Fetch failed:', error);
      return {
        success: false,
        message: error.message || 'Fetch failed',
      };
    }
  }

  static async merge(
    directory: string,
    branch: string,
  ): Promise<{ success: boolean; message: string }> {
    console.log(`[GitService] Merging ${branch} in: ${directory}`);
    try {
      await window.mainProcess.git.execCommand(directory, ['merge', branch]);

      return {
        success: true,
        message: `Merged ${branch} successfully`,
      };
    } catch (error: any) {
      console.error('[GitService] Merge failed:', error);
      return {
        success: false,
        message: error.message || 'Merge failed',
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
    console.log(`[GitService] Pushing changes from: ${directory}`);
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
    } catch (error: any) {
      console.error('[GitService] Push failed:', error);

      // Parse common push errors
      const errorMessage = error.message || error.stderr || 'Push failed';

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
            message: 'Push rejected: Remote has changes. Pull first or force push.',
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

  static async isPushSafe(
    directory: string,
  ): Promise<{
    safe: boolean;
    reason?: string;
    hasUpstream: boolean;
    needsUpstream: boolean;
  }> {
    console.log(`[GitService] Checking if push is safe for: ${directory}`);
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
    } catch (error: any) {
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
   * Subscribe to git status updates
   * @returns Unsubscribe function
   */
  static onStatusUpdate(
    callback: (status: GitWatcherStatus) => void,
  ): () => void {
    if (window.mainProcess.git.onStatusUpdate) {
      return window.mainProcess.git.onStatusUpdate(callback);
    }
    // Return no-op unsubscribe if not available
    return () => {};
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
}
