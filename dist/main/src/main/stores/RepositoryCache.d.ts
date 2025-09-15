import { Repository } from '../../shared/types/repository.types';
import type { GitInfo } from '../../shared/types/git.types';
export declare class RepositoryCache {
    private memoryCache;
    private gitService;
    private cacheTimeout;
    private repositoriesCache;
    private initialized;
    private initPromise;
    constructor();
    /**
     * Generate a storage key for a repository URL
     * Uses hash to avoid electron-store dot notation issues
     */
    private getRepositoryKey;
    /**
     * Ensure cache is initialized before use
     */
    private ensureInitialized;
    /**
     * Initialize cache from storage using type-safe store
     */
    private initializeCache;
    /**
     * Get repository info for a path, checking cache first
     */
    getRepositoryForPath(workingDirectory: string): Promise<{
        repository: Repository;
        gitInfo: GitInfo;
    } | null>;
    /**
     * Update repository access time using type-safe store
     */
    updateRepositoryAccess(remoteUrl: string): Promise<void>;
    /**
     * Get all repositories from cache
     */
    getAllRepositories(): Promise<Repository[]>;
    /**
     * Clear the memory cache (useful for testing)
     */
    clearMemoryCache(): void;
    /**
     * Detect VCS type from remote URL
     */
    private detectVCSType;
}
export declare const repositoryCache: RepositoryCache;
//# sourceMappingURL=RepositoryCache.d.ts.map