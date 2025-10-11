/**
 * FileSystemCore - Shared file system operations without Electron dependencies
 * Can be used by both main process and utility processes
 */

import { globby } from 'globby';
import * as path from 'path';
import * as fs from 'fs';
import { Minimatch } from 'minimatch';
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
  private static getUniversalDirectories(): string[] {
    const patternGroups = Object.values(universalPatternsConfig.patterns);
    return patternGroups
      .flatMap((category) =>
        category.directories ? [...category.directories] : [],
      )
      .map((dir) => dir.replace(/\\/g, '/'));
  }

  private static normalizeToPosix(target: string): string {
    return target.split(path.sep).join('/');
  }

  private static getDirectoryGlobVariants(dirName: string): string[] {
    const normalized = dirName.replace(/\\/g, '/');
    return [`**/${normalized}`, `**/${normalized}/**`];
  }

  private static addDirectoryIgnorePatterns(
    accumulator: Set<string>,
    dirName: string,
    repoPosixPath: string,
  ): void {
    FileSystemCore.getDirectoryGlobVariants(dirName).forEach((pattern) =>
      accumulator.add(pattern),
    );
    const absoluteBase = `${repoPosixPath}/${dirName}`.replace(/\\/g, '/');
    accumulator.add(absoluteBase);
    accumulator.add(`${absoluteBase}/**`);
  }

  private static convertGitignorePatternToGlobs(
    pattern: string,
    repoPosixPath: string,
  ): string[] {
    const trimmed = pattern.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      return [];
    }

    if (trimmed.startsWith('!')) {
      // Negated patterns are not supported by chokidar ignore globs
      return [];
    }

    let normalized = trimmed.replace(/\\ /g, ' ').replace(/\\/g, '/');
    const isDirectoryPattern = normalized.endsWith('/');

    if (isDirectoryPattern) {
      normalized = normalized.replace(/\/+/g, '/').replace(/\/+$/g, '');
    }

    if (!normalized) {
      return [];
    }

    const results: string[] = [];
    const globCharacters = ['*', '?', '[', ']'];
    const hasGlobChars = globCharacters.some((char) =>
      normalized.includes(char),
    );
    const isAbsolute = normalized.startsWith('/');

    const addDirectoryVariants = (basePattern: string) => {
      results.push(basePattern);
      results.push(`${basePattern}/**`);
    };

    if (isAbsolute) {
      const absoluteBase = `${repoPosixPath}/${normalized.replace(/^\/+/, '')}`;
      if (isDirectoryPattern && !hasGlobChars) {
        addDirectoryVariants(absoluteBase);
      } else {
        results.push(absoluteBase);
      }
      return results;
    }

    if (isDirectoryPattern && !hasGlobChars) {
      const base = `**/${normalized}`;
      addDirectoryVariants(base);
      return results;
    }

    if (!normalized.includes('/') && !hasGlobChars) {
      results.push(`**/${normalized}`);
      return results;
    }

    results.push(`**/${normalized}`);
    return results;
  }

  private static async getGitignoreGlobPatterns(
    repoPath: string,
  ): Promise<string[]> {
    try {
      const gitignorePath = path.join(repoPath, '.gitignore');
      if (!fs.existsSync(gitignorePath)) {
        return [];
      }

      const fileContents = await fs.promises.readFile(gitignorePath, 'utf8');
      if (!fileContents) {
        return [];
      }

      const repoPosixPath = FileSystemCore.normalizeToPosix(
        path.resolve(repoPath),
      );

      return fileContents
        .split(/\r?\n/)
        .flatMap((line) =>
          FileSystemCore.convertGitignorePatternToGlobs(line, repoPosixPath),
        )
        .filter(Boolean);
    } catch (error) {
      console.warn(
        '[FileSystemCore] Failed to read .gitignore patterns:',
        error,
      );
      return [];
    }
  }

  static async getWatchIgnoreGlobs(
    repoPath: string,
    options?: { additionalPatterns?: string[] },
  ): Promise<string[]> {
    const patterns = new Set<string>();
    const repoPosixPath = FileSystemCore.normalizeToPosix(
      path.resolve(repoPath),
    );

    // Always ignore .git directories
    FileSystemCore.addDirectoryIgnorePatterns(patterns, '.git', repoPosixPath);
    patterns.add(`${repoPosixPath}/.git/fsmonitor--daemon.ipc`);

    // Include universal directories
    for (const dirName of FileSystemCore.getUniversalDirectories()) {
      FileSystemCore.addDirectoryIgnorePatterns(
        patterns,
        dirName,
        repoPosixPath,
      );
    }

    // Merge additional patterns (already globbed)
    options?.additionalPatterns?.forEach((pattern) => {
      if (pattern) {
        patterns.add(pattern);
      }
    });

    // Merge .gitignore-derived globs
    const gitignoreGlobs =
      await FileSystemCore.getGitignoreGlobPatterns(repoPath);
    gitignoreGlobs.forEach((pattern) => patterns.add(pattern));

    return Array.from(patterns);
  }

  private static compileGlobMatchers(patterns: string[]): Minimatch[] {
    return patterns.map(
      (pattern) =>
        new Minimatch(pattern.replace(/\\/g, '/'), {
          dot: true,
          nocase: false,
          matchBase: !pattern.includes('/'),
        }),
    );
  }

  static createWatchIgnorePredicate(
    repoPath: string,
    patterns: string[],
  ): (targetPath: string, stats?: fs.Stats) => boolean {
    const matchers = FileSystemCore.compileGlobMatchers(patterns);
    const repoPosixPath = FileSystemCore.normalizeToPosix(
      path.resolve(repoPath),
    );

    return (targetPath: string | undefined): boolean => {
      if (!targetPath) {
        return false;
      }

      const normalizedTarget = FileSystemCore.normalizeToPosix(targetPath);
      const isInsideRepo =
        normalizedTarget === repoPosixPath ||
        normalizedTarget.startsWith(`${repoPosixPath}/`);
      const relativeTarget =
        isInsideRepo && normalizedTarget.length > repoPosixPath.length
          ? normalizedTarget.slice(repoPosixPath.length + 1)
          : undefined;

      if (normalizedTarget.startsWith(`${repoPosixPath}/.git`)) {
        return true;
      }

      return matchers.some((matcher) => {
        if (matcher.match(normalizedTarget)) {
          return true;
        }
        if (relativeTarget && matcher.match(relativeTarget)) {
          return true;
        }
        return false;
      });
    };
  }

  /**
   * Build a filtered file tree using globby with automatic .gitignore support
   * This is the exact same logic as ElectronFileSystemAdapter.buildFilteredFileTree
   */
  static async buildFilteredFileTree(
    directoryPath: string,
    options?: FileSystemCoreOptions,
  ): Promise<FileTreeResult> {
    try {
      // Default options
      const gitignore = options?.gitignore !== false; // Default to true
      const includeStats = options?.includeStats || false;

      // Extract universal patterns from the config
      const universalPatterns = FileSystemCore.getUniversalDirectories().map(
        (dir) => `**/${dir}/**`,
      );

      // Combine with any additional patterns
      const ignorePatterns = [
        '.git', // Always exclude .git
        '**/.git/**', // Exclude .git at any level
        ...universalPatterns,
        ...(options?.ignorePatterns || []),
      ];

      console.info(
        `[FileSystemCore] Using globby with gitignore=${gitignore}, ${ignorePatterns.length} ignore patterns`,
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
      const absolutePaths = paths.map((p) => path.join(directoryPath, p));

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
        error,
      );
      return { paths: [], stats: [] };
    }
  }
}
