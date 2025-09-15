/**
 * Gemini Hook Types
 * Based on Gemini CLI documentation and Claude-compatible structure
 */
export interface GeminiHookData {
    session_id?: string;
    agent_type: 'gemini';
    hook_event_name: string;
    tool_name?: string;
    tool_input?: Record<string, unknown>;
    tool_response?: Record<string, unknown>;
    params?: Record<string, unknown>;
    working_directory?: string;
    timestamp?: number;
}
export interface GeminiPreToolUseData extends GeminiHookData {
    hook_event_name: 'PreToolUse';
    tool_name: string;
    tool_input: Record<string, unknown>;
}
export interface GeminiPostToolUseData extends GeminiHookData {
    hook_event_name: 'PostToolUse';
    tool_name: string;
    tool_input: Record<string, unknown>;
    tool_response: Record<string, unknown>;
}
export interface GeminiStopHookData extends GeminiHookData {
    hook_event_name: 'Stop';
}
export interface GeminiNotificationData extends GeminiHookData {
    hook_event_name: 'Notification';
    message?: string;
    level?: 'info' | 'warning' | 'error';
}
export interface GeminiSubagentStopData extends GeminiHookData {
    hook_event_name: 'SubagentStop';
    subagent_id?: string;
}
export interface GeminiPreCompactData extends GeminiHookData {
    hook_event_name: 'PreCompact';
    conversation_length?: number;
}
export type GeminiHookInput = GeminiPreToolUseData | GeminiPostToolUseData | GeminiStopHookData | GeminiNotificationData | GeminiSubagentStopData | GeminiPreCompactData;
/**
 * Gemini tool names (based on README)
 */
export declare const GEMINI_TOOLS: {
    readonly READ_FILE: "read_file";
    readonly WRITE_FILE: "write_file";
    readonly REPLACE: "replace";
    readonly FIND: "find";
    readonly GREP: "grep";
    readonly RUN_SHELL: "run_shell";
    readonly WEB_FETCH: "web_fetch";
    readonly GOOGLE_WEB_SEARCH: "google_web_search";
};
export type GeminiToolName = (typeof GEMINI_TOOLS)[keyof typeof GEMINI_TOOLS];
/**
 * Type guards
 */
export declare function isGeminiPreToolUse(data: unknown): data is GeminiPreToolUseData;
export declare function isGeminiPostToolUse(data: unknown): data is GeminiPostToolUseData;
export declare function isGeminiStopHook(data: unknown): data is GeminiStopHookData;
export declare function isGeminiNotification(data: unknown): data is GeminiNotificationData;
export declare function isGeminiSubagentStop(data: unknown): data is GeminiSubagentStopData;
export declare function isGeminiPreCompact(data: unknown): data is GeminiPreCompactData;
