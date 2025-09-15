import { FileTreeCacheService } from './FileTreeCacheService';
import { CityDataCacheService } from './CityDataCacheService';
/**
 * Service that listens to file system changes and intelligently invalidates
 * the FileTree cache when needed.
 *
 * Strategy:
 * - Batch file changes to avoid excessive invalidations
 * - Only invalidate when structure changes (add/remove files)
 * - Ignore content-only changes unless they affect the tree structure
 */
export declare class FileTreeInvalidator {
    private cacheService;
    private cityDataCache?;
    private pendingInvalidations;
    private invalidationTimer;
    private structuralChangeTypes;
    constructor(cacheService: FileTreeCacheService, cityDataCache?: CityDataCacheService);
    /**
     * Set up IPC listeners for file change events from main process
     */
    private setupListeners;
    /**
     * Handle a file change event
     */
    private handleFileChange;
    /**
     * Schedule a batched invalidation
     */
    private scheduleInvalidation;
    /**
     * Process all pending invalidations
     */
    private processPendingInvalidations;
    /**
     * Invalidate cache for a specific repository
     */
    private invalidateRepository;
    /**
     * Get source IDs affected by changes to a repository
     */
    private getAffectedSourceIds;
    /**
     * Emit an event to notify UI components that cache was invalidated
     */
    private emitInvalidationEvent;
    /**
     * Manually invalidate cache for a repository
     */
    invalidateNow(repoPath: string): void;
    /**
     * Set the city data cache (for cases where it's created after the invalidator)
     */
    setCityDataCache(cityDataCache: CityDataCacheService): void;
    /**
     * Clean up listeners
     */
    destroy(): void;
}
//# sourceMappingURL=FileTreeInvalidator.d.ts.map