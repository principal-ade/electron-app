/**
 * Gemini Hook Event Types
 * Based on official Gemini CLI documentation
 * https://github.com/principle-md/gemini-cli/blob/add-hooks-feature/docs/hooks.md
 */
/**
 * Common fields present in all Gemini hook events
 */
export interface GeminiHookCommon {
    session_id: string;
    transcript_path: string;
    working_directory: string;
    hook_event_name: string;
}
/**
 * PreToolUse event - before tool execution
 */
export interface GeminiPreToolUseEvent extends GeminiHookCommon {
    hook_event_name: 'PreToolUse';
    tool_name: string;
    tool_use_input: string;
}
/**
 * PostToolUse event - after tool execution
 */
export interface GeminiPostToolUseEvent extends GeminiHookCommon {
    hook_event_name: 'PostToolUse';
    tool_name: string;
    tool_use_input: string;
    tool_response: unknown;
    duration?: number;
    result_size?: number;
}
/**
 * Notification event
 */
export interface GeminiNotificationEvent extends GeminiHookCommon {
    hook_event_name: 'Notification';
    message: string;
}
/**
 * UserPromptSubmit event - when user submits a prompt
 */
export interface GeminiUserPromptSubmitEvent extends GeminiHookCommon {
    hook_event_name: 'UserPromptSubmit';
    prompt: string;
}
/**
 * Stop event - when Gemini finishes responding
 */
export interface GeminiStopEvent extends GeminiHookCommon {
    hook_event_name: 'Stop';
    trigger?: 'user' | 'error' | 'complete';
    reason?: string;
    stop_hook_active?: boolean;
}
/**
 * SubagentStop event - when a subagent (Task tool) finishes
 */
export interface GeminiSubagentStopEvent extends GeminiHookCommon {
    hook_event_name: 'SubagentStop';
    task_id?: string;
    stop_hook_active?: boolean;
}
/**
 * PreCompact event - before context compaction
 */
export interface GeminiPreCompactEvent extends GeminiHookCommon {
    hook_event_name: 'PreCompact';
    trigger: 'manual' | 'auto';
    custom_instructions?: string;
    context_size?: number;
}
/**
 * SessionStart event - when session starts or resumes
 */
export interface GeminiSessionStartEvent extends GeminiHookCommon {
    hook_event_name: 'SessionStart';
    source: 'startup' | 'resume' | 'clear';
    resume_from?: string;
}
/**
 * Union type of all Gemini hook events
 */
export type GeminiHookEvent = GeminiPreToolUseEvent | GeminiPostToolUseEvent | GeminiNotificationEvent | GeminiUserPromptSubmitEvent | GeminiStopEvent | GeminiSubagentStopEvent | GeminiPreCompactEvent | GeminiSessionStartEvent;
/**
 * Type guards for Gemini events
 */
export declare function isGeminiPreToolUse(data: unknown): data is GeminiPreToolUseEvent;
export declare function isGeminiPostToolUse(data: unknown): data is GeminiPostToolUseEvent;
export declare function isGeminiNotification(data: unknown): data is GeminiNotificationEvent;
export declare function isGeminiUserPromptSubmit(data: unknown): data is GeminiUserPromptSubmitEvent;
export declare function isGeminiStop(data: unknown): data is GeminiStopEvent;
export declare function isGeminiSubagentStop(data: unknown): data is GeminiSubagentStopEvent;
export declare function isGeminiPreCompact(data: unknown): data is GeminiPreCompactEvent;
export declare function isGeminiSessionStart(data: unknown): data is GeminiSessionStartEvent;
/**
 * Base type guard for Gemini events
 */
export declare function isGeminiEvent(data: unknown): data is GeminiHookEvent;
/**
 * Known Gemini tool names
 * Based on the documentation
 */
export declare const GEMINI_TOOLS: {
    readonly READ_FILE: "read_file";
    readonly WRITE_FILE: "write_file";
    readonly EDIT_FILE: "str_replace_editor";
    readonly BASH: "bash";
    readonly GLOB: "glob";
    readonly GREP: "grep";
    readonly LIST_FILES: "list_files";
    readonly WEB_SEARCH: "web_search";
    readonly GET_URL: "get_url";
    readonly TASK: "task";
    readonly TODO_UPDATE: "todo_update";
    readonly ASK_FOLLOWUP: "ask_followup_question";
    readonly ATTEMPT_COMPLETION: "attempt_completion";
};
export type GeminiToolName = (typeof GEMINI_TOOLS)[keyof typeof GEMINI_TOOLS] | string;
//# sourceMappingURL=gemini-hook-types.d.ts.map