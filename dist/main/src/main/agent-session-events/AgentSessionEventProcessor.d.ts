import { EventEmitter } from 'events';
import { SupportedAgent, NormalizedAgentSessionEvent, ClaudeHookInput, GeminiHookInput, OpenCodeHookInput } from "@principal-ai/agent-monitoring";
import { ProcessedSessionData } from '../storage-providers/typed-namespaces';
type AgentHookInput = ClaudeHookInput | GeminiHookInput | OpenCodeHookInput;
export declare class AgentSessionEventProcessor extends EventEmitter {
    private adapters;
    private pathNormalizer;
    private eventQueue;
    constructor();
    /**
     * Process a raw event from a hook
     */
    processRawEvent(provider: SupportedAgent, rawData: AgentHookInput): Promise<NormalizedAgentSessionEvent>;
    /**
     * Store normalized event in AGENT_SESSIONS namespace
     * Uses EventQueue to serialize writes per session and prevent race conditions
     */
    private storeNormalizedEvent;
    /**
     * Update session counters based on normalized event
     */
    private updateSessionCounters;
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
    /**
     * Log important events using normalized event data
     */
    private logEvent;
    /**
     * Enrich event with normalized working directory (git root)
     * This adds the git root as normalizedWorkingDirectory
     */
    private enrichEventWithGitRoot;
    /**
     * Update repository tracking for the session
     * Uses the normalizedWorkingDirectory from the enriched event
     */
    private updateRepositoryTracking;
    /**
     * Get session data by session ID
     */
    getSessionData(sessionId: string): Promise<ProcessedSessionData | null>;
    /**
     * Get all session IDs
     */
    getAllSessionIds(): Promise<string[]>;
    /**
     * Delete a session
     */
    deleteSession(sessionId: string): Promise<boolean>;
    /**
     * Emit session created event to all windows
     */
    private emitSessionCreatedEvent;
}
export {};
//# sourceMappingURL=AgentSessionEventProcessor.d.ts.map