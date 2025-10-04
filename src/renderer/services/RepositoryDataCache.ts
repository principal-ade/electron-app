/**
 * RepositoryDataCache - Event-driven cache for repository data
 * Maintains a centralized cache of repository information that updates automatically via events
 */

import { EventEmitter } from 'events';
import type { EnhancedAlexandriaEntry } from '../../shared/types/repository.types';
import type { FileTree } from '@principal-ai/repository-abstraction';
import type { PackageLayer } from '@principal-ai/codebase-composition';
import type {
  GitStatusMetadata,
  GitStatusWithFiles,
  RepositoryCacheSyncEvent,
  CacheSlice,
  CacheEntry as RegistryCacheEntry,
  CacheSliceDataMap,
  PackageSummary,
} from '../../shared/main-process-api-interfaces/RepositoryMonitoringAPI';
import type { AlexandriaChangeEvent, AlexandriaEventType } from '../../shared/main-process-api-interfaces/AlexandriaAPI';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { AlexandriaService } from '../main-process-api/AlexandriaService';
import { GitService } from '../main-process-api/GitService';

/**
 * Cache entry metadata
 */
interface LocalCacheEntry<T> {
  data: T;
  timestamp: number;
  version: number;
  subscriptions: Set<string>; // Component IDs subscribed to this data
}

/**
 * Markdown file with metadata
 */
export interface MarkdownFile {
  path: string;
  lastModified?: string;
  size?: number;
}

/**
 * Quality metrics data structure
 */
export interface QualityMetrics {
  hexagon: {
    tests: number;
    deadCode: number;
    formatting: number;
    linting: number;
    types: number;
    documentation: number;
  };
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  availableTools: string[];
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Complete repository cache data
 */
export interface RepositoryCacheData {
  // Core repository data
  repository: EnhancedAlexandriaEntry;

  // Git information
  gitStatus: GitStatusWithFiles | null;
  gitBranch: string;
  branchStatus: {
    ahead: number;
    behind: number;
    upstream?: string;
    canFastForward?: boolean;
    needsUpstream?: boolean;
  };

  // File system data
  fileTree: FileTree | null;
  markdownFiles: MarkdownFile[];

  // Package and quality data
  packages: PackageLayer[];
  qualityMetrics: QualityMetrics | null;
  packageSummary: PackageSummary | null;

  // Metadata
  lastFullRefresh: number;
  partialUpdates: {
    git: number;
    files: number;
    packages: number;
    quality: number;
  };
  cacheSlices: RepositoryCacheSlicesState;
}

/**
 * Update types for partial cache updates
 */
type PartialCacheUpdate = Partial<RepositoryCacheData>;

type RepositoryCacheSlicesState = {
  gitStatus?: RegistryCacheEntry<CacheSliceDataMap['gitStatus']>;
  fileTree?: RegistryCacheEntry<CacheSliceDataMap['fileTree']>;
  packages?: RegistryCacheEntry<CacheSliceDataMap['packages']>;
};

/**
 * Cache update event
 */
interface CacheUpdateEvent {
  repoPath: string;
  fields: string[];
  data: PartialCacheUpdate;
}

/**
 * Batched update queue entry
 */
interface QueuedUpdate {
  fields: Set<string>;
  timestamp: number;
}

/**
 * Repository data cache with event-driven updates
 */
export class RepositoryDataCache extends EventEmitter {
  private static instance: RepositoryDataCache | null = null;
  private cache = new Map<string, LocalCacheEntry<RepositoryCacheData>>();
  private updateQueue = new Map<string, QueuedUpdate>();
  private flushTimer: NodeJS.Timeout | null = null;
  private flushInterval = 100; // Batch updates every 100ms
  private eventSubscriptions: (() => void)[] = [];
  private maxCacheAge = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    super();
    this.initializeEventSubscriptions();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): RepositoryDataCache {
    if (!this.instance) {
      this.instance = new RepositoryDataCache();
    }
    return this.instance;
  }

