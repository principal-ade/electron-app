/**
 * OpenCode Hook Adapter
 * Handles OpenCode's Anthropic-compatible hook data
 */
import { NormalizedAgentSessionEvent } from '../../types/NormalizedAgentSessionEvent';
import { AgentEventProcessor } from '../AgentEventProcessor';
import type { OpenCodeHookInput } from './types';
export declare class OpenCodeEventProcessor implements AgentEventProcessor<OpenCodeHookInput> {
    /**
     * Normalize OpenCode hook data into standardized format
     * OpenCode uses Anthropic-compatible hooks, so this is similar to Claude
     */
    normalize(rawData: OpenCodeHookInput): NormalizedAgentSessionEvent;
    /**
     * Extract tool information if this is a tool event
     * @deprecated Use normalized event's toolName and toolInput
     */
    extractToolInfo(event: any): {
        toolName: string;
        toolInput: unknown;
    } | null;
}
