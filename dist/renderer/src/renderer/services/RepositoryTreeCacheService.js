import { FilesystemService } from "@principal-ai/codebase-composition";
import { ElectronFileSystemAdapter } from '../adapters/ElectronFileSystemAdapter';
export class RepositoryTreeCacheService {
    static instance;
    cache = new Map();
    filesystemService;
    // Cache TTL in milliseconds (5 minutes)
    CACHE_TTL = 5 * 60 * 1000;
    constructor() {
        const adapter = new ElectronFileSystemAdapter();
        this.filesystemService = new FilesystemService(adapter);
    }
    static getInstance() {
        if (!RepositoryTreeCacheService.instance) {
            RepositoryTreeCacheService.instance = new RepositoryTreeCacheService();
        }
        return RepositoryTreeCacheService.instance;
    }
    /**
     * Get filesystem tree for a repository, using cache if available
     */
    async getTreeForRepository(gitRoot) {
        // Check cache
        const cached = this.cache.get(gitRoot);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.tree;
        }
        // Build new tree
        try {
            const tree = await this.filesystemService.buildFileSystemTreeFromPath(gitRoot, [], // No user filters
            { generateWarningsForMandatoryFilters: false });
            if (tree) {
                // Cache the result
                this.cache.set(gitRoot, {
                    tree,
                    timestamp: Date.now(),
                });
            }
            return tree;
        }
        catch (error) {
            console.error(`[RepositoryTreeCache] Error building tree for ${gitRoot}:`, error);
            return null;
        }
    }
    /**
     * Clear cache for a specific repository
     */
    clearCache(gitRoot) {
        if (gitRoot) {
            this.cache.delete(gitRoot);
        }
        else {
            this.cache.clear();
        }
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            repositories: Array.from(this.cache.keys()),
            entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
                repository: key,
                age: Date.now() - entry.timestamp,
                fileCount: entry.tree.allFiles?.length || 0,
            })),
        };
    }
}
// Export singleton instance
export const repositoryTreeCache = RepositoryTreeCacheService.getInstance();
