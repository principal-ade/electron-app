/**
 * Repository Monitoring Server - Main coordinator
 * Milestone 1: Basic structure with FileTree building
 * Enhanced with Git FSMonitor-based watching
 * Enhanced with @principal-ai/repository-monitoring library for git state events
 */

import type { FileTree } from '@principal-ai/repository-abstraction';
import type { PackageLayer } from '@principal-ai/codebase-composition';
import { FileTreeBuilder } from './FileTreeBuilder';
import { PackageProcessor } from './PackageProcessor';
import { GitCore } from '../shared/repository-core/GitCore';
import { FSWatcher, watch } from 'chokidar';
import * as nodePath from 'path';
import type { RepositoryState, CachedFileTree, GitStatusMetadata, PackageSummary, GitStateEventPayload } from './types';
import { MonitoringInternalEvent } from './types';
import { GitWatcherAdapter } from './GitWatcherAdapter';
import { FileSystemCore } from '../shared/repository-core/FileSystemCore';

export class RepositoryMonitoringServer {
  private repositories: Map<string, RepositoryState> = new Map();
  private fileTreeCache: Map<string, CachedFileTree> = new Map();
  private fileTreeBuilder: FileTreeBuilder;
  private packageProcessor: PackageProcessor;
  private gitWatchers: Map<string, FSWatcher> = new Map();
  private fsMonitorStatus: Map<string, boolean> = new Map();
  private packageCache: Map<string, { packages: PackageLayer[]; summary: PackageSummary; timestamp: number }> = new Map();
  private gitWatcherAdapter: GitWatcherAdapter;
  private watcherRestartTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.fileTreeBuilder = new FileTreeBuilder();
    this.packageProcessor = new PackageProcessor();

    // Initialize git watcher adapter
    this.gitWatcherAdapter = new GitWatcherAdapter(this, {
      debounceMs: parseInt(process.env.GIT_WATCHER_DEBOUNCE_MS || '500', 10),
    });

