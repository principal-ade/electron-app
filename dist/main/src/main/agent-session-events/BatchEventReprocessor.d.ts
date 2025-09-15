import { SupportedAgent, ClaudeHookInput, GeminiHookInput, OpenCodeHookInput } from "@principal-ai/agent-monitoring";
import { ProcessedSessionData } from '../storage-providers/typed-namespaces';
type AgentHookInput = ClaudeHookInput | GeminiHookInput | OpenCodeHookInput;
/**
 * Optimized batch reprocessor for session events
 * Creates ProcessedSessionData with flat event list for efficient bulk operations
 */
export declare class BatchEventReprocessor {
    private adapters;
    constructor();
    /**
     * Reprocess all events for a session in an optimized batch mode
     * Returns ProcessedSessionData with flat normalized event list
     */
    reprocessSessionBatch(sessionId: string, events: Array<{
        provider: SupportedAgent;
        data: AgentHookInput;
    }>, onProgress?: (current: number, total: number) => void): Promise<ProcessedSessionData>;
    /**
     * Store the processed session data using type-safe store
     */
    storeProcessedSession(sessionData: ProcessedSessionData): Promise<void>;
    /**
     * Enrich event with normalized working directory during batch processing
     * Also updates repository tracking
     */
    private enrichEventWithGitRoot;
    /**
     * Calculate counters from normalized events
     */
    private calculateCounters;
    /**
     * Check if a tool is a file reading tool
     */
    private isFileReadTool;
    /**
     * Check if a tool is a file writing tool
     */
    private isFileWriteTool;
    /**
     * Check if a tool is a web access tool
     */
    private isWebAccessTool;
}
export {};
//# sourceMappingURL=BatchEventReprocessor.d.ts.map