import { Repository } from '../../shared/types/repository.types';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';
import type { DefaultBranchInfo } from '../contexts/ProjectsPanelContext';

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

export type GitCommitFileStatus = 'A' | 'M' | 'D' | 'R' | 'C' | 'T';

export interface GitCommitFileChange {
  /** Repo-relative path (post-rename when status is `R`). */
  path: string;
  status: GitCommitFileStatus;
}

export interface GitCommitWithStats {
  hash: string;
  subject: string;
  author: string;
  /** ISO 8601 author timestamp (`%aI`). */
  authoredAt: string;
  filesChanged: number;
  additions: number;
  deletions: number;
  files: GitCommitFileChange[];
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

  /**
   * Get commit dates for heat map visualization
   * Returns an array of { date, count } for each day with commits
   * @param directory - Repository directory
   * @param days - Number of days to look back (default: 365)
   */
  static async getCommitDatesForHeatMap(
    directory: string,
    days = 365,
  ): Promise<{ date: string; count: number }[]> {
    console.info(
      `[GitService] Getting commit dates for heat map: ${directory} (days=${days})`,
    );
    try {
      // Get all commit dates in short format for the past N days
      const result = await window.mainProcess.git.execCommand(directory, [
        'log',
        '--date=short',
        '--format=%ad',
        `--since=${days} days ago`,
      ]);

      const dates = result.stdout.trim().split('\n').filter(Boolean);

      // Count commits per date
      const countMap = new Map<string, number>();
      for (const date of dates) {
        countMap.set(date, (countMap.get(date) || 0) + 1);
      }

      // Convert to array format
      const commitDates: { date: string; count: number }[] = [];
      for (const [date, count] of countMap) {
        commitDates.push({ date, count });
      }

      return commitDates;
    } catch (error) {
      console.error('[GitService] Failed to get commit dates:', error);
      return [];
    }
  }

  /**
   * Commit info returned by getCommitForDate
   */
  static CommitInfo: {
    hash: string;
    message: string;
    author: string;
    date: string;
  };

  /**
   * Get the last commit info for a specific date
   * @param directory - Repository directory
   * @param date - Date in YYYY-MM-DD format
   * @returns Commit info or null if no commits on that date
   */
  static async getCommitForDate(
    directory: string,
    date: string,
  ): Promise<{ hash: string; message: string; author: string; date: string } | null> {
    console.info(`[GitService] Getting commit for date: ${directory} (${date})`);
    try {
      // Get the last commit on the given date with full info
      // Format: hash|subject|author|date
      const result = await window.mainProcess.git.execCommand(directory, [
        'log',
        '--format="%H|%s|%an|%ad"',
        '--date=short',
        '-1',
        `--since=${date} 00:00:00`,
        `--until=${date} 23:59:59`,
      ]);

      const line = result.stdout.trim().replace(/^"|"$/g, '');
      if (!line) return null;

      const [hash, message, author, commitDate] = line.split('|');
      return { hash, message, author, date: commitDate };
    } catch (error) {
      console.error('[GitService] Failed to get commit for date:', error);
      return null;
    }
  }