  /**
   * Initialize event subscriptions from monitoring service
   */
  private initializeEventSubscriptions(): void {
    // Subscribe to git status changes
    const unsubscribeGit = RepositoryMonitoringService.onGitStatusChanged((status) => {
      this.handleGitStatusChange(status);
    });
    this.eventSubscriptions.push(unsubscribeGit);

    const unsubscribeCacheSync = RepositoryMonitoringService.onCacheSync((event) => {
      this.handleCacheSyncEvent(event);
    });
    this.eventSubscriptions.push(unsubscribeCacheSync);

    // Subscribe to repository changes from Alexandria
    const unsubscribeRepo = AlexandriaService.onRepositoryChange((event) => {
      this.handleRepositoryChange(event);
    });
    this.eventSubscriptions.push(unsubscribeRepo);
  }

  /**
   * Get cached data for a repository with automatic subscription
   */
  get(repoPath: string, componentId: string): RepositoryCacheData | null {
    const entry = this.cache.get(repoPath);
    if (!entry) return null;

    // Track which components are using this data
    entry.subscriptions.add(componentId);

    return entry.data;
  }

  /**
   * Subscribe to cache updates for a repository
   */
  subscribe(
    repoPath: string,
    componentId: string,
    callback: (data: RepositoryCacheData) => void
  ): () => void {
    // Create event listener for this repository
    const eventName = `update:${repoPath}`;
    const listener = (event: CacheUpdateEvent) => {
      if (event.repoPath === repoPath) {
        const entry = this.cache.get(repoPath);
        if (entry) {
          callback(entry.data);
        }
      }
    };

    this.on(eventName, listener);

    // Track subscription
    const entry = this.cache.get(repoPath);
    if (entry) {
      entry.subscriptions.add(componentId);
    }

    // Return unsubscribe function
    return () => {
      this.off(eventName, listener);
      this.unsubscribe(repoPath, componentId);
    };
  }

  /**
   * Unsubscribe a component from a repository's data
   */
  unsubscribe(repoPath: string, componentId: string): void {
    const entry = this.cache.get(repoPath);
    if (entry) {
      entry.subscriptions.delete(componentId);

      // If no more subscriptions, consider removing from cache
      if (entry.subscriptions.size === 0 && this.isCacheStale(entry)) {
        this.cache.delete(repoPath);
      }
    }
  }

  /**
   * Load repository data into cache
   */
  async load(repoPath: string): Promise<RepositoryCacheData> {
    console.log(`[RepositoryDataCache] Loading data for: ${repoPath}`);

    // Check if we have fresh cached data
    const existing = this.cache.get(repoPath);
    if (existing && !this.isCacheStale(existing)) {
      return existing.data;
    }

    // Fetch all data in parallel
    const [snapshot, repository] = await Promise.all([
      RepositoryMonitoringService.getRepositoryCacheSnapshot(repoPath),
      this.getRepositoryByPath(repoPath),
    ]);

    const gitEntry = snapshot.slices.gitStatus as RegistryCacheEntry<CacheSliceDataMap['gitStatus']> | undefined;
    const fileTreeEntry = snapshot.slices.fileTree as RegistryCacheEntry<CacheSliceDataMap['fileTree']> | undefined;
    const packagesEntry = snapshot.slices.packages as RegistryCacheEntry<CacheSliceDataMap['packages']> | undefined;

    const gitStatus = gitEntry?.data ?? null;
    const fileTree = fileTreeEntry?.data ?? null;
    const packagesData = packagesEntry?.data;

    const qualityMetrics = this.extractQualityMetrics(packagesData);
    const markdownFiles = this.extractMarkdownFiles(fileTree);
    const branchStatus = await this.getBranchStatus(repoPath, gitStatus);
    const cacheSlices: RepositoryCacheSlicesState = {
      gitStatus: gitEntry,
      fileTree: fileTreeEntry,
      packages: packagesEntry,
    };

    // Create cache data
    const cacheData: RepositoryCacheData = {
      repository: this.enhanceRepository(repository, gitStatus),
      gitStatus,
      gitBranch: gitStatus?.branch || 'main',
      branchStatus,
      fileTree,
      markdownFiles,
      packages: packagesData?.packages || [],
      qualityMetrics,
      packageSummary: packagesData?.summary ?? null,
      lastFullRefresh: Date.now(),
      partialUpdates: {
        git: gitEntry?.timestamp ?? Date.now(),
        files: fileTreeEntry?.timestamp ?? Date.now(),
        packages: packagesEntry?.timestamp ?? Date.now(),
        quality: packagesEntry?.timestamp ?? Date.now(),
      },
      cacheSlices,
    };

    // Store in cache
    this.set(repoPath, cacheData);

    return cacheData;
  }

