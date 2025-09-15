/**
 * Service that listens to file system changes and intelligently invalidates
 * the FileTree cache when needed.
 *
 * Strategy:
 * - Batch file changes to avoid excessive invalidations
 * - Only invalidate when structure changes (add/remove files)
 * - Ignore content-only changes unless they affect the tree structure
 */
export class FileTreeInvalidator {
    cacheService;
    cityDataCache;
    pendingInvalidations = new Map(); // repoPath -> affected paths
    invalidationTimer = null;
    structuralChangeTypes = new Set(['add', 'unlink']);
    constructor(cacheService, cityDataCache) {
        this.cacheService = cacheService;
        this.cityDataCache = cityDataCache;
        this.setupListeners();
    }
    /**
     * Set up IPC listeners for file change events from main process
     */
    setupListeners() {
        // Listen for file changes from GitRepositoryWatcher
        window.electron?.ipcRenderer?.on('git:file-changed', (_event, changeEvent) => {
            this.handleFileChange(changeEvent);
        });
    }
    /**
     * Handle a file change event
     */
    handleFileChange(event) {
        console.log('[FileTreeInvalidator] File change:', event.type, event.path, 'in', event.repoPath);
        // Only care about structural changes (add/remove) 
        // Content changes don't affect the FileTree structure
        if (!this.structuralChangeTypes.has(event.type)) {
            // For 'change' events, only care if it's a directory change
            if (event.type === 'change' && !event.isDirectory) {
                return;
            }
        }
        // Add to pending invalidations
        if (!this.pendingInvalidations.has(event.repoPath)) {
            this.pendingInvalidations.set(event.repoPath, new Set());
        }
        this.pendingInvalidations.get(event.repoPath).add(event.path);
        // Debounce invalidations to batch changes
        this.scheduleInvalidation();
    }
    /**
     * Schedule a batched invalidation
     */
    scheduleInvalidation() {
        // Clear existing timer
        if (this.invalidationTimer) {
            clearTimeout(this.invalidationTimer);
        }
        // Wait 1 second to batch changes (e.g., multiple files being added)
        this.invalidationTimer = setTimeout(() => {
            this.processPendingInvalidations();
        }, 1000);
    }
    /**
     * Process all pending invalidations
     */
    processPendingInvalidations() {
        if (this.pendingInvalidations.size === 0)
            return;
        console.log('[FileTreeInvalidator] Processing invalidations for', this.pendingInvalidations.size, 'repositories');
        // Process each repository's changes
        for (const [repoPath, changedPaths] of this.pendingInvalidations.entries()) {
            this.invalidateRepository(repoPath, changedPaths);
        }
        // Clear pending invalidations
        this.pendingInvalidations.clear();
        this.invalidationTimer = null;
    }
    /**
     * Invalidate cache for a specific repository
     */
    invalidateRepository(repoPath, changedPaths) {
        console.log('[FileTreeInvalidator] Invalidating cache for', repoPath, 'with', changedPaths.size, 'changed paths');
        // Find all sources that match this repository path
        this.cacheService.invalidateMatching((source) => {
            // For local sources, check if the path matches
            if (source.type === 'local' && source.location === repoPath) {
                console.log('[FileTreeInvalidator] Invalidating local source:', source.id);
                return true;
            }
            return false;
        });
        // Also invalidate analysis cache for affected sources
        const affectedSourceIds = this.getAffectedSourceIds(repoPath);
        affectedSourceIds.forEach(sourceId => {
            this.cacheService.removeAnalysis(sourceId);
        });
        // Invalidate city data cache for affected sources
        if (this.cityDataCache) {
            this.cityDataCache.invalidateMatching(() => true); // For now, invalidate all - could be more selective
        }
        // Emit an event that the cache was invalidated
        this.emitInvalidationEvent(repoPath, changedPaths);
    }
    /**
     * Get source IDs affected by changes to a repository
     */
    getAffectedSourceIds(repoPath) {
        // Generate possible source IDs for this repo
        return [
            `local-${repoPath}`,
            `local-${repoPath}-working`,
            `local-${repoPath}-HEAD`,
        ];
    }
    /**
     * Emit an event to notify UI components that cache was invalidated
     */
    emitInvalidationEvent(repoPath, changedPaths) {
        // Create a custom event
        const event = new CustomEvent('filetree:cache-invalidated', {
            detail: {
                repoPath,
                changedPaths: Array.from(changedPaths),
                timestamp: Date.now()
            }
        });
        // Dispatch to window for any listeners
        window.dispatchEvent(event);
    }
    /**
     * Manually invalidate cache for a repository
     */
    invalidateNow(repoPath) {
        console.log('[FileTreeInvalidator] Manual invalidation for', repoPath);
        this.invalidateRepository(repoPath, new Set(['manual-invalidation']));
    }
    /**
     * Set the city data cache (for cases where it's created after the invalidator)
     */
    setCityDataCache(cityDataCache) {
        this.cityDataCache = cityDataCache;
    }
    /**
     * Clean up listeners
     */
    destroy() {
        if (this.invalidationTimer) {
            clearTimeout(this.invalidationTimer);
        }
        // Remove IPC listeners
        window.electron?.ipcRenderer?.removeAllListeners('git:file-changed');
    }
}
