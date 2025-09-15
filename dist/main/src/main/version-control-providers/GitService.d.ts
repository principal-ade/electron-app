import type { GitInfo } from '../../shared/types/git.types';
export declare class GitService {
    private gitInfoCache;
    private cacheTimeout;
    private branchService;
    /**
     * Get git information for a directory
     */
    getGitInfo(directory: string): Promise<GitInfo | null>;
    /**
     * Normalize git URL to https format
     */
    private normalizeGitUrl;
    /**
     * Clear the cache
     */
    clearCache(): void;
}
//# sourceMappingURL=GitService.d.ts.map