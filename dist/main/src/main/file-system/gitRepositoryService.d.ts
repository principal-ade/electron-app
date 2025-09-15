export interface GitRepositoryInfo {
    root: string;
    relativePath: string;
    isRepository: boolean;
    remotes?: Array<{
        name: string;
        url: string;
        owner?: string;
        repo?: string;
    }>;
}
export interface PackageInfo {
    path: string;
    name: string;
    version?: string;
    type: 'npm' | 'yarn' | 'pnpm' | 'unknown';
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
}
export declare class GitRepositoryService {
    private repositoryCache;
    private packageCache;
    private readonly CACHE_TTL;
    private cleanupInterval;
    constructor();
    /**
     * Cleanup method to be called when service is destroyed
     */
    destroy(): void;
    /**
     * Clear the repository cache (useful for debugging)
     */
    clearRepositoryCache(): void;
    /**
     * Clean up expired cache entries to prevent memory growth
     */
    cleanupExpiredCacheEntries(): void;
    /**
     * Get cache information for debugging
     */
    getCacheInfo(): {
        size: number;
        entries: string[];
    };
    /**
     * Check if cache entry is still valid
     */
    private isCacheValid;
    /**
     * Normalize input path to absolute path for consistent caching
     */
    private normalizePath;
    /**
     * Find the git repository root for a given file path or directory
     */
    findGitRoot(filePath: string): Promise<string | null>;
    /**
     * Get repository information for a file path or directory
     */
    getRepositoryInfo(filePath: string): Promise<GitRepositoryInfo | null>;
    /**
     * Find the nearest package.json for a file
     */
    findNearestPackage(filePath: string): Promise<PackageInfo | null>;
    /**
     * Get a tree of repositories from a list of paths (files or directories)
     */
    getRepositoryTree(filePaths: string[]): Promise<Map<string, {
        info: GitRepositoryInfo;
        files: string[];
        packages: Map<string, PackageInfo>;
    }>>;
    /**
     * Detect package manager by looking for lock files
     * First checks the package directory, then works up to git root
     */
    private detectPackageManager;
    /**
     * Clear caches
     */
    clearCache(): void;
    /**
     * Check if a directory is a git repository
     */
    isGitRepository(directory: string): Promise<boolean>;
    /**
     * Get git status for a directory
     */
    getGitStatus(directory: string): Promise<{
        staged: string[];
        unstaged: string[];
        untracked: string[];
    }>;
    /**
     * Stage files for commit
     */
    stageFiles(directory: string, files: string[]): Promise<void>;
    /**
     * Create a git commit
     */
    createCommit(directory: string, message: string): Promise<string>;
    /**
     * Get list of files changed in the current session (not yet committed)
     */
    getUncommittedChanges(directory: string): Promise<string[]>;
    /**
     * Get detailed change information for files
     */
    getDetailedChanges(directory: string, files?: string[]): Promise<{
        created: string[];
        modified: string[];
        deleted: string[];
        renamed: Array<{
            from: string;
            to: string;
        }>;
        stats: {
            additions: number;
            deletions: number;
        };
        fileStats: Record<string, {
            additions: number;
            deletions: number;
        }>;
    }>;
}
//# sourceMappingURL=gitRepositoryService.d.ts.map