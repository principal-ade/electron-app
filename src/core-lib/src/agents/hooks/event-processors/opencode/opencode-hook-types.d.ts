/**
 * OpenCode Hook Event Types (Anthropic-compatible)
 * Based on OpenCode's Anthropic hooks implementation
 * https://github.com/principle-md/opencode/blob/feature/comprehensive-hooks-integration/HOOKS_INTEGRATION.md
 */
/**
 * Common fields present in all OpenCode hook events (Anthropic format)
 */
export interface OpenCodeHookCommon {
    session_id: string;
    transcript_path: string;
    cwd: string;
    hook_event_name: string;
}
/**
 * PreToolUse event - before tool execution
 */
export interface OpenCodePreToolUseEvent extends OpenCodeHookCommon {
    hook_event_name: 'PreToolUse';
    tool_name: string;
    tool_input: unknown;
}
/**
 * PostToolUse event - after tool execution
 */
export interface OpenCodePostToolUseEvent extends OpenCodeHookCommon {
    hook_event_name: 'PostToolUse';
    tool_name: string;
    tool_input: unknown;
    tool_response: unknown;
}
/**
 * Notification event
 */
export interface OpenCodeNotificationEvent extends OpenCodeHookCommon {
    hook_event_name: 'Notification';
    message: string;
}
/**
 * UserPromptSubmit event - when user submits a prompt
 */
export interface OpenCodeUserPromptSubmitEvent extends OpenCodeHookCommon {
    hook_event_name: 'UserPromptSubmit';
    prompt: string;
}
/**
 * Stop event - when OpenCode finishes responding
 */
export interface OpenCodeStopEvent extends OpenCodeHookCommon {
    hook_event_name: 'Stop';
    stop_hook_active?: boolean;
}
/**
 * SubagentStop event - when a subagent (Task tool) finishes
 */
export interface OpenCodeSubagentStopEvent extends OpenCodeHookCommon {
    hook_event_name: 'SubagentStop';
    stop_hook_active?: boolean;
}
/**
 * PreCompact event - before context compaction
 */
export interface OpenCodePreCompactEvent extends OpenCodeHookCommon {
    hook_event_name: 'PreCompact';
    trigger: 'manual' | 'auto';
    custom_instructions?: string;
}
/**
 * SessionStart event - when session starts or resumes
 */
export interface OpenCodeSessionStartEvent extends OpenCodeHookCommon {
    hook_event_name: 'SessionStart';
    source: 'startup' | 'resume' | 'clear';
}
/**
 * Union type of all OpenCode hook events (Anthropic format)
 */
export type OpenCodeHookEvent = OpenCodePreToolUseEvent | OpenCodePostToolUseEvent | OpenCodeNotificationEvent | OpenCodeUserPromptSubmitEvent | OpenCodeStopEvent | OpenCodeSubagentStopEvent | OpenCodePreCompactEvent | OpenCodeSessionStartEvent;
/**
 * Type guards for OpenCode events
 */
export declare function isOpenCodePreToolUse(data: unknown): data is OpenCodePreToolUseEvent;
export declare function isOpenCodePostToolUse(data: unknown): data is OpenCodePostToolUseEvent;
export declare function isOpenCodeNotification(data: unknown): data is OpenCodeNotificationEvent;
export declare function isOpenCodeUserPromptSubmit(data: unknown): data is OpenCodeUserPromptSubmitEvent;
export declare function isOpenCodeStop(data: unknown): data is OpenCodeStopEvent;
export declare function isOpenCodeSubagentStop(data: unknown): data is OpenCodeSubagentStopEvent;
export declare function isOpenCodePreCompact(data: unknown): data is OpenCodePreCompactEvent;
export declare function isOpenCodeSessionStart(data: unknown): data is OpenCodeSessionStartEvent;
/**
 * Base type guard for OpenCode events
 */
export declare function isOpenCodeEvent(data: unknown): data is OpenCodeHookEvent;
/**
 * Known OpenCode tool names (from Anthropic-compatible implementation)
 * Based on the documentation's tool list
 */
export declare const OPENCODE_TOOLS: {
    readonly READ: "Read";
    readonly WRITE: "Write";
    readonly EDIT: "Edit";
    readonly MULTI_EDIT: "MultiEdit";
    readonly BASH: "Bash";
    readonly GLOB: "Glob";
    readonly GREP: "Grep";
    readonly LS: "LS";
    readonly WEB_FETCH: "WebFetch";
    readonly WEB_SEARCH: "WebSearch";
    readonly TASK: "Task";
    readonly TODO_WRITE: "TodoWrite";
    readonly NOTEBOOK_READ: "NotebookRead";
    readonly NOTEBOOK_EDIT: "NotebookEdit";
    readonly EXIT_PLAN_MODE: "ExitPlanMode";
};
export type OpenCodeToolName = (typeof OPENCODE_TOOLS)[keyof typeof OPENCODE_TOOLS] | string;
//# sourceMappingURL=opencode-hook-types.d.ts.map