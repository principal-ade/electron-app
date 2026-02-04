import type { FSWatcher } from 'chokidar';
import chokidar from 'chokidar';
import { dialog, ipcMain, BrowserWindow, app } from 'electron';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';

import { FileSystemAPIEvent, type GlobalSkill } from '../../shared/main-process-api-interfaces/FileSystemAPI';
import type { IModernApplicationWindow } from '../window/types';
import { GitHubAdapter } from '../version-control-providers/githubHandlers';
import { SkillsConfigService } from '../services/SkillsConfigService';
import { SkillsGitService } from '../services/SkillsGitService';
import { SkillsSyncService } from '../services/SkillsSyncService';
import { SkillsDetectionService } from '../services/SkillsDetectionService';
import { getSkillLockFileService } from '../skills/skillLockFile';
import { isSymlink, removeSkillSymlink } from '../skills/symlinkUtils';
import { RecentReposService } from '../services/RecentReposService';
import { RecentReposAPIEvent } from '../../shared/main-process-api-interfaces/RecentReposAPI';
import { gitClientFactory } from '../utils/gitClientFactory';

export class ElectronFileSystemAdapter {
  private rootPath: string | null = null;

  private fileWatcher: FSWatcher | null = null;

  private directoryWatcher: FSWatcher | null = null;

  private filesWatcher: FSWatcher | null = null; // Watcher for specific files

  private gitWatcher: FSWatcher | null = null; // Watcher for git changes

  private mainWindow: BrowserWindow | null = null;

  private currentlyWatchingPath: string | null = null;

  private githubAdapter: GitHubAdapter | null = null;

  constructor() {
    console.log('[File System] Adapter instance created');
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
    console.log(
      `[File System] Main window reference set for adapter associated with window ID: ${window.id}`,
    );
  }

  setGitHubAdapter(adapter: GitHubAdapter) {
    this.githubAdapter = adapter;
    console.log(`[File System] GitHub adapter reference set`);
  }

  getRootPath(): string | null {
    return this.rootPath;
  }

  // Instance methods - these will be called by the global handlers
  async readFile(filePath: string) {
    if (!this.mainWindow) {
      console.error(
        '[File System] readFile: No main window reference on this adapter instance.',
      );
      return null;
    }
    if (!filePath) {
      return null;
    }

    try {
      await fsPromises.access(filePath);
      const content = await fsPromises.readFile(filePath, 'utf8');
      return { content, filePath };
    } catch (error) {
      console.error('Error reading file:', error);
      return null;
    }
  }

