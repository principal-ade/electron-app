/**
 * FileTreeBuilder - Creates FileTree using shared core implementations
 * Milestone 1: Basic FileTree building with git information
 * Works in utility process without Electron dependencies
 */

import { GitFileTreeBuilder, type FileTree, type GitSource } from '@principal-ai/repository-abstraction';
import { FileSystemCore } from '../shared/repository-core/FileSystemCore';
import { GitCore } from '../shared/repository-core/GitCore';
import * as path from 'path';

export class FileTreeBuilder {
  private gitTreeBuilder = new GitFileTreeBuilder();

  /**
   * Build a FileTree for a repository path
   * Uses shared core implementations that work in utility process
   */
  async buildFileTree(repoPath: string): Promise<FileTree> {
    // 1. Get files from file system using shared FileSystemCore
    const { paths, stats } = await FileSystemCore.buildFilteredFileTree(repoPath, {
      gitignore: true,
      includeStats: true,
    });

    const toPosix = (value: string) => value.replace(/\\/g, '/');

    const fileEntries = (stats ?? [])
      .filter(stat => !stat.isDirectory)
      .map(stat => ({
        path: toPosix(stat.path.endsWith('/') ? stat.path.slice(0, -1) : stat.path),
        size: stat.size,
        lastModified: stat.lastModified,
      }));

    // 2. Get git information using shared GitCore
    const gitInfo = await GitCore.getGitInfo(repoPath);

    // 3. Build GitSource for GitFileTreeBuilder
    const gitSource: GitSource = {
      commitSha: gitInfo.currentCommit,
      branch: gitInfo.branch,
      rootPath: repoPath,
      isDirty: gitInfo.isDirty,
      files: (fileEntries.length > 0
        ? fileEntries
        : paths.map((filePath: string) => ({
            path: toPosix(path.relative(repoPath, filePath)),
          })))
        .map(file => ({
          ...file,
          path: file.path,
        })),
    };

    // 4. Use GitFileTreeBuilder to create properly structured FileTree
    const fileTree = this.gitTreeBuilder.build(gitSource);

    // 5. Add the additional stats properties that codebase-composition expects
    // These are needed for compatibility with the bundled version in codebase-composition
    const enhancedFileTree = {
      ...fileTree,
      stats: {
        ...fileTree.stats,
        buildingTypeDistribution: {},
        directoryTypeDistribution: {},
        combinedTypeDistribution: {},
      },
    };

    return enhancedFileTree as FileTree;
  }
}