/**
 * Gemini Hook Adapter
 * Handles Gemini-specific hook data while preserving all fields
 */
import { NormalizedAgentSessionEvent } from '../../types/NormalizedAgentSessionEvent';
import { AgentEventProcessor } from '../AgentEventProcessor';
import type { GeminiHookInput } from './types';
export declare class GeminiEventProcessor implements AgentEventProcessor<GeminiHookInput> {
    /**
     * Normalize Gemini hook data into standardized format
     */
    normalize(rawData: GeminiHookInput): NormalizedAgentSessionEvent;
    /**
     * Extract tool information if this is a tool event
     * @deprecated Use normalized event's toolName and toolInput
     */
    extractToolInfo(event: any): {
        toolName: string;
        toolInput: unknown;
    } | null;
}
