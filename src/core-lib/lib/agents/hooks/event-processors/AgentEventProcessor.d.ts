import { NormalizedAgentSessionEvent } from '../types/NormalizedAgentSessionEvent';
/**
 * Interface for agent-specific event processors
 * Each agent (Claude, Gemini, OpenCode) implements this to normalize their events
 */
export interface AgentEventProcessor<RawEventType = unknown> {
    /**
     * Normalize raw hook data into a consistent structure
     * @param rawData The raw event data from the agent's hook
     * @returns Normalized event that can be stored and processed consistently
     */
    normalize(rawData: RawEventType): NormalizedAgentSessionEvent;
    /**
     * Optional: Extract tool information from raw event
     * @deprecated Use the normalized event's toolName and toolInput instead
     */
    extractToolInfo?(event: any): {
        toolName: string;
        toolInput: unknown;
    } | null;
}
