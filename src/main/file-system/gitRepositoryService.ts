import * as path from 'path';
import * as fs from 'fs/promises';
import { execSync } from 'child_process';
import { gitClientFactory } from '../utils/gitClientFactory';
import type { GitStatusWithFiles } from '@principal-ai/repository-abstraction';
import { getTracer } from '../telemetry';
import { SpanStatusCode } from '@opentelemetry/api';

export interface GitCommitHistoryEntry {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitRepositoryInfo {
  root: string;
  relativePath: string;
  isRepository: boolean;
  remotes?: Array<{
    name: string;
    url: string;
    owner?: string;
    repo?: string;
  }>;
}

export interface PackageInfo {
  path: string;
  name: string;
  version?: string;
  type: 'npm' | 'yarn' | 'pnpm' | 'unknown';
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export class GitRepositoryService {
  private repositoryCache = new Map<
    string,
    { info: GitRepositoryInfo; timestamp: number }
  >();

  private packageCache = new Map<string, PackageInfo>();

  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Run cache cleanup every 10 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredCacheEntries();
      },
      10 * 60 * 1000,
    );
  }

  /**
   * Cleanup method to be called when service is destroyed
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clearRepositoryCache();
  }

  /**
   * Clear the repository cache (useful for debugging)
   */
  clearRepositoryCache(): void {
    console.log(
      `[GitRepositoryService] Clearing repository cache. Had ${this.repositoryCache.size} entries.`,
    );
    this.repositoryCache.clear();
  }

  /**
   * Clean up expired cache entries to prevent memory growth
   */
  cleanupExpiredCacheEntries(): void {
    const sizeBefore = this.repositoryCache.size;
    const now = Date.now();

    for (const [key, entry] of this.repositoryCache.entries()) {
      if (now - entry.timestamp >= this.CACHE_TTL) {
        this.repositoryCache.delete(key);
      }
    }

    const sizeAfter = this.repositoryCache.size;
    if (sizeBefore !== sizeAfter) {
      console.log(
        `[GitRepositoryService] Cleaned up ${sizeBefore - sizeAfter} expired cache entries`,
      );
    }
  }

  /**
   * Get cache information for debugging
   */
  getCacheInfo(): { size: number; entries: string[] } {
    // Clean up expired entries first
    this.cleanupExpiredCacheEntries();

    return {
      size: this.repositoryCache.size,
      entries: Array.from(this.repositoryCache.keys()),
    };
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(entry: {
    info: GitRepositoryInfo;
    timestamp: number;
  }): boolean {
    return Date.now() - entry.timestamp < this.CACHE_TTL;
  }

  /**
   * Normalize input path to absolute path for consistent caching
   */
  private normalizePath(filePath: string): string {
    return path.resolve(filePath);
  }

  /**
   * Find the git repository root for a given file path or directory
   */
  async findGitRoot(filePath: string): Promise<string | null> {
    try {
      // If it's a file, start from its directory; if it's a directory, use it directly
      const stats = await fs.stat(filePath).catch(() => null);
      const startDir =
        stats && stats.isDirectory() ? filePath : path.dirname(filePath);

      // Use simple-git through GitClientFactory
      const gitRoot = await gitClientFactory.findGitRoot(startDir);

      if (gitRoot) {
        console.log(
          `🔍 GIT-DEBUG: findGitRoot - input: "${filePath}" -> startDir: "${startDir}" -> gitRoot: "${gitRoot}"`,
        );
      } else {
        console.log(
          `🔍 GIT-DEBUG: findGitRoot - NO git repo found for: "${filePath}"`,
        );
      }

      return gitRoot;
    } catch (_error) {
      // Not in a git repository
      console.log(
        `🔍 GIT-DEBUG: findGitRoot - NO git repo found for: "${filePath}"`,
      );
      return null;
    }
  }

  /**
   * Get repository information for a file path or directory
   */
  async getRepositoryInfo(filePath: string): Promise<GitRepositoryInfo | null> {
    // Normalize input path for consistent caching
    const normalizedFilePath = this.normalizePath(filePath);

    const gitRoot = await this.findGitRoot(normalizedFilePath);

    if (!gitRoot) {
      return null;
    }

    // Check cache by git root (not input path) for better cache efficiency
    const normalizedGitRoot = this.normalizePath(gitRoot);
    const cachedEntry = this.repositoryCache.get(normalizedGitRoot);
    if (cachedEntry && this.isCacheValid(cachedEntry)) {
      return cachedEntry.info;
    }

    try {
      // Get relative path from git root
      const relativePath = path.relative(gitRoot, normalizedFilePath);

      // Get remotes using simple-git through GitClientFactory
      const remotes = await gitClientFactory.getRemotes(gitRoot);

      const info: GitRepositoryInfo = {
        root: gitRoot,
        relativePath,
        isRepository: true,
        remotes,
      };

      // Cache by git root, not input path - this is more efficient
      this.repositoryCache.set(normalizedGitRoot, {
        info,
        timestamp: Date.now(),
      });

      return info;
    } catch (error) {
      console.error(
        `[GitRepositoryService] Error getting repository info for ${filePath}:`,
        error,
      );
      if (error instanceof Error) {
        console.error(`[GitRepositoryService] Error stack:`, error.stack);
      }
      return null;
    }
  }

  /**
   * Find the nearest package.json for a file
   */
  async findNearestPackage(filePath: string): Promise<PackageInfo | null> {
    // Check cache first
    const cached = this.packageCache.get(filePath);
    if (cached) return cached;

    let currentDir = path.dirname(filePath);
    const { root } = path.parse(currentDir);

    while (currentDir !== root) {
      const packageJsonPath = path.join(currentDir, 'package.json');

      try {
        await fs.access(packageJsonPath);

        // Found package.json, parse it
        const content = await fs.readFile(packageJsonPath, 'utf-8');
        const packageData = JSON.parse(content);

        // Determine package manager
        let packageManager: PackageInfo['type'] = 'unknown';

        // Check for lock files in current directory first, then work up to git root
        packageManager = await this.detectPackageManager(currentDir, filePath);

        const info: PackageInfo = {
          path: currentDir,
          name: packageData.name || path.basename(currentDir),
          version: packageData.version,
          type: packageManager,
          dependencies: packageData.dependencies,
          devDependencies: packageData.devDependencies,
        };

        // Cache the result
        this.packageCache.set(filePath, info);

        return info;
      } catch {
        // No package.json in this directory, move up
        currentDir = path.dirname(currentDir);
      }
    }

    return null;
  }

  /**
   * Get a tree of repositories from a list of paths (files or directories)
   */
  async getRepositoryTree(filePaths: string[]): Promise<
    Map<
      string,
      {
        info: GitRepositoryInfo;
        files: string[];
        packages: Map<string, PackageInfo>;
      }
    >
  > {
    const repositories = new Map<
      string,
      {
        info: GitRepositoryInfo;
        files: string[];
        packages: Map<string, PackageInfo>;
      }
    >();

    for (const filePath of filePaths) {
      const repoInfo = await this.getRepositoryInfo(filePath);
      if (!repoInfo) continue;

      // Get or create repository entry
      let repoEntry = repositories.get(repoInfo.root);
      if (!repoEntry) {
        repoEntry = {
          info: repoInfo,
          files: [],
          packages: new Map(),
        };
        repositories.set(repoInfo.root, repoEntry);
      }

      // Add file to repository
      repoEntry.files.push(filePath);

      // Find package for this file
      const packageInfo = await this.findNearestPackage(filePath);
      if (packageInfo && !repoEntry.packages.has(packageInfo.path)) {
        repoEntry.packages.set(packageInfo.path, packageInfo);
      }
    }

    return repositories;
  }

  /**
   * Detect package manager by looking for lock files
   * First checks the package directory, then works up to git root
   */
  private async detectPackageManager(
    packageDir: string,
    originalFilePath: string,
  ): Promise<PackageInfo['type']> {
    // First check the package directory itself
    const lockFiles = [
      { file: 'yarn.lock', type: 'yarn' as const },
      { file: 'pnpm-lock.yaml', type: 'pnpm' as const },
      { file: 'package-lock.json', type: 'npm' as const },
    ];

    // Check package directory first
    for (const { file, type } of lockFiles) {
      const lockPath = path.join(packageDir, file);
      try {
        await fs.access(lockPath);
        return type;
      } catch {
        // Continue checking
      }
    }

    // If not found in package directory, check up to git root (for monorepos)
    try {
      const gitRoot = await this.findGitRoot(originalFilePath);

      if (gitRoot && gitRoot !== packageDir) {
        for (const { file, type } of lockFiles) {
          const lockPath = path.join(gitRoot, file);
          try {
            await fs.access(lockPath);
            return type;
          } catch {
            // Continue checking
          }
        }
      }
    } catch (error) {
      console.log(`[GitRepositoryService] Git root lookup failed:`, error);
    }

    // Check package.json files for packageManager field and other indicators
    // Check both the package directory and git root
    const dirsToCheck = [packageDir];
    try {
      const gitRoot = await this.findGitRoot(originalFilePath);
      if (gitRoot && gitRoot !== packageDir) {
        dirsToCheck.push(gitRoot);
      }
    } catch {
      // Continue without git root
    }

    for (const dir of dirsToCheck) {
      try {
        const packageJsonPath = path.join(dir, 'package.json');
        const content = await fs.readFile(packageJsonPath, 'utf-8');
        const packageData = JSON.parse(content);

        // Check packageManager field
        if (packageData.packageManager) {
          const pmString = packageData.packageManager.toLowerCase();
          if (pmString.includes('yarn')) return 'yarn';
          if (pmString.includes('pnpm')) return 'pnpm';
          if (pmString.includes('npm')) return 'npm';
        }

        // Check for PNPM-specific configuration (monorepo indicator)
        if (packageData.pnpm) {
          return 'pnpm';
        }

        // Check scripts for package manager hints
        if (packageData.scripts) {
          const scripts = JSON.stringify(packageData.scripts);
          if (scripts.includes('pnpm ')) {
            return 'pnpm';
          }
          if (scripts.includes('yarn ')) {
            return 'yarn';
          }
        }

        // Check engines for package manager requirements
        if (packageData.engines) {
          if (packageData.engines.pnpm) {
            return 'pnpm';
          }
          if (packageData.engines.yarn) {
            return 'yarn';
          }
        }
      } catch (error) {
        console.log(
          `[GitRepositoryService] Package.json analysis failed for ${dir}:`,
          error,
        );
      }
    }

    return 'unknown';
  }

  /**
   * Clear caches
   */
  clearCache(): void {
    this.repositoryCache.clear();
    this.packageCache.clear();
  }

  /**
   * Check if a directory is a git repository
   */
  async isGitRepository(directory: string): Promise<boolean> {
    try {
      // Check if .git directory exists
      const gitDir = path.join(directory, '.git');
      const stats = await fs.stat(gitDir).catch(() => null);
      if (!stats) {
        return false;
      }

      // Verify it's actually a git repository by running a git command
      // Use simple-git through GitClientFactory
      return await gitClientFactory.isGitRepository(directory);
    } catch (_error) {
      return false;
    }
  }

  /**
   * Get git status for a directory
   */
  async getGitStatus(directory: string): Promise<GitStatusWithFiles> {
    // Use GitClientFactory which now returns GitStatusWithFiles format
    return await gitClientFactory.getGitStatus(directory);
  }

  /**
   * Get list of files changed in the current session (not yet committed)
   */
  async getUncommittedChanges(directory: string): Promise<string[]> {
    const status = await this.getGitStatus(directory);
    return [
      ...new Set([
        ...status.stagedFiles,
        ...status.modifiedFiles,
      ]),
    ];
  }

  /**
   * Get detailed change information for files
   */
  async getDetailedChanges(
    directory: string,
    files?: string[],
  ): Promise<{
    created: string[];
    modified: string[];
    deleted: string[];
    renamed: Array<{ from: string; to: string }>;
    stats: { additions: number; deletions: number };
    fileStats: Record<string, { additions: number; deletions: number }>;
  }> {
    const created: string[] = [];
    const modified: string[] = [];
    const deleted: string[] = [];
    const renamed: Array<{ from: string; to: string }> = [];
    const fileStats: Record<string, { additions: number; deletions: number }> =
      {};
    let additions = 0;
    let deletions = 0;

    try {
      // Use simple-git to get status information
      const status = await gitClientFactory.getGitStatus(directory);

      // Process staged, modified, and untracked files (now string arrays)
      status.stagedFiles.forEach((filePath) => {
        created.push(filePath);
      });

      status.modifiedFiles.forEach((filePath) => {
        modified.push(filePath);
      });

      status.untrackedFiles.forEach((filePath) => {
        created.push(filePath);
      });

      // For more detailed analysis, we still need to use git client directly
      // since simple-git doesn't provide porcelain format parsing
      const git = await gitClientFactory.getClient(directory);

      try {
        // Get detailed status using porcelain format for renames detection
        const statusResult = await git.raw([
          'status',
          '--porcelain=v1',
          ...(files ? ['--', ...files] : []),
        ]);

        statusResult
          .split('\n')
          .filter((line: string) => line.trim())
          .forEach((line: string) => {
            const status = line.substring(0, 2);
            const filePath = line.substring(3);

            // Check for renamed files
            if (status[0] === 'R' || status[1] === 'R') {
              const parts = filePath.split(' -> ');
              if (parts.length === 2) {
                renamed.push({ from: parts[0], to: parts[1] });
                // Remove from other arrays if added there
                const fromIndex = modified.indexOf(parts[0]);
                if (fromIndex >= 0) modified.splice(fromIndex, 1);
                const toIndex = created.indexOf(parts[1]);
                if (toIndex >= 0) created.splice(toIndex, 1);
              }
            }
          });
      } catch (error) {
        console.warn('Failed to get detailed status for renames:', error);
      }

      // Get diff stats for additions/deletions count
      try {
        const diffResult = await git.raw([
          'diff',
          '--numstat',
          ...(files ? ['--', ...files] : []),
        ]);

        diffResult
          .split('\n')
          .filter((line: string) => line.trim())
          .forEach((line: string) => {
            const parts = line.split('\t');
            if (parts.length >= 3) {
              const added = parseInt(parts[0]) || 0;
              const removed = parseInt(parts[1]) || 0;
              const filePath = parts[2];

              // Initialize file stats if not exists
              if (!fileStats[filePath]) {
                fileStats[filePath] = { additions: 0, deletions: 0 };
              }

              fileStats[filePath].additions += added;
              fileStats[filePath].deletions += removed;
              additions += added;
              deletions += removed;
            }
          });

        // Also check staged changes
        const stagedDiffResult = await git.raw([
          'diff',
          '--cached',
          '--numstat',
          ...(files ? ['--', ...files] : []),
        ]);

        stagedDiffResult
          .split('\n')
          .filter((line: string) => line.trim())
          .forEach((line: string) => {
            const parts = line.split('\t');
            if (parts.length >= 3) {
              const added = parseInt(parts[0]) || 0;
              const removed = parseInt(parts[1]) || 0;
              const filePath = parts[2];

              // Initialize file stats if not exists
              if (!fileStats[filePath]) {
                fileStats[filePath] = { additions: 0, deletions: 0 };
              }

              fileStats[filePath].additions += added;
              fileStats[filePath].deletions += removed;
              additions += added;
              deletions += removed;
            }
          });
      } catch (error) {
        console.warn('Failed to get diff stats:', error);
      }

      return {
        created: Array.from(new Set(created)), // Remove duplicates
        modified,
        deleted,
        renamed,
        stats: { additions, deletions },
        fileStats,
      };
    } catch (error) {
      console.error('Failed to get detailed changes:', error);
      throw error;
    }
  }

  /**
   * Get commit history for a directory
   */
  async getCommitHistory(
    directory: string,
    limit = 50,
  ): Promise<GitCommitHistoryEntry[]> {
    try {
      const git = await gitClientFactory.getClient(directory);
      const format = '%H%x1f%an%x1f%ad%x1f%s%x1e';
      const logOutput = await git.raw([
        'log',
        `-${Math.max(limit, 1)}`,
        '--date=iso-strict',
        `--pretty=${format}`,
      ]);

      return logOutput
        .split('\x1e')
        .map((entry: string) => entry.trim())
        .filter((entry: string) => entry.length > 0)
        .map((entry: string) => {
          const [hash, author, date, message] = entry.split('\x1f');
          return {
            hash: hash?.trim() ?? '',
            author: author?.trim() ?? '',
            date: date?.trim() ?? '',
            message: message?.trim() ?? '',
          } satisfies GitCommitHistoryEntry;
        });
    } catch (error) {
      // Empty repositories or git failures should not break the UI
      if (
        error instanceof Error &&
        (error.message.includes('does not have any commits yet') ||
          error.message.includes('unknown revision'))
      ) {
        return [];
      }

      console.error(
        '[GitRepositoryService] Failed to get commit history:',
        error,
      );
      throw error;
    }
  }

  // Binary file extensions to skip when counting lines
  private static readonly BINARY_EXTENSIONS = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'svg',
    'mp3', 'mp4', 'wav', 'avi', 'mov', 'webm', 'ogg',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'zip', 'tar', 'gz', 'rar', '7z', 'bz2',
    'exe', 'dll', 'so', 'dylib', 'bin',
    'ttf', 'otf', 'woff', 'woff2', 'eot',
    'db', 'sqlite', 'sqlite3',
    'lock', 'lockb',
  ]);

  /**
   * Check if a file is likely binary based on extension
   */
  private isBinaryFile(filePath: string): boolean {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    return GitRepositoryService.BINARY_EXTENSIONS.has(ext);
  }

  /**
   * Count lines in a file content
   */
  private countLinesInContent(content: string): number {
    if (!content) return 0;
    const newlines = (content.match(/\n/g) || []).length;
    return content.endsWith('\n') ? newlines : newlines + 1;
  }

  /**
   * Push line counts to the web-ade cache API
   * Fire and forget - does not block on the response
   */
  private pushLineCountsToWebCache(
    owner: string,
    repo: string,
    lineCounts: Record<string, number>
  ): void {
    const fileCount = Object.keys(lineCounts).length;
    if (fileCount === 0) return;

    const url = `https://app.principal-ade.com/api/line-counts/${owner}/${repo}`;

    fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lineCounts,
        fileCount,
      }),
    })
      .then((response) => {
        if (response.ok) {
          console.log(`[GitRepositoryService] Pushed line counts to web cache for ${owner}/${repo}`);
        } else {
          console.warn(`[GitRepositoryService] Failed to push line counts: ${response.status}`);
        }
      })
      .catch((err) => {
        console.warn('[GitRepositoryService] Failed to push line counts to web cache:', err);
      });
  }

  /**
   * Count lines in all tracked files in a repository
   * Returns a map of file paths (with repo prefix) to line counts
   */
  async countLinesInRepository(repoPath: string): Promise<Record<string, number>> {
    const tracer = getTracer('principal-ade-main');
    const span = tracer.startSpan('git_repository.count_lines', {
      attributes: { 'repo_path': repoPath },
    });
    const startTime = Date.now();

    try {
      const lineCounts: Record<string, number> = {};
      const repoName = path.basename(repoPath);

      // Use git ls-files to get tracked files only
      let files: string[];
      try {
        const output = execSync('git ls-files', {
          cwd: repoPath,
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large repos
        });
        files = output.split('\n').filter(Boolean);
      } catch (gitError) {
        console.error('[GitRepositoryService] git ls-files failed:', gitError);
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'git ls-files failed' });
        return lineCounts;
      }

      span.addEvent('git_repository.count_lines.files_listed', {
        'repo_path': repoPath,
        'file_count': files.length,
      });

      // Count lines for each non-binary file
      let processedCount = 0;
      let skippedCount = 0;

      for (const file of files) {
        if (this.isBinaryFile(file)) {
          skippedCount++;
          continue;
        }

        try {
          const filePath = path.join(repoPath, file);
          const stat = await fs.stat(filePath);

          // Skip files larger than 1MB (likely minified/generated)
          if (stat.size > 1024 * 1024) {
            skippedCount++;
            continue;
          }

          const content = await fs.readFile(filePath, 'utf-8');
          const lineCount = this.countLinesInContent(content);

          // Key includes repo name prefix to match building.path format
          lineCounts[`${repoName}/${file}`] = lineCount;
          processedCount++;
        } catch (_fileError) {
          // File may have been deleted or be unreadable
          skippedCount++;
        }
      }

      const duration = Date.now() - startTime;
      console.log(`[GitRepositoryService] Counted lines in ${processedCount} files (skipped ${skippedCount}) in ${duration}ms`);

      span.addEvent('git_repository.count_lines.complete', {
        'repo_path': repoPath,
        'processed_count': processedCount,
        'skipped_count': skippedCount,
        'duration_ms': duration,
      });
      span.setStatus({ code: SpanStatusCode.OK });

      // Push line counts to web-ade cache (fire and forget)
      // Use cached repository info to get owner/repo
      const repoInfo = await this.getRepositoryInfo(repoPath);
      const originRemote = repoInfo?.remotes?.find(r => r.name === 'origin');
      if (originRemote?.owner && originRemote?.repo) {
        this.pushLineCountsToWebCache(originRemote.owner, originRemote.repo, lineCounts);
      }

      return lineCounts;
    } catch (error) {
      console.error('[GitRepositoryService] Error counting lines:', error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Line counting failed',
      });
      return {};
    } finally {
      span.end();
    }
  }
}
