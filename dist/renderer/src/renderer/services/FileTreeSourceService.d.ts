import { PackageLayer } from "@principal-ai/codebase-composition";
import type { Repository } from '../../shared/types/repository.types';
import type { FileTreeSource, LoadedFileTreeSource } from '../types/file-tree-source';
import { FileTreeCacheService } from './FileTreeCacheService';
/**
 * Service for managing file tree sources
 * Handles converting repository info to sources and managing source state
 */
export declare class FileTreeSourceService {
    private sources;
    private activeSourceId;
    private cacheService;
    private packageModule;
    constructor(cacheService?: FileTreeCacheService);
    /**
     * Initialize sources from a repository
     * Creates only the visible clone source to optimize loading
     */
    initializeFromRepository(repository: Repository, options?: {
        loadRemoteHead?: boolean;
    }): FileTreeSource[];
    /**
     * Add a new source
     */
    addSource(source: FileTreeSource): void;
    /**
     * Remove a source
     */
    removeSource(sourceId: string): void;
    /**
     * Get all sources
     */
    getAllSources(): FileTreeSource[];
    /**
     * Get sources by type
     */
    getSourcesByType(type: 'local' | 'remote'): FileTreeSource[];
    /**
     * Get temporary sources
     */
    getTemporarySources(): FileTreeSource[];
    /**
     * Get a specific source
     */
    getSource(sourceId: string): FileTreeSource | undefined;
    /**
     * Get active source
     */
    getActiveSource(): FileTreeSource | null;
    /**
     * Set active source
     */
    setActiveSource(sourceId: string): void;
    /**
     * Load a source's tree (uses cache)
     */
    loadSourceTree(sourceId: string): Promise<LoadedFileTreeSource | null>;
    /**
     * Load the active source's tree
     */
    loadActiveSourceTree(): Promise<LoadedFileTreeSource | null>;
    /**
     * Detect packages in a source's file tree
     * Uses the standard PackageLayerModule for consistent package detection
     */
    detectPackagesForSource(sourceId: string): Promise<PackageLayer[] | null>;
    /**
     * Core package detection logic using PackageLayerModule
     */
    private detectPackages;
    /**
     * Get cached packages for a source without loading
     */
    getCachedPackages(sourceId: string): PackageLayer[] | null;
    /**
     * Load multiple source trees in parallel
     */
    loadSourceTrees(sourceIds: string[]): Promise<LoadedFileTreeSource[]>;
    /**
     * Create a new branch source
     */
    createBranchSource(branchName: string, makeActive?: boolean): FileTreeSource | null;
    /**
     * Create a new tag source
     */
    createTagSource(tagName: string, makeActive?: boolean): FileTreeSource | null;
    /**
     * Create a new commit source
     */
    createCommitSource(commitSha: string, makeActive?: boolean): FileTreeSource | null;
    /**
     * Create a temporary source for experimentation
     */
    createTemporarySource(baseSourceId: string, location: string, locationType: 'branch' | 'tag' | 'commit'): FileTreeSource | null;
    /**
     * Switch to a different clone and load its tree
     */
    switchVisibleClone(repository: Repository, newClonePath: string): Promise<FileTreeSource | null>;
    /**
     * Clean up expired temporary sources
     */
    cleanupTemporarySources(maxAge?: number): number;
    /**
     * Refresh a source (invalidate cache and optionally reload)
     */
    refreshSource(sourceId: string, reload?: boolean): Promise<LoadedFileTreeSource | null>;
    /**
     * Refresh all sources of a specific type
     */
    refreshSourcesByType(type: 'local' | 'remote'): Promise<void>;
    /**
     * Update source metadata
     */
    updateSourceMetadata(sourceId: string, metadata: Partial<FileTreeSource['metadata']>): void;
    /**
     * Clear all sources
     */
    clear(): void;
    /**
     * Get statistics about sources
     */
    getStatistics(): {
        totalSources: number;
        localSources: number;
        remoteSources: number;
        temporarySources: number;
        activeSourceId: string | null;
        cacheStats: any;
    };
    /**
     * Export sources for persistence
     */
    exportSources(): {
        sources: FileTreeSource[];
        activeSourceId: string | null;
    };
    /**
     * Import sources from persistence
     */
    importSources(data: {
        sources: FileTreeSource[];
        activeSourceId?: string | null;
    }): void;
}
//# sourceMappingURL=FileTreeSourceService.d.ts.map