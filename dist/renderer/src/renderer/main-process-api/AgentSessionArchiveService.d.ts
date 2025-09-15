/**
 * Service layer for Agent Session Archive functionality
 * ALL window.mainProcess.agentSessionArchive calls MUST be encapsulated here
 */
import type { ArchiveConfiguration, ArchivedSessionSummary, ArchiveStatistics, ArchiveSessionOptions } from '../../shared/main-process-api-interfaces/AgentSessionArchiveAPI';
import type { SessionState } from '../../shared/event-processing/SessionEventProcessor';
export declare class AgentSessionArchiveService {
    /**
     * Archive a session
     */
    static archiveSession(sessionId: string, options?: ArchiveSessionOptions): Promise<void>;
    /**
     * List all archived sessions
     */
    static listArchivedSessions(): Promise<ArchivedSessionSummary[]>;
    /**
     * Get an archived session
     */
    static getArchivedSession(sessionId: string): Promise<SessionState | null>;
    /**
     * Delete an archived session
     */
    static deleteArchivedSession(sessionId: string): Promise<void>;
    /**
     * Get archive configuration
     */
    static getConfiguration(): Promise<ArchiveConfiguration>;
    /**
     * Update archive configuration
     */
    static updateConfiguration(config: Partial<ArchiveConfiguration>): Promise<void>;
    /**
     * Reset configuration to defaults
     */
    static resetConfiguration(): Promise<void>;
    /**
     * Archive all sessions
     */
    static archiveAllInactive(): Promise<number>;
    /**
     * Get archive statistics
     */
    static getStatistics(): Promise<ArchiveStatistics>;
    /**
     * Restore an archived session
     */
    static restoreArchivedSession(sessionId: string): Promise<void>;
}
//# sourceMappingURL=AgentSessionArchiveService.d.ts.map