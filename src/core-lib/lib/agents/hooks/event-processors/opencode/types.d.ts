/**
 * OpenCode Hook Types
 * Based on opencode-with-hooks implementation
 */
export interface OpenCodeHookData {
    agent_type: string;
    session_id: string;
    timestamp?: number;
    hook_event_name: string;
    tool_name?: string;
    tool_input?: Record<string, unknown>;
    tool_response?: Record<string, unknown>;
    [key: string]: unknown;
}
export interface OpenCodeToolCallData extends OpenCodeHookData {
    hook_event_name: 'tool_call' | 'tool_call_hook';
    tool_name: string;
    tool_input: Record<string, unknown>;
    tool_response?: Record<string, unknown>;
}
export interface OpenCodeFileReadData extends OpenCodeHookData {
    hook_event_name: 'file_read' | 'file_read_hook';
    tool_name: string;
    tool_input: {
        file_path: string;
        [key: string]: unknown;
    };
}
export interface OpenCodeFileEditedData extends OpenCodeHookData {
    hook_event_name: 'file_edited' | 'file_edited_hook';
    tool_name: string;
    tool_input: {
        file_path: string;
        content?: string;
        old_string?: string;
        new_string?: string;
        [key: string]: unknown;
    };
}
export interface OpenCodeWebAccessData extends OpenCodeHookData {
    hook_event_name: 'web_access' | 'web_access_hook';
    tool_name: string;
    tool_input: {
        url?: string;
        query?: string;
        prompt?: string;
        [key: string]: unknown;
    };
}
export interface OpenCodeSessionStopData extends OpenCodeHookData {
    hook_event_name: 'session_stop' | 'session_stop_hook';
}
export type OpenCodeHookInput = OpenCodeToolCallData | OpenCodeFileReadData | OpenCodeFileEditedData | OpenCodeWebAccessData | OpenCodeSessionStopData;
/**
 * OpenCode tool names (based on Claude tools)
 */
export declare const OPENCODE_TOOLS: {
    readonly READ: "Read";
    readonly WRITE: "Write";
    readonly EDIT: "Edit";
    readonly MULTI_EDIT: "MultiEdit";
    readonly WEB_FETCH: "WebFetch";
    readonly WEB_SEARCH: "WebSearch";
    readonly BASH: "Bash";
    readonly GREP: "Grep";
    readonly GLOB: "Glob";
    readonly LS: "LS";
    readonly TODO_WRITE: "TodoWrite";
    readonly TASK: "Task";
};
export type OpenCodeToolName = (typeof OPENCODE_TOOLS)[keyof typeof OPENCODE_TOOLS] | string;
/**
 * Type guards
 */
export declare function isOpenCodeToolCall(data: unknown): data is OpenCodeToolCallData;
export declare function isOpenCodeFileRead(data: unknown): data is OpenCodeFileReadData;
export declare function isOpenCodeFileEdited(data: unknown): data is OpenCodeFileEditedData;
export declare function isOpenCodeWebAccess(data: unknown): data is OpenCodeWebAccessData;
export declare function isOpenCodeSessionStop(data: unknown): data is OpenCodeSessionStopData;
