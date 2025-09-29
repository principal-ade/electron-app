/**
 * MonitoredFileTreeService - Clean break from FileTreeCacheService
 *
 * This service ONLY uses the repository-monitoring service for FileTree data.
 * No fallback to the old filesystem scanning approach.
 *
 * Benefits:
 * - Git-aware caching in the monitoring service (SHA-based)
 * - Single source of truth for FileTree data
 * - Pre-computed trees served from worker process
 * - Reduced IPC overhead
 */

import type { FileTree } from '@principal-ai/repository-abstraction';
import type {
  FileTreeSource,
  LoadedFileTreeSource,
  FileTreeStats,
} from '../types/file-tree-source';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';

/**
 * In-memory cache entry for a FileTree
 */
interface CachedFileTree {
  source: FileTreeSource;
  tree: FileTree;
  stats: FileTreeStats;
  expiresAt: number;
}

/**
 * Service that loads FileTrees exclusively from the repository-monitoring service
 * Provides memory caching but delegates primary caching to the monitoring service
 */
export class MonitoredFileTreeService {
  // Simple memory cache - the monitoring service has the primary cache
  private memoryCache: Map<string, CachedFileTree> = new Map();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private static readonly MAX_MEMORY_TREES = 3; // Keep recent trees in memory

  // Analysis cache (memory only) - for compatibility with existing code
  private analysisCache: Map<
    string,
    {
      loadedAt: number;
      packageLayers: any;
      frameworkLayers?: any;
      dependencyLayers?: any;
      fileTypeLayers?: any;
    }
  > = new Map();

