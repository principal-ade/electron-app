import { type AgentSessionEventsAPI } from '../../shared/main-process-api-interfaces/AgentSessionEventsAPI';
import { NormalizedAgentSessionEvent } from "@principal-ai/agent-monitoring";
export type SessionEventType = 'session-created' | 'session-updated' | 'session-stopped' | 'event-processed';
export interface SessionEventUpdate {
    type: SessionEventType;
    sessionId: string;
    workingDirectory: string;
    event?: NormalizedAgentSessionEvent;
    timestamp: number;
}
declare class AgentSessionEventsAPIExtended implements AgentSessionEventsAPI {
    private eventListeners;
    constructor();
    subscribe: (provider?: string) => Promise<any>;
    getRecentEvents: (provider?: string) => Promise<any>;
    getSessionEvents: (sessionId: string) => Promise<any>;
    clearEvents: (provider?: string) => Promise<any>;
    reprocessAllEvents: () => Promise<any>;
    reprocessSessionEvents: (sessionId: string) => Promise<any>;
    processFallbackFile: (filePath: string, cli: string) => Promise<any>;
    /**
     * Watch for real-time session events for a directory
     */
    watchSessionEvents(directory: string, callback: (update: SessionEventUpdate) => void): () => void;
    /**
     * Get live session statistics
     */
    getSessionStats(sessionId: string): Promise<{
        fileReadCount: number;
        fileWriteCount: number;
        toolCallCount: number;
        webAccessCount: number;
        lastActivity: number;
        isActive: boolean;
        currentTool?: string;
        currentFile?: string;
    }>;
    private notifyListeners;
}
export declare const agentSessionEventsAPI: AgentSessionEventsAPIExtended;
export {};
//# sourceMappingURL=agentSessionEventsApi.d.ts.map