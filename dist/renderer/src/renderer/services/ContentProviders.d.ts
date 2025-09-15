/**
 * Content Provider Interface for Search
 * Abstracts file content access for different repository types
 */
export interface ContentProvider {
    /**
     * Check if this provider can provide file content
     */
    canProvideContent(): boolean;
    /**
     * Read a single file's content
     */
    readFileContent(filePath: string): Promise<string | null>;
    /**
     * Optional: Read multiple files in batch (for performance)
     */
    bulkReadFiles?(filePaths: string[]): Promise<Map<string, string>>;
    /**
     * Get provider capabilities for UI adaptation
     */
    getCapabilities(): ContentProviderCapabilities;
}
export interface ContentProviderCapabilities {
    supportsContentSearch: boolean;
    supportsStreaming?: boolean;
    requiresAuthentication?: boolean;
    rateLimit?: {
        requestsPerHour: number;
        remaining?: number;
    };
    estimatedLatency?: 'low' | 'medium' | 'high';
}
/**
 * Local filesystem content provider
 * Used for local development repositories
 */
export declare class LocalFileSystemProvider implements ContentProvider {
    canProvideContent(): boolean;
    readFileContent(filePath: string): Promise<string | null>;
    bulkReadFiles(filePaths: string[]): Promise<Map<string, string>>;
    getCapabilities(): ContentProviderCapabilities;
}
/**
 * GitHub API content provider using main process
 * Uses gh CLI if available, falls back to HTTPS API
 */
export declare class GitHubContentProvider implements ContentProvider {
    private owner;
    private repo;
    private branch;
    private rateLimitRemaining?;
    private isAuthenticated;
    private authMethod;
    constructor(owner: string, repo: string, branch?: string);
    private checkAuthStatus;
    canProvideContent(): boolean;
    readFileContent(filePath: string): Promise<string | null>;
    bulkReadFiles(filePaths: string[]): Promise<Map<string, string>>;
    getCapabilities(): ContentProviderCapabilities;
}
/**
 * Null content provider
 * Used when content search is not available
 */
export declare class NullContentProvider implements ContentProvider {
    canProvideContent(): boolean;
    readFileContent(): Promise<null>;
    getCapabilities(): ContentProviderCapabilities;
}
/**
 * Cached content provider wrapper
 * Wraps another provider and adds caching
 */
export declare class CachedContentProvider implements ContentProvider {
    private innerProvider;
    private cache;
    private cacheTimeout;
    constructor(innerProvider: ContentProvider);
    canProvideContent(): boolean;
    readFileContent(filePath: string): Promise<string | null>;
    bulkReadFiles(filePaths: string[]): Promise<Map<string, string>>;
    getCapabilities(): ContentProviderCapabilities;
    clearCache(): void;
}
//# sourceMappingURL=ContentProviders.d.ts.map