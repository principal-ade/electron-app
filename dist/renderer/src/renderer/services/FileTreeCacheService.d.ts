import type { FileTree } from "@principal-ai/repository-abstraction";
import type { FileTreeSource, LoadedFileTreeSource } from '../types/file-tree-source';
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
    size: number;
    expiresAt: number;
}
/**
 * Service for caching file trees from various sources
 * Manages memory efficiently by storing trees in localStorage/IndexedDB
 */
export declare class FileTreeCacheService {
    private static CACHE_PREFIX;
    private static CACHE_INDEX_KEY;
    private static MAX_CACHE_SIZE;
    private static MAX_MEMORY_TREES;
    private memoryCache;
    private analysisCache;
    /** Store analysis results for a source in memory */
    setAnalysis(sourceId: string, analysis: {
        packageLayers: any;
        frameworkLayers?: any;
        dependencyLayers?: any;
        fileTypeLayers?: any;
    }): void;
    /** Retrieve cached analysis results for a source, or null if missing */
    getAnalysis(sourceId: string): {
        loadedAt: number;
        packageLayers: any;
        frameworkLayers?: any;
        dependencyLayers?: any;
        fileTypeLayers?: any;
    } | null;
    /** Remove cached analysis for a source */
    removeAnalysis(sourceId: string): void;
    /**
     * Get storage key for a source
     */
    private getStorageKey;
    /**
     * Get the cache index (list of all cached sources)
     */
    private getCacheIndex;
    /**
     * Update the cache index
     */
    private updateCacheIndex;
    /**
     * Store a tree in cache
     */
    storeTree(source: FileTreeSource, tree: FileTree, stats: {
        fileCount: number;
        directoryCount: number;
    }): Promise<void>;
    /**
     * Update memory cache with LRU eviction
     */
    private updateMemoryCache;
    /**
     * Retrieve a tree from cache
     */
    getTree(source: FileTreeSource): Promise<CachedFileTree | null>;
    /**
     * Load a tree for a FileTreeSource (from cache or fetch if needed)
     */
    loadFileTree(source: FileTreeSource): Promise<LoadedFileTreeSource>;
    /**
     * Load multiple trees in parallel
     */
    loadTrees(sources: FileTreeSource[]): Promise<LoadedFileTreeSource[]>;
    /**
     * Invalidate cache for a source
     */
    invalidateSource(sourceId: string): void;
    /**
     * Invalidate all caches for sources matching a predicate
     */
    invalidateMatching(predicate: (source: FileTreeSource) => boolean): void;
    /**
     * Remove a tree from cache
     */
    removeTree(sourceId: string): void;
    /**
     * Clear all cached trees
     */
    clearAll(): void;
    /**
     * Evict old entries if needed to make space
     */
    private evictIfNeeded;
    /**
     * Clear expired entries
     */
    private clearExpiredEntries;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        totalEntries: number;
        memoryEntries: number;
        totalSize: number;
        oldestEntry: number | null;
        expiringCount: number;
    };
    /**
     * Prefetch trees for sources that might be needed soon
     */
    prefetchTrees(sources: FileTreeSource[]): Promise<void>;
}
export {};
//# sourceMappingURL=FileTreeCacheService.d.ts.map