  /**
   * Set cache data for a repository
   */
  private set(repoPath: string, data: RepositoryCacheData): void {
    const existing = this.cache.get(repoPath);

    this.cache.set(repoPath, {
      data,
      timestamp: Date.now(),
      version: (existing?.version || 0) + 1,
      subscriptions: existing?.subscriptions || new Set(),
    });

    // Emit update event
    this.emit(`update:${repoPath}`, {
      repoPath,
      fields: ['all'],
      data,
    });
  }

  /**
   * Update cache partially
   */
  updatePartial(repoPath: string, update: PartialCacheUpdate): void {
    const entry = this.cache.get(repoPath);
    if (!entry) {
      console.warn(`[RepositoryDataCache] No cache entry for ${repoPath}`);
      return;
    }

    // Merge update with existing data
    const updatedData = {
      ...entry.data,
      ...update,
      cacheSlices: entry.data.cacheSlices,
      packageSummary:
        update.packageSummary !== undefined ? update.packageSummary : entry.data.packageSummary,
      partialUpdates: {
        ...entry.data.partialUpdates,
        git: update.gitStatus ? Date.now() : entry.data.partialUpdates.git,
        files: update.fileTree ? Date.now() : entry.data.partialUpdates.files,
        packages: update.packages ? Date.now() : entry.data.partialUpdates.packages,
        quality: update.qualityMetrics ? Date.now() : entry.data.partialUpdates.quality,
      },
    };

    // Update cache
    this.cache.set(repoPath, {
      ...entry,
      data: updatedData,
      timestamp: Date.now(),
      version: entry.version + 1,
    });

    // Emit update event with changed fields
    const changedFields = Object.keys(update);
    this.emit(`update:${repoPath}`, {
      repoPath,
      fields: changedFields,
      data: update,
    });
  }

  /**
   * Queue a partial update (batched)
   */
  queueUpdate(repoPath: string, fields: string[]): void {
    const existing = this.updateQueue.get(repoPath);

    if (existing) {
      fields.forEach(f => existing.fields.add(f));
    } else {
      this.updateQueue.set(repoPath, {
        fields: new Set(fields),
        timestamp: Date.now(),
      });
    }

    this.scheduleFlush();
  }

  /**
   * Schedule flush of queued updates
   */
  private scheduleFlush(): void {
    if (this.flushTimer) return;

    this.flushTimer = setTimeout(() => {
      this.flushQueuedUpdates();
    }, this.flushInterval);
  }

  /**
   * Flush all queued updates
   */
  private async flushQueuedUpdates(): Promise<void> {
    const updates = new Map(this.updateQueue);
    this.updateQueue.clear();
    this.flushTimer = null;

    for (const [repoPath, update] of updates) {
      await this.processBatchedUpdate(repoPath, Array.from(update.fields));
    }
  }

