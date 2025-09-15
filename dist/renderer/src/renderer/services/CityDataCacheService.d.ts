import type { CityData } from "@principal-ai/code-city-react";
import type { FileTree } from "@principal-ai/repository-abstraction";
import type { FileTreeSource } from '../types/file-tree-source';
/**
 * Cache key for city data computation
 */
interface CityDataCacheKey {
    sourceId: string;
    additionalTreeIds: string[];
    dimensions: string;
    gitCommitSha?: string;
    treeHash: string;
}
/**
 * Options for building city data
 */
export interface CityDataBuildOptions {
    width?: number;
    height?: number;
    gitCommitSha?: string;
}
/**
 * Service for caching computed CityData to avoid expensive recomputations
 * when switching between views, sources, or toggling git trees.
 */
export declare class CityDataCacheService {
    private static readonly MAX_CACHED_CITIES;
    private static readonly MAX_AGE_MS;
    private static readonly DEFAULT_DIMENSIONS;
    private cache;
    /**
     * Generate a stable cache key from inputs
     */
    private generateCacheKey;
    /**
     * Get cached city data if available and valid
     */
    getCityData(key: CityDataCacheKey): CityData | null;
    /**
     * Store computed city data in cache
     */
    private storeCityData;
    /**
     * Evict oldest entries if cache is over size limit
     */
    private evictIfNeeded;
    /**
     * Build city data with caching using MultiVersionCityBuilder
     */
    buildCityData(primarySource: FileTreeSource, primaryTree: FileTree, additionalTrees?: Map<string, FileTree>, options?: CityDataBuildOptions): Promise<CityData | null>;
    /**
     * Invalidate cache entries for a specific source
     */
    invalidateSource(sourceId: string): void;
    /**
     * Invalidate cache entries matching a predicate
     */
    invalidateMatching(predicate: (source: FileTreeSource) => boolean): void;
    /**
     * Invalidate all cache entries
     */
    invalidateAll(): void;
    /**
     * Get cache statistics for debugging
     */
    getStats(): {
        entryCount: number;
        totalEstimatedSize: number;
        oldestAge: number;
        newestAge: number;
        hitRate?: number;
    };
    /**
     * Prune entries older than specified age
     */
    pruneOldEntries(maxAgeMs?: number): number;
    /**
     * Get a summary of cached entries for debugging
     */
    getCacheSummary(): Array<{
        sourceId: string;
        dimensions: string;
        age: number;
        estimatedSize: number;
    }>;
}
export {};
//# sourceMappingURL=CityDataCacheService.d.ts.map