  /**
   * Get all commits in a date range
   * @param directory - Repository directory
   * @param startDate - Start date in YYYY-MM-DD format
   * @param endDate - End date in YYYY-MM-DD format
   * @returns Array of commit info, oldest first
   */
  static async getCommitsInDateRange(
    directory: string,
    startDate: string,
    endDate: string,
  ): Promise<{ hash: string; message: string; author: string; authorEmail: string; date: string }[]> {
    try {
      // Get all commits in the date range, oldest first (--reverse)
      // Use ISO 8601 format for full timestamp
      const result = await window.mainProcess.git.execCommand(directory, [
        'log',
        '--format="%H|%s|%an|%ae|%aI"',
        '--reverse',
        `--since=${startDate} 00:00:00`,
        `--until=${endDate} 23:59:59`,
      ]);

      const lines = result.stdout.trim().split('\n').filter(Boolean);
      return lines.map(line => {
        const cleanLine = line.replace(/^"|"$/g, '');
        const [hash, message, author, authorEmail, date] = cleanLine.split('|');
        return { hash, message, author, authorEmail, date };
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[GitService] Failed to get commits in date range:', error);

      // Check if it's a worker timeout error
      if (errorMsg.includes('Worker') && errorMsg.includes('timeout')) {
        console.error('[GitService] ⚠️  CLI Bridge worker not responding!');
        console.error('[GitService] 💡 Try: Open System Monitor → CLI Bridge → Test Worker or Restart Worker');
      }

      return [];
    }
  }

  /**
   * Get the file tree structure at a specific commit
   * Uses git ls-tree to get file paths without checking out
   * @param directory - Repository directory
   * @param commitHash - Git commit hash
   * @returns Array of file paths
   */
  static async getFileTreeAtCommit(
    directory: string,
    commitHash: string,
  ): Promise<string[]> {
    console.info(`[GitService] Getting file tree at commit: ${directory} (${commitHash})`);
    try {
      // Get all files at the commit using ls-tree
      const result = await window.mainProcess.git.execCommand(directory, [
        'ls-tree',
        '-r',
        '--name-only',
        commitHash,
      ]);

      const files = result.stdout.trim().split('\n').filter(Boolean);
      return files;
    } catch (error) {
      console.error('[GitService] Failed to get file tree at commit:', error);
      return [];
    }
  }

  /**
   * Get files changed in a specific commit with their change type and line counts
   * Uses git show --numstat and --name-status to get complete file change info
   * @param directory - Repository directory
   * @param commitHash - Git commit hash
   * @returns Map of file path to change info (status and line counts)
   */
  /**
   * Get the full diff text for a commit
   */
  static async getCommitDiff(
    directory: string,
    commitHash: string,
  ): Promise<string> {
    console.info(`[GitService] Getting commit diff: ${directory} (${commitHash})`);
    try {
      const result = await window.mainProcess.git.execCommand(directory, [
        'show',
        '--format=',
        '--no-color',
        commitHash,
      ]);
      return result.stdout;
    } catch (error) {
      console.error('[GitService] Failed to get commit diff:', error);
      return '';
    }
  }

  static async getChangedFilesForCommit(
    directory: string,
    commitHash: string,
  ): Promise<Map<string, { status: 'added' | 'modified' | 'deleted' | 'renamed'; additions: number; deletions: number }>> {
    try {
      // Get file changes with status codes and line counts in one call
      // Format: --numstat gives "additions deletions path"
      // --name-status gives "status path"
      const [numstatResult, nameStatusResult] = await Promise.all([
        window.mainProcess.git.execCommand(directory, [
          'show',
          '--numstat',
          '--format=',
          commitHash,
        ]),
        window.mainProcess.git.execCommand(directory, [
          'show',
          '--name-status',
          '--format=',
          commitHash,
        ]),
      ]);

      // Parse line counts from numstat
      const lineCounts = new Map<string, { additions: number; deletions: number }>();
      for (const line of numstatResult.stdout.trim().split('\n').filter(Boolean)) {
        const parts = line.split('\t');
        if (parts.length >= 3) {
          // Binary files show "-" for additions/deletions
          const additions = parts[0] === '-' ? 0 : parseInt(parts[0], 10) || 0;
          const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10) || 0;
          const filePath = parts[2];
          lineCounts.set(filePath, { additions, deletions });
        }
      }

      // Parse status codes
      const changedFiles = new Map<string, { status: 'added' | 'modified' | 'deleted' | 'renamed'; additions: number; deletions: number }>();
      for (const line of nameStatusResult.stdout.trim().split('\n').filter(Boolean)) {
        const parts = line.split('\t');
        if (parts.length < 2) continue;

        const statusCode = parts[0];
        let filePath = parts[1];
        let status: 'added' | 'modified' | 'deleted' | 'renamed';

        if (statusCode === 'A') {
          status = 'added';
        } else if (statusCode === 'M') {
          status = 'modified';
        } else if (statusCode === 'D') {
          status = 'deleted';
        } else if (statusCode.startsWith('R')) {
          // Renamed files have format: R<score>\told_path\tnew_path
          status = 'renamed';
          filePath = parts[2] || filePath; // Use new path
        } else {
          status = 'modified'; // Default
        }

        const counts = lineCounts.get(filePath) || { additions: 0, deletions: 0 };
        changedFiles.set(filePath, {
          status,
          additions: counts.additions,
          deletions: counts.deletions,
        });
      }

      return changedFiles;
    } catch (error) {
      console.error('[GitService] Failed to get changed files for commit:', error);
      return new Map();
    }
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

  /**
   * Single-call variant of `getLatestCommit` that also pulls `--shortstat`
   * for the file-city RecentCommitCard. Returns `null` when the repo has no
   * commits yet (or the call fails).
   */
  static async getLatestCommitWithStats(
    directory: string,
  ): Promise<GitCommitWithStats | null> {
    try {
      // Single call returns:
      //   <hash>\0<subject>\0<author>\0<iso>
      //   :<mode> <mode> <sha> <sha> <STATUS>\t<path>     (--raw, one per file)
      //   <adds>\t<dels>\t<path>                          (--numstat, one per file)
      // We can't combine --shortstat with --name-status (git silently drops
      // shortstat), so compute totals from --numstat instead.
      const { stdout } = await window.mainProcess.git.execCommand(directory, [
        'log',
        '-1',
        '--pretty=format:%H%x00%s%x00%an%x00%aI',
        '--raw',
        '--numstat',
      ]);

      const lines = stdout.split('\n').filter((l) => l.length > 0);
      if (lines.length === 0) return null;

      const [hash = '', subject = '', author = '', authoredAt = ''] =
        lines[0].split('\x00');
      if (!hash) return null;

      const files: GitCommitFileChange[] = [];
      let additions = 0;
      let deletions = 0;

      for (const line of lines.slice(1)) {
        if (line.startsWith(':')) {
          // --raw: ":mode mode sha sha STATUS\tpath" or
          //        ":mode mode sha sha R100\told\tnew" for renames/copies.
          const parts = line.split('\t');
          if (parts.length < 2) continue;
          const headerTokens = parts[0].split(' ');
          const code = headerTokens[headerTokens.length - 1] ?? '';
          const head = code[0];
          if (
            head !== 'A' && head !== 'M' && head !== 'D' &&
            head !== 'R' && head !== 'C' && head !== 'T'
          ) {
            continue;
          }
          const path = (head === 'R' || head === 'C') && parts.length >= 3
            ? parts[2]
            : parts[1];
          if (!path) continue;
          files.push({ path, status: head });
        } else {
          // --numstat: "<adds>\t<dels>\t<path>". Binary diffs use "-\t-\t<path>".
          const parts = line.split('\t');
          if (parts.length < 3) continue;
          const adds = Number(parts[0]);
          const dels = Number(parts[1]);
          if (Number.isFinite(adds)) additions += adds;
          if (Number.isFinite(dels)) deletions += dels;
        }
      }

      return {
        hash,
        subject,
        author,
        authoredAt,
        filesChanged: files.length,
        additions,
        deletions,
        files,
      };
    } catch (error: unknown) {
      console.error(
        '[GitService] Failed to get latest commit with stats:',
        error,
      );
      return null;
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

  /**
   * Get the commits the current branch is ahead of its upstream by.
   * Returns an empty array if there is no upstream or no commits ahead.
   */
  static async getAheadCommits(
    directory: string,
  ): Promise<GitCommitInfo[]> {
    try {
      const result = await window.mainProcess.git.execCommand(directory, [
        'log',
        '@{u}..HEAD',
        '--format="%H|%s|%an|%aI"',
      ]);
      const lines = result.stdout.trim().split('\n').filter(Boolean);
      return lines.map((line) => {
        const cleanLine = line.replace(/^"|"$/g, '');
        const [hash, message, author, date] = cleanLine.split('|');
        return { hash, message, author, date };
      });
    } catch (error) {
      console.warn('[GitService] Failed to get ahead commits:', error);
      return [];
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
   * Get the number of unique contributors for a repository
   * @param directory - Repository directory
   * @returns Number of unique contributors
   */
  static async getContributorCount(directory: string): Promise<number> {
    console.info(`[GitService] Getting contributor count for: ${directory}`);
    const contributors = await GitService.getContributors(directory);
    return contributors.length;
  }

  /**
   * Get the list of contributors with their commit counts
   * @param directory - Repository directory
   * @returns Array of contributors with their commit counts
   */
  static async getContributors(directory: string): Promise<Array<{ name: string; commits: number; email?: string }>> {
    console.info(`[GitService] Getting contributors for: ${directory}`);
    try {
      const result = await window.mainProcess.git.execCommand(directory, [
        'shortlog',
        '-s',
        '-n',
        '-e',
        '--all',
      ]);

      // Parse "  count\tAuthor Name <email>"
      const emailMap = new Map<string, { name: string; commits: number; email: string }>();
      const noEmailList: Array<{ name: string; commits: number }> = [];

      const lines = result.stdout.trim().split('\n').filter(Boolean);
      for (const line of lines) {
        const match = line.trim().match(/^(\d+)\s+(.+?)\s+<([^>]*)>$/);
        if (match) {
          const commits = parseInt(match[1], 10);
          const name = match[2];
          const email = match[3].toLowerCase();

          if (email) {
            const existing = emailMap.get(email);
            if (existing) {
              // Keep the name with more commits, accumulate total
              emailMap.set(email, {
                name: existing.commits >= commits ? existing.name : name,
                commits: existing.commits + commits,
                email,
              });
            } else {
              emailMap.set(email, { name, commits, email });
            }
          } else {
            noEmailList.push({ name, commits });
          }
        } else {
          // Fallback for lines without email
          const fallback = line.trim().match(/^(\d+)\s+(.+)$/);
          if (fallback) {
            noEmailList.push({ name: fallback[2], commits: parseInt(fallback[1], 10) });
          }
        }
      }

      return [...emailMap.values(), ...noEmailList].sort((a, b) => b.commits - a.commits);
    } catch (error) {
      console.error('[GitService] Failed to get contributors:', error);
      return [];
    }
  }

  /**
   * Build a repo-wide ownership map by blaming every tracked file at HEAD.
   *
   * Uses `git blame --line-porcelain -w HEAD -- <file>` per file and counts
   * `author-mail` headers (one per source line) by email.
   *
   * Cost is roughly O(files × history_depth). On a moderate repo this can take
   * tens of seconds — call once and cache.
   *
   * @param directory - Repository directory
   * @param concurrency - Number of parallel blames (default 8)
   * @returns
   *   - `byEmail`: Map<lowercased email, Map<path, linesOwned>>
   *   - `totalLines`: Map<path, total lines at HEAD> (lines blame could attribute)
   *   - `totalLinesGlobal`: sum of all totalLines values
   */
  static async getOwnershipMap(
    directory: string,
    concurrency: number = 8,
  ): Promise<{
    byEmail: Map<string, Map<string, number>>;
    totalLines: Map<string, number>;
    totalLinesGlobal: number;
  }> {
    const byEmail = new Map<string, Map<string, number>>();
    const totalLines = new Map<string, number>();
    let totalLinesGlobal = 0;

    let files: string[] = [];
    try {
      const lsResult = await window.mainProcess.git.execCommand(directory, ['ls-files']);
      files = lsResult.stdout.split('\n').filter(Boolean);
    } catch (error) {
      console.error('[GitService] ls-files failed for ownership map:', error);
      return { byEmail, totalLines, totalLinesGlobal };
    }

    let cursor = 0;
    const blameOne = async () => {
      while (true) {
        const i = cursor++;
        if (i >= files.length) return;
        const file = files[i];
        try {
          const blameResult = await window.mainProcess.git.execCommand(directory, [
            'blame',
            '--line-porcelain',
            '-w',
            'HEAD',
            '--',
            file,
          ]);
          const perFileEmails = new Map<string, number>();
          let fileLines = 0;
          for (const line of blameResult.stdout.split('\n')) {
            if (line.startsWith('author-mail ')) {
              const m = /^author-mail <([^>]*)>/.exec(line);
              if (m) {
                const email = m[1].toLowerCase();
                perFileEmails.set(email, (perFileEmails.get(email) ?? 0) + 1);
                fileLines++;
              }
            }
          }
          if (fileLines > 0) {
            totalLines.set(file, fileLines);
            totalLinesGlobal += fileLines;
            for (const [email, lines] of perFileEmails) {
              let perFile = byEmail.get(email);
              if (!perFile) {
                perFile = new Map();
                byEmail.set(email, perFile);
              }
              perFile.set(file, (perFile.get(file) ?? 0) + lines);
            }
          }
        } catch {
          // Binary file or unblameable — skip silently.
        }
      }
    };

    const workers = Array.from({ length: Math.max(1, concurrency) }, blameOne);
    await Promise.all(workers);

    return { byEmail, totalLines, totalLinesGlobal };
  }

  /**
   * Get the files an author has touched, with line counts and commit counts per file.
   * Uses `git log --author=<email> --numstat` and aggregates across all commits.
   * @param directory - Repository directory
   * @param email - Author email (matched against the author header; regex specials are escaped)
   * @returns Map<filePath, { commits, linesTouched }>
   */
  static async getFilesTouchedByAuthor(
    directory: string,
    email: string,
  ): Promise<Map<string, { commits: number; linesTouched: number }>> {
    const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      const result = await window.mainProcess.git.execCommand(directory, [
        'log',
        '--all',
        '--no-merges',
        `--author=${escapedEmail}`,
        '--numstat',
        '--pretty=tformat:__COMMIT__',
      ]);

      const files = new Map<string, { commits: number; linesTouched: number; lastCommitMarker: number }>();
      let commitIdx = 0;
      const renamePattern = /\{.*? => (.*?)\}/;

      for (const rawLine of result.stdout.split('\n')) {
        const line = rawLine.trim();
        if (!line) continue;
        if (line === '__COMMIT__') {
          commitIdx++;
          continue;
        }
        // numstat line: <add>\t<del>\t<path>  (binary files use "-")
        const parts = line.split('\t');
        if (parts.length < 3) continue;
        const additions = parts[0] === '-' ? 0 : parseInt(parts[0], 10) || 0;
        const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10) || 0;
        let filePath = parts[2];
        // Handle rename notation "old/{a => b}/file" or "{old => new}"
        const renameMatch = filePath.match(renamePattern);
        if (renameMatch) {
          filePath = filePath.replace(renamePattern, renameMatch[1]).replace(/\/\//g, '/');
        }

        const existing = files.get(filePath);
        if (existing) {
          existing.linesTouched += additions + deletions;
          if (existing.lastCommitMarker !== commitIdx) {
            existing.commits += 1;
            existing.lastCommitMarker = commitIdx;
          }
        } else {
          files.set(filePath, { commits: 1, linesTouched: additions + deletions, lastCommitMarker: commitIdx });
        }
      }

      const out = new Map<string, { commits: number; linesTouched: number }>();
      for (const [path, info] of files) {
        out.set(path, { commits: info.commits, linesTouched: info.linesTouched });
      }
      return out;
    } catch (error) {
      console.error('[GitService] Failed to get files touched by author:', error);
      return new Map();
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

  /**
   * Get the default branch for a repository
   * Uses symbolic-ref → remote set-head → fallback strategy
   * @param directory - Repository directory
   * @returns Default branch name or null if cannot be determined
   */
  static async getDefaultBranch(directory: string): Promise<string | null> {
    console.info(`[GitService] Getting default branch for: ${directory}`);

    // Try symbolic-ref first (fast, offline)
    try {
      const result = await window.mainProcess.git.execCommand(directory, [
        'symbolic-ref',
        'refs/remotes/origin/HEAD',
      ]);
      if (result.stdout) {
        const branch = result.stdout.trim().replace('refs/remotes/origin/', '');
        if (branch) {
          console.info(`[GitService] Default branch from symbolic-ref: ${branch}`);
          return branch;
        }
      }
    } catch {
      console.info('[GitService] symbolic-ref not set, trying remote detection...');
    }

    // Try remote set-head (needs network)
    try {
      console.info('[GitService] Running git remote set-head origin --auto...');
      await window.mainProcess.git.execCommand(directory, [
        'remote',
        'set-head',
        'origin',
        '--auto',
      ]);
      const result = await window.mainProcess.git.execCommand(directory, [
        'symbolic-ref',
        'refs/remotes/origin/HEAD',
      ]);
      if (result.stdout) {
        const branch = result.stdout.trim().replace('refs/remotes/origin/', '');
        if (branch) {
          console.info(`[GitService] Default branch after set-head: ${branch}`);
          return branch;
        }
      }
    } catch (error) {
      console.warn('[GitService] remote set-head failed (offline?):', error);
    }

    // Fallback: check for common branches
    try {
      console.info('[GitService] Trying fallback branch detection...');
      const result = await window.mainProcess.git.execCommand(directory, [
        'branch',
        '-r',
      ]);
      const remoteBranches = result.stdout
        .split('\n')
        .map(b => b.trim())
        .filter(Boolean);

      for (const common of ['origin/main', 'origin/master']) {
        if (
          remoteBranches.some(b => b === common || b.startsWith(`${common} `))
        ) {
          const branchName = common.replace('origin/', '');
          console.info(`[GitService] Default branch from fallback: ${branchName}`);
          return branchName;
        }
      }
    } catch (error) {
      console.error('[GitService] Fallback branch detection failed:', error);
    }

    console.warn('[GitService] Could not determine default branch');
    return null;
  }

  /**
   * Analyze default branch status for a repository
   * @param entry - Alexandria repository entry
   * @returns DefaultBranchInfo or null if analysis failed
   */
  static async analyzeDefaultBranchStatus(
    entry: AlexandriaEntry,
  ): Promise<DefaultBranchInfo | null> {
    console.info(`[GitService] Analyzing default branch status: ${entry.name}`);

    try {
      // Get current branch
      const branchStatus = await this.getBranchStatus(entry.path);
      const currentBranch = branchStatus.branch;

      // Check if repo has remote
      const repoInfo = await this.getRepositoryInfo(entry.path);
      if (!repoInfo || !repoInfo.remotes || repoInfo.remotes.length === 0) {
        console.info(`[GitService] ${entry.name}: No remote configured`);
        return {
          entry,
          currentBranch,
          defaultBranch: 'unknown',
          behindCount: 0,
          isOnDefaultBranch: false,
          hasRemote: false,
        };
      }

      // Get default branch - prefer cached metadata, fall back to git detection
      let defaultBranch: string | null = null;

      // Try cached GitHub metadata first (fast!)
      if (entry.github?.defaultBranch) {
        defaultBranch = entry.github.defaultBranch;
        console.info(
          `[GitService] ${entry.name}: Using cached default branch: ${defaultBranch}`,
        );
      } else {
        // Fall back to git detection (slower but works for non-GitHub remotes)
        defaultBranch = await this.getDefaultBranch(entry.path);
        if (defaultBranch) {
          console.info(
            `[GitService] ${entry.name}: Detected default branch via git: ${defaultBranch}`,
          );
        }
      }

      if (!defaultBranch) {
        console.warn(
          `[GitService] ${entry.name}: Could not determine default branch`,
        );
        return {
          entry,
          currentBranch,
          defaultBranch: 'unknown',
          behindCount: 0,
          isOnDefaultBranch: false,
          hasRemote: true,
          error: 'Could not determine default branch',
        };
      }

      // Check if on default branch
      const isOnDefaultBranch = currentBranch === defaultBranch;

      // Calculate behind count
      let behindCount = 0;
      if (isOnDefaultBranch && branchStatus.hasUpstream) {
        behindCount = branchStatus.behind;
      } else if (!isOnDefaultBranch) {
        try {
          const result = await window.mainProcess.git.execCommand(entry.path, [
            'rev-list',
            '--count',
            `HEAD..origin/${defaultBranch}`,
          ]);
          behindCount = parseInt(result.stdout.trim(), 10) || 0;
        } catch (error) {
          console.warn(
            `[GitService] ${entry.name}: Failed to count commits behind:`,
            error,
          );
          behindCount = 0;
        }
      }

      console.info(
        `[GitService] ${entry.name}: current=${currentBranch}, default=${defaultBranch}, behind=${behindCount}`,
      );

      return {
        entry,
        currentBranch,
        defaultBranch,
        behindCount,
        isOnDefaultBranch,
        hasRemote: true,
      };
    } catch (error) {
      console.error(`[GitService] Failed to analyze ${entry.name}:`, error);
      return null;
    }
  }
}
