/**
 * Service for managing which clone is visible in the UI
 * Persists visibility state per repository in localStorage
 */
export declare class CloneVisibilityService {
    private static STORAGE_KEY_PREFIX;
    /**
     * Get the storage key for a repository
     */
    private static getStorageKey;
    /**
     * Get the visible clone path for a repository
     * Returns the first clone if no preference is stored
     */
    static getVisibleClonePath(repository: {
        remoteUrl: string;
        localClones: Array<{
            path: string;
        }>;
    }): string | null;
    /**
     * Set the visible clone path for a repository
     */
    static setVisibleClonePath(remoteUrl: string, clonePath: string): void;
    /**
     * Clear visibility preference for a repository
     */
    static clearVisibility(remoteUrl: string): void;
    /**
     * Check if a specific clone is visible
     */
    static isCloneVisible(repository: {
        remoteUrl: string;
        localClones: Array<{
            path: string;
        }>;
    }, clonePath: string): boolean;
    /**
     * Get visibility state for all clones
     */
    static getCloneVisibilityMap(repository: {
        remoteUrl: string;
        localClones: Array<{
            path: string;
        }>;
    }): Map<string, boolean>;
}
//# sourceMappingURL=CloneVisibilityService.d.ts.map