  /**
   * Process a batched update
   */
  private async processBatchedUpdate(repoPath: string, fields: string[]): Promise<void> {
    const updates: PartialCacheUpdate = {};

    // Fetch only the required data
    if (fields.includes('gitStatus')) {
      updates.gitStatus = await RepositoryMonitoringService.getGitStatusWithFiles(repoPath).catch(() => null);
      if (updates.gitStatus) {
        updates.gitBranch = updates.gitStatus.branch;
        updates.branchStatus = await this.getBranchStatus(repoPath, updates.gitStatus);
      }
    }

    if (fields.includes('fileTree') || fields.includes('markdownFiles')) {
      const fileTree = await RepositoryMonitoringService.getFileTree(repoPath).catch(() => null);
      updates.fileTree = fileTree;
      updates.markdownFiles = this.extractMarkdownFiles(fileTree);
    }

    if (fields.includes('packages') || fields.includes('qualityMetrics')) {
      const packagesData = await RepositoryMonitoringService.getPackages(repoPath).catch(() => null);
      updates.packages = packagesData?.packages || [];
      updates.qualityMetrics = this.extractQualityMetrics(packagesData);
      updates.packageSummary = packagesData?.summary ?? null;
    }

    // Apply updates
    this.updatePartial(repoPath, updates);
  }

  /**
   * Handle git status change event
   * Receives a basic GitStatusMetadata event and triggers a fetch for full details
   */
  private handleGitStatusChange(status: GitStatusMetadata): void {
    const repoPath = status.repoPath || status.path;
    if (!repoPath) return;

    // Update basic status immediately
    const entry = this.cache.get(repoPath);
    if (entry) {
      const updatedRepository: EnhancedAlexandriaEntry = {
        ...entry.data.repository,
        isDirty: status.isDirty,
        gitBranch: status.branch,
      } as EnhancedAlexandriaEntry;

      if (status.lastChangedAt) {
        const current = entry.data.repository.mostRecentChange
          ? new Date(entry.data.repository.mostRecentChange).getTime()
          : 0;
        const incoming = new Date(status.lastChangedAt).getTime();
        if (incoming > current) {
          updatedRepository.mostRecentChange = new Date(status.lastChangedAt).toISOString();
        }
      }

      this.updatePartial(repoPath, {
        gitBranch: status.branch,
        repository: updatedRepository,
      });
    }
  }

  private handleCacheSyncEvent(event: RepositoryCacheSyncEvent): void {
    void this.applyCacheSyncEvent(event);
  }

