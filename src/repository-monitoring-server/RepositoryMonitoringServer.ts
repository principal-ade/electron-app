/**
 * Repository Monitoring Server - Main coordinator
 * Milestone 1: Basic structure with FileTree building
 * Enhanced with Git FSMonitor-based watching
 * Enhanced with @principal-ai/repository-monitoring library for git state events
 */

/// <reference path="./global.d.ts" />

import type { FileTree } from '@principal-ai/repository-abstraction';
import type { PackageLayer } from '@principal-ai/codebase-composition';
import { FileTreeBuilder } from './FileTreeBuilder';
import { PackageProcessor } from './PackageProcessor';
import { GitCore } from '../shared/repository-core/GitCore';
import { RepositoryCacheRegistry, type CacheUpdatedEvent } from './cache/RepositoryCacheRegistry';
import type {
  RepositoryState,
  CachedFileTree,
  GitStatusMetadata,
  GitStatusWithFiles,
  GitRemoteInfo,
  PackageSummary,
  GitStateEventPayload,
  WorkspaceChangeEventPayload,
  DependencyResolutionRequest,
  DependencyResolutionResult,
  CacheSlice,
  CacheSliceDataMap,
  RepositoryCacheSnapshot,
  RepositoryCacheSyncEvent,
} from './types';
import { MonitoringInternalEvent } from './types';
import { GitWatcherAdapter } from './GitWatcherAdapter';
import { GitRemoteService } from './GitRemoteService';

export class RepositoryMonitoringServer {
  private repositories: Map<string, RepositoryState> = new Map();
  private fileTreeCache: Map<string, CachedFileTree> = new Map();
  private fileTreeBuilder: FileTreeBuilder;
  private packageProcessor: PackageProcessor;
  private packageCache: Map<string, { packages: PackageLayer[]; summary: PackageSummary; timestamp: number }> = new Map();
  private gitWatcherAdapter: GitWatcherAdapter;
  private gitStatusRefreshTimers: Map<string, NodeJS.Timeout> = new Map();
  private cacheRegistry: RepositoryCacheRegistry;
  private rebuildTimers: Map<string, Map<CacheSlice, NodeJS.Timeout>> = new Map();

