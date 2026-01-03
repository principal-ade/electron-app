/**
 * GitRepositoryScannerService - Scans directories for git repositories
 * Used to discover untracked git repos in the user's projects folder
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { AlexandriaRegistryService } from '../stores/AlexandriaRegistryService';

export interface DiscoveredRepository {
  /** Absolute path to the repository */
  path: string;
  /** Repository name (directory name) */
  name: string;
  /** Whether this repo is tracked in Alexandria */
  isTracked: false;
}

export class GitRepositoryScannerService {
  private static instance: GitRepositoryScannerService;

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
        'Library',
        'Applications',
        '.Trash',
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

    // Filter to only untracked repos
    const discoveredRepos: DiscoveredRepository[] = [];

    for (const repoPath of allRepos) {
      const normalizedPath = path.normalize(repoPath);
      if (!trackedPaths.has(normalizedPath)) {
        discoveredRepos.push({
          path: repoPath,
          name: path.basename(repoPath),
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
}
