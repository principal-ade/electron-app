import { FileTree } from "@principal-ai/repository-abstraction";
export declare class RepositoryTreeCacheService {
    private static instance;
    private cache;
    private filesystemService;
    private readonly CACHE_TTL;
    private constructor();
    static getInstance(): RepositoryTreeCacheService;
    /**
     * Get filesystem tree for a repository, using cache if available
     */
    getTreeForRepository(gitRoot: string): Promise<FileTree | null>;
    /**
     * Clear cache for a specific repository
     */
    clearCache(gitRoot?: string): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        repositories: string[];
        entries: {
            repository: string;
            age: number;
            fileCount: number;
        }[];
    };
}
export declare const repositoryTreeCache: RepositoryTreeCacheService;
//# sourceMappingURL=RepositoryTreeCacheService.d.ts.map