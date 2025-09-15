import { ToolContainerState, DockerAnalysisSession } from '../storage-providers/typed-namespaces';
/**
 * Service for managing Docker-related data in the typed store
 */
export declare class DockerStoreService {
    private static instance;
    private store;
    private constructor();
    static getInstance(): Promise<DockerStoreService>;
    /**
     * Save container state
     */
    saveContainerState(container: ToolContainerState): Promise<void>;
    /**
     * Get container state by ID
     */
    getContainerState(containerId: string): Promise<ToolContainerState | null>;
    /**
     * Get all containers for a tool
     */
    getContainersByTool(toolName: string): Promise<ToolContainerState[]>;
    /**
     * Get all active containers
     */
    getAllContainers(): Promise<ToolContainerState[]>;
    /**
     * Remove container from store
     */
    removeContainer(containerId: string): Promise<void>;
    /**
     * Update container metrics
     */
    updateContainerMetrics(containerId: string, metrics: Partial<ToolContainerState['metrics']>): Promise<void>;
    /**
     * Mark container as busy
     */
    markContainerBusy(containerId: string, sessionInfo: {
        sessionId: string;
        projectPath: string;
        startTime: number;
    }): Promise<void>;
    /**
     * Mark container as ready
     */
    markContainerReady(containerId: string): Promise<void>;
    /**
     * Save analysis session
     */
    saveSession(session: DockerAnalysisSession): Promise<void>;
    /**
     * Get session by ID
     */
    getSession(sessionId: string): Promise<DockerAnalysisSession | undefined>;
    /**
     * Get sessions by tool
     */
    getSessionsByTool(toolName: string, limit?: number): Promise<DockerAnalysisSession[]>;
    /**
     * Get sessions by repository
     */
    getSessionsByRepository(repositoryUrl: string, limit?: number): Promise<DockerAnalysisSession[]>;
    /**
     * Get recent sessions
     */
    getRecentSessions(limit?: number): Promise<DockerAnalysisSession[]>;
    /**
     * Get sessions by status
     */
    getSessionsByStatus(status: DockerAnalysisSession['status'], limit?: number): Promise<DockerAnalysisSession[]>;
    /**
     * Get running sessions
     */
    getRunningSessions(): Promise<DockerAnalysisSession[]>;
    /**
     * Get failed sessions
     */
    getFailedSessions(limit?: number): Promise<DockerAnalysisSession[]>;
    /**
     * Update session status
     */
    updateSessionStatus(sessionId: string, status: DockerAnalysisSession['status'], error?: string): Promise<void>;
    /**
     * Get tool usage statistics
     */
    getToolStatistics(toolName: string): Promise<{
        totalSessions: number;
        successfulSessions: number;
        failedSessions: number;
        avgExecutionTime: number;
        totalExecutionTime: number;
        lastUsed?: number;
    }>;
    /**
     * Get repository analysis statistics
     */
    getRepositoryStatistics(repositoryUrl: string): Promise<{
        totalAnalyses: number;
        toolsUsed: string[];
        lastAnalysis?: number;
        avgExecutionTime: number;
    }>;
    /**
     * Clean up old sessions
     */
    cleanupOldSessions(olderThanDays?: number): Promise<number>;
    /**
     * Remove stale container entries
     */
    removeStaleContainers(): Promise<number>;
    /**
     * Get storage usage summary
     */
    getStorageUsage(): Promise<{
        totalContainers: number;
        totalSessions: number;
        activeContainers: number;
        runningSessions: number;
    }>;
}
export declare const dockerStoreService: Promise<DockerStoreService>;
//# sourceMappingURL=DockerStoreService.d.ts.map