/**
 * FileSystemCore - Shared file system operations without Electron dependencies
 * Can be used by both main process and utility processes
 */

import { globby } from 'globby';
import * as path from 'path';
import * as fs from 'fs';
import { universalGitignorePatterns as universalPatternsConfig } from '../configs';

export interface FileSystemCoreOptions {
  gitignore?: boolean; // Enable .gitignore parsing (default: true)
  ignorePatterns?: string[]; // Additional patterns to ignore
  includeStats?: boolean; // Include file stats (default: false)
}

export interface FileStats {
  path: string;
  size: number;
  isDirectory: boolean;
  lastModified: Date;
}

export interface FileTreeResult {
  paths: string[];
  stats?: FileStats[];
}

/**
 * Core file system operations shared between processes
 */
export class FileSystemCore {
  /**
   * Build a filtered file tree using globby with automatic .gitignore support
   * This is the exact same logic as ElectronFileSystemAdapter.buildFilteredFileTree
   */
  static async buildFilteredFileTree(
    directoryPath: string,
    options?: FileSystemCoreOptions
  ): Promise<FileTreeResult> {
    try {
      // Default options
      const gitignore = options?.gitignore !== false; // Default to true
      const includeStats = options?.includeStats || false;

      // Extract universal patterns from the config
      const universalPatterns = Object.values(universalPatternsConfig.patterns)
        .flatMap((category: any) => category.directories || [])
        .map((dir) => `**/${dir}/**`);

      // Combine with any additional patterns
      const ignorePatterns = [
        '.git', // Always exclude .git
        '**/.git/**', // Exclude .git at any level
        ...universalPatterns,
        ...(options?.ignorePatterns || []),
      ];

      console.log(
        `[FileSystemCore] Using globby with gitignore=${gitignore}, ${ignorePatterns.length} ignore patterns`
      );

      // Use globby to get all files and directories
      const paths = await globby('**/*', {
        cwd: directoryPath,
        gitignore: gitignore,
        ignore: ignorePatterns,
        onlyFiles: false, // Include directories
        markDirectories: true, // Add trailing slash to directories
        dot: true, // Include dotfiles (except .git which is ignored)
        followSymbolicLinks: false,
      });

      // Convert relative paths to absolute paths
      const absolutePaths = paths.map(p => path.join(directoryPath, p));

      // Optionally gather stats
      let stats: FileStats[] | undefined;

      if (includeStats) {
        stats = [];
        for (const relativePath of paths) {
          const fullPath = path.join(directoryPath, relativePath);
          try {
            const stat = fs.statSync(fullPath);
            stats.push({
              path: relativePath,
              size: stat.size,
              isDirectory: stat.isDirectory(),
              lastModified: stat.mtime,
            });
          } catch (error) {
            // Skip files we can't stat
            console.warn(`[FileSystemCore] Could not stat ${fullPath}:`, error);
          }
        }
      }

      return {
        paths: absolutePaths,
        stats,
      };
    } catch (error) {
      console.error(
        `[FileSystemCore] Error building filtered file tree for ${directoryPath}:`,
        error
      );
      return { paths: [], stats: [] };
    }
  }
}