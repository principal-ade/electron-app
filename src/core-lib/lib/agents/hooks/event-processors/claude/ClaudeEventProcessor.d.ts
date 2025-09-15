/**
 * Claude Hook Adapter
 * Handles Claude-specific hook data while preserving all fields
 */
import { NormalizedAgentSessionEvent } from '../../types/NormalizedAgentSessionEvent';
import { AgentEventProcessor } from '../AgentEventProcessor';
import type { ClaudeHookInput } from './types';
export declare class ClaudeEventProcessor implements AgentEventProcessor<ClaudeHookInput> {
    /**
     * Normalize Claude hook data into standardized format
     */
    normalize(rawData: ClaudeHookInput): NormalizedAgentSessionEvent;
    /**
     * Extract tool information if this is a tool event
     * @deprecated Use normalized event's toolName and toolInput
     */
    extractToolInfo(event: any): {
        toolName: string;
        toolInput: unknown;
    } | null;
}
