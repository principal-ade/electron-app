/**
 * Service for managing which clone is visible in the UI
 * Persists visibility state per repository in localStorage
 */
export class CloneVisibilityService {
    static STORAGE_KEY_PREFIX = 'clone_visibility_';
    /**
     * Get the storage key for a repository
     */
    static getStorageKey(remoteUrl) {
        // Use remote URL as the stable identifier
        const sanitized = remoteUrl.replace(/[^a-zA-Z0-9]/g, '_');
        return `${this.STORAGE_KEY_PREFIX}${sanitized}`;
    }
    /**
     * Get the visible clone path for a repository
     * Returns the first clone if no preference is stored
     */
    static getVisibleClonePath(repository) {
        if (!repository.localClones || repository.localClones.length === 0) {
            return null;
        }
        try {
            const stored = localStorage.getItem(this.getStorageKey(repository.remoteUrl));
            if (stored) {
                // Verify the stored path still exists in the clones
                const exists = repository.localClones.some(clone => clone.path === stored);
                if (exists) {
                    return stored;
                }
            }
        }
        catch (error) {
            console.error('Failed to get visible clone:', error);
        }
        // Default to first clone
        return repository.localClones[0].path;
    }
    /**
     * Set the visible clone path for a repository
     */
    static setVisibleClonePath(remoteUrl, clonePath) {
        try {
            localStorage.setItem(this.getStorageKey(remoteUrl), clonePath);
        }
        catch (error) {
            console.error('Failed to set visible clone:', error);
        }
    }
    /**
     * Clear visibility preference for a repository
     */
    static clearVisibility(remoteUrl) {
        try {
            localStorage.removeItem(this.getStorageKey(remoteUrl));
        }
        catch (error) {
            console.error('Failed to clear visibility:', error);
        }
    }
    /**
     * Check if a specific clone is visible
     */
    static isCloneVisible(repository, clonePath) {
        const visiblePath = this.getVisibleClonePath(repository);
        return visiblePath === clonePath;
    }
    /**
     * Get visibility state for all clones
     */
    static getCloneVisibilityMap(repository) {
        const visiblePath = this.getVisibleClonePath(repository);
        const map = new Map();
        repository.localClones.forEach(clone => {
            map.set(clone.path, clone.path === visiblePath);
        });
        return map;
    }
}
