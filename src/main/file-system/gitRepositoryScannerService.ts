/**
 * GitRepositoryScannerService - Scans directories for git repositories
 * Used to discover untracked git repos in the user's projects folder
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { AlexandriaRegistryService } from '../stores/AlexandriaRegistryService';

const execFileAsync = promisify(execFile);

export interface DiscoveredRepository {
  /** Absolute path to the repository */
  path: string;
  /** Repository name (directory name) */
  name: string;
  /** Owner/organization name from git remote (if available) */
  owner?: string;
  /** Whether this repo is tracked in Alexandria */
  isTracked: false;
}

export class GitRepositoryScannerService {
  private static instance: GitRepositoryScannerService;

  // Private constructor for singleton pattern
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  static getInstance(): GitRepositoryScannerService {
    if (!GitRepositoryScannerService.instance) {
      GitRepositoryScannerService.instance = new GitRepositoryScannerService();
    }
    return GitRepositoryScannerService.instance;
  }

  /**
   * Check if a directory is a git repository (has .git folder)
   */
  private async isGitRepository(directory: string): Promise<boolean> {
    try {
      const gitDir = path.join(directory, '.git');
      const stats = await fs.stat(gitDir);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Get the git remote URL for a repository
   */
  private async getGitRemoteUrl(repoPath: string): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync('git', ['remote', 'get-url', 'origin'], {
        cwd: repoPath,
        timeout: 5000
      });
      return stdout.trim();
    } catch {
      return null;
    }
  }

  /**
   * Parse owner and repo name from git remote URL
   * Supports: https://github.com/owner/repo.git, git@github.com:owner/repo.git, etc.
   */
  private parseGitRemote(remoteUrl: string): { owner?: string; repo?: string } {
    if (!remoteUrl) {
      return {};
    }

    try {
      // Handle SSH format: git@github.com:owner/repo.git
      const sshMatch = remoteUrl.match(/[^@]+@[^:]+:([^/]+)\/(.+?)(?:\.git)?$/);
      if (sshMatch) {
        return {
          owner: sshMatch[1],
          repo: sshMatch[2]
        };
      }

      // Handle HTTPS format: https://github.com/owner/repo.git
      const httpsMatch = remoteUrl.match(/https?:\/\/[^/]+\/([^/]+)\/(.+?)(?:\.git)?$/);
      if (httpsMatch) {
        return {
          owner: httpsMatch[1],
          repo: httpsMatch[2]
        };
      }

      return {};
    } catch {
      return {};
    }
  }

  /**
   * Get repository info including owner from git remote
   */
  private async getRepositoryInfo(repoPath: string): Promise<{ owner?: string; name: string }> {
    const name = path.basename(repoPath);
    const remoteUrl = await this.getGitRemoteUrl(repoPath);

    if (remoteUrl) {
      const { owner, repo } = this.parseGitRemote(remoteUrl);
      return {
        owner,
        name: repo || name // Prefer parsed repo name, fallback to directory name
      };
    }

    return { name };
  }

  /**
   * Recursively scan a folder for git repositories
   * @param folderPath - Base folder to scan
   * @param maxDepth - Maximum depth to scan (default: 2)
   * @param currentDepth - Current recursion depth
   * @returns Array of absolute paths to git repositories
   */
  async scanFolderForGitRepos(
    folderPath: string,
    maxDepth: number = 2,
    currentDepth: number = 0,
  ): Promise<string[]> {
    const gitRepos: string[] = [];

    // Stop if we've exceeded max depth
    if (currentDepth > maxDepth) {
      return gitRepos;
    }

    try {
      // Check if this folder itself is a git repo
      if (await this.isGitRepository(folderPath)) {
        gitRepos.push(folderPath);
        // Don't recurse into git repos (nested git repos are rare and problematic)
        return gitRepos;
      }

      // Read directory contents
      const entries = await fs.readdir(folderPath, { withFileTypes: true });

      // Filter to only directories, excluding hidden folders and common non-project folders
      const excludedFolders = new Set([
        'node_modules',
        '.git',
        '.svn',
        '.hg',
        'vendor',
        '__pycache__',
        '.cache',
        '.npm',
        '.yarn',
        '.local',
        '.config',
        '.vscode',
        'Library',
        'Applications',
        '.Trash',
        'Music',
        'Movies',
        'Pictures',
        'Public',
        'Downloads',
        '.dropbox',
        'Dropbox',
        'Google Drive',
        'OneDrive',
        'iCloud Drive',
      ]);

      const directories = entries.filter(
        (entry) =>
          entry.isDirectory() &&
          !entry.name.startsWith('.') &&
          !excludedFolders.has(entry.name),
      );

      // Recursively scan subdirectories in parallel
      const subResults = await Promise.all(
        directories.map((dir) =>
          this.scanFolderForGitRepos(
            path.join(folderPath, dir.name),
            maxDepth,
            currentDepth + 1,
          ),
        ),
      );

      // Flatten results
      for (const repos of subResults) {
        gitRepos.push(...repos);
      }
    } catch (error) {
      // Permission denied or other errors - just skip this folder
      console.warn(
        `[GitRepositoryScannerService] Could not scan ${folderPath}:`,
        error,
      );
    }

    return gitRepos;
  }

  /**
   * Get discovered (untracked) repositories in a folder
   * Filters out repositories already registered in Alexandria
   * @param basePath - Base folder to scan
   * @param maxDepth - Maximum depth to scan (default: 2)
   * @returns Array of discovered repositories not in Alexandria
   */
  async getDiscoveredRepositories(
    basePath: string,
    maxDepth: number = 2,
  ): Promise<DiscoveredRepository[]> {
    // Get all git repos in the folder
    const allRepos = await this.scanFolderForGitRepos(basePath, maxDepth);

    // Get tracked repos from Alexandria
    const registryService = AlexandriaRegistryService.getInstance();
    const trackedRepos = await registryService.getRepositories();

    // Create a set of tracked paths for quick lookup
    const trackedPaths = new Set(
      trackedRepos.map((repo) => path.normalize(repo.path)),
    );

    // Filter to only untracked repos and get their info
    const discoveredRepos: DiscoveredRepository[] = [];

    for (const repoPath of allRepos) {
      const normalizedPath = path.normalize(repoPath);
      if (!trackedPaths.has(normalizedPath)) {
        const info = await this.getRepositoryInfo(repoPath);
        discoveredRepos.push({
          path: repoPath,
          name: info.name,
          owner: info.owner,
          isTracked: false,
        });
      }
    }

    // Sort by name
    discoveredRepos.sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
    );

    return discoveredRepos;
  }

  /**
   * Get repository info (name and owner) for multiple repos in parallel
   * Used for onboarding wizard scanning
   */
  async getRepositoriesInfo(repoPaths: string[]): Promise<Array<{ path: string; name: string; owner?: string }>> {
    const results = await Promise.all(
      repoPaths.map(async (repoPath) => {
        const info = await this.getRepositoryInfo(repoPath);
        return {
          path: repoPath,
          name: info.name,
          owner: info.owner
        };
      })
    );

    return results;
  }
}