  async selectFile() {
    if (!this.mainWindow) {
      console.error(
        '[File System] selectFile: No main window reference on this adapter instance.',
      );
      return null;
    }

    const result = await dialog.showOpenDialog(this.mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'All Supported', extensions: ['md', 'json'] },
        { name: 'Markdown', extensions: ['md'] },
        { name: 'JSON', extensions: ['json'] },
      ],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      try {
        const content = await fsPromises.readFile(filePath, 'utf8');
        return { content, filePath };
      } catch (error) {
        console.error('Error reading file:', error);
        return null;
      }
    }
    return null;
  }

  async selectDirectory(options?: {
    title?: string;
    buttonLabel?: string;
    properties?: ('openDirectory' | 'createDirectory' | 'promptToCreate')[];
  }) {
    if (!this.mainWindow) {
      console.error(
        '[File System] selectDirectory: No main window reference on this adapter instance.',
      );
      return null;
    }
    console.log(
      '[File System] Select directory dialog requested with options:',
      options,
    );

    const dialogOptions: Electron.OpenDialogOptions = {
      properties: options?.properties || ['openDirectory'],
      title: options?.title || 'Select a directory with markdown files',
    };

    if (options?.buttonLabel) {
      dialogOptions.buttonLabel = options.buttonLabel;
    }

    const { canceled, filePaths } = await dialog.showOpenDialog(
      this.mainWindow,
      dialogOptions,
    );

    if (canceled || filePaths.length === 0) {
      console.log('[File System] Directory selection canceled');
      return { canceled: true };
    }

    this.rootPath = filePaths[0]; // This state is per-adapter instance
    console.log(
      `[File System] Directory selected for adapter (window ${this.mainWindow.id}): ${this.rootPath}`,
    );
    return { filePaths: [this.rootPath], canceled: false };
  }

  async writeFile(filePath: string, content: string) {
    if (!this.mainWindow) {
      console.error(
        '[File System] writeFile: No main window reference on this adapter instance.',
      );
      return null;
    }
    if (!filePath) {
      console.error('[File System] writeFile: No file path provided.');
      return null;
    }
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fsPromises.mkdir(dir, { recursive: true });

      await fsPromises.writeFile(filePath, content, 'utf8');
      console.log(`[File System] Successfully wrote file: ${filePath}`);
      return { success: true, filePath };
    } catch (error) {
      console.error('[File System] Error writing file:', error);
      return {
        success: false,
        filePath,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getHomePath() {
    return app.getPath('home');
  }

  async getCurrentWorkingDirectory() {
    const cwd = process.cwd();
    console.log('[File System] Current working directory:', cwd);
    return cwd;
  }

  async getFileStats(filePath: string) {
    if (!this.mainWindow) {
      console.error(
        '[File System] getFileStats: No main window reference on this adapter instance.',
      );
      return null;
    }
    if (!filePath) {
      return null;
    }
    try {
      const stats = await fsPromises.stat(filePath);
      return {
        size: stats.size,
        isDirectory: stats.isDirectory(),
        lastModified: stats.mtime,
      };
    } catch (error) {
      console.error('Error getting file stats:', error);
      return null;
    }
  }

  async getDirectoryStats(dirPath: string) {
    if (!this.mainWindow) {
      console.error(
        '[File System] getDirectoryStats: No main window reference on this adapter instance.',
      );
      return null;
    }
    if (!dirPath) {
      return null;
    }
    try {
      // Check if directory exists
      await fsPromises.access(dirPath);

      let totalFiles = 0;
      let totalDirectories = 0;
      let totalSize = 0;

      const processDirectory = async (currentPath: string): Promise<void> => {
        const entries = await fsPromises.readdir(currentPath);

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry);
          try {
            const stats = await fsPromises.stat(fullPath);

            if (stats.isDirectory()) {
              totalDirectories++;
              // Skip certain directories to avoid excessive scanning
              if (
                !entry.startsWith('.') &&
                entry !== 'node_modules' &&
                entry !== 'dist' &&
                entry !== 'build'
              ) {
                await processDirectory(fullPath);
              }
            } else {
              totalFiles++;
              totalSize += stats.size;
            }
          } catch (error) {
            // Skip files/directories that can't be accessed
            console.warn(`[File System] Could not access ${fullPath}:`, error);
          }
        }
      };

      await processDirectory(dirPath);

      return {
        totalFiles,
        totalDirectories,
        totalSize,
      };
    } catch (error) {
      console.error('Error getting directory stats:', error);
      return null;
    }
  }

  async readDirectory(dirPath: string) {
    if (!this.mainWindow) {
      console.error(
        '[File System] readDirectory: No main window reference on this adapter instance.',
      );
      return [];
    }
    if (!dirPath) {
      return [];
    }
    try {
      const entries = await fsPromises.readdir(dirPath);
      return entries;
    } catch (error) {
      console.error('Error reading directory:', error);
      return [];
    }
  }

  async watchFile(filePath: string): Promise<boolean> {
    console.log(`[File System] Watching file: ${filePath}`);
    if (!this.mainWindow) {
      console.error(
        '[File System] Cannot watch file: No main window reference on this adapter instance',
      );
      return false;
    }
    // Watcher logic needs careful review for multi-window state
    if (this.fileWatcher) {
      try {
        await this.fileWatcher.close();
        console.info(
          '[File System] Closed previous file watcher before starting a new one.',
        );
      } catch (closeError) {
        console.warn(
          '[File System] Failed to close existing file watcher cleanly:',
          closeError,
        );
      }
      this.fileWatcher = null;
    }

    this.fileWatcher = this.createFileWatcher(filePath, this.mainWindow);
    this.currentlyWatchingPath = filePath;
    try {
      await fsPromises.access(filePath);
      this.fileWatcher.add(filePath);
      return true;
    } catch (error) {
      console.error(
        `[File System] File does not exist or cannot be accessed: ${filePath}`,
        error,
      );
      return false;
    }
  }

  async watchDirectory(options: {
    directoryPath: string;
    fileTypes?: string[];
    isSubdirectory?: boolean;
  }): Promise<boolean> {
    const {
      directoryPath,
      fileTypes = ['.md'],
      isSubdirectory = false,
    } = options;

    if (!this.mainWindow) {
      console.error(
        '[File System] watchDirectory: No main window reference on this adapter instance.',
      );
      return false;
    }

    if (isSubdirectory) {
      console.log(
        `[File System] watchDirectory: Adding path ${directoryPath} to existing watcher.`,
      );
      // addPathToDirectoryWatcher will use the existing this.rootPath for validation.
      // It also checks if this.directoryWatcher exists.
      return this.addPathToDirectoryWatcher(directoryPath);
    }
    // This is for starting a new watch or re-initializing the watch for a new primary directory.
    console.log(
      `[File System] watchDirectory: Setting up new watcher for ${directoryPath}.`,
    );
    if (this.directoryWatcher) {
      await this.directoryWatcher.close();
      this.directoryWatcher = null;
      console.log(
        `[File System] Closed existing directory watcher for adapter of window ${this.mainWindow.id}`,
      );
    }

    // Set/update the rootPath and currentlyWatchingPath for this new primary watch operation.
    // This directoryPath becomes the new root against which subdirectories will be validated.
    this.rootPath = directoryPath;
    this.currentlyWatchingPath = directoryPath; // Update the path being primarily watched.
    console.log(
      `[File System] Root path for watcher set to: ${this.rootPath} for window ${this.mainWindow.id}`,
    );

    try {
      await fsPromises.access(directoryPath);
    } catch {
      console.error(`[File System] Directory does not exist: ${directoryPath}`);
      // Reset paths if we failed to watch, as no valid root is established.
      this.rootPath = null;
      this.currentlyWatchingPath = null;
      return false;
    }

    try {
      this.directoryWatcher = chokidar.watch(directoryPath, {
        persistent: true,
        ignoreInitial: true,
        depth: 0, // Watch only the top-level directory
        awaitWriteFinish: {
          stabilityThreshold: 300,
          pollInterval: 100,
        },
        ignored: (itemPath) =>
          itemPath.includes('.DS_Store') || itemPath.includes('/.'),
      });
      this.setupDirectoryWatcherEvents(
        this.directoryWatcher,
        this.mainWindow,
        fileTypes,
      );
      console.log(
        `[File System] Directory watcher set up for ${directoryPath} by adapter of window ${this.mainWindow.id}`,
      );
      return true;
    } catch (error) {
      console.error(
        '[File System] ❌ Error setting up directory watcher:',
        error,
      );
      // Reset paths if we failed to watch.
      this.rootPath = null;
      this.currentlyWatchingPath = null;
      return false;
    }
  }

  private createFileWatcher(
    filePath: string,
    targetWindow: BrowserWindow,
  ): FSWatcher {
    const fileWatcher = chokidar.watch(filePath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
      alwaysStat: true,
    });
    fileWatcher
      .on('ready', () => console.log('[File System] ✅ File watcher is READY'))
      .on('error', (err: unknown) =>
        console.error('[File System] ❌ File watcher error:', err),
      )
      .on('change', (changedPath: string, stats?: fs.Stats) => {
        console.log(
          `[File System] 📝 File CHANGED: ${changedPath}`,
          stats ? `(size: ${stats.size})` : '',
        );
        // Check if window is still valid before sending
        if (!targetWindow.isDestroyed()) {
          targetWindow.webContents.send('file-change', {
            type: 'change',
            path: changedPath,
            extension: path.extname(changedPath).toLowerCase(),
            stats: stats ? { size: stats.size, mtime: stats.mtime } : null,
            isCurrentFile: true,
          });
        } else {
          console.warn(
            '[File System] Target window destroyed, skipping file-change event',
          );
        }
      });
    return fileWatcher;
  }

  private async createGitWatcher(
    repoPath: string,
    targetWindow: BrowserWindow,
  ): Promise<FSWatcher | null> {
    const gitIndexPath = path.join(repoPath, '.git', 'index');

    try {
      await fsPromises.access(gitIndexPath);
    } catch {
      console.log(`[File System] No .git/index found at ${gitIndexPath}`);
      return null;
    }

    console.log(`[File System] Creating git watcher for ${gitIndexPath}`);

    const gitWatcher = chokidar.watch(gitIndexPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    let debounceTimer: NodeJS.Timeout | null = null;

    gitWatcher
      .on('ready', () => console.log('[File System] ✅ Git watcher is READY'))
      .on('error', (err: unknown) =>
        console.error('[File System] ❌ Git watcher error:', err),
      )
      .on('change', async () => {
        // Debounce multiple rapid changes
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(async () => {
          console.log(`[File System] 📝 Git index changed, checking status...`);

          if (this.githubAdapter) {
            try {
              const changedFiles =
                await this.githubAdapter.getChangedFiles(repoPath);
              console.log(
                `[File System] Found ${changedFiles.length} changed files`,
              );

              // Check if window is still valid before sending
              if (!targetWindow.isDestroyed()) {
                targetWindow.webContents.send('git-status-change', {
                  repoPath,
                  changedFiles,
                  timestamp: new Date().toISOString(),
                });
              } else {
                console.warn(
                  '[File System] Target window destroyed, skipping git-status-change event',
                );
              }
            } catch (error) {
              console.error('[File System] Error getting git status:', error);
            }
          } else {
            console.warn(
              '[File System] No GitHub adapter available for git status check',
            );
          }
        }, 300); // Wait 300ms after last change
      });

    return gitWatcher;
  }

  private setupDirectoryWatcherEvents(
    watcher: FSWatcher,
    targetWindow: BrowserWindow,
    fileTypes: string[] = ['.md'],
  ) {
    const isRelevantFileType = (filePath: string): boolean => {
      const ext = path.extname(filePath).toLowerCase();
      return fileTypes.includes(ext);
    };

    watcher
      .on('ready', () =>
        console.log('[File System] ✅ Directory watcher is READY'),
      )
      .on('error', (error) =>
        console.error(`[File System] ❌ Directory watcher error: ${error}`),
      )
      .on('add', (addedPath, stats) => {
        if (isRelevantFileType(addedPath)) {
          console.log(`[File System] ✨ File ADDED: ${addedPath}`);
          // Check if window is still valid before sending
          if (!targetWindow.isDestroyed()) {
            targetWindow.webContents.send('directory-change', {
              type: 'add',
              path: addedPath,
              stats,
            });
          } else {
            console.warn(
              '[File System] Target window destroyed, skipping directory add event',
            );
          }
        }
      })
      .on('unlink', (unlinkedPath) => {
        if (isRelevantFileType(unlinkedPath)) {
          console.log(`[File System] 🗑️ File DELETED: ${unlinkedPath}`);
          // Check if window is still valid before sending
          if (!targetWindow.isDestroyed()) {
            targetWindow.webContents.send('directory-change', {
              type: 'unlink',
              path: unlinkedPath,
            });
          } else {
            console.warn(
              '[File System] Target window destroyed, skipping directory unlink event',
            );
          }
        }
      })
      .on('addDir', (addedDirPath) => {
        console.log(`[File System] 📁 Directory ADDED: ${addedDirPath}`);
        // Check if window is still valid before sending
        if (!targetWindow.isDestroyed()) {
          targetWindow.webContents.send('directory-change', {
            type: 'addDir',
            path: addedDirPath,
          });
        } else {
          console.warn(
            '[File System] Target window destroyed, skipping directory addDir event',
          );
        }
      })
      .on('unlinkDir', (unlinkedDirPath) => {
        console.log(`[File System] 🗑️ Directory DELETED: ${unlinkedDirPath}`);
        // Check if window is still valid before sending
        if (!targetWindow.isDestroyed()) {
          targetWindow.webContents.send('directory-change', {
            type: 'unlinkDir',
            path: unlinkedDirPath,
          });
        } else {
          console.warn(
            '[File System] Target window destroyed, skipping directory unlinkDir event',
          );
        }
      });
  }

  async watchGitRepository(repoPath: string): Promise<boolean> {
    if (!this.mainWindow) {
      console.error(
        '[File System] Cannot watch git repository: No main window reference',
      );
      return false;
    }

    if (!this.githubAdapter) {
      console.error(
        '[File System] Cannot watch git repository: No GitHub adapter reference',
      );
      return false;
    }

    // Stop existing git watcher if any
    if (this.gitWatcher) {
      console.log('[File System] Stopping existing git watcher...');
      await this.gitWatcher.close();
      this.gitWatcher = null;
    }

    try {
      this.gitWatcher = await this.createGitWatcher(repoPath, this.mainWindow);

      if (this.gitWatcher) {
        console.log(`[File System] Git watcher started for ${repoPath}`);

        // Send initial git status
        const changedFiles = await this.githubAdapter.getChangedFiles(repoPath);
        // Check if window is still valid before sending
        if (!this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('git-status-change', {
            repoPath,
            changedFiles,
            timestamp: new Date().toISOString(),
            initial: true,
          });
        } else {
          console.warn(
            '[File System] Main window destroyed, skipping initial git status',
          );
        }

        return true;
      }
      console.log(
        `[File System] Could not create git watcher for ${repoPath} (not a git repository?)`,
      );
      return false;
    } catch (error) {
      console.error('[File System] Error setting up git watcher:', error);
      return false;
    }
  }

  async stopWatchingGit(): Promise<boolean> {
    if (this.gitWatcher) {
      console.log('[File System] Stopping git watcher...');
      await this.gitWatcher.close();
      this.gitWatcher = null;
      console.log('[File System] Git watcher stopped.');
      return true;
    }
    return false;
  }

  async stopWatching(): Promise<boolean> {
    let stoppedFile = true;
    let stoppedDir = true;
    let stoppedGit = true;

    if (this.fileWatcher) {
      console.log('[File System] Stopping file watcher...');
      await this.fileWatcher.close();
      this.fileWatcher = null;
      stoppedFile = true;
      console.log('[File System] File watcher stopped.');
    }
    if (this.directoryWatcher) {
      console.log('[File System] Stopping directory watcher...');
      await this.directoryWatcher.close();
      this.directoryWatcher = null;
      stoppedDir = true;
      console.log('[File System] Directory watcher stopped.');
    }
    if (this.gitWatcher) {
      stoppedGit = await this.stopWatchingGit();
    }
    this.currentlyWatchingPath = null;
    return stoppedFile && stoppedDir && stoppedGit;
  }

  async stopWatchingFile(filePath: string): Promise<boolean> {
    if (!this.fileWatcher) {
      console.info(
        '[File System] stopWatchingFile: No active file watcher to stop.',
      );
      return false;
    }
    if (this.currentlyWatchingPath && this.currentlyWatchingPath !== filePath) {
      console.warn(
        '[File System] stopWatchingFile: Requested path does not match current watcher. Ignoring request.',
        {
          current: this.currentlyWatchingPath,
          requested: filePath,
        },
      );
      return false;
    }

    try {
      await this.fileWatcher.close();
      console.info('[File System] File watcher stopped.');
    } catch (error) {
      console.error('[File System] Error stopping file watcher:', error);
      return false;
    } finally {
      this.fileWatcher = null;
      this.currentlyWatchingPath = null;
    }

    return true;
  }

  async stopWatchingDirectory(directoryPath: string): Promise<boolean> {
    if (!this.mainWindow) {
      console.error(
        '[File System] stopWatchingDirectory: No main window reference on this adapter instance.',
      );
      return false;
    }
    if (!this.directoryWatcher) {
      console.warn(
        '[File System] stopWatchingDirectory: No active directory watcher to stop.',
      );
      return false; // Nothing to stop
    }
    if (!this.rootPath) {
      // This state (active watcher but no rootPath) would be inconsistent.
      // Indicates watchDirectory(isSubdirectory:false) might not have completed setting rootPath or was bypassed.
      console.error(
        '[File System] stopWatchingDirectory: Root path is not set, but a directory watcher exists. Inconsistent state. Attempting to close watcher.',
      );
      try {
        await this.directoryWatcher.close();
      } catch (closeError) {
        console.error(
          '[File System] stopWatchingDirectory: Error closing watcher during inconsistent state recovery:',
          closeError,
        );
        // Fall through to nullify even if close fails
      }
      this.directoryWatcher = null;
      this.currentlyWatchingPath = null;
      // rootPath is already null/unset
      return false; // Indicate an issue due to inconsistent state, even if cleanup was attempted.
    }

    try {
      const resolvedPathToStop = path.resolve(directoryPath);
      const resolvedRootPath = path.resolve(this.rootPath);

      if (resolvedPathToStop === resolvedRootPath) {
        // User wants to stop watching the entire root.
        console.log(
          `[File System] stopWatchingDirectory: Stopping watcher for root path ${resolvedRootPath} for adapter of window ${this.mainWindow.id}.`,
        );
        await this.directoryWatcher.close();
        this.directoryWatcher = null;
        this.currentlyWatchingPath = null;
        this.rootPath = null; // Clear the root path as it's no longer watched.
        console.log(
          `[File System] Directory watcher for root ${resolvedRootPath} stopped and rootPath cleared.`,
        );
        return true;
      }
      // The path is not the root. Assume it's a subdirectory and delegate.
      // stopWatchingSubdirectory will validate if it's a child of rootPath.
      console.log(
        `[File System] stopWatchingDirectory: Path ${resolvedPathToStop} is not the root. Delegating to stopWatchingSubdirectory.`,
      );
      return this.stopWatchingSubdirectory(resolvedPathToStop);
    } catch (error) {
      console.error(
        `[File System] ❌ Error in stopWatchingDirectory for path (${directoryPath}):`,
        error,
      );
      return false;
    }
  }

  private async findFilesWithExtensions(
    dirPath: string,
    extensions: string[],
    maxDepth = 3,
    currentDepth = 0,
  ): Promise<string[]> {
    let files: string[] = [];
    if (currentDepth > maxDepth) return files;

    try {
      const entries = await fsPromises.readdir(dirPath, {
        withFileTypes: true,
      });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const entryPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          files = files.concat(
            await this.findFilesWithExtensions(
              entryPath,
              extensions,
              maxDepth,
              currentDepth + 1,
            ),
          );
        } else if (
          extensions.includes(path.extname(entry.name).toLowerCase())
        ) {
          files.push(entryPath);
        }
      }
    } catch (_error) {
      // console.warn(`[File System] Error finding files in ${dirPath}:`, error);
    }
    return files;
  }

  /**
   * Glob pattern matching for files
   */
  async glob(pattern: string, options?: { cwd?: string }): Promise<string[]> {
    if (!this.mainWindow) {
      console.error(
        '[File System] glob: No main window reference on this adapter instance.',
      );
      return [];
    }

    const workingDir = options?.cwd || process.cwd();

    try {
      await fsPromises.access(workingDir);
    } catch {
      console.error(
        `[File System] glob: Working directory does not exist: ${workingDir}`,
      );
      return [];
    }

    try {
      // Simple glob implementation for **/*.ext patterns
      if (pattern.startsWith('**/') && pattern.includes('.')) {
        const extension = pattern.substring(pattern.lastIndexOf('.'));
        const files = await this.findFilesWithExtensions(
          workingDir,
          [extension],
          10,
          0,
        );
        return files.map((filePath) => path.relative(workingDir, filePath));
      }

      // For other patterns, use a basic implementation
      return await this.findFilesWithGlobPattern(workingDir, pattern);
    } catch (error) {
      console.error('[File System] Error in glob pattern matching:', error);
      return [];
    }
  }

  private async findFilesWithGlobPattern(
    dirPath: string,
    pattern: string,
    maxDepth = 10,
    currentDepth = 0,
  ): Promise<string[]> {
    let files: string[] = [];
    if (currentDepth > maxDepth) return files;

    try {
      const entries = await fsPromises.readdir(dirPath, {
        withFileTypes: true,
      });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const entryPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(dirPath, entryPath);

        if (entry.isDirectory()) {
          const subFiles = await this.findFilesWithGlobPattern(
            entryPath,
            pattern,
            maxDepth,
            currentDepth + 1,
          );
          files = files.concat(subFiles.map((f) => path.join(relativePath, f)));
        } else {
          // Simple pattern matching - convert glob to regex
          const regex = new RegExp(
            `^${pattern.replace(/\*/g, '.*').replace(/\?/g, '.')}$`,
          );
          if (regex.test(relativePath) || regex.test(entry.name)) {
            files.push(relativePath);
          }
        }
      }
    } catch (_error) {
      // console.warn(`[File System] Error in glob pattern matching for ${dirPath}:`, error);
    }
    return files;
  }

  async addPathToDirectoryWatcher(newPathToAdd: string): Promise<boolean> {
    if (!this.mainWindow) {
      console.error(
        '[File System] addPathToDirectoryWatcher: No main window reference on this adapter instance.',
      );
      return false;
    }
    if (!this.directoryWatcher) {
      console.error(
        '[File System] addPathToDirectoryWatcher: No active directory watcher. Call watchDirectory({isSubdirectory: false}) first for a primary directory.',
      );
      return false;
    }
    if (!this.rootPath) {
      console.error(
        '[File System] addPathToDirectoryWatcher: Root path is not set. Call watchDirectory({isSubdirectory: false}) first for a primary directory.',
      );
      return false;
    }

    try {
      const resolvedNewPath = path.resolve(newPathToAdd);
      const resolvedRootPath = path.resolve(this.rootPath);

      if (!resolvedNewPath.startsWith(resolvedRootPath + path.sep)) {
        console.error(
          `[File System] addPathToDirectoryWatcher: Path ${resolvedNewPath} is not a subdirectory of the root path ${resolvedRootPath}.`,
        );
        return false;
      }

      try {
        const stats = await fsPromises.stat(resolvedNewPath);
        if (!stats.isDirectory()) {
          console.error(
            `[File System] addPathToDirectoryWatcher: Path is not a directory: ${resolvedNewPath}`,
          );
          return false;
        }
      } catch {
        console.error(
          `[File System] addPathToDirectoryWatcher: Path does not exist: ${resolvedNewPath}`,
        );
        return false;
      }

      this.directoryWatcher.add(resolvedNewPath);
      console.log(
        `[File System] Successfully added path to directory watcher: ${resolvedNewPath} for adapter of window ${this.mainWindow.id}`,
      );
      return true;
    } catch (error) {
      console.error(
        `[File System] ❌ Error adding path to directory watcher (${newPathToAdd}):`,
        error,
      );
      return false;
    }
  }

  async stopWatchingSubdirectory(subdirectoryPath: string): Promise<boolean> {
    if (!this.mainWindow) {
      console.error(
        '[File System] stopWatchingSubdirectory: No main window reference on this adapter instance.',
      );
      return false;
    }
    if (!this.directoryWatcher) {
      console.error(
        '[File System] stopWatchingSubdirectory: No active directory watcher to remove a path from. Call watchDirectory() first.',
      );
      return false;
    }
    if (!this.rootPath) {
      console.error(
        '[File System] stopWatchingSubdirectory: Root path is not set. Cannot validate sub-path. Call watchDirectory() first.',
      );
      return false;
    }

    try {
      const resolvedSubPath = path.resolve(subdirectoryPath);
      const resolvedRootPath = path.resolve(this.rootPath);

      if (resolvedSubPath === resolvedRootPath) {
        console.warn(
          `[File System] stopWatchingSubdirectory: Attempted to unwatch the root path (${resolvedSubPath}) using stopWatchingSubdirectory. Use stopWatchingDirectory() or stopWatching() instead.`,
        );
        return false;
      }

      if (!resolvedSubPath.startsWith(resolvedRootPath + path.sep)) {
        console.error(
          `[File System] stopWatchingSubdirectory: Path ${resolvedSubPath} is not a subdirectory of the current root path ${resolvedRootPath}.`,
        );
        return false;
      }

      // It's good practice to check if the path exists, though unwatch might handle non-existent paths gracefully.
      // For consistency with adding, we can check.
      try {
        const stats = await fsPromises.stat(resolvedSubPath);
        if (!stats.isDirectory()) {
          console.warn(
            `[File System] stopWatchingSubdirectory: Path to unwatch is not a directory: ${resolvedSubPath}. Proceeding to attempt unwatch.`,
          );
        }
      } catch {
        console.warn(
          `[File System] stopWatchingSubdirectory: Path to unwatch does not exist: ${resolvedSubPath}. Proceeding to attempt unwatch.`,
        );
        // Chokidar's unwatch might not error if the path isn't actively watched or doesn't exist, it just removes it from its list.
      }

      await this.directoryWatcher.unwatch(resolvedSubPath);
      console.log(
        `[File System] Successfully requested to stop watching subdirectory: ${resolvedSubPath} for adapter of window ${this.mainWindow.id}`,
      );
      // Note: `unwatch` is async in some chokidar versions or usage patterns, but often acts immediately.
      // Chokidar doesn't provide a direct callback for successful unwatching of a specific path in the same way it does for `add` events.
      // We assume success if no error is thrown by the unwatch call itself.
      return true;
    } catch (error) {
      console.error(
        `[File System] ❌ Error stopping watch for subdirectory (${subdirectoryPath}):`,
        error,
      );
      return false;
    }
  }

  async watchFiles(options: { filePaths: string[] }): Promise<boolean> {
    if (!this.mainWindow) {
      console.error(
        '[File System Adapter] watchFiles: No main window reference.',
      );
      return false;
    }
    // Stop any existing specific files watcher for this adapter instance
    await this.stopWatchingFiles();

    if (!options.filePaths || options.filePaths.length === 0) {
      // console.log('[File System Adapter] watchFiles: No file paths provided to watch.');
      return true; // Nothing to watch
    }

    try {
      // console.log(`[File System Adapter WID-${this.mainWindow.id}] Setting up files watcher for:`, options.filePaths);
      this.filesWatcher = chokidar.watch(options.filePaths, {
        persistent: true,
        ignoreInitial: true, // Don't send events for files already existing when watcher starts
        awaitWriteFinish: {
          stabilityThreshold: 300, // Wait for file write to complete
          pollInterval: 100,
        },
        // depth: 0 // Not applicable when watching individual files
      });

      this.filesWatcher
        .on('unlink', (unlinkedPath) => {
          console.log(
            `[File System Adapter WID-${this.mainWindow!.id}] File DELETED by filesWatcher: ${unlinkedPath}`,
          );
          // Check if window is still valid before sending
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('files-change', {
              type: 'unlink',
              path: unlinkedPath,
            });
          } else {
            console.warn(
              '[File System] Main window destroyed or null, skipping files-change event',
            );
          }
        })
        .on('error', (error) => {
          console.error(
            `[File System Adapter WID-${this.mainWindow!.id}] Files watcher error:`,
            error,
          );
        });
      // .on('ready', () => {
      //   console.log(`[File System Adapter WID-${this.mainWindow!.id}] Files watcher is ready for ${options.filePaths.length} files.`);
      // });
      return true;
    } catch (error) {
      console.error(
        `[File System Adapter WID-${this.mainWindow!.id}] Error setting up files watcher:`,
        error,
      );
      this.filesWatcher = null; // Ensure it's null on error
      return false;
    }
  }

  async stopWatchingFiles(): Promise<boolean> {
    if (this.filesWatcher) {
      // console.log(`[File System Adapter WID-${this.mainWindow?.id}] Stopping files watcher.`);
      try {
        await this.filesWatcher.close();
      } catch (error) {
        console.error(
          `[File System Adapter WID-${this.mainWindow?.id}] Error closing files watcher:`,
          error,
        );
      }
      this.filesWatcher = null;
    }
    return true;
  }
}