  /**
   * Load a FileTree for a source
   * @throws Error if monitoring service doesn't have data for the source
   */
  async loadFileTree(source: FileTreeSource): Promise<LoadedFileTreeSource> {
    console.log(`🌳 [MonitoredFileTreeService] Loading file tree for source:`, {
      id: source.id,
      type: source.type,
      name: source.name,
      location: source.location,
    });

    // Check memory cache first
    const cached = this.getFromMemoryCache(source.id);
    if (cached) {
      console.log(
        `📦 [MonitoredFileTreeService] Found in memory cache for ${source.id} (${cached.stats.fileCount} files)`
      );
      return this.toCachedResult(source, cached);
    }

    // Only support local sources (monitoring service requirement)
    if (source.type !== 'local') {
      throw new Error(
        `MonitoredFileTreeService only supports local sources. Got type: ${source.type}`
      );
    }

    if (!source.location) {
      throw new Error(`Source ${source.id} has no location path`);
    }

    console.log(
      `🔄 [MonitoredFileTreeService] Fetching from monitoring service: ${source.location}`
    );

    try {
      // Get FileTree from monitoring service (no fallback!)
      const tree = await RepositoryMonitoringService.getFileTree(source.location);

      if (!tree) {
        throw new Error(
          `No FileTree available from monitoring service for ${source.location}. ` +
          `Ensure the repository is registered with RepositoryMonitoringService.registerRepository()`
        );
      }

      console.log(
        `✅ [MonitoredFileTreeService] Received tree from monitoring service:`,
        {
          path: source.location,
          files: tree.allFiles?.length || 0,
          directories: tree.allDirectories?.length || 0,
          sha: tree.sha,
        }
      );

      // Cache in memory
      const cacheEntry: CachedFileTree = {
        source,
        tree,
        stats: {
          fileCount: tree.allFiles?.length || 0,
          directoryCount: tree.allDirectories?.length || 0,
          loadedAt: Date.now(),
        },
        expiresAt: Date.now() + MonitoredFileTreeService.CACHE_TTL,
      };

      this.updateMemoryCache(source.id, cacheEntry);

      return {
        ...source,
        tree,
        treeStats: cacheEntry.stats,
      };
    } catch (error) {
      console.error(
        `❌ [MonitoredFileTreeService] Failed to load tree for ${source.location}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Load multiple trees in parallel
   */
  async loadTrees(sources: FileTreeSource[]): Promise<LoadedFileTreeSource[]> {
    return Promise.all(sources.map((source) => this.loadFileTree(source)));
  }

  /**
   * Register a repository with the monitoring service
   * Should be called when a repository window opens
   */
  async registerRepository(path: string): Promise<void> {
    console.log(`📝 [MonitoredFileTreeService] Registering repository: ${path}`);
    try {
      await RepositoryMonitoringService.registerRepository(path);
      console.log(`✅ [MonitoredFileTreeService] Repository registered: ${path}`);
    } catch (error) {
      console.error(`❌ [MonitoredFileTreeService] Failed to register repository:`, error);
      throw error;
    }
  }

  /**
   * Refresh a repository's FileTree in the monitoring service
   */
  async refreshRepository(path: string): Promise<void> {
    console.log(`🔄 [MonitoredFileTreeService] Refreshing repository: ${path}`);

    // Invalidate memory cache for this path
    this.invalidateByPath(path);

    // Tell monitoring service to refresh
    await RepositoryMonitoringService.refreshRepository(path);

    console.log(`✅ [MonitoredFileTreeService] Repository refreshed: ${path}`);
  }

  /**
   * Prefetch trees for given sources
   * Registers them with monitoring service but doesn't load into memory yet
   */
  async prefetchTrees(sources: FileTreeSource[]): Promise<void> {
    const localSources = sources.filter(s => s.type === 'local' && s.location);

    console.log(
      `🔮 [MonitoredFileTreeService] Prefetching ${localSources.length} local sources`
    );

    // Register all local paths with monitoring service
    await Promise.all(
      localSources.map(source =>
        this.registerRepository(source.location!)
          .catch(error => {
            console.warn(
              `Failed to prefetch ${source.location}:`,
              error
            );
          })
      )
    );
  }

  /**
   * Invalidate memory cache for a source
   */
  invalidateSource(sourceId: string): void {
    console.log(`🗑️ [MonitoredFileTreeService] Invalidating source: ${sourceId}`);
    this.memoryCache.delete(sourceId);
  }

  /**
   * Invalidate all memory cache entries for a given path
   */
  private invalidateByPath(path: string): void {
    for (const [id, cached] of this.memoryCache.entries()) {
      if (cached.source.location === path) {
        this.memoryCache.delete(id);
      }
    }
  }

  /**
   * Clear all memory cache
   */
  clearMemoryCache(): void {
    console.log(`🧹 [MonitoredFileTreeService] Clearing all memory cache`);
    this.memoryCache.clear();
  }

  /**
   * Invalidate cache entries matching a predicate
   */
  invalidateMatching(predicate: (source: FileTreeSource) => boolean): void {
    const toDelete: string[] = [];

    for (const [id, cached] of this.memoryCache.entries()) {
      if (predicate(cached.source)) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      console.log(`🗑️ [MonitoredFileTreeService] Invalidating matching source: ${id}`);
      this.memoryCache.delete(id);
    }
  }

  /**
   * Clear all cache (for compatibility with FileTreeCacheService)
   */
  clearAll(): void {
    console.log(`🧹 [MonitoredFileTreeService] Clearing all cache`);
    this.memoryCache.clear();
    this.analysisCache.clear();
  }

  /**
   * Get analysis cache for a source (for compatibility with FileTreeCacheService)
   */
  getAnalysis(sourceId: string): {
    loadedAt: number;
    packageLayers: any;
    frameworkLayers?: any;
    dependencyLayers?: any;
    fileTypeLayers?: any;
  } | null {
    return this.analysisCache.get(sourceId) || null;
  }

  /**
   * Set analysis cache for a source (for compatibility with FileTreeCacheService)
   */
  setAnalysis(
    sourceId: string,
    analysis: {
      packageLayers: any;
      frameworkLayers?: any;
      dependencyLayers?: any;
      fileTypeLayers?: any;
    }
  ): void {
    this.analysisCache.set(sourceId, {
      loadedAt: Date.now(),
      ...analysis,
    });
  }

  /**
   * Get from memory cache if not expired
   */
  private getFromMemoryCache(sourceId: string): CachedFileTree | null {
    const cached = this.memoryCache.get(sourceId);

    if (!cached) {
      return null;
    }

    // Check expiration
    if (Date.now() >= cached.expiresAt) {
      this.memoryCache.delete(sourceId);
      return null;
    }

    // Move to end (LRU)
    this.memoryCache.delete(sourceId);
    this.memoryCache.set(sourceId, cached);

    return cached;
  }

  /**
   * Update memory cache with LRU eviction
   */
  private updateMemoryCache(sourceId: string, cached: CachedFileTree): void {
    // Remove if already exists (to reorder)
    this.memoryCache.delete(sourceId);

    // Add to cache
    this.memoryCache.set(sourceId, cached);

    // Evict oldest if over limit
    if (this.memoryCache.size > MonitoredFileTreeService.MAX_MEMORY_TREES) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        console.log(`🔄 [MonitoredFileTreeService] Evicting oldest cache entry: ${firstKey}`);
        this.memoryCache.delete(firstKey);
      }
    }
  }

  /**
   * Convert cached entry to LoadedFileTreeSource
   */
  private toCachedResult(
    source: FileTreeSource,
    cached: CachedFileTree
  ): LoadedFileTreeSource {
    return {
      ...source,
      tree: cached.tree,
      treeStats: cached.stats,
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    memoryCacheSize: number;
    memoryCacheEntries: string[];
  } {
    return {
      memoryCacheSize: this.memoryCache.size,
      memoryCacheEntries: Array.from(this.memoryCache.keys()),
    };
  }
}