  private async applyCacheSyncEvent(event: RepositoryCacheSyncEvent): Promise<void> {
    const entry = this.cache.get(event.repoPath);
    if (!entry) {
      return;
    }

    const slice = event.slice as CacheSlice;
    const existingSlice = entry.data.cacheSlices[slice];
    if (existingSlice && event.entry.version <= existingSlice.version) {
      return;
    }

    const updatedSlices: RepositoryCacheSlicesState = {
      ...entry.data.cacheSlices,
      [slice]: event.entry as RegistryCacheEntry<CacheSliceDataMap[CacheSlice]>,
    };

    const updatedData: RepositoryCacheData = {
      ...entry.data,
      cacheSlices: updatedSlices,
    };

    const partial: PartialCacheUpdate = {};
    const changedFields: string[] = [];
    const partialUpdates = { ...entry.data.partialUpdates };
    const timestamp = event.entry.timestamp ?? Date.now();

    switch (slice) {
      case 'gitStatus': {
        updatedData.gitStatus = event.entry.data ?? null;
        partial.gitStatus = updatedData.gitStatus;
        changedFields.push('gitStatus');

        if (event.entry.data) {
          updatedData.gitBranch = event.entry.data.branch;
          partial.gitBranch = updatedData.gitBranch;
          changedFields.push('gitBranch');

          updatedData.repository = this.enhanceRepository(updatedData.repository, event.entry.data);
          partial.repository = updatedData.repository;
          changedFields.push('repository');

          updatedData.branchStatus = await this.getBranchStatus(event.repoPath, event.entry.data);
          partial.branchStatus = updatedData.branchStatus;
          changedFields.push('branchStatus');
        } else {
          updatedData.branchStatus = { ahead: 0, behind: 0 };
          partial.branchStatus = updatedData.branchStatus;
          changedFields.push('branchStatus');
        }

        partialUpdates.git = timestamp;
        break;
      }
      case 'fileTree': {
        updatedData.fileTree = event.entry.data ?? null;
        partial.fileTree = updatedData.fileTree;
        changedFields.push('fileTree');

        updatedData.markdownFiles = this.extractMarkdownFiles(updatedData.fileTree);
        partial.markdownFiles = updatedData.markdownFiles;
        changedFields.push('markdownFiles');

        partialUpdates.files = timestamp;
        break;
      }
      case 'packages': {
        const packagesData = event.entry.data;
        updatedData.packages = packagesData?.packages ?? [];
        partial.packages = updatedData.packages;
        changedFields.push('packages');

        updatedData.packageSummary = packagesData?.summary ?? null;
        partial.packageSummary = updatedData.packageSummary;
        changedFields.push('packageSummary');

        updatedData.qualityMetrics = this.extractQualityMetrics(packagesData);
        partial.qualityMetrics = updatedData.qualityMetrics;
        changedFields.push('qualityMetrics');

        partialUpdates.packages = timestamp;
        partialUpdates.quality = timestamp;
        break;
      }
      default:
        return;
    }

    updatedData.partialUpdates = partialUpdates;

    const newEntry: LocalCacheEntry<RepositoryCacheData> = {
      ...entry,
      data: updatedData,
      timestamp: Date.now(),
      version: entry.version + 1,
    };

    this.cache.set(event.repoPath, newEntry);

    if (changedFields.length > 0) {
      this.emit(`update:${event.repoPath}`, {
        repoPath: event.repoPath,
        fields: changedFields,
        data: partial,
      });
    }
  }

  /**
   * Handle repository change event from Alexandria
   */
  private handleRepositoryChange(event: AlexandriaChangeEvent): void {
    if (event.type === 'removed') {
      // For removal events, we only get the name, not the full repository object
      if (event.name) {
        // Find and remove all cache entries for this repository name
        const entriesToDelete: string[] = [];

        for (const [cachePath, entry] of this.cache.entries()) {
          if (entry.data.repository.name === event.name) {
            entriesToDelete.push(cachePath);
          }
        }

        // Delete all found entries
        for (const path of entriesToDelete) {
          this.cache.delete(path);
          console.log(`[RepositoryDataCache] Removed cache entry for ${event.name} at ${path}`);
        }

        if (entriesToDelete.length === 0) {
          console.log(`[RepositoryDataCache] Repository ${event.name} not found in cache (already removed)`);
        }
      }
    } else if (event.type === 'added' && event.repository) {
      // Load new repository into cache
      if (event.repository.path) {
        this.load(event.repository.path as string).catch(err =>
          console.error(`Failed to load added repository:`, err)
        );
      }
    } else if (event.type === 'updated' && event.repository) {
      // Update repository data
      if (event.repository.path) {
        this.updatePartial(event.repository.path as string, {
          repository: event.repository as EnhancedAlexandriaEntry,
        });
      }
    }
  }

  /**
   * Check if cache entry is stale
   */
  private isCacheStale(entry: LocalCacheEntry<RepositoryCacheData>): boolean {
    return Date.now() - entry.timestamp > this.maxCacheAge;
  }

