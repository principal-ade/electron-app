interface MCPBridgeRequest {
    id: string;
    endpoint: string;
    method: string;
    body: any;
    headers?: Record<string, string>;
    timestamp: number;
    repositoryUrl?: string;
    filePath?: string;
}
interface MCPBridgeResponse {
    id: string;
    requestId: string;
    statusCode: number;
    body: any;
    headers?: Record<string, string>;
    timestamp: number;
    duration: number;
}
interface MCPBridgeDataEntry {
    request: MCPBridgeRequest;
    response?: MCPBridgeResponse;
    repositoryUrl?: string;
    sessionId?: string;
    tags?: string[];
}
interface MCPBridgeStatistics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    endpointUsage: Map<string, number>;
    lastAccessTime: number;
}
export declare class MCPBridgeDataStore {
    private memoryCache;
    private statisticsCache;
    private initialized;
    private initPromise;
    private maxEntriesPerRepository;
    private retentionDays;
    constructor();
    /**
     * Generate a storage key for a repository URL
     */
    private getRepositoryKey;
    /**
     * Generate a statistics key for a repository URL
     */
    private getStatisticsKey;
    /**
     * Ensure store is initialized before use
     */
    private ensureInitialized;
    /**
     * Initialize store from storage
     */
    private initializeStore;
    /**
     * Store a request/response pair
     */
    storeInteraction(request: Omit<MCPBridgeRequest, 'id' | 'timestamp'>, response?: Omit<MCPBridgeResponse, 'id' | 'requestId' | 'timestamp' | 'duration'>, filePath?: string): Promise<void>;
    /**
     * Store entry for a specific repository
     */
    private storeForRepository;
    /**
     * Update statistics for a repository
     */
    private updateStatistics;
    /**
     * Extract tags from request data
     * Only uses explicitly provided tags - no auto-generation
     */
    private extractTags;
    /**
     * Enforce retention policy on entries
     */
    private enforceRetentionPolicy;
    /**
     * Get all interactions for a repository
     */
    getInteractionsForRepository(repositoryUrl: string, options?: {
        startTime?: number;
        endTime?: number;
        endpoint?: string;
        tags?: string[];
        limit?: number;
    }): Promise<MCPBridgeDataEntry[]>;
    /**
     * Get statistics for a repository
     */
    getStatisticsForRepository(repositoryUrl: string): Promise<MCPBridgeStatistics | null>;
    /**
     * Export interactions for testing
     */
    exportForTesting(repositoryUrl: string, outputFormat?: 'json' | 'jest' | 'mocha'): Promise<string>;
    /**
     * Format interactions as Jest tests
     */
    private formatAsJestTests;
    /**
     * Format interactions as Mocha tests
     */
    private formatAsMochaTests;
    /**
     * Clear all data for a repository
     */
    clearRepositoryData(repositoryUrl: string): Promise<void>;
    /**
     * Get summary of all stored data
     */
    getSummary(): Promise<{
        totalRepositories: number;
        totalInteractions: number;
        oldestEntry: number | null;
        newestEntry: number | null;
        topEndpoints: Array<{
            endpoint: string;
            count: number;
        }>;
    }>;
}
export declare const mcpBridgeDataStore: MCPBridgeDataStore;
export {};
//# sourceMappingURL=MCPBridgeDataStore.d.ts.map