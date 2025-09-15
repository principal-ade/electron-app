import { SessionSummary } from '../storage-providers/typed-namespaces';
import { AgentSessionEvent } from '../../shared/main-process-api-interfaces';
export interface StorageMetrics {
    archiveFiles: {
        count: number;
        totalSize: number;
        oldestFile?: Date;
        newestFile?: Date;
    };
    processedEvents: {
        sessionCount: number;
        totalSize: number;
    };
    rawEvents: {
        [agent: string]: {
            eventCount: number;
            totalSize: number;
        };
    };
    summaries: {
        count: number;
        totalSize: number;
    };
    totalStorageUsed: number;
}
export declare class AgentSessionArchivingService {
    private archiveDir;
    private readonly summariesNamespace;
    private readonly processedEventsNamespace;
    private maxSummaryAge;
    private maxArchiveAge;
    constructor();
    /**
     * Ensure the archive directory exists
     */
    private ensureArchiveDirectory;
    /**
     * Archive a completed session
     * @param sessionId - The session to archive
     * @param options - Optional settings for archiving
     */
    archiveSession(sessionId: string, options?: {
        skipCleanup?: boolean;
        skipProcessedDelete?: boolean;
    }): Promise<void>;
    /**
     * Get recent session summaries
     */
    getRecentSummaries(): Promise<SessionSummary[]>;
    /**
     * Load a full session from archive
     */
    loadArchivedSession(sessionId: string): Promise<{
        session?: any;
        metadata?: any;
        rawEvents?: AgentSessionEvent[];
    } | null>;
    /**
     * Clean up old archives and summaries
     */
    cleanupOldArchives(): Promise<void>;
    /**
     * Generate session directory name
     */
    private generateSessionDirName;
    /**
     * Collect raw events for a session - OPTIMIZED VERSION
     */
    private collectRawEvents;
    /**
     * Legacy method for collecting raw events (fallback)
     */
    private collectRawEventsLegacy;
    /**
     * Clean up raw events after archiving - OPTIMIZED VERSION
     */
    private cleanupRawEvents;
    /**
     * Clean up event indexes after deleting events
     */
    private cleanupEventIndexes;
    /**
     * Get archive configuration
     */
    private getArchiveConfig;
    /**
     * Check if file exists
     */
    private fileExists;
    /**
     * Write JSON file with optimized formatting
     */
    private writeJsonFile;
    /**
     * Write large JSON files using streaming approach to avoid memory issues
     */
    private writeJsonFileStreaming;
    /**
     * Extract working directory from session data
     */
    private extractWorkingDirectory;
    /**
     * Count file accesses in session
     */
    private countFileAccesses;
    /**
     * Count file writes in session
     */
    private countFileWrites;
    /**
     * Count tool calls in session
     */
    private countToolCalls;
    /**
     * Get storage metrics for all session data
     */
    getStorageMetrics(): Promise<StorageMetrics>;
    /**
     * Cleanup sessions by age or directory
     */
    cleanupSessions(options: {
        olderThanDays?: number;
        directory?: string;
        includeArchives?: boolean;
        includeProcessed?: boolean;
        includeRaw?: boolean;
    }): Promise<{
        deletedCount: number;
        freedSpace: number;
    }>;
    /**
     * Remove a directory recursively
     */
    private removeDirectory;
    /**
     * Get total size of a directory
     */
    private getDirectorySize;
    /**
     * List all archived sessions
     */
    listArchivedSessions(): Promise<any[]>;
    /**
     * Delete an archived session
     */
    deleteArchivedSession(sessionId: string): Promise<void>;
    /**
     * Restore an archived session to active (move from archive back to active storage)
     */
    restoreArchivedSession(sessionId: string): Promise<void>;
}
export declare const agentSessionArchivingService: AgentSessionArchivingService;
//# sourceMappingURL=AgentSessionArchivingService.d.ts.map