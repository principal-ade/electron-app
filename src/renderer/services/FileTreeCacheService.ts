import type { FileTree } from "@principal-ai/repository-abstraction";
import { loadLocalFileSystemTree, loadGitHubFileSystemTree, TreeLoadResult } from '../utils/loadFileSystemTree';
import type { FileTreeSource, LoadedFileTreeSource } from '../types/file-tree-source';
import { getSourceCacheTTL, shouldCacheSource, getSourceIdentifier } from '../types/file-tree-source';

/**
 * Cache entry for a file tree
 */
interface CachedFileTree {
  source: FileTreeSource;
  tree: FileTree;
  stats: {
    fileCount: number;
    directoryCount: number;
    loadedAt: number;
  };
  size: number; // Approximate size in bytes
  expiresAt: number; // When this cache entry expires
}

/**
 * Service for caching file trees from various sources
 * Manages memory efficiently by storing trees in localStorage/IndexedDB
 */
export class FileTreeCacheService {
  private static CACHE_PREFIX = 'filetree_cache_';
  private static CACHE_INDEX_KEY = 'filetree_cache_index';
  private static MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB max cache
  private static MAX_MEMORY_TREES = 3; // Max trees to keep in memory
  
  // In-memory cache for recently accessed trees
  private memoryCache: Map<string, CachedFileTree> = new Map();

  // In-memory analysis cache (per source.id). We intentionally keep this memory-only
  // so switching tabs does not recompute analysis repeatedly within a session.
  private analysisCache: Map<string, {
    loadedAt: number;
    packageLayers: any;
    frameworkLayers?: any;
    dependencyLayers?: any;
    fileTypeLayers?: any;
  }> = new Map();

  /** Store analysis results for a source in memory */
  setAnalysis(sourceId: string, analysis: {
    packageLayers: any;
    frameworkLayers?: any;
    dependencyLayers?: any;
    fileTypeLayers?: any;
  }): void {
    this.analysisCache.set(sourceId, {
      loadedAt: Date.now(),
      ...analysis,
    });
  }

  /** Retrieve cached analysis results for a source, or null if missing */
  getAnalysis(sourceId: string): {
    loadedAt: number;
    packageLayers: any;
    frameworkLayers?: any;
    dependencyLayers?: any;
    fileTypeLayers?: any;
  } | null {
    return this.analysisCache.get(sourceId) || null;
  }

  /** Remove cached analysis for a source */
  removeAnalysis(sourceId: string): void {
    this.analysisCache.delete(sourceId);
  }
  
  /**
   * Get storage key for a source
   */
  private getStorageKey(sourceId: string): string {
    return `${FileTreeCacheService.CACHE_PREFIX}${sourceId}`;
  }
  
  /**
   * Get the cache index (list of all cached sources)
   */
  private getCacheIndex(): string[] {
    try {
      const indexStr = localStorage.getItem(FileTreeCacheService.CACHE_INDEX_KEY);
      return indexStr ? JSON.parse(indexStr) : [];
    } catch {
      return [];
    }
  }
  
  /**
   * Update the cache index
   */
  private updateCacheIndex(index: string[]): void {
    localStorage.setItem(FileTreeCacheService.CACHE_INDEX_KEY, JSON.stringify(index));
  }
  