    // Subscribe to git state events from the library
    this.gitWatcherAdapter.on(MonitoringInternalEvent.GIT_STATE_EVENT, (payload: GitStateEventPayload) => {
      this.handleGitStateEvent(payload);
    });
  }

  /**
   * Register a repository for monitoring
   */
  async registerRepository(path: string): Promise<void> {
    if (!this.repositories.has(path)) {
      const state: RepositoryState = {
        path,
        lastUpdated: new Date(),
        isWatching: false,
      };

      try {
        const lastCommit = await GitCore.getMostRecentCommitTimestamp(path);
        if (lastCommit) {
          state.lastLocalChange = lastCommit;
        }
      } catch (error) {
        console.warn(`[RepositoryMonitoring] Could not determine initial commit time for ${path}:`, error);
      }

      this.repositories.set(path, state);
    }
  }

  /**
   * Unregister a repository
   */
  async unregisterRepository(path: string): Promise<void> {
    this.repositories.delete(path);
    this.fileTreeCache.delete(path);
  }

  /**
   * Get or build FileTree for a repository
   */
  async getFileTree(path: string): Promise<FileTree | null> {
    // Check cache first
    const cached = this.fileTreeCache.get(path);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 min cache
      return cached.tree;
    }

    // Build new FileTree
    try {
      const fileTree = await this.fileTreeBuilder.buildFileTree(path);

      // Cache it
      this.fileTreeCache.set(path, {
        tree: fileTree,
        timestamp: Date.now(),
        sha: fileTree.sha,
      });

      // Update repository state
      const state = this.repositories.get(path);
      if (state) {
        state.lastUpdated = new Date();
        state.fileTree = fileTree;
      }

      return fileTree;
    } catch (error) {
      console.error(`[RepositoryMonitoring] Failed to build FileTree for ${path}:`, error);
      return null;
    }
  }

  /**
   * Get packages from a repository
   */
  async getPackages(repoPath: string): Promise<{ packages: PackageLayer[]; summary: PackageSummary } | null> {
    // Check cache first
    const cached = this.packageCache.get(repoPath);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 min cache
      return { packages: cached.packages, summary: cached.summary };
    }

    // Get or build FileTree first
    const fileTree = await this.getFileTree(repoPath);
    if (!fileTree) {
      console.error(`[RepositoryMonitoring] Failed to get FileTree for packages in ${repoPath}`);
      return null;
    }

    try {
      // Extract packages using PackageProcessor
      const packages = await this.packageProcessor.extractPackages(fileTree, repoPath);

      // Generate summary
      const summary = await this.packageProcessor.getPackageSummary(packages);

      // Cache the results
      this.packageCache.set(repoPath, {
        packages,
        summary,
        timestamp: Date.now(),
      });

      return { packages, summary };
    } catch (error) {
      console.error(`[RepositoryMonitoring] Failed to extract packages for ${repoPath}:`, error);
      return null;
    }
  }

  /**
   * Refresh repository data (clear cache)
   */
  async refreshRepository(path: string): Promise<void> {
    this.fileTreeCache.delete(path);
    this.packageCache.delete(path);
    await this.getFileTree(path);
  }

  /**
   * Get git status for a repository
   */
  async getGitStatus(repoPath: string): Promise<GitStatusMetadata> {
    console.log(`[RepositoryMonitoring] getGitStatus called for ${repoPath}`);
    try {
      const state = this.repositories.get(repoPath);

      if (state && !state.lastLocalChange) {
        const initialCommit = await GitCore.getMostRecentCommitTimestamp(repoPath);
        if (initialCommit) {
          state.lastLocalChange = initialCommit;
        }
      }

      const detailedStatus = await GitCore.getDetailedStatus(repoPath);

      const status: GitStatusMetadata = {
        repoPath,
        branch: detailedStatus.branch,
        isDirty: detailedStatus.isDirty,
        hasUntracked: detailedStatus.hasUntracked,
        hasStaged: detailedStatus.hasStaged,
        ahead: detailedStatus.ahead,
        behind: detailedStatus.behind,
        watchingEnabled: state?.gitWatchingEnabled || false,
        lastChangedAt: state?.lastLocalChange || state?.lastGitStatus?.lastChangedAt,
      };

      // Cache the status
      if (state) {
        state.lastGitStatus = status;
      }

      return status;
    } catch (error) {
      console.error(`[RepositoryMonitoring] Failed to get git status for ${repoPath}:`, error);
      const state = this.repositories.get(repoPath);
      return {
        repoPath,
        branch: 'unknown',
        isDirty: false,
        hasUntracked: false,
        hasStaged: false,
        ahead: 0,
        behind: 0,
        watchingEnabled: false,
        lastChangedAt: state?.lastLocalChange,
      };
    }
  }

  /**
   * Get git status with file lists
   */
  async getGitStatusWithFiles(repoPath: string): Promise<any> {
    console.log(`[RepositoryMonitoring] getGitStatusWithFiles called for ${repoPath}`);
    try {
      const state = this.repositories.get(repoPath);

      if (state && !state.lastLocalChange) {
        const initialCommit = await GitCore.getMostRecentCommitTimestamp(repoPath);
        if (initialCommit) {
          state.lastLocalChange = initialCommit;
        }
      }

      // Get all status information in a single call - detailedStatus now includes files
      const detailedStatus = await GitCore.getDetailedStatus(repoPath);

      // Use the file status from detailedStatus to avoid duplicate git calls
      const fileStatus = detailedStatus.files || { staged: [], unstaged: [], untracked: [], deleted: [] };

      // Build the complete status object
      return {
        repoPath,
        branch: detailedStatus.branch,
        isDirty: detailedStatus.isDirty,
        hasUntracked: detailedStatus.hasUntracked,
        hasStaged: detailedStatus.hasStaged,
        ahead: detailedStatus.ahead,
        behind: detailedStatus.behind,
        watchingEnabled: state?.gitWatchingEnabled || false,
        lastChangedAt: state?.lastLocalChange || state?.lastGitStatus?.lastChangedAt,
        modifiedFiles: fileStatus.unstaged?.map(f => f.path) || [],
        untrackedFiles: fileStatus.untracked?.map(f => f.path) || [],
        stagedFiles: fileStatus.staged?.map(f => f.path) || [],
        // For now, treat untracked files as created (new files)
        createdFiles: fileStatus.untracked?.map(f => f.path) || [],
        // Now properly returning deleted files from git status
        deletedFiles: fileStatus.deleted?.map(f => f.path) || [],
      };
    } catch (error) {
      console.error(`[RepositoryMonitoring] Failed to get git status with files for ${repoPath}:`, error);
      const state = this.repositories.get(repoPath);
      return {
        repoPath,
        branch: 'unknown',
        isDirty: false,
        hasUntracked: false,
        hasStaged: false,
        ahead: 0,
        behind: 0,
        watchingEnabled: false,
        lastChangedAt: state?.lastLocalChange,
        modifiedFiles: [],
        untrackedFiles: [],
        stagedFiles: [],
        createdFiles: [],
        deletedFiles: [],
      };
    }
  }

  /**
   * Enable git watching for a repository
   */
  async enableGitWatching(repoPath: string): Promise<void> {
    const state = this.repositories.get(repoPath);
    if (!state) {
      throw new Error(`Repository ${repoPath} not registered`);
    }

    if (state.gitWatchingEnabled) {
      return;
    }

    try {
      // Start library-based git state event watching
      console.log(`[RepositoryMonitoring] Starting git state event watching for ${repoPath}`);
      await this.gitWatcherAdapter.startWatching(repoPath);

      // Set up file watching for source file changes
      // Try to enable FSMonitor first
      const fsMonitorEnabled = await GitCore.enableFSMonitor(repoPath);
      this.fsMonitorStatus.set(repoPath, fsMonitorEnabled);

      // Set up file watching based on FSMonitor availability
      if (fsMonitorEnabled) {
        try {
          await this.setupMinimalGitWatching(repoPath);
          state.watchingMode = 'minimal';
        } catch (error) {
          console.warn(`[RepositoryMonitoring] Minimal watcher setup failed for ${repoPath}, falling back:`, error);
          await this.setupFallbackGitWatching(repoPath);
          state.watchingMode = 'fallback';
          state.fsMonitorEnabled = false;
        }
      } else {
        // Fallback to more comprehensive watching
        await this.setupFallbackGitWatching(repoPath);
        state.watchingMode = 'fallback';
      }

      state.gitWatchingEnabled = true;
      state.fsMonitorEnabled = fsMonitorEnabled;

      // Do initial status check
      await this.getGitStatus(repoPath);
    } catch (error) {
      console.error(`[RepositoryMonitoring] Failed to enable git watching for ${repoPath}:`, error);
      throw error;
    }
  }

  /**
   * Disable git watching for a repository
   */
  async disableGitWatching(repoPath: string): Promise<void> {
    const state = this.repositories.get(repoPath);
    if (state) {
      state.gitWatchingEnabled = false;
      state.isWatching = false;
    }

    // Stop library-based watching
    await this.gitWatcherAdapter.stopWatching(repoPath);

    // Clean up watcher
    await this.disposeWatcher(repoPath);

    // Clear any pending debounce timers
    this.clearWatcherRestart(repoPath);
  }

  /**
   * Setup minimal git watching (when FSMonitor is enabled)
   * FSMonitor makes git status fast, but we still need to detect working dir changes
   */
  private async setupMinimalGitWatching(repoPath: string): Promise<void> {
    let ignoreGlobs: string[] = [];
    try {
      ignoreGlobs = await FileSystemCore.getWatchIgnoreGlobs(repoPath);
    } catch (error) {
      console.warn(`[RepositoryMonitoring] Failed to load watch ignore globs for ${repoPath}:`, error);
    }

    let watcher: FSWatcher;
    try {
      watcher = watch(repoPath, {
        ignoreInitial: true,
        persistent: true,
        ignored: FileSystemCore.createWatchIgnorePredicate(repoPath, ignoreGlobs),
        ignorePermissionErrors: true,
        awaitWriteFinish: {
          stabilityThreshold: 300,
          pollInterval: 100,
        },
      });
    } catch (error) {
      console.error(`[RepositoryMonitoring] Failed to initialize minimal watcher for ${repoPath}:`, error);
      throw error;
    }

    this.registerWatcher(repoPath, watcher);
  }

  /**
   * Setup fallback git watching (when FSMonitor is not available)
   */
  private async setupFallbackGitWatching(repoPath: string): Promise<void> {
    let ignoreGlobs: string[] = [];
    try {
      ignoreGlobs = await FileSystemCore.getWatchIgnoreGlobs(repoPath);
    } catch (error) {
      console.warn(`[RepositoryMonitoring] Failed to load watch ignore globs for ${repoPath}:`, error);
    }

    let watcher: FSWatcher;
    try {
      watcher = watch(repoPath, {
        ignoreInitial: true,
        persistent: true,
        ignored: FileSystemCore.createWatchIgnorePredicate(repoPath, ignoreGlobs),
        ignorePermissionErrors: true,
        awaitWriteFinish: {
          stabilityThreshold: 500,
          pollInterval: 100,
        },
      });
    } catch (error) {
      console.error(`[RepositoryMonitoring] Failed to initialize fallback watcher for ${repoPath}:`, error);
      throw error;
    }

    this.registerWatcher(repoPath, watcher);
  }

  /**
   * Handle file system changes for cache invalidation only
   * Git status updates are handled by the library watcher
   */
  private handleFileChange(repoPath: string, filePath: string, event: string): void {
    // Clear caches that depend on file contents
    this.fileTreeCache.delete(repoPath);
    this.packageCache.delete(repoPath);

    const gitignorePath = nodePath.join(repoPath, '.gitignore');
    if (nodePath.resolve(filePath) === nodePath.resolve(gitignorePath)) {
      this.scheduleWatcherRestart(repoPath, '.gitignore changed');
    }

    // Note: We don't trigger git status here anymore
    // The library watcher handles all git state changes
    console.log(`[RepositoryMonitoring] File change detected in ${repoPath}, caches cleared`);
  }

  private registerWatcher(repoPath: string, watcher: FSWatcher): void {
    watcher.on('all', (event, filePath) => {
      this.handleFileChange(repoPath, filePath, event);
    });

    watcher.on('error', (error) => {
      if (this.isIgnorableWatcherError(repoPath, error)) {
        return;
      }

      console.error(`[RepositoryMonitoring] Watcher error for ${repoPath}:`, error);
      this.scheduleWatcherRestart(repoPath, 'watcher error');
    });

    watcher.on('ready', () => {
      const state = this.repositories.get(repoPath);
      if (state) {
        state.isWatching = true;
      }
    });

    watcher.on('close', () => {
      const state = this.repositories.get(repoPath);
      if (state) {
        state.isWatching = false;
      }
    });

    this.gitWatchers.set(repoPath, watcher);
  }

  private async disposeWatcher(repoPath: string): Promise<void> {
    const watcher = this.gitWatchers.get(repoPath);
    if (watcher) {
      try {
        await watcher.close();
      } catch (error) {
        console.warn(`[RepositoryMonitoring] Error closing watcher for ${repoPath}:`, error);
      }
      this.gitWatchers.delete(repoPath);
    }
  }

  private clearWatcherRestart(repoPath: string): void {
    const timer = this.watcherRestartTimers.get(repoPath);
    if (timer) {
      clearTimeout(timer);
      this.watcherRestartTimers.delete(repoPath);
    }
  }

  private scheduleWatcherRestart(repoPath: string, reason: string): void {
    const state = this.repositories.get(repoPath);
    if (!state?.gitWatchingEnabled) {
      return;
    }

    this.clearWatcherRestart(repoPath);

    const timer = setTimeout(() => {
      this.watcherRestartTimers.delete(repoPath);
      this.restartWatcher(repoPath, reason).catch((error) => {
        console.error(`[RepositoryMonitoring] Failed to restart watcher for ${repoPath}:`, error);
      });
    }, 300);

    this.watcherRestartTimers.set(repoPath, timer);
  }

  private async restartWatcher(repoPath: string, reason: string): Promise<void> {
    console.log(`[RepositoryMonitoring] Restarting watcher for ${repoPath} (${reason})`);
    const state = this.repositories.get(repoPath);
    if (!state || !state.gitWatchingEnabled) {
      return;
    }

    await this.disposeWatcher(repoPath);

    try {
      if (state.watchingMode === 'minimal' && state.fsMonitorEnabled) {
        await this.setupMinimalGitWatching(repoPath);
        state.watchingMode = 'minimal';
      } else {
        await this.setupFallbackGitWatching(repoPath);
        state.watchingMode = 'fallback';
      }
    } catch (error) {
      console.error(`[RepositoryMonitoring] Watcher restart failed for ${repoPath}:`, error);
      if (state.watchingMode === 'minimal') {
        console.warn(`[RepositoryMonitoring] Falling back to comprehensive watcher for ${repoPath}`);
        state.watchingMode = 'fallback';
        state.fsMonitorEnabled = false;
        await this.setupFallbackGitWatching(repoPath);
      } else {
        throw error;
      }
    }
  }

  private isIgnorableWatcherError(repoPath: string, error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const err = error as NodeJS.ErrnoException & { filename?: string };
    if (err.code !== 'UNKNOWN') {
      return false;
    }

    const targetPath = err.path || err.filename;
    if (!targetPath) {
      return false;
    }

    const normalize = (value: string) => value.split(nodePath.sep).join('/');
    const expected = normalize(nodePath.resolve(repoPath, '.git', 'fsmonitor--daemon.ipc'));
    const actual = normalize(targetPath);

    if (actual === expected) {
      console.warn(`[RepositoryMonitoring] Ignoring watcher error for fsmonitor socket in ${repoPath}`);
      return true;
    }

    return false;
  }


  /**
   * Handle git state events from the library-based watcher
   * These are specific state transitions (commit, branch-switch, merge, etc.)
   */
  private async handleGitStateEvent(payload: GitStateEventPayload): Promise<void> {
    const { event, affectedCacheFields } = payload;

    console.log(`[RepositoryMonitoring] Git state event received:`, {
      type: event.type,
      repo: event.repoPath,
      branch: event.branch,
      sha: event.shortSha,
      affectedFields: affectedCacheFields,
    });

    // Clear affected caches based on event type
    if (affectedCacheFields.includes('fileTree')) {
      this.fileTreeCache.delete(event.repoPath);
    }
    if (affectedCacheFields.includes('packages')) {
      this.packageCache.delete(event.repoPath);
    }

    // Update repository state with latest info
    const state = this.repositories.get(event.repoPath);
    if (state) {
      state.lastLocalChange = new Date(event.timestamp).toISOString();
    }

    // Forward the git state event to main process
    if (process.parentPort) {
      process.parentPort.postMessage({
        type: 'event',
        event: {
          name: MonitoringInternalEvent.GIT_STATE_EVENT,
          data: payload,
        },
      });
    }

    // Also trigger a status update if needed for compatibility
    if (affectedCacheFields.includes('gitStatus')) {
      const status = await this.getGitStatus(event.repoPath);
      if (process.parentPort) {
        process.parentPort.postMessage({
          type: 'event',
          event: {
            name: MonitoringInternalEvent.GIT_STATUS_CHANGED,
            data: status,
          },
        });
      }
    }
  }

}