// New function to register IPC Handlers globally
export function registerFileSystemIpcHandlers(
  appWindows: Map<number, IModernApplicationWindow>,
) {
  console.log('[File System] Registering global IPC handlers...');

  // Initialize skills sync services
  const configService = new SkillsConfigService();
  const gitService = new SkillsGitService(configService);
  const syncService = new SkillsSyncService(configService, gitService);
  const detectionService = new SkillsDetectionService();

  // Set up pending changes emitter
  syncService.setPendingChangesEmitter((directoryId, changes) => {
    // Broadcast pending changes to all windows
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send(FileSystemAPIEvent.PENDING_CHANGES_UPDATED, {
        directoryId,
        changes,
      });
    });
  });

  // Initialize services asynchronously
  configService.initialize().catch(console.error);
  syncService.initialize().catch(console.error);

  ipcMain.handle(FileSystemAPIEvent.SELECT_FILE, async (event) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (!senderWindow) {
      console.error('SELECT_FILE: No sender window');
      return null;
    }
    const appWindow = appWindows.get(senderWindow.id);
    if (!appWindow || !appWindow.fileSystemAdapter) {
      console.error(
        'SELECT_FILE: No AppWindow or Adapter for ID ',
        senderWindow.id,
      );
      return null;
    }
    return appWindow.fileSystemAdapter.selectFile();
  });

  ipcMain.handle(
    FileSystemAPIEvent.SELECT_DIRECTORY,
    async (event, options) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      if (!senderWindow) {
        console.error('SELECT_DIRECTORY: No sender window');
        return null;
      }
      const appWindow = appWindows.get(senderWindow.id);
      if (!appWindow || !appWindow.fileSystemAdapter) {
        console.error(
          'SELECT_DIRECTORY: No AppWindow or Adapter for ID ',
          senderWindow.id,
        );
        return null;
      }
      return appWindow.fileSystemAdapter.selectDirectory(options);
    },
  );

  ipcMain.handle(
    FileSystemAPIEvent.READ_FILE,
    async (event, filePath: string) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      if (!senderWindow) {
        console.error('READ_FILE: No sender window');
        return null;
      }
      const appWindow = appWindows.get(senderWindow.id);
      if (!appWindow || !appWindow.fileSystemAdapter) {
        console.error(
          'READ_FILE: No AppWindow or Adapter for ID ',
          senderWindow.id,
        );
        return null;
      }
      return appWindow.fileSystemAdapter.readFile(filePath);
    },
  );

  ipcMain.handle(
    FileSystemAPIEvent.WRITE_FILE,
    async (event, filePath: string, content: string) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      if (!senderWindow) {
        console.error('WRITE_FILE: No sender window');
        return null;
      }
      const appWindow = appWindows.get(senderWindow.id);
      if (!appWindow || !appWindow.fileSystemAdapter) {
        console.error(
          'WRITE_FILE: No AppWindow or Adapter for ID ',
          senderWindow.id,
        );
        return null;
      }
      console.log(
        `********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.WRITE_FILE} for window ${senderWindow.id} **********`,
      );
      return appWindow.fileSystemAdapter.writeFile(filePath, content);
    },
  );

  ipcMain.handle(
    FileSystemAPIEvent.DELETE_FILE,
    async (event, filePath: string) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      if (!senderWindow) {
        console.error('DELETE_FILE: No sender window');
        return { success: false, error: 'No sender window' };
      }
      try {
        // Stop watching the file first if it's being watched
        const appWindow = appWindows.get(senderWindow.id);
        if (appWindow?.fileSystemAdapter) {
          await appWindow.fileSystemAdapter.stopWatchingFile(filePath);
        }

        // Delete the file
        const fs = require('fs').promises;
        await fs.unlink(filePath);

        console.log(`[FileSystem] File deleted: ${filePath}`);
        return { success: true };
      } catch (error) {
        console.error(`[FileSystem] Failed to delete file: ${filePath}`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  ipcMain.handle(
    'file-system:get-file-stats',
    async (event, filePath: string) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      if (!senderWindow) {
        console.error('GET_FILE_STATS: No sender window');
        return null;
      }
      const appWindow = appWindows.get(senderWindow.id);
      if (!appWindow || !appWindow.fileSystemAdapter) {
        console.error(
          'GET_FILE_STATS: No AppWindow or Adapter for ID ',
          senderWindow.id,
        );
        return null;
      }
      return appWindow.fileSystemAdapter.getFileStats(filePath);
    },
  );

  ipcMain.handle(
    'file-system:read-directory',
    async (event, dirPath: string) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      if (!senderWindow) {
        console.error('READ_DIRECTORY: No sender window');
        return [];
      }
      const appWindow = appWindows.get(senderWindow.id);
      if (!appWindow || !appWindow.fileSystemAdapter) {
        console.error(
          'READ_DIRECTORY: No AppWindow or Adapter for ID ',
          senderWindow.id,
        );
        return [];
      }
      return appWindow.fileSystemAdapter.readDirectory(dirPath);
    },
  );

  ipcMain.handle(
    'file-system:get-directory-stats',
    async (event, dirPath: string) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      if (!senderWindow) {
        console.error('GET_DIRECTORY_STATS: No sender window');
        return null;
      }
      const appWindow = appWindows.get(senderWindow.id);
      if (!appWindow || !appWindow.fileSystemAdapter) {
        console.error(
          'GET_DIRECTORY_STATS: No AppWindow or Adapter for ID ',
          senderWindow.id,
        );
        return null;
      }
      return appWindow.fileSystemAdapter.getDirectoryStats(dirPath);
    },
  );

  ipcMain.handle(
    FileSystemAPIEvent.WATCH_FILE,
    async (event, filePath: string) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      if (!senderWindow) {
        console.error('WATCH_FILE: No sender window');
        return false;
      }
      const appWindow = appWindows.get(senderWindow.id);
      if (!appWindow || !appWindow.fileSystemAdapter) {
        console.error(
          'WATCH_FILE: No AppWindow or Adapter for ID ',
          senderWindow.id,
        );
        return false;
      }
      console.log(
        `********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.WATCH_FILE} for window ${senderWindow.id} **********`,
      );
      return appWindow.fileSystemAdapter.watchFile(filePath);
    },
  );

  ipcMain.handle(
    FileSystemAPIEvent.WATCH_DIRECTORY,
    async (event, options: { directoryPath: string; fileTypes?: string[] }) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      if (!senderWindow) {
        console.error('WATCH_DIRECTORY: No sender window');
        return false;
      }
      const appWindow = appWindows.get(senderWindow.id);
      if (!appWindow || !appWindow.fileSystemAdapter) {
        console.error(
          'WATCH_DIRECTORY: No AppWindow or Adapter for ID ',
          senderWindow.id,
        );
        return false;
      }
      console.log(
        `********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.WATCH_DIRECTORY} for window ${senderWindow.id} **********`,
      );
      // Explicitly pass isSubdirectory: false for primary directory watching
      return appWindow.fileSystemAdapter.watchDirectory({
        ...options,
        isSubdirectory: false,
      });
    },
  );

  ipcMain.handle(
    FileSystemAPIEvent.WATCH_SUBDIRECTORY,
    async (event, directoryPath: string) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      if (!senderWindow) {
        console.error('WATCH_SUBDIRECTORY: No sender window');
        return false;
      }
      const appWindow = appWindows.get(senderWindow.id);
      if (!appWindow || !appWindow.fileSystemAdapter) {
        console.error(
          'WATCH_SUBDIRECTORY: No AppWindow or Adapter for ID ',
          senderWindow.id,
        );
        return false;
      }
      // fileTypes are not directly used by addPathToDirectoryWatcher in the current adapter implementation
      // but including it in case the adapter evolves. The adapter method would need to be updated to use it.
      console.log(
        `********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.WATCH_SUBDIRECTORY} for window ${senderWindow.id} **********`,
      );
      return appWindow.fileSystemAdapter.addPathToDirectoryWatcher(
        directoryPath,
      );
    },
  );

  ipcMain.handle(
    FileSystemAPIEvent.WATCH_FILES,
    async (event, options: { filePaths: string[] }) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      if (!senderWindow) {
        console.error('WATCH_FILES: No sender window');
        return false;
      }
      const appWindow = appWindows.get(senderWindow.id);
      if (!appWindow || !appWindow.fileSystemAdapter) {
        console.error(
          'WATCH_FILES: No AppWindow or Adapter for ID ',
          senderWindow.id,
        );
        return false;
      }
      console.log(
        `********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.WATCH_FILES} for window ${senderWindow.id} **********`,
      );
      return appWindow.fileSystemAdapter.watchFiles(options);
    },
  );

  ipcMain.handle(FileSystemAPIEvent.STOP_WATCHING_FILES, async (event) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (!senderWindow) {
      console.error('STOP_WATCHING_FILES: No sender window');
      return false;
    }
    const appWindow = appWindows.get(senderWindow.id);
    if (!appWindow || !appWindow.fileSystemAdapter) {
      console.error(
        'STOP_WATCHING_FILES: No AppWindow or Adapter for ID ',
        senderWindow.id,
      );
      return false;
    }
    console.log(
      `********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.STOP_WATCHING_FILES} for window ${senderWindow.id} **********`,
    );
    return appWindow.fileSystemAdapter.stopWatchingFiles();
  });

  ipcMain.handle(FileSystemAPIEvent.STOP_WATCHING, async (event) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (!senderWindow) {
      console.error('STOP_WATCHING: No sender window');
      return false;
    }
    const appWindow = appWindows.get(senderWindow.id);
    if (!appWindow || !appWindow.fileSystemAdapter) {
      console.error(
        'STOP_WATCHING: No AppWindow or Adapter for ID ',
        senderWindow.id,
      );
      return false;
    }
    console.log(
      `********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.STOP_WATCHING} for window ${senderWindow.id} **********`,
    );
    return appWindow.fileSystemAdapter.stopWatching();
  });

  ipcMain.handle(
    FileSystemAPIEvent.STOP_WATCHING_FILE,
    async (event, filePath: string) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      if (!senderWindow) {
        console.error('STOP_WATCHING_FILE: No sender window');
        return false;
      }
      const appWindow = appWindows.get(senderWindow.id);
      if (!appWindow || !appWindow.fileSystemAdapter) {
        console.error(
          'STOP_WATCHING_FILE: No AppWindow or Adapter for ID ',
          senderWindow.id,
        );
        return false;
      }
      console.log(
        `********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.STOP_WATCHING_FILE} for window ${senderWindow.id} **********`,
      );
      return appWindow.fileSystemAdapter.stopWatchingFile(filePath);
    },
  );

  ipcMain.handle(
    FileSystemAPIEvent.STOP_WATCHING_DIRECTORY,
    async (event, directoryPath: string) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      if (!senderWindow) {
        console.error('STOP_WATCHING_DIRECTORY: No sender window');
        return false;
      }
      const appWindow = appWindows.get(senderWindow.id);
      if (!appWindow || !appWindow.fileSystemAdapter) {
        console.error(
          'STOP_WATCHING_DIRECTORY: No AppWindow or Adapter for ID ',
          senderWindow.id,
        );
        return false;
      }
      console.log(
        `********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.STOP_WATCHING_DIRECTORY} for window ${senderWindow.id} **********`,
      );
      return appWindow.fileSystemAdapter.stopWatchingDirectory(directoryPath);
    },
  );

  ipcMain.handle(
    FileSystemAPIEvent.STOP_WATCHING_SUBDIRECTORY,
    async (event, directoryPath: string) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      if (!senderWindow) {
        console.error('STOP_WATCHING_SUBDIRECTORY: No sender window');
        return false;
      }
      const appWindow = appWindows.get(senderWindow.id);
      if (!appWindow || !appWindow.fileSystemAdapter) {
        console.error(
          'STOP_WATCHING_SUBDIRECTORY: No AppWindow or Adapter for ID ',
          senderWindow.id,
        );
        return false;
      }
      console.log(
        `********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.STOP_WATCHING_SUBDIRECTORY} for window ${senderWindow.id} **********`,
      );
      return appWindow.fileSystemAdapter.stopWatchingSubdirectory(
        directoryPath,
      );
    },
  );

  ipcMain.handle(
    FileSystemAPIEvent.WATCH_GIT_REPOSITORY,
    async (event, repoPath: string) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      if (!senderWindow) {
        console.error('WATCH_GIT_REPOSITORY: No sender window');
        return false;
      }
      const appWindow = appWindows.get(senderWindow.id);
      if (!appWindow || !appWindow.fileSystemAdapter) {
        console.error(
          'WATCH_GIT_REPOSITORY: No AppWindow or Adapter for ID ',
          senderWindow.id,
        );
        return false;
      }
      console.log(
        `********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.WATCH_GIT_REPOSITORY} for window ${senderWindow.id} **********`,
      );
      return appWindow.fileSystemAdapter.watchGitRepository(repoPath);
    },
  );

  ipcMain.handle(FileSystemAPIEvent.STOP_WATCHING_GIT, async (event) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (!senderWindow) {
      console.error('STOP_WATCHING_GIT: No sender window');
      return false;
    }
    const appWindow = appWindows.get(senderWindow.id);
    if (!appWindow || !appWindow.fileSystemAdapter) {
      console.error(
        'STOP_WATCHING_GIT: No AppWindow or Adapter for ID ',
        senderWindow.id,
      );
      return false;
    }
    console.log(
      `********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.STOP_WATCHING_GIT} for window ${senderWindow.id} **********`,
    );
    return appWindow.fileSystemAdapter.stopWatchingGit();
  });

  ipcMain.handle(
    'file-system:glob',
    async (event, pattern: string, options?: { cwd?: string }) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      if (!senderWindow) {
        console.error('GLOB: No sender window');
        return [];
      }
      const appWindow = appWindows.get(senderWindow.id);
      if (!appWindow || !appWindow.fileSystemAdapter) {
        console.error('GLOB: No AppWindow or Adapter for ID ', senderWindow.id);
        return [];
      }
      return appWindow.fileSystemAdapter.glob(pattern, options);
    },
  );

  ipcMain.handle(FileSystemAPIEvent.GET_HOME_PATH, async (event) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (!senderWindow) {
      console.error('GET_HOME_PATH: No sender window');
      return null;
    }
    const appWindow = appWindows.get(senderWindow.id);
    if (!appWindow || !appWindow.fileSystemAdapter) {
      console.error(
        'GET_HOME_PATH: No AppWindow or Adapter for ID ',
        senderWindow.id,
      );
      return null;
    }
    console.log(
      `********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.GET_HOME_PATH} for window ${senderWindow.id} **********`,
    );
    return appWindow.fileSystemAdapter.getHomePath();
  });

  ipcMain.handle(
    FileSystemAPIEvent.GET_CURRENT_WORKING_DIRECTORY,
    async (event) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      if (!senderWindow) {
        console.error('GET_CURRENT_WORKING_DIRECTORY: No sender window');
        return null;
      }
      const appWindow = appWindows.get(senderWindow.id);
      if (!appWindow || !appWindow.fileSystemAdapter) {
        console.error(
          'GET_CURRENT_WORKING_DIRECTORY: No AppWindow or Adapter for ID ',
          senderWindow.id,
        );
        return null;
      }
      console.log(
        `********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.GET_CURRENT_WORKING_DIRECTORY} for window ${senderWindow.id} **********`,
      );
      return appWindow.fileSystemAdapter.getCurrentWorkingDirectory();
    },
  );

  // Handler for getting global skills from ~/.claude and ~/.agent
  ipcMain.handle(FileSystemAPIEvent.GET_GLOBAL_SKILLS, async () => {
    try {
      const homeDir = app.getPath('home');
      const skills: GlobalSkill[] = [];

      // Helper function to find all SKILL.md files recursively
      const findSkillFiles = async (dir: string): Promise<string[]> => {
        const skillFiles: string[] = [];
        try {
          const entries = await fsPromises.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              const subSkills = await findSkillFiles(fullPath);
              skillFiles.push(...subSkills);
            } else if (entry.name === 'SKILL.md') {
              skillFiles.push(fullPath);
            }
          }
        } catch (error) {
          // Ignore permission errors and continue
          console.warn(`[getGlobalSkills] Could not read directory ${dir}:`, error);
        }
        return skillFiles;
      };

      // Helper function to analyze skill folder structure
      const analyzeSkillStructure = async (skillPath: string) => {
        const skillDir = path.dirname(skillPath);
        const scriptFiles: string[] = [];
        const referenceFiles: string[] = [];
        const assetFiles: string[] = [];

        try {
          const scriptsDir = path.join(skillDir, 'scripts');
          if (fs.existsSync(scriptsDir)) {
            const files = await fsPromises.readdir(scriptsDir);
            scriptFiles.push(...files);
          }
        } catch (error) {
          // Ignore errors
        }

        try {
          const referencesDir = path.join(skillDir, 'references');
          if (fs.existsSync(referencesDir)) {
            const files = await fsPromises.readdir(referencesDir);
            referenceFiles.push(...files);
          }
        } catch (error) {
          // Ignore errors
        }

        try {
          const assetsDir = path.join(skillDir, 'assets');
          if (fs.existsSync(assetsDir)) {
            const files = await fsPromises.readdir(assetsDir);
            assetFiles.push(...files);
          }
        } catch (error) {
          // Ignore errors
        }

        return {
          skillFolderPath: skillDir,
          hasScripts: scriptFiles.length > 0,
          hasReferences: referenceFiles.length > 0,
          hasAssets: assetFiles.length > 0,
          scriptFiles,
          referenceFiles,
          assetFiles,
        };
      };

      // Helper function to validate skill frontmatter
      const validateFrontmatter = (content: string, skillName: string): { isValid: boolean; hasStructure: boolean; missingFields: string[]; errorMessage?: string } => {
        const missingFields: string[] = [];

        // Check for basic structure (heading)
        const hasHeading = /^#\s+.+/m.test(content);

        // For now, we consider a skill valid if it has content and a heading
        // More sophisticated frontmatter validation can be added later
        const isValid = content.length > 0 && hasHeading;

        if (!hasHeading) {
          missingFields.push('heading');
        }

        return {
          isValid,
          hasStructure: hasHeading,
          missingFields,
          errorMessage: isValid ? undefined : 'Skill is missing required structure',
        };
      };

      // Helper function to parse SKILL.md content
      const parseSkillContent = async (skillPath: string, source: 'global-universal' | 'global-claude'): Promise<GlobalSkill | null> => {
        try {
          const content = await fsPromises.readFile(skillPath, 'utf-8');
          const skillDir = path.dirname(skillPath);
          const skillDirName = path.basename(skillDir);

          // Extract description from first paragraph after heading
          let description = '';
          const lines = content.split('\n');
          let foundHeading = false;

          for (const line of lines) {
            if (line.startsWith('#')) {
              foundHeading = true;
              continue;
            }
            if (foundHeading && line.trim() && !line.startsWith('#')) {
              description = line.trim();
              break;
            }
          }

          // Extract capabilities (bullet points)
          const capabilities: string[] = [];
          for (const line of lines) {
            const bulletMatch = line.match(/^[\s]*[-*]\s+(.+)/);
            if (bulletMatch) {
              capabilities.push(bulletMatch[1].trim());
            }
          }

          // Analyze folder structure
          const structure = await analyzeSkillStructure(skillPath);

          // Read metadata from centralized lock file (add-skill convention)
          let metadata: {
            installedFrom?: string;
            skillPath?: string;
            owner?: string;
            repo?: string;
            sha?: string;
            installedAt?: string;
          } | undefined;
          try {
            const lockService = getSkillLockFileService();
            const skillEntry = await lockService.getSkill(skillDirName);
            if (skillEntry) {
              metadata = {
                installedFrom: skillEntry.sourceUrl,
                skillPath: skillEntry.skillPath,
                owner: skillEntry.source.split('/')[0],
                repo: skillEntry.source.split('/')[1],
                sha: skillEntry.skillFolderHash,
                installedAt: skillEntry.installedAt?.toString(),
              };
              console.log(`[getGlobalSkills] Loaded metadata from lock file for skill: ${skillDirName}`);
            }
          } catch (error) {
            // Lock file doesn't exist or skill not found - this is fine
            console.debug(`[getGlobalSkills] No lock file entry for skill: ${skillDirName}`);
          }

          // Validate frontmatter
          const frontmatterValidation = validateFrontmatter(content, skillDirName);

          return {
            id: skillPath,
            name: skillDirName.replace(/-/g, ' ').replace(/_/g, ' '),
            path: skillPath,
            description: description || 'No description available',
            content,
            capabilities: capabilities.slice(0, 3),
            ...structure,
            source,
            priority: source === 'global-universal' ? 2 : 4,
            metadata,
            frontmatterValidation,
          };
        } catch (error) {
          console.error(`[getGlobalSkills] Failed to parse skill at ${skillPath}:`, error);
          return null;
        }
      };

      // Scan ~/.agents/skills/
      const agentSkillsDir = path.join(homeDir, '.agents', 'skills');
      if (fs.existsSync(agentSkillsDir)) {
        const agentSkillFiles = await findSkillFiles(agentSkillsDir);
        for (const skillPath of agentSkillFiles) {
          const skill = await parseSkillContent(skillPath, 'global-universal');
          if (skill) {
            skills.push(skill);
          }
        }
      }

      // Scan ~/.claude/skills/
      const claudeSkillsDir = path.join(homeDir, '.claude', 'skills');
      if (fs.existsSync(claudeSkillsDir)) {
        const claudeSkillFiles = await findSkillFiles(claudeSkillsDir);
        for (const skillPath of claudeSkillFiles) {
          const skill = await parseSkillContent(skillPath, 'global-claude');
          if (skill) {
            skills.push(skill);
          }
        }
      }

      console.log(`[getGlobalSkills] Found ${skills.length} global skills`);
      return skills;
    } catch (error) {
      console.error('[getGlobalSkills] Failed to get global skills:', error);
      return [];
    }
  });

  // Handler for getting file content at a specific git revision
  ipcMain.handle(
    FileSystemAPIEvent.GET_FILE_CONTENT_AT_REVISION,
    async (
      _event,
      repositoryPath: string,
      filePath: string,
      revision: string = 'HEAD'
    ) => {
      try {
        console.log(`[getFileContentAtRevision] Getting content for ${filePath} at ${revision} in ${repositoryPath}`);

        // Use gitClientFactory to get file content from git
        const content = await gitClientFactory.getFileContentAtRevision(
          repositoryPath,
          filePath,
          revision
        );

        return content;
      } catch (error) {
        console.error('[getFileContentAtRevision] Failed:', error);
        return null;
      }
    }
  );

  // Handler for syncing global skills from Git repository
  ipcMain.handle(FileSystemAPIEvent.SYNC_GLOBAL_SKILLS, async () => {
    try {
      console.log('[syncGlobalSkills] Starting sync...');
      const success = await syncService.sync();
      return { success };
    } catch (error) {
      console.error('[syncGlobalSkills] Failed to sync:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Handler for getting sync status
  ipcMain.handle(FileSystemAPIEvent.GET_SYNC_STATUS, async () => {
    try {
      const state = syncService.getSyncState();
      return state;
    } catch (error) {
      console.error('[getSyncStatus] Failed to get status:', error);
      return null;
    }
  });

  // Handler for getting sync configuration
  ipcMain.handle(FileSystemAPIEvent.GET_SYNC_CONFIG, async () => {
    try {
      const config = await configService.getConfig();
      return config;
    } catch (error) {
      console.error('[getSyncConfig] Failed to get config:', error);
      return null;
    }
  });

  // Handler for updating sync configuration
  ipcMain.handle(FileSystemAPIEvent.UPDATE_SYNC_CONFIG, async (event, updates) => {
    try {
      console.log('[updateSyncConfig] Updating config:', updates);
      const config = await configService.updateConfig(updates);
      return config;
    } catch (error) {
      console.error('[updateSyncConfig] Failed to update config:', error);
      return null;
    }
  });

  // Handler for enabling sync for a skill
  ipcMain.handle(FileSystemAPIEvent.ENABLE_SKILL_SYNC, async (event, { skillPath, syncSource }) => {
    try {
      console.log('[enableSkillSync] Enabling sync for:', skillPath);
      const success = await syncService.enableSkillSync(skillPath, syncSource);
      return { success };
    } catch (error) {
      console.error('[enableSkillSync] Failed to enable sync:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Handler for disabling sync for a skill
  ipcMain.handle(FileSystemAPIEvent.DISABLE_SKILL_SYNC, async (event, { skillPath }) => {
    try {
      console.log('[disableSkillSync] Disabling sync for:', skillPath);
      const success = await syncService.disableSkillSync(skillPath);
      return { success };
    } catch (error) {
      console.error('[disableSkillSync] Failed to disable sync:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Handler for resolving skill conflicts
  ipcMain.handle(FileSystemAPIEvent.RESOLVE_SKILL_CONFLICT, async (event, { skillPath, resolution }) => {
    try {
      console.log('[resolveSkillConflict] Resolving conflict for:', skillPath, 'with:', resolution);
      const success = await syncService.resolveConflict(skillPath, resolution);
      return { success };
    } catch (error) {
      console.error('[resolveSkillConflict] Failed to resolve conflict:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Handler for getting all local skills (for migration)
  ipcMain.handle(FileSystemAPIEvent.GET_ALL_LOCAL_SKILLS, async () => {
    try {
      const skills = await detectionService.getAllLocalSkills();
      console.log(`[getAllLocalSkills] Found ${skills.length} local skills`);
      return { skills };
    } catch (error) {
      console.error('[getAllLocalSkills] Failed:', error);
      return { skills: [], error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Handler for initializing a new skills repository
  ipcMain.handle(FileSystemAPIEvent.INITIALIZE_SKILLS_REPO, async (event, { repoUrl }) => {
    try {
      console.log('[initializeSkillsRepo] Initializing with URL:', repoUrl);

      // Update config with the repo URL
      await configService.updateConfig({
        enabled: true,
        repoUrl: repoUrl || '',
        branch: 'main',
      });

      // Initialize the local Git repository
      const success = await gitService.initializeRepository();

      if (!success) {
        throw new Error('Failed to initialize repository');
      }

      // If a remote URL is provided, set it
      if (repoUrl) {
        await gitService.setRemote(repoUrl);
      }

      return { success: true };
    } catch (error) {
      console.error('[initializeSkillsRepo] Failed:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Handler for migrating skills to the repository
  ipcMain.handle(FileSystemAPIEvent.MIGRATE_SKILLS_TO_REPO, async (event, { skillPaths }) => {
    try {
      console.log('[migrateSkillsToRepo] Migrating', skillPaths.length, 'skills');

      const config = await configService.getConfig();
      // Use localPath if it exists (backwards compatibility), otherwise use first directory's clone path
      const repoPath = config.localPath || (config.directories.length > 0 ? config.directories[0].localClonePath : null);

      if (!repoPath) {
        throw new Error('No repository path configured');
      }

      // Copy each skill to the repository
      for (const skillPath of skillPaths) {
        const skillName = path.basename(skillPath);
        const targetPath = path.join(repoPath, skillName);

        console.log(`[migrateSkillsToRepo] Copying ${skillName}`);

        // Use recursive copy
        await copyDir(skillPath, targetPath);
      }

      // Commit all skills
      const commitSuccess = await gitService.commitSkills('Migrate existing skills');

      if (!commitSuccess) {
        throw new Error('Failed to commit skills');
      }

      // Push to remote if configured
      if (config.repoUrl) {
        console.log('[migrateSkillsToRepo] Pushing to remote...');

        // Try pushing to remote (normal push should work now that we don't auto_init repos)
        const pushSuccess = await gitService.pushToRemote('origin', config.branch);

        if (!pushSuccess) {
          throw new Error('Failed to push skills to GitHub. Please check your network connection and repository access.');
        }

        console.log('[migrateSkillsToRepo] Successfully pushed to remote');
      }

      // Sync to global directories
      await gitService.syncToGlobalDirectories();

      return { success: true };
    } catch (error) {
      console.error('[migrateSkillsToRepo] Failed:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Handler for getting all skill directories
  ipcMain.handle(FileSystemAPIEvent.GET_SKILL_DIRECTORIES, async () => {
    try {
      console.log('[getSkillDirectories] Getting skill directories...');
      const config = await configService.getConfig();
      console.log('[getSkillDirectories] Config loaded, directories:', config.directories?.length || 0);

      // Enrich directories with status information
      const directoriesWithStatus = await Promise.all(
        (config.directories || []).map(async (dir) => {
          try {
            const status = await gitService.getDirectoryStatus(dir.id);
            return { ...dir, status };
          } catch (error) {
            console.error(`[getSkillDirectories] Failed to get status for ${dir.displayName}:`, error);
            return dir; // Return directory without status on error
          }
        })
      );

      return directoriesWithStatus;
    } catch (error) {
      console.error('[getSkillDirectories] Failed with error:', error);
      console.error('[getSkillDirectories] Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      return [];
    }
  });

  // Handler for adding a skill directory
  ipcMain.handle(FileSystemAPIEvent.ADD_SKILL_DIRECTORY, async (event, directory) => {
    try {
      const result = await configService.addDirectory(directory);
      return { success: true, directory: result };
    } catch (error) {
      console.error('[addSkillDirectory] Failed:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Handler for updating a skill directory
  ipcMain.handle(FileSystemAPIEvent.UPDATE_SKILL_DIRECTORY, async (event, { id, updates }) => {
    try {
      const result = await configService.updateDirectory(id, updates);
      return { success: true, directory: result };
    } catch (error) {
      console.error('[updateSkillDirectory] Failed:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Handler for removing a skill directory
  ipcMain.handle(FileSystemAPIEvent.REMOVE_SKILL_DIRECTORY, async (event, id) => {
    try {
      const success = await configService.removeDirectory(id);
      return { success };
    } catch (error) {
      console.error('[removeSkillDirectory] Failed:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Handler for detecting preset directories that have skills
  ipcMain.handle(FileSystemAPIEvent.DETECT_PRESET_DIRECTORIES, async () => {
    try {
      const detectedDirs = await detectionService.detectPresetDirectories();
      return detectedDirs;
    } catch (error) {
      console.error('[detectPresetDirectories] Failed:', error);
      return [];
    }
  });

  // Handler for creating agent skill directories
  ipcMain.handle(FileSystemAPIEvent.CREATE_AGENT_DIRECTORIES, async (_event, agentIds: string[]) => {
    try {
      const homeDir = app.getPath('home');
      const createdDirs: string[] = [];

      const directoryMap: Record<string, string> = {
        'claude-specific': path.join(homeDir, '.claude', 'skills'),
        'opencode': path.join(homeDir, '.config', 'opencode', 'skill'),
        'cursor-ide': path.join(homeDir, '.cursor', 'skills'),
        'windsurf': path.join(homeDir, '.windsurf', 'skills'),
      };

      const agentNames: Record<string, string> = {
        'claude-specific': 'Claude',
        'opencode': 'OpenCode',
        'cursor-ide': 'Cursor',
        'windsurf': 'Windsurf',
      };

      for (const agentId of agentIds) {
        const dirPath = directoryMap[agentId];
        if (!dirPath) {
          console.warn(`[createAgentDirectories] Unknown agent ID: ${agentId}`);
          continue;
        }

        // Create directory if it doesn't exist
        await fsPromises.mkdir(dirPath, { recursive: true });
        createdDirs.push(dirPath);
        console.log(`[createAgentDirectories] Created directory: ${dirPath}`);

        // Create a placeholder skill directory so the directory is detected
        // This allows the directory to show up in "Identified Agent Skills"
        const placeholderDir = path.join(dirPath, '.placeholder');
        const placeholderReadme = path.join(placeholderDir, 'SKILL.md');

        const readmeContent = `# ${agentNames[agentId] || 'Agent'} Skills Directory

This directory has been set up to store skills for ${agentNames[agentId] || 'your AI agent'}.

## Getting Started

You can install skills to this directory by:
1. Browsing GitHub repositories in the Skill Browser
2. Selecting a skill you want to install
3. Choosing "${agentNames[agentId]}" as the installation destination

This placeholder skill can be safely deleted once you've installed your first skill.
`;

        try {
          await fsPromises.mkdir(placeholderDir, { recursive: true });
          await fsPromises.writeFile(placeholderReadme, readmeContent, 'utf-8');
          console.log(`[createAgentDirectories] Created placeholder in: ${placeholderDir}`);
        } catch (placeholderError) {
          console.warn(`[createAgentDirectories] Failed to create placeholder:`, placeholderError);
          // Continue even if placeholder fails
        }
      }

      return { success: true, createdDirectories: createdDirs };
    } catch (error) {
      console.error('[createAgentDirectories] Failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Handler for deleting agent skill directories (only if empty or only contains placeholder)
  ipcMain.handle(FileSystemAPIEvent.DELETE_AGENT_DIRECTORY, async (_event, agentId: string) => {
    try {
      const homeDir = app.getPath('home');

      const directoryMap: Record<string, string> = {
        'claude-specific': path.join(homeDir, '.claude', 'skills'),
        'opencode': path.join(homeDir, '.config', 'opencode', 'skill'),
        'cursor-ide': path.join(homeDir, '.cursor', 'skills'),
        'windsurf': path.join(homeDir, '.windsurf', 'skills'),
      };

      const dirPath = directoryMap[agentId];
      if (!dirPath) {
        return { success: false, error: `Unknown agent ID: ${agentId}` };
      }

      // Check if directory exists
      try {
        await fsPromises.access(dirPath);
      } catch {
        return { success: false, error: 'Directory does not exist' };
      }

      // Read directory contents
      const contents = await fsPromises.readdir(dirPath);

      // Only allow deletion if directory is empty or only contains .placeholder
      const hasOnlyPlaceholder = contents.length === 0 ||
        (contents.length === 1 && contents[0] === '.placeholder');

      if (!hasOnlyPlaceholder) {
        return {
          success: false,
          error: 'Directory contains skills and cannot be deleted. Please remove all skills first.'
        };
      }

      // Delete the directory
      await fsPromises.rm(dirPath, { recursive: true, force: true });
      console.log(`[deleteAgentDirectory] Deleted directory: ${dirPath}`);

      return { success: true };
    } catch (error) {
      console.error('[deleteAgentDirectory] Failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Handler for deleting a skill directory
  // Symlink-aware: removes symlinks without touching canonical files
  ipcMain.handle(FileSystemAPIEvent.DELETE_SKILL, async (_event, skillPath: string) => {
    try {
      console.log(`[deleteSkill] Deleting skill at: ${skillPath}`);

      // Verify the path exists
      try {
        await fsPromises.access(skillPath);
      } catch {
        console.log(`[deleteSkill] Skill directory does not exist: ${skillPath}`);
        // Consider this a success - the skill is already gone
        return { success: true };
      }

      // Get skill name from path for lock file operations
      const skillName = path.basename(skillPath);
      const homeDir = app.getPath('home');
      const canonicalPath = path.join(homeDir, '.agents', 'skills', skillName);

      // Check if this is a symlink (agent directory pointing to canonical)
      const pathIsSymlink = await isSymlink(skillPath);

      if (pathIsSymlink) {
        // This is a symlink - just remove the symlink, not the canonical files
        console.log(`[deleteSkill] Path is a symlink, removing symlink only`);
        await removeSkillSymlink(skillPath);
        console.log(`[deleteSkill] Successfully removed symlink at: ${skillPath}`);
        // Don't remove from lock file - the canonical files still exist
        return { success: true };
      }

      // Not a symlink - verify this is actually a skill directory by checking for SKILL.md
      const contents = await fsPromises.readdir(skillPath);
      const hasSkillFile = contents.some(file =>
        file === 'SKILL.md' ||
        file.toLowerCase() === 'skill.md'
      );

      if (!hasSkillFile) {
        return {
          success: false,
          error: 'Directory does not appear to be a skill (missing SKILL.md)'
        };
      }

      // Check if this is the canonical location
      const isCanonical = path.resolve(skillPath) === path.resolve(canonicalPath);

      // Delete the skill directory recursively
      await fsPromises.rm(skillPath, { recursive: true, force: true });
      console.log(`[deleteSkill] Successfully deleted skill at: ${skillPath}`);

      // Only remove from lock file if this was the canonical location
      if (isCanonical) {
        try {
          const lockService = getSkillLockFileService();
          await lockService.removeSkill(skillName);
          console.log(`[deleteSkill] Removed skill from lock file: ${skillName}`);
        } catch (lockError) {
          // Non-fatal - skill files are deleted, lock file update is best-effort
          console.warn(`[deleteSkill] Failed to remove from lock file: ${lockError}`);
        }
      } else {
        console.log(`[deleteSkill] Not canonical location, keeping lock file entry`);
      }

      return { success: true };
    } catch (error) {
      console.error('[deleteSkill] Failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Handler for pushing repository to remote
  ipcMain.handle(FileSystemAPIEvent.PUSH_SKILLS_REPO, async () => {
    try {
      const config = await configService.getConfig();

      if (!config.repoUrl) {
        return { success: false, error: 'No remote repository configured' };
      }

      console.log('[pushSkillsRepo] Pushing to remote...');

      // Try normal push first
      let success = await gitService.pushToRemote('origin', config.branch);

      // If it fails (likely due to diverged history), try force push
      if (!success) {
        console.log('[pushSkillsRepo] Normal push failed, trying force push...');
        success = await gitService.pushToRemote('origin', config.branch, true);
      }

      if (success) {
        console.log('[pushSkillsRepo] Successfully pushed to remote');
        return { success: true };
      } else {
        return { success: false, error: 'Failed to push to remote' };
      }
    } catch (error) {
      console.error('[pushSkillsRepo] Failed:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Handler for detecting skills in global directories that aren't in the repo
  ipcMain.handle(FileSystemAPIEvent.DETECT_UNSYNCED_SKILLS, async () => {
    try {
      const config = await configService.getConfig();

      if (!config.enabled || !config.repoUrl) {
        return { skills: [] };
      }

      const repoPath = await configService.getLocalPath();

      // Get skills in the repo
      const repoSkills = new Set<string>();
      try {
        const repoContents = await fsPromises.readdir(repoPath);
        for (const item of repoContents) {
          if (item === '.git' || item.startsWith('.') || item === 'README.md') {
            continue;
          }
          const itemPath = path.join(repoPath, item);
          const stat = await fsPromises.stat(itemPath);
          if (stat.isDirectory()) {
            repoSkills.add(item);
          }
        }
      } catch (error) {
        console.error('[detectUnsyncedSkills] Error reading repo:', error);
        return { skills: [], error: 'Failed to read repository' };
      }

      // Check each enabled global directory for unsynced skills
      const unsyncedSkills: Array<{ name: string; path: string; directory: string }> = [];
      const enabledDirs = await configService.getEnabledDirectories();

      for (const directory of enabledDirs) {
        try {
          if (!fs.existsSync(directory.path)) {
            continue;
          }

          const dirContents = await fsPromises.readdir(directory.path);
          for (const item of dirContents) {
            if (item.startsWith('.')) continue;

            const itemPath = path.join(directory.path, item);
            const stat = await fsPromises.stat(itemPath);

            if (stat.isDirectory()) {
              // Check if this skill has a SKILL.md file
              const skillMdPath = path.join(itemPath, 'SKILL.md');
              if (fs.existsSync(skillMdPath)) {
                // Check if it's NOT in the repo
                if (!repoSkills.has(item)) {
                  unsyncedSkills.push({
                    name: item,
                    path: itemPath,
                    directory: directory.displayName,
                  });
                }
              }
            }
          }
        } catch (error) {
          console.warn(`[detectUnsyncedSkills] Error reading directory ${directory.path}:`, error);
        }
      }

      // Remove duplicates (same skill in multiple directories)
      const uniqueSkills = Array.from(
        new Map(unsyncedSkills.map(skill => [skill.name, skill])).values()
      );

      console.log(`[detectUnsyncedSkills] Found ${uniqueSkills.length} unsynced skills`);
      return { skills: uniqueSkills };
    } catch (error) {
      console.error('[detectUnsyncedSkills] Failed:', error);
      return { skills: [], error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Handler for adding skills to the repository
  ipcMain.handle(FileSystemAPIEvent.ADD_SKILLS_TO_REPO, async (event, { skillPaths }) => {
    try {
      console.log('[addSkillsToRepo] Adding', skillPaths.length, 'skills to repo');

      const config = await configService.getConfig();
      const repoPath = await configService.getLocalPath();

      if (!repoPath) {
        throw new Error('No repository path configured');
      }

      // Copy each skill to the repository
      for (const skillPath of skillPaths) {
        const skillName = path.basename(skillPath);
        const targetPath = path.join(repoPath, skillName);

        console.log(`[addSkillsToRepo] Copying ${skillName}`);

        // Use recursive copy
        await copyDir(skillPath, targetPath);
      }

      // Commit the new skills
      const commitSuccess = await gitService.commitSkills(`Add ${skillPaths.length} skill${skillPaths.length !== 1 ? 's' : ''} to repository`);

      if (!commitSuccess) {
        throw new Error('Failed to commit skills');
      }

      // Push to remote if configured
      if (config.repoUrl) {
        console.log('[addSkillsToRepo] Pushing to remote...');
        const pushSuccess = await gitService.pushToRemote('origin', config.branch);

        if (!pushSuccess) {
          throw new Error('Failed to push skills to GitHub');
        }

        console.log('[addSkillsToRepo] Successfully pushed to remote');
      }

      // Sync to global directories
      await gitService.syncToGlobalDirectories();

      return { success: true };
    } catch (error) {
      console.error('[addSkillsToRepo] Failed:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Handler for syncing a single directory
  ipcMain.handle(FileSystemAPIEvent.SYNC_SINGLE_DIRECTORY, async (event, directoryId) => {
    try {
      const directory = await configService.getDirectory(directoryId);
      if (!directory) {
        return { success: false, error: 'Directory not found' };
      }

      const success = await gitService.syncSingleDirectory(directory);
      return { success };
    } catch (error) {
      console.error('[syncSingleDirectory] Failed:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Handler for getting pending changes
  ipcMain.handle(FileSystemAPIEvent.GET_PENDING_CHANGES, async () => {
    try {
      const pendingChanges = syncService.getPendingChanges();
      // Convert Map to array of objects for serialization
      return Array.from(pendingChanges.entries()).map(([directoryId, changes]) => ({
        directoryId,
        changes: changes.changes,
        lastDetected: changes.lastDetected,
      }));
    } catch (error) {
      console.error('[getPendingChanges] Failed:', error);
      return [];
    }
  });

  // Handler for clearing pending changes for a directory
  ipcMain.handle(FileSystemAPIEvent.CLEAR_PENDING_CHANGES, async (event, directoryId) => {
    try {
      syncService.clearPendingChanges(directoryId);
      return { success: true };
    } catch (error) {
      console.error('[clearPendingChanges] Failed:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Helper function for recursive directory copy
  async function copyDir(source: string, target: string): Promise<void> {
    await fsPromises.mkdir(target, { recursive: true });
    const entries = await fsPromises.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const targetPath = path.join(target, entry.name);

      if (entry.isDirectory()) {
        await copyDir(sourcePath, targetPath);
      } else {
        await fsPromises.copyFile(sourcePath, targetPath);
      }
    }
  }

  // Recent repositories handlers
  const recentReposService = new RecentReposService();

  ipcMain.handle(RecentReposAPIEvent.GET_RECENT_REPOS, async () => {
    try {
      const repos = recentReposService.getRecentRepos();
      return repos;
    } catch (error) {
      console.error('[getRecentRepos] Failed:', error);
      return [];
    }
  });

  ipcMain.handle(RecentReposAPIEvent.ADD_RECENT_REPO, async (event, repo) => {
    try {
      recentReposService.addRecentRepo(repo);
      return { success: true };
    } catch (error) {
      console.error('[addRecentRepo] Failed:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle(RecentReposAPIEvent.REMOVE_RECENT_REPO, async (event, { owner, repo }) => {
    try {
      recentReposService.removeRecentRepo(owner, repo);
      return { success: true };
    } catch (error) {
      console.error('[removeRecentRepo] Failed:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle(RecentReposAPIEvent.CLEAR_RECENT_REPOS, async () => {
    try {
      recentReposService.clearRecentRepos();
      return { success: true };
    } catch (error) {
      console.error('[clearRecentRepos] Failed:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  console.log('[File System] Global IPC handlers registered.');
}
