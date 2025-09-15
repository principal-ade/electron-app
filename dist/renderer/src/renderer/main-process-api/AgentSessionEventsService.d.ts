/**
 * Service layer for Agent Session Events functionality
 * ALL window.mainProcess.agentSessionEvents calls MUST be encapsulated here
 */
import type { AgentSessionEvent, AgentSessionEventsSubscribeResult, AgentSessionEventsClearResult } from '../../shared/main-process-api-interfaces/AgentSessionEventsAPI';
export declare class AgentSessionEventsService {
    /**
     * Subscribe to session events
     */
    static subscribe(provider?: string): Promise<AgentSessionEventsSubscribeResult>;
    /**
     * Clear stored events
     */
    static clearEvents(provider?: string): Promise<AgentSessionEventsClearResult>;
    /**
     * Get session events
     */
    static getSessionEvents(sessionId: string): Promise<AgentSessionEvent[]>;
    /**
     * Reprocess session events
     */
    static reprocessSessionEvents(sessionId: string): Promise<{
        success: boolean;
        processedCount?: number;
        error?: string;
    }>;
    /**
     * Reprocess all events
     */
    static reprocessAllEvents(): Promise<{
        success: boolean;
        processedCount?: number;
        error?: string;
    }>;
    /**
     * Get recent events from CLI providers
     */
    static getRecentEvents(provider?: string): Promise<AgentSessionEvent[]>;
    /**
     * Process a fallback file
     */
    static processFallbackFile(filePath: string, cli: string): Promise<{
        success: boolean;
        storedCount?: number;
        processedCount?: number;
        error?: string;
    }>;
}
//# sourceMappingURL=AgentSessionEventsService.d.ts.map