  /**
   * Store a tree in cache
   */
  async storeTree(
    source: FileTreeSource,
    tree: FileTree,
    stats: { fileCount: number; directoryCount: number }
  ): Promise<void> {
    // Check if this source should be cached
    if (!shouldCacheSource(source)) {
      // Still keep in memory for temporary sources
      const cached: CachedFileTree = {
        source,
        tree,
        stats: { ...stats, loadedAt: Date.now() },
        size: 0,
        expiresAt: Date.now() + getSourceCacheTTL(source)
      };
      this.updateMemoryCache(source.id, cached);
      return;
    }
    
    const cached: CachedFileTree = {
      source,
      tree,
      stats: { ...stats, loadedAt: Date.now() },
      size: 0,
      expiresAt: Date.now() + getSourceCacheTTL(source)
    };
    
    // Estimate size
    const treeStr = JSON.stringify(tree);
    cached.size = treeStr.length;
    
    // Check if we need to evict old entries
    await this.evictIfNeeded(cached.size);
    
    // Store in localStorage
    try {
      localStorage.setItem(this.getStorageKey(source.id), JSON.stringify(cached));
      
      // Update index
      const index = this.getCacheIndex();
      if (!index.includes(source.id)) {
        index.push(source.id);
        this.updateCacheIndex(index);
      }
      
      // Update memory cache
      this.updateMemoryCache(source.id, cached);
    } catch (error) {
      console.error('Failed to cache tree:', error);
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        await this.clearExpiredEntries();
        // Retry once after clearing expired entries
        try {
          localStorage.setItem(this.getStorageKey(source.id), JSON.stringify(cached));
        } catch {
          // If still failing, just keep in memory
          this.updateMemoryCache(source.id, cached);
        }
      }
    }
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
    if (this.memoryCache.size > FileTreeCacheService.MAX_MEMORY_TREES) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
      }
    }
  }
  
  /**
   * Retrieve a tree from cache
   */
  async getTree(source: FileTreeSource): Promise<CachedFileTree | null> {
    const sourceId = source.id;
    
    // Check memory cache first
    const memCached = this.memoryCache.get(sourceId);
    if (memCached) {
      // Check if expired
      if (Date.now() < memCached.expiresAt) {
        // Move to end (LRU)
        this.memoryCache.delete(sourceId);
        this.memoryCache.set(sourceId, memCached);
        return memCached;
      } else {
        // Remove expired entry
        this.memoryCache.delete(sourceId);
      }
    }
    
    // Check localStorage
    try {
      const stored = localStorage.getItem(this.getStorageKey(sourceId));
      if (!stored) return null;
      
      const cached: CachedFileTree = JSON.parse(stored);
      
      // Check if expired
      if (Date.now() >= cached.expiresAt) {
        this.removeTree(sourceId);
        return null;
      }
      
      // Update memory cache
      this.updateMemoryCache(sourceId, cached);
      return cached;
    } catch {
      return null;
    }
  }
  
  /**
   * Load a tree for a FileTreeSource (from cache or fetch if needed)
   */
  async loadFileTree(source: FileTreeSource): Promise<LoadedFileTreeSource> {
    console.log(`🌳 [FileTreeCache] Loading file tree for source:`, {
      id: source.id,
      type: source.type,
      name: source.name,
      location: source.location,
      locationType: source.locationType
    });
    
    // Try cache first
    const cached = await this.getTree(source);
    if (cached) {
      console.log(`📦 [FileTreeCache] Found cached tree for ${source.id} (${cached.stats.fileCount} files)`);
      return {
        ...source,
        tree: cached.tree,
        treeStats: cached.stats
      };
    }
    
    console.log(`🔄 [FileTreeCache] No cache found, loading fresh tree for ${source.type} source: ${source.location}`);
    
    // Load fresh based on source type
    try {
      let result: TreeLoadResult;
      
      if (source.type === 'local') {
        console.log(`💻 [FileTreeCache] Loading LOCAL file tree from path: ${source.location}`);
        // Load local filesystem tree
        result = await loadLocalFileSystemTree({
          localPath: source.location,
          owner: source.owner,
          repo: source.name,
          includeVCS: true
        });
        console.log(`✅ [FileTreeCache] LOCAL tree loaded successfully:`, {
          fileCount: result.stats.fileCount,
          directoryCount: result.stats.directoryCount,
          pathsCount: result.fileTree.paths?.length || 0
        });
      } else if (source.type === 'remote') {
        console.log(`☁️ [FileTreeCache] Loading REMOTE file tree from GitHub: ${source.owner}/${source.name}@${source.location}`);
        // Load from remote (GitHub API)
        if (source.locationType === 'branch' || source.locationType === 'tag') {
          result = await loadGitHubFileSystemTree({
            owner: source.owner,
            repo: source.name,
            branch: source.location
          });
        } else if (source.locationType === 'commit') {
          // For commits, we still use the branch API but with the commit SHA
          result = await loadGitHubFileSystemTree({
            owner: source.owner,
            repo: source.name,
            branch: source.metadata?.commitSha || source.location
          });
        } else {
          throw new Error(`Unsupported location type: ${source.locationType}`);
        }
        console.log(`✅ [FileTreeCache] REMOTE tree loaded successfully:`, {
          fileCount: result.stats.fileCount,
          directoryCount: result.stats.directoryCount,
          pathsCount: result.fileTree.paths?.length || 0
        });
      } else {
        throw new Error(`Unsupported source type: ${source.type}`);
      }
      
      console.log(`💾 [FileTreeCache] Caching tree for ${source.id}...`);
      // Cache the result
      await this.storeTree(source, result.fileTree, result.stats);
      
      // Update source's lastAccessed
      const updatedSource = { ...source, lastAccessed: Date.now() };
      
      console.log(`🎉 [FileTreeCache] File tree loading complete for ${source.type} source: ${source.name}`);
      
      return {
        ...updatedSource,
        tree: result.fileTree,
        treeStats: {
          ...result.stats,
          loadedAt: Date.now()
        },
        filterLayers: result.filterLayers
      };
    } catch (error) {
      console.error(`❌ [FileTreeCache] Failed to load tree for ${source.type} source ${source.location}:`, error);
      throw error;
    }
  }
  
  /**
   * Load multiple trees in parallel
   */
  async loadTrees(sources: FileTreeSource[]): Promise<LoadedFileTreeSource[]> {
    return Promise.all(sources.map(source => this.loadFileTree(source)));
  }
  
  /**
   * Invalidate cache for a source
   */
  invalidateSource(sourceId: string): void {
    this.memoryCache.delete(sourceId);
    this.removeTree(sourceId);
  }
  
  /**
   * Invalidate all caches for sources matching a predicate
   */
  invalidateMatching(predicate: (source: FileTreeSource) => boolean): void {
    // Check memory cache
    for (const [id, cached] of this.memoryCache.entries()) {
      if (predicate(cached.source)) {
        this.memoryCache.delete(id);
      }
    }
    
    // Check localStorage
    const index = this.getCacheIndex();
    const toRemove: string[] = [];
    
    for (const sourceId of index) {
      try {
        const stored = localStorage.getItem(this.getStorageKey(sourceId));
        if (stored) {
          const cached: CachedFileTree = JSON.parse(stored);
          if (predicate(cached.source)) {
            toRemove.push(sourceId);
          }
        }
      } catch {
        // Ignore invalid entries
      }
    }
    
    toRemove.forEach(id => this.removeTree(id));
  }
  
  /**
   * Remove a tree from cache
   */
  removeTree(sourceId: string): void {
    localStorage.removeItem(this.getStorageKey(sourceId));
    
    const index = this.getCacheIndex();
    const filtered = index.filter(id => id !== sourceId);
    this.updateCacheIndex(filtered);
    
    this.memoryCache.delete(sourceId);
    this.analysisCache.delete(sourceId);
  }
  
  /**
   * Clear all cached trees
   */
  clearAll(): void {
    const index = this.getCacheIndex();
    index.forEach(sourceId => {
      localStorage.removeItem(this.getStorageKey(sourceId));
    });
    this.updateCacheIndex([]);
    this.memoryCache.clear();
  }
  
  /**
   * Evict old entries if needed to make space
   */
  private async evictIfNeeded(newSize: number): Promise<void> {
    const index = this.getCacheIndex();
    let totalSize = newSize;
    
    // Calculate current cache size and collect entry info
    const entries: Array<{ sourceId: string; size: number; expiresAt: number }> = [];
    
    for (const sourceId of index) {
      try {
        const stored = localStorage.getItem(this.getStorageKey(sourceId));
        if (stored) {
          const cached: CachedFileTree = JSON.parse(stored);
          const size = cached.size || stored.length;
          totalSize += size;
          entries.push({ sourceId, size, expiresAt: cached.expiresAt });
        }
      } catch {
        // Ignore invalid entries
      }
    }
    
    // Evict entries if over limit
    if (totalSize > FileTreeCacheService.MAX_CACHE_SIZE) {
      // Sort by expiration time (evict soon-to-expire first)
      entries.sort((a, b) => a.expiresAt - b.expiresAt);
      
      let sizeToFree = totalSize - FileTreeCacheService.MAX_CACHE_SIZE;
      for (const entry of entries) {
        if (sizeToFree <= 0) break;
        this.removeTree(entry.sourceId);
        sizeToFree -= entry.size;
      }
    }
  }
  
  /**
   * Clear expired entries
   */
  private async clearExpiredEntries(): Promise<void> {
    const index = this.getCacheIndex();
    const now = Date.now();
    const validIds: string[] = [];
    
    for (const sourceId of index) {
      try {
        const stored = localStorage.getItem(this.getStorageKey(sourceId));
        if (stored) {
          const cached: CachedFileTree = JSON.parse(stored);
          if (now < cached.expiresAt) {
            validIds.push(sourceId);
          } else {
            localStorage.removeItem(this.getStorageKey(sourceId));
          }
        }
      } catch {
        // Remove invalid entries
        localStorage.removeItem(this.getStorageKey(sourceId));
      }
    }
    
    this.updateCacheIndex(validIds);
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalEntries: number;
    memoryEntries: number;
    totalSize: number;
    oldestEntry: number | null;
    expiringCount: number;
  } {
    const index = this.getCacheIndex();
    let totalSize = 0;
    let oldestTimestamp: number | null = null;
    let expiringCount = 0;
    const now = Date.now();
    const soonThreshold = now + 5 * 60 * 1000; // 5 minutes
    
    for (const sourceId of index) {
      try {
        const stored = localStorage.getItem(this.getStorageKey(sourceId));
        if (stored) {
          const cached: CachedFileTree = JSON.parse(stored);
          totalSize += cached.size || stored.length;
          
          const loadedAt = cached.stats.loadedAt;
          if (!oldestTimestamp || loadedAt < oldestTimestamp) {
            oldestTimestamp = loadedAt;
          }
          
          if (cached.expiresAt < soonThreshold) {
            expiringCount++;
          }
        }
      } catch {
        // Ignore
      }
    }
    
    return {
      totalEntries: index.length,
      memoryEntries: this.memoryCache.size,
      totalSize,
      oldestEntry: oldestTimestamp,
      expiringCount
    };
  }
  
  /**
   * Prefetch trees for sources that might be needed soon
   */
  async prefetchTrees(sources: FileTreeSource[]): Promise<void> {
    // Only prefetch non-temporary sources
    const toPrefetch = sources.filter(shouldCacheSource);
    
    // Load in background without waiting
    Promise.all(
      toPrefetch.map(source => 
        this.loadFileTree(source).catch(err => 
          console.warn(`Failed to prefetch tree for ${source.id}:`, err)
        )
      )
    );
  }
}