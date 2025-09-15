import type { Repository } from '../../shared/types/repository.types';
import type { FileTreeSource } from '../types/file-tree-source';
/**
 * Service for managing which source is selected for a repository
 * Handles both local clones and remote branches/tags/commits
 */
export declare class SourceSelectionService {
    private static STORAGE_KEY_PREFIX;
    /**
     * Get the storage key for a repository
     */
    private static getStorageKey;
    /**
     * Get all available sources for a repository
     */
    static getAvailableSources(repository: Repository): FileTreeSource[];
    /**
     * Get the default source for a repository
     * Priority: first local clone > remote default branch
     */
    static getDefaultSource(repository: Repository): FileTreeSource | null;
    /**
     * Get the selected source for a repository
     * Returns stored selection or default if no selection is stored
     */
    static getSelectedSource(repository: Repository): FileTreeSource | null;
    /**
     * Set the selected source for a repository
     */
    static setSelectedSource(remoteUrl: string, sourceId: string): void;
    /**
     * Clear selection for a repository (will fall back to default)
     */
    static clearSelection(remoteUrl: string): void;
    /**
     * Check if a specific source is selected
     */
    static isSourceSelected(repository: Repository, sourceId: string): boolean;
    /**
     * Get user-friendly display name for a source
     */
    static getSourceDisplayName(source: FileTreeSource): string;
    /**
     * Get source type display name
     */
    static getSourceTypeDisplayName(source: FileTreeSource): string;
    /**
     * Create a new remote branch source and optionally select it
     */
    static createRemoteBranchSource(repository: Repository, branchName: string, makeSelected?: boolean): FileTreeSource | null;
    /**
     * Create a new remote tag source and optionally select it
     */
    static createRemoteTagSource(repository: Repository, tagName: string, makeSelected?: boolean): FileTreeSource | null;
    /**
     * Get sources grouped by type for UI display
     */
    static getGroupedSources(repository: Repository): {
        local: FileTreeSource[];
        remote: FileTreeSource[];
    };
}
//# sourceMappingURL=SourceSelectionService.d.ts.map