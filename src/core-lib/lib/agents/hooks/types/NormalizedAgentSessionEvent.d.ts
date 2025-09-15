/**
 * Normalized event structure for all agent session events
 * This provides a consistent interface across different agents (Claude, Gemini, OpenCode, etc.)
 */
import { SupportedAgent } from '../../supported-agents';
import { NormalizedPathInfo, FileOperation } from './PathNormalization';
/**
 * Known event types across all agents
 * Using 'unknown' for events we haven't categorized yet
 */
export type NormalizedEventType = 'pre-tool-use' | 'post-tool-use' | 'notification' | 'user-prompt-submit' | 'stop' | 'subagent-stop' | 'pre-compact' | 'session-start' | 'lifecycle' | 'unknown';
/**
 * Common tool names across agents
 * This is a union of known tools, but we accept string for flexibility
 */
export type CommonToolName = 'Task' | 'Bash' | 'Glob' | 'Grep' | 'Read' | 'Edit' | 'MultiEdit' | 'Write' | 'WebFetch' | 'WebSearch' | 'LS' | 'TodoWrite' | 'NotebookRead' | 'NotebookEdit' | 'ExitPlanMode' | string;
/**
 * Normalized agent session event
 * This is what all agent event processors should return
 */
export interface NormalizedAgentSessionEvent {
    eventType: NormalizedEventType;
    sessionId: string;
    workingDirectory: string;
    normalizedWorkingDirectory?: string;
    transcriptPath?: string;
    timestamp: number;
    toolName?: CommonToolName;
    toolInput?: unknown;
    toolOutput?: unknown;
    files?: NormalizedPathInfo[];
    operation?: FileOperation;
    data?: {
        prompt?: string;
        message?: string;
        stopHookActive?: boolean;
        trigger?: 'manual' | 'auto';
        customInstructions?: string;
        source?: 'startup' | 'resume' | 'clear';
        [key: string]: unknown;
    };
    raw: unknown;
    provider: SupportedAgent;
}
/**
 * Type guard to check if an object is a normalized event
 */
export declare function isNormalizedAgentSessionEvent(obj: unknown): obj is NormalizedAgentSessionEvent;
/**
 * Helper to determine if an event is a tool event
 */
export declare function isToolEvent(event: NormalizedAgentSessionEvent): boolean;
/**
 * Helper to determine if an event is a stop event
 */
export declare function isStopEvent(event: NormalizedAgentSessionEvent): boolean;
/**
 * Helper to extract file path from tool input (if applicable)
 */
export declare function extractFilePath(event: NormalizedAgentSessionEvent): string | undefined;