  /**
   * Get repository by path from Alexandria
   */
  private async getRepositoryByPath(repoPath: string): Promise<EnhancedAlexandriaEntry> {
    const repos = await AlexandriaService.getRepositories();
    const repo = repos.find(r => r.path === repoPath);

    if (!repo) {
      throw new Error(`Repository not found: ${repoPath}`);
    }

    // Return as enhanced repository with default values
    return {
      ...repo,
      gitBranch: 'main',
      isDirty: false,
      dirtyFileCount: 0,
      mostRecentChange: repo.github?.lastCommit || repo.registeredAt,
    } as EnhancedAlexandriaEntry;
  }

  /**
   * Enhance repository with git information
   */
  private enhanceRepository(repo: any, gitStatus: GitStatusWithFiles | null): EnhancedAlexandriaEntry {
    return {
      ...repo,
      gitBranch: gitStatus?.branch || repo.gitBranch || 'main',
      isDirty: gitStatus?.isDirty || false,
      dirtyFileCount:
        (gitStatus?.modifiedFiles?.length || 0) +
        (gitStatus?.untrackedFiles?.length || 0) +
        (gitStatus?.stagedFiles?.length || 0),
      mostRecentChange: repo.github?.lastCommit || repo.mostRecentChange || repo.registeredAt,
    };
  }

  /**
   * Get branch status for a repository
   */
  private async getBranchStatus(repoPath: string, gitStatus: GitStatusWithFiles | null): Promise<any> {
    if (!gitStatus) {
      return {
        ahead: 0,
        behind: 0,
      };
    }

    try {
      const branchStatus = await GitService.getBranchStatus(repoPath);
      const pushSafety = await GitService.isPushSafe(repoPath);

      return {
        ahead: gitStatus.ahead || branchStatus.ahead || 0,
        behind: gitStatus.behind || branchStatus.behind || 0,
        upstream: branchStatus.upstream,
        canFastForward: branchStatus.canFastForward,
        needsUpstream: pushSafety.needsUpstream,
      };
    } catch (error) {
      return {
        ahead: gitStatus.ahead || 0,
        behind: gitStatus.behind || 0,
      };
    }
  }

  /**
   * Extract quality metrics from packages data
   */
  private extractQualityMetrics(
    packagesData: CacheSliceDataMap['packages'] | { packages: PackageLayer[] } | null | undefined,
  ): QualityMetrics | null {
    if (!packagesData?.packages?.[0]?.qualityMetrics) {
      return null;
    }

    const metrics = packagesData.packages[0].qualityMetrics;
    return {
      hexagon: metrics.hexagon || {
        tests: 0,
        deadCode: 0,
        formatting: 0,
        linting: 0,
        types: 0,
        documentation: 0,
      },
      tier: metrics.tier || 'bronze',
      availableTools: metrics.availableTools || [],
      confidence: metrics.confidence || 'low',
    };
  }

  /**
   * Extract markdown files from file tree
   */
  private extractMarkdownFiles(fileTree: FileTree | null): MarkdownFile[] {
    if (!fileTree?.allFiles) {
      return [];
    }

    return fileTree.allFiles
      .filter(file => file.path.endsWith('.md') || file.path.endsWith('.mdx'))
      .map(file => ({
        path: file.path,
        lastModified: file.lastModified ? file.lastModified.toISOString() : undefined,
        size: file.size,
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  /**
   * Clear all cache data
   */
  clear(): void {
    this.cache.clear();
    this.updateQueue.clear();
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Cleanup event subscriptions
   */
  cleanup(): void {
    this.eventSubscriptions.forEach(unsubscribe => unsubscribe());
    this.eventSubscriptions = [];
    this.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    cacheSize: number;
    repositories: string[];
    subscriptions: Map<string, number>;
    queuedUpdates: number;
  } {
    const subscriptions = new Map<string, number>();

    this.cache.forEach((entry, repoPath) => {
      subscriptions.set(repoPath, entry.subscriptions.size);
    });

    return {
      cacheSize: this.cache.size,
      repositories: Array.from(this.cache.keys()),
      subscriptions,
      queuedUpdates: this.updateQueue.size,
    };
  }
}