  constructor() {
    this.fileTreeBuilder = new FileTreeBuilder();
    this.packageProcessor = new PackageProcessor();
    this.cacheRegistry = new RepositoryCacheRegistry();

    this.cacheRegistry.on('cacheUpdated', (event: CacheUpdatedEvent) => {
      this.handleCacheUpdated(event);
    });

    // Initialize git watcher adapter
    this.gitWatcherAdapter = new GitWatcherAdapter(this, {
      debounceMs: parseInt(process.env.GIT_WATCHER_DEBOUNCE_MS || '500', 10),
    });

    // Subscribe to git state events from the library
    this.gitWatcherAdapter.on(MonitoringInternalEvent.GIT_STATE_EVENT, (payload: GitStateEventPayload) => {
      this.handleGitStateEvent(payload);
    });

    this.gitWatcherAdapter.on(MonitoringInternalEvent.WORKSPACE_CHANGED, (event: WorkspaceChangeEventPayload) => {
      this.handleWorkspaceChangeEvent(event);
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
        gitWatchingEnabled: false,
        watchingMode: 'none',
        fsMonitorEnabled: false,
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

  private handleCacheUpdated(event: CacheUpdatedEvent): void {
    const payload: RepositoryCacheSyncEvent = {
      repoPath: event.repoPath,
      slice: event.slice,
      entry: event.entry,
    };

    const { repoPath, slice, entry } = payload;
    const state = this.repositories.get(repoPath);

    switch (slice) {
      case 'fileTree':
        if (entry.data) {
          const fileTreeData = entry.data as FileTree;
          this.fileTreeCache.set(repoPath, {
            tree: fileTreeData,
            timestamp: entry.timestamp,
            sha: fileTreeData.sha,
          });
          if (state) {
            state.fileTree = fileTreeData;
            state.lastUpdated = new Date(entry.timestamp);
          }
        } else {
          this.fileTreeCache.delete(repoPath);
          if (state) {
            delete state.fileTree;
          }
        }
        break;

      case 'packages':
        if (entry.data) {
          const packagesData = entry.data as { packages: PackageLayer[]; summary: PackageSummary };
          this.packageCache.set(repoPath, {
            packages: packagesData.packages,
            summary: packagesData.summary,
            timestamp: entry.timestamp,
          });
        } else {
          this.packageCache.delete(repoPath);
        }
        break;

      case 'gitStatus':
        if (state && entry.data) {
          const gitStatusData = entry.data as GitStatusWithFiles;
          state.lastGitStatus = this.toGitStatusMetadata(gitStatusData);
          if (gitStatusData.lastChangedAt) {
            state.lastLocalChange = gitStatusData.lastChangedAt;
          }
        }
        break;
    }

    if (process.parentPort) {
      process.parentPort.postMessage({
        type: 'event',
        event: {
          name: MonitoringInternalEvent.CACHE_SYNC,
          data: payload,
        },
      });
    }
  }

  private toGitStatusMetadata(status: GitStatusWithFiles): GitStatusMetadata {
    const { modifiedFiles: _modifiedFiles, untrackedFiles: _untrackedFiles, stagedFiles: _stagedFiles, createdFiles: _createdFiles, deletedFiles: _deletedFiles, ...metadata } = status;
    return metadata;
  }

  private getRebuildDelay(slice: CacheSlice): number {
    switch (slice) {
      case 'gitStatus':
        return 0;
      case 'packages':
        return 300;
      case 'fileTree':
      default:
        return 250;
    }
  }

  private scheduleCacheRebuild<K extends CacheSlice>(repoPath: string, slice: K, delay = this.getRebuildDelay(slice)): void {
    let repoTimers = this.rebuildTimers.get(repoPath);
    if (!repoTimers) {
      repoTimers = new Map();
      this.rebuildTimers.set(repoPath, repoTimers);
    }

    const existingTimer = repoTimers.get(slice);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      repoTimers?.delete(slice);
      void this.cacheRegistry
        .scheduleRebuild(repoPath, slice, () => this.buildCacheSlice(repoPath, slice))
        .catch(error => {
          console.error(
            `[RepositoryMonitoring] Failed to rebuild cache slice ${slice} for ${repoPath}:`,
            error,
          );
        });
    }, Math.max(0, delay));

    repoTimers.set(slice, timer);
  }

  private async buildCacheSlice<K extends CacheSlice>(
    repoPath: string,
    slice: K,
  ): Promise<CacheSliceDataMap[K]> {
    switch (slice) {
      case 'gitStatus':
        return (await this.buildGitStatusSlice(repoPath)) as CacheSliceDataMap[K];
      case 'fileTree':
        return (await this.buildFileTreeSlice(repoPath)) as CacheSliceDataMap[K];
      case 'packages':
        return (await this.buildPackagesSlice(repoPath)) as CacheSliceDataMap[K];
      case 'gitRemote':
        return (await this.buildGitRemoteSlice(repoPath)) as CacheSliceDataMap[K];
      default: {
        const exhaustive: never = slice;
        throw new Error(`Unsupported cache slice: ${exhaustive}`);
      }
    }
  }

  private async buildFileTreeSlice(repoPath: string) {
    const fileTree = await this.fileTreeBuilder.buildFileTree(repoPath);
    const state = this.repositories.get(repoPath);
    if (state) {
      state.lastUpdated = new Date();
      state.fileTree = fileTree;
    }
    return fileTree;
  }

  private async buildPackagesSlice(repoPath: string) {
    const fileTreeEntry = await this.cacheRegistry.getOrBuild(repoPath, 'fileTree', () =>
      this.buildFileTreeSlice(repoPath),
    );

    if (!fileTreeEntry.data) {
      throw new Error(`File tree unavailable for packages slice: ${repoPath}`);
    }

    const packages = await this.packageProcessor.extractPackages(fileTreeEntry.data, repoPath);
    const summary = await this.packageProcessor.getPackageSummary(packages);

    return { packages, summary };
  }

  private async buildGitStatusSlice(repoPath: string): Promise<GitStatusWithFiles> {
    const state = this.repositories.get(repoPath);

    if (state && !state.lastLocalChange) {
      const initialCommit = await GitCore.getMostRecentCommitTimestamp(repoPath);
      if (initialCommit) {
        state.lastLocalChange = initialCommit;
      }
    }

    const detailedStatus = await GitCore.getDetailedStatus(repoPath);
    const fileStatus = detailedStatus.files || { staged: [], unstaged: [], untracked: [], deleted: [] };

    const status: GitStatusWithFiles = {
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
      createdFiles: fileStatus.untracked?.map(f => f.path) || [],
      deletedFiles: fileStatus.deleted?.map(f => f.path) || [],
    };

    if (state) {
      state.lastGitStatus = this.toGitStatusMetadata(status);
    }

    return status;
  }

  private async buildGitRemoteSlice(repoPath: string): Promise<GitRemoteInfo> {
    console.info(`[RepositoryMonitoring] Building gitRemote cache for ${repoPath}`);

    try {
      const remoteInfo = await GitRemoteService.buildRemoteInfo(repoPath);

      console.info(`[RepositoryMonitoring] gitRemote cache built for ${repoPath}`, {
        accessible: remoteInfo.accessible,
        defaultBranch: remoteInfo.defaultBranch,
        branchCount: remoteInfo.remoteBranches.length,
      });

      return remoteInfo;
    } catch (error) {
      console.error(`[RepositoryMonitoring] Failed to build gitRemote cache for ${repoPath}:`, error);

      // Return fallback with just remote URL
      const remoteUrl = await GitCore.getRemoteUrl(repoPath).catch(() => null);
      return {
        remoteUrl: remoteUrl || '',
        remoteBranches: [],
        accessible: false,
        lastFetched: Date.now(),
        fetchError: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private createFallbackGitStatus(repoPath: string): GitStatusMetadata {
    const state = this.repositories.get(repoPath);
    return {
      repoPath,
      branch: 'unknown',
      isDirty: false,
      hasUntracked: false,
      hasStaged: false,
      ahead: 0,
      behind: 0,
      watchingEnabled: state?.gitWatchingEnabled || false,
      lastChangedAt: state?.lastLocalChange,
    };
  }

  private createFallbackGitStatusWithFiles(repoPath: string): GitStatusWithFiles {
    const base = this.createFallbackGitStatus(repoPath);
    return {
      ...base,
      modifiedFiles: [],
      untrackedFiles: [],
      stagedFiles: [],
      createdFiles: [],
      deletedFiles: [],
    };
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
      const entry = await this.cacheRegistry.getOrBuild(path, 'fileTree', () => this.buildFileTreeSlice(path));
      if (entry.data) {
        this.fileTreeCache.set(path, {
          tree: entry.data,
          timestamp: entry.timestamp,
          sha: entry.data.sha,
        });
        return entry.data;
      }

      return cached?.tree ?? null;
    } catch (error) {
      console.error(`[RepositoryMonitoring] Failed to build FileTree for ${path}:`, error);
      return cached?.tree ?? null;
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

    try {
      const entry = await this.cacheRegistry.getOrBuild(repoPath, 'packages', () =>
        this.buildPackagesSlice(repoPath),
      );

      if (entry.data) {
        this.packageCache.set(repoPath, {
          packages: entry.data.packages,
          summary: entry.data.summary,
          timestamp: entry.timestamp,
        });
        return entry.data;
      }

      return cached ? { packages: cached.packages, summary: cached.summary } : null;
    } catch (error) {
      console.error(`[RepositoryMonitoring] Failed to extract packages for ${repoPath}:`, error);
      return cached ? { packages: cached.packages, summary: cached.summary } : null;
    }
  }

  async getRepositoryCacheSnapshot(repoPath: string): Promise<RepositoryCacheSnapshot> {
    await Promise.all([
      this.cacheRegistry
        .getOrBuild(repoPath, 'gitStatus', () => this.buildGitStatusSlice(repoPath))
        .catch(error => {
          console.error(`[RepositoryMonitoring] Failed to warm git status slice for ${repoPath}:`, error);
        }),
      this.cacheRegistry
        .getOrBuild(repoPath, 'fileTree', () => this.buildFileTreeSlice(repoPath))
        .catch(error => {
          console.error(`[RepositoryMonitoring] Failed to warm file tree slice for ${repoPath}:`, error);
        }),
      this.cacheRegistry
        .getOrBuild(repoPath, 'packages', () => this.buildPackagesSlice(repoPath))
        .catch(error => {
          console.error(`[RepositoryMonitoring] Failed to warm packages slice for ${repoPath}:`, error);
        }),
    ]);

    return this.cacheRegistry.getSnapshot(repoPath);
  }

  /**
   * Refresh repository data (clear cache and trigger git status update)
   */
  async refreshRepository(path: string): Promise<void> {
    this.fileTreeCache.delete(path);
    this.packageCache.delete(path);
    await Promise.all([
      this.cacheRegistry
        .scheduleRebuild(path, 'fileTree', () => this.buildCacheSlice(path, 'fileTree'))
        .catch(error => {
          console.error(`[RepositoryMonitoring] Failed to rebuild file tree during refresh for ${path}:`, error);
        }),
      this.cacheRegistry
        .scheduleRebuild(path, 'packages', () => this.buildCacheSlice(path, 'packages'))
        .catch(error => {
          console.error(`[RepositoryMonitoring] Failed to rebuild packages during refresh for ${path}:`, error);
        }),
      this.cacheRegistry
        .scheduleRebuild(path, 'gitStatus', () => this.buildCacheSlice(path, 'gitStatus'))
        .catch(error => {
          console.error(`[RepositoryMonitoring] Failed to rebuild git status during refresh for ${path}:`, error);
        }),
    ]);

    // Also fetch fresh git status to update ahead/behind indicators
    try {
      const gitStatus = await this.getGitStatus(path);
      // Notify adapter about git status change
      this.gitWatcherAdapter.emit(MonitoringInternalEvent.GIT_STATUS_CHANGED, gitStatus);
    } catch (error) {
      console.error(`[RepositoryMonitoring] Failed to refresh git status for ${path}:`, error);
    }
  }

  /**
   * Get git status for a repository
   */
  async getGitStatus(repoPath: string): Promise<GitStatusMetadata> {
    console.info(`[RepositoryMonitoring] getGitStatus called for ${repoPath}`);
    try {
      const entry = await this.cacheRegistry.getOrBuild(repoPath, 'gitStatus', () =>
        this.buildGitStatusSlice(repoPath),
      );

      if (entry.data) {
        const metadata = this.toGitStatusMetadata(entry.data);
        const state = this.repositories.get(repoPath);
        if (state) {
          state.lastGitStatus = metadata;
        }
        return metadata;
      }

      return this.createFallbackGitStatus(repoPath);
    } catch (error) {
      console.error(`[RepositoryMonitoring] Failed to get git status for ${repoPath}:`, error);
      return this.createFallbackGitStatus(repoPath);
    }
  }

  /**
   * Get git status with file lists
   */
  async getGitStatusWithFiles(repoPath: string): Promise<GitStatusWithFiles> {
    console.info(`[RepositoryMonitoring] getGitStatusWithFiles called for ${repoPath}`);
    try {
      const entry = await this.cacheRegistry.getOrBuild(repoPath, 'gitStatus', () =>
        this.buildGitStatusSlice(repoPath),
      );

      if (entry.data) {
        return entry.data;
      }

      return this.createFallbackGitStatusWithFiles(repoPath);
    } catch (error) {
      console.error(`[RepositoryMonitoring] Failed to get git status with files for ${repoPath}:`, error);
      return this.createFallbackGitStatusWithFiles(repoPath);
    }
  }

  /**
   * Get git remote information for a repository
   */
  async getGitRemoteInfo(repoPath: string): Promise<GitRemoteInfo | null> {
    console.info(`[RepositoryMonitoring] getGitRemoteInfo called for ${repoPath}`);
    try {
      const entry = await this.cacheRegistry.getOrBuild(repoPath, 'gitRemote', () =>
        this.buildGitRemoteSlice(repoPath),
      );

      if (entry.data) {
        return entry.data;
      }

      return null;
    } catch (error) {
      console.error(`[RepositoryMonitoring] Failed to get git remote info for ${repoPath}:`, error);
      return null;
    }
  }

  /**
   * Invalidate git remote cache for a repository
   * This will force a fresh fetch on next access
   */
  async invalidateGitRemoteCache(repoPath: string): Promise<void> {
    console.info(`[RepositoryMonitoring] Invalidating gitRemote cache for ${repoPath}`);
    this.cacheRegistry.invalidate(repoPath, 'gitRemote');

    // Trigger background rebuild
    await this.cacheRegistry.scheduleRebuild(
      repoPath,
      'gitRemote',
      () => this.buildGitRemoteSlice(repoPath)
    ).catch(error => {
      console.error(`[RepositoryMonitoring] Failed to rebuild gitRemote cache for ${repoPath}:`, error);
    });
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
      // Attempt to enable fsmonitor for improved performance information
      const fsMonitorEnabled = await GitCore.enableFSMonitor(repoPath);
      state.fsMonitorEnabled = fsMonitorEnabled;
      const workspaceMode: 'minimal' | 'fallback' = fsMonitorEnabled ? 'minimal' : 'fallback';
      state.watchingMode = workspaceMode;

      // Start library-based git state and workspace event watching
      console.info(`[RepositoryMonitoring] Starting git state event watching for ${repoPath}`);
      await this.gitWatcherAdapter.startWatching(repoPath, workspaceMode);
      state.gitWatchingEnabled = true;
      state.isWatching = true;

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
      state.fsMonitorEnabled = false;
      state.watchingMode = 'none';
    }

    // Stop library-based watching
    await this.gitWatcherAdapter.stopWatching(repoPath);

    const refreshTimer = this.gitStatusRefreshTimers.get(repoPath);
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      this.gitStatusRefreshTimers.delete(repoPath);
    }
  }

  private handleWorkspaceChangeEvent(event: WorkspaceChangeEventPayload): void {
    const { repoPath, state: gitState } = event;

    this.fileTreeCache.delete(repoPath);
    this.packageCache.delete(repoPath);

    this.scheduleCacheRebuild(repoPath, 'fileTree');
    this.scheduleCacheRebuild(repoPath, 'packages');

    const state = this.repositories.get(repoPath);
    if (state) {
      state.lastUpdated = new Date();
      if (gitState?.lastCommitTime) {
        state.lastLocalChange = new Date(gitState.lastCommitTime).toISOString();
      }
      if (gitState?.timestamp) {
        state.lastLocalChange = new Date(gitState.timestamp).toISOString();
      }
    }

    if (process.parentPort) {
      process.parentPort.postMessage({
        type: 'event',
        event: {
          name: MonitoringInternalEvent.WORKSPACE_CHANGED,
          data: event,
        },
      });
    }

    const delay = state?.watchingMode === 'minimal' ? 300 : 500;
    this.scheduleGitStatusRefresh(repoPath, delay);
  }

  private scheduleGitStatusRefresh(repoPath: string, delay: number): void {
    const state = this.repositories.get(repoPath);
    if (!state?.gitWatchingEnabled) {
      return;
    }

    const existingTimer = this.gitStatusRefreshTimers.get(repoPath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      this.gitStatusRefreshTimers.delete(repoPath);
      try {
        // Rebuild git status in cache - this will emit CACHE_SYNC event
        // Use buildGitStatusSlice directly to force a fresh build instead of using cached data
        await this.cacheRegistry.scheduleRebuild(repoPath, 'gitStatus', async () => {
          return await this.buildGitStatusSlice(repoPath);
        });

        if (process.parentPort) {
          const status = this.cacheRegistry.get(repoPath, 'gitStatus');
          process.parentPort.postMessage({
            type: 'event',
            event: {
              name: MonitoringInternalEvent.GIT_STATUS_CHANGED,
              data: status?.data,
            },
          });
        }
      } catch (error) {
        console.error(`[RepositoryMonitoring] Failed to refresh git status after workspace change for ${repoPath}:`, error);
      }
    }, delay);

    this.gitStatusRefreshTimers.set(repoPath, timer);
  }

  /**
   * Handle git state events from the library-based watcher
   * These are specific state transitions (commit, branch-switch, merge, etc.)
   */
  private async handleGitStateEvent(payload: GitStateEventPayload): Promise<void> {
    const { event, affectedCacheFields } = payload;

    console.info(`[RepositoryMonitoring] Git state event received:`, {
      type: event.type,
      repo: event.repoPath,
      branch: event.branch,
      sha: event.shortSha,
      affectedFields: affectedCacheFields,
    });

    // Clear affected caches based on event type
    if (affectedCacheFields.includes('fileTree')) {
      this.fileTreeCache.delete(event.repoPath);
      this.scheduleCacheRebuild(event.repoPath, 'fileTree');
    }
    if (affectedCacheFields.includes('packages')) {
      this.packageCache.delete(event.repoPath);
      this.scheduleCacheRebuild(event.repoPath, 'packages');
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
      this.scheduleCacheRebuild(event.repoPath, 'gitStatus');
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

  /**
   * Resolve dependency information by checking registered repositories
   * Returns AlexandriaEntry-like information if the dependency is found as a registered repository
   */
  async resolveDependency(request: DependencyResolutionRequest): Promise<DependencyResolutionResult> {
    const { dependencyId, repositoryRoot } = request;
    
    console.info(`[RepositoryMonitoring] Resolving dependency: ${dependencyId}`);

    const result: DependencyResolutionResult = {
      dependencyId,
      found: false,
    };

    try {
      // First, check if the dependency exists in the current repository (if provided)
      if (repositoryRoot && this.repositories.has(repositoryRoot)) {
        const packageInfo = await this.checkDependencyInRepository(dependencyId, repositoryRoot);
        if (packageInfo) {
          result.found = true;
          result.packageInfo = packageInfo;
          
          // Generate installation suggestions based on package structure
          const suggestions = await this.generateInstallationSuggestions(dependencyId, repositoryRoot);
          if (suggestions) {
            result.suggestions = suggestions;
          }
        }
      }

      // Check if the dependency matches any registered repository by name
      const matchingRepo = await this.findRepositoryByDependencyId(dependencyId);
      if (matchingRepo) {
        result.found = true;
        result.alexandriaEntry = matchingRepo;
      }

      console.info(`[RepositoryMonitoring] Dependency resolution result:`, {
        dependencyId,
        found: result.found,
        hasPackageInfo: !!result.packageInfo,
        hasAlexandriaEntry: !!result.alexandriaEntry,
        hasSuggestions: !!result.suggestions,
      });

      return result;
    } catch (error) {
      console.error(`[RepositoryMonitoring] Error resolving dependency ${dependencyId}:`, error);
      return result;
    }
  }

  /**
   * Check if a dependency exists in a specific repository's packages
   */
  private async checkDependencyInRepository(
    dependencyId: string, 
    repositoryPath: string
  ): Promise<DependencyResolutionResult['packageInfo'] | null> {
    try {
      const packagesResult = await this.getPackages(repositoryPath);
      if (!packagesResult) return null;

      // Search through all packages for the dependency
      for (const pkg of packagesResult.packages) {
        const { dependencies, devDependencies } = pkg.packageData;
        
        // Check regular dependencies
        if (dependencies && dependencies[dependencyId]) {
          return {
            name: dependencyId,
            version: dependencies[dependencyId],
            packagePath: pkg.packageData.path,
            isDevDependency: false,
          };
        }

        // Check dev dependencies
        if (devDependencies && devDependencies[dependencyId]) {
          return {
            name: dependencyId,
            version: devDependencies[dependencyId],
            packagePath: pkg.packageData.path,
            isDevDependency: true,
          };
        }
      }

      return null;
    } catch (error) {
      console.error(`[RepositoryMonitoring] Error checking dependency in repository:`, error);
      return null;
    }
  }

  /**
   * Find a registered repository that matches the dependency ID
   * This helps identify if the dependency is actually a local/internal package
   */
  private async findRepositoryByDependencyId(
    dependencyId: string
  ): Promise<DependencyResolutionResult['alexandriaEntry'] | null> {
    try {
      // Check all registered repositories
      for (const [repoPath, _state] of this.repositories.entries()) {
        // Get package information for this repository
        const packagesResult = await this.getPackages(repoPath);
        if (!packagesResult) continue;

        // Check if any package in this repo matches the dependency ID
        for (const pkg of packagesResult.packages) {
          if (pkg.packageData.name === dependencyId) {
            // Found a matching package! Create AlexandriaEntry-like info
            const gitInfo = await this.getBasicGitInfo(repoPath);
            
            return {
              name: pkg.packageData.name || dependencyId,
              path: repoPath,
              description: `Local package: ${dependencyId}`,
              remoteUrl: gitInfo?.remoteUrl,
              lastCommit: gitInfo?.lastCommit,
              lastCommitMessage: gitInfo?.lastCommitMessage,
              lastCommitAuthor: gitInfo?.lastCommitAuthor,
              lastCommitHash: gitInfo?.lastCommitHash,
            };
          }
        }

        // Also check if the repository name/folder matches the dependency
        const repoName = repoPath.split('/').pop() || '';
        if (repoName === dependencyId || repoName.includes(dependencyId)) {
          const gitInfo = await this.getBasicGitInfo(repoPath);
          
          return {
            name: repoName,
            path: repoPath,
            description: `Repository: ${repoName}`,
            remoteUrl: gitInfo?.remoteUrl,
            lastCommit: gitInfo?.lastCommit,
            lastCommitMessage: gitInfo?.lastCommitMessage,
            lastCommitAuthor: gitInfo?.lastCommitAuthor,
            lastCommitHash: gitInfo?.lastCommitHash,
          };
        }
      }

      return null;
    } catch (error) {
      console.error(`[RepositoryMonitoring] Error finding repository by dependency ID:`, error);
      return null;
    }
  }

  /**
   * Generate installation suggestions based on repository structure
   */
  private async generateInstallationSuggestions(
    dependencyId: string,
    repositoryPath: string
  ): Promise<DependencyResolutionResult['suggestions'] | null> {
    try {
      const packagesResult = await this.getPackages(repositoryPath);
      if (!packagesResult) return null;

      const { packages, summary } = packagesResult;
      
      // Determine package manager from available scripts
      let packageManager = 'npm'; // default
      if (summary.availableScripts.some(script => script.includes('yarn'))) {
        packageManager = 'yarn';
      } else if (summary.availableScripts.some(script => script.includes('pnpm'))) {
        packageManager = 'pnpm';
      }

      // Generate install commands
      const installCommands: string[] = [];
      
      if (summary.isMonorepo && packages.length > 1) {
        // For monorepos, suggest workspace-specific installation
        const workspacePackages = packages.filter(p => p.packageData.path !== '');
        
        if (workspacePackages.length > 0) {
          // Suggest the first workspace package as target
          const targetPackage = workspacePackages[0];
          installCommands.push(`${packageManager} add ${dependencyId} --workspace=${targetPackage.packageData.name || targetPackage.packageData.path}`);
        }
        
        // Also suggest root installation
        installCommands.push(`${packageManager} add ${dependencyId}`);
      } else {
        // Single package repository
        installCommands.push(`${packageManager} add ${dependencyId}`);
      }

      // Add dev dependency option
      installCommands.push(`${packageManager} add ${dependencyId} --save-dev`);

      return {
        installCommands,
        targetPackage: summary.isMonorepo ? packages.find(p => p.packageData.path !== '')?.packageData.name : undefined,
        packageManager,
      };
    } catch (error) {
      console.error(`[RepositoryMonitoring] Error generating installation suggestions:`, error);
      return null;
    }
  }

  /**
   * Get basic git information for a repository
   */
  private async getBasicGitInfo(repoPath: string): Promise<{
    remoteUrl?: string;
    lastCommit?: string;
    lastCommitMessage?: string;
    lastCommitAuthor?: string;
    lastCommitHash?: string;
  } | null> {
    try {
      // Get remote URL and commit details using GitCore static methods
      const [remoteUrl, commitDetails] = await Promise.all([
        GitCore.getRemoteUrl(repoPath),
        GitCore.getLastCommitDetails(repoPath),
      ]);

      return {
        remoteUrl: remoteUrl || undefined,
        lastCommit: commitDetails?.timestamp,
        lastCommitMessage: commitDetails?.message,
        lastCommitAuthor: commitDetails?.author,
        lastCommitHash: commitDetails?.hash,
      };
    } catch (error) {
      console.error(`[RepositoryMonitoring] Error getting git info for ${repoPath}:`, error);
      return null;
    }
  }

}