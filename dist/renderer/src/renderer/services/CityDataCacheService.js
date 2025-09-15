import { MultiVersionCityBuilder } from "@principal-ai/code-city-react";
/**
 * Service for caching computed CityData to avoid expensive recomputations
 * when switching between views, sources, or toggling git trees.
 */
export class CityDataCacheService {
    static MAX_CACHED_CITIES = 8; // Reasonable memory limit
    static MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes
    static DEFAULT_DIMENSIONS = { width: 1200, height: 900 };
    // LRU cache for city data (memory only - CityData objects are large)
    cache = new Map();
    /**
     * Generate a stable cache key from inputs
     */
    generateCacheKey(key) {
        const parts = [
            `src:${key.sourceId}`,
            `trees:${key.additionalTreeIds.sort().join(',')}`,
            `dim:${key.dimensions}`,
            `hash:${key.treeHash}`
        ];
        if (key.gitCommitSha) {
            parts.push(`git:${key.gitCommitSha}`);
        }
        return parts.join('|');
    }
    /**
     * Get cached city data if available and valid
     */
    getCityData(key) {
        const cacheKey = this.generateCacheKey(key);
        const cached = this.cache.get(cacheKey);
        if (!cached) {
            return null;
        }
        // Check age
        const age = Date.now() - cached.computedAt;
        if (age > CityDataCacheService.MAX_AGE_MS) {
            console.log('[CityDataCache] Entry expired:', cacheKey);
            this.cache.delete(cacheKey);
            return null;
        }
        // Update access time and move to end (LRU)
        cached.accessedAt = Date.now();
        this.cache.delete(cacheKey);
        this.cache.set(cacheKey, cached);
        console.log('[CityDataCache] Cache hit:', cacheKey);
        return cached.cityData;
    }
    /**
     * Store computed city data in cache
     */
    storeCityData(key, cityData) {
        const cacheKey = this.generateCacheKey(key);
        // Rough size estimation (JSON string length as proxy)
        const estimatedSize = JSON.stringify({
            buildings: cityData.buildings?.length || 0,
            districts: cityData.districts?.length || 0,
            // Just count elements, not full serialization for performance
        }).length * 100; // Rough multiplier
        const entry = {
            key,
            cityData,
            computedAt: Date.now(),
            accessedAt: Date.now(),
            estimatedSize,
        };
        // Add to cache
        this.cache.set(cacheKey, entry);
        // Evict oldest entries if over limit
        this.evictIfNeeded();
        console.log('[CityDataCache] Stored:', cacheKey, `(~${(estimatedSize / 1024).toFixed(1)}KB)`);
    }
    /**
     * Evict oldest entries if cache is over size limit
     */
    evictIfNeeded() {
        while (this.cache.size > CityDataCacheService.MAX_CACHED_CITIES) {
            // Find oldest by accessedAt
            let oldestKey = null;
            let oldestTime = Infinity;
            for (const [key, entry] of this.cache.entries()) {
                if (entry.accessedAt < oldestTime) {
                    oldestTime = entry.accessedAt;
                    oldestKey = key;
                }
            }
            if (oldestKey) {
                console.log('[CityDataCache] Evicting oldest:', oldestKey);
                this.cache.delete(oldestKey);
            }
            else {
                break; // Safety break
            }
        }
    }
    /**
     * Build city data with caching using MultiVersionCityBuilder
     */
    async buildCityData(primarySource, primaryTree, additionalTrees = new Map(), options = {}) {
        const dimensions = {
            width: options.width || CityDataCacheService.DEFAULT_DIMENSIONS.width,
            height: options.height || CityDataCacheService.DEFAULT_DIMENSIONS.height,
        };
        // Create cache key
        const cacheKey = {
            sourceId: primarySource.id,
            additionalTreeIds: Array.from(additionalTrees.keys()),
            dimensions: `${dimensions.width}x${dimensions.height}`,
            gitCommitSha: options.gitCommitSha,
            treeHash: primaryTree.sha, // Use FileTree's SHA for structural change detection
        };
        // Check cache first
        const cached = this.getCityData(cacheKey);
        if (cached) {
            return cached;
        }
        console.log('[CityDataCache] Cache miss, computing city data for:', primarySource.id);
        try {
            // Build versions map for multi-version city
            const versions = new Map();
            versions.set(primarySource.id, primaryTree);
            // Add additional trees (e.g., HEAD tree for git comparisons)
            for (const [id, tree] of additionalTrees.entries()) {
                versions.set(id, tree);
            }
            // Build multi-version city using new API (expensive operation)
            const startTime = performance.now();
            const { unionCity, presenceByVersion } = MultiVersionCityBuilder.build(versions, {});
            const layoutTime = performance.now() - startTime;
            // Get presence data for primary source
            const presence = presenceByVersion.get(primarySource.id);
            if (!presence) {
                console.warn('[CityDataCache] No presence data for primary source:', primarySource.id);
                return null;
            }
            // Get version view for the primary source (also expensive)
            const cityStartTime = performance.now();
            const cityData = MultiVersionCityBuilder.getVersionView(unionCity, presence);
            const cityTime = performance.now() - cityStartTime;
            const totalTime = layoutTime + cityTime;
            console.log('[CityDataCache] Built city data:', `layout=${layoutTime.toFixed(1)}ms`, `city=${cityTime.toFixed(1)}ms`, `total=${totalTime.toFixed(1)}ms`);
            // Store in cache
            this.storeCityData(cacheKey, cityData);
            return cityData;
        }
        catch (error) {
            console.error('[CityDataCache] Failed to build city data:', error);
            return null;
        }
    }
    /**
     * Invalidate cache entries for a specific source
     */
    invalidateSource(sourceId) {
        const toDelete = [];
        for (const [key, entry] of this.cache.entries()) {
            if (entry.key.sourceId === sourceId ||
                entry.key.additionalTreeIds.includes(sourceId)) {
                toDelete.push(key);
            }
        }
        toDelete.forEach(key => this.cache.delete(key));
        if (toDelete.length > 0) {
            console.log('[CityDataCache] Invalidated', toDelete.length, 'entries for source:', sourceId);
        }
    }
    /**
     * Invalidate cache entries matching a predicate
     */
    invalidateMatching(predicate) {
        const toDelete = [];
        for (const [key, entry] of this.cache.entries()) {
            // We don't store the full source object, so we use sourceId matching
            // This could be enhanced if needed
            if (entry.key.sourceId.includes('local-')) {
                // For local sources, we can try to match path patterns
                const pathMatch = entry.key.sourceId.replace('local-', '');
                // Simple heuristic - could be improved with better source tracking
                toDelete.push(key);
            }
        }
        toDelete.forEach(key => this.cache.delete(key));
        if (toDelete.length > 0) {
            console.log('[CityDataCache] Invalidated', toDelete.length, 'matching entries');
        }
    }
    /**
     * Invalidate all cache entries
     */
    invalidateAll() {
        const count = this.cache.size;
        this.cache.clear();
        console.log('[CityDataCache] Cleared all', count, 'cache entries');
    }
    /**
     * Get cache statistics for debugging
     */
    getStats() {
        let totalSize = 0;
        let oldestTime = Infinity;
        let newestTime = 0;
        const now = Date.now();
        for (const entry of this.cache.values()) {
            totalSize += entry.estimatedSize;
            if (entry.computedAt < oldestTime)
                oldestTime = entry.computedAt;
            if (entry.computedAt > newestTime)
                newestTime = entry.computedAt;
        }
        return {
            entryCount: this.cache.size,
            totalEstimatedSize: totalSize,
            oldestAge: oldestTime === Infinity ? 0 : now - oldestTime,
            newestAge: newestTime === 0 ? 0 : now - newestTime,
        };
    }
    /**
     * Prune entries older than specified age
     */
    pruneOldEntries(maxAgeMs = CityDataCacheService.MAX_AGE_MS) {
        const now = Date.now();
        const toDelete = [];
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.computedAt > maxAgeMs) {
                toDelete.push(key);
            }
        }
        toDelete.forEach(key => this.cache.delete(key));
        if (toDelete.length > 0) {
            console.log('[CityDataCache] Pruned', toDelete.length, 'old entries');
        }
        return toDelete.length;
    }
    /**
     * Get a summary of cached entries for debugging
     */
    getCacheSummary() {
        const now = Date.now();
        return Array.from(this.cache.values()).map(entry => ({
            sourceId: entry.key.sourceId,
            dimensions: entry.key.dimensions,
            age: now - entry.computedAt,
            estimatedSize: entry.estimatedSize,
        }));
    }
}
