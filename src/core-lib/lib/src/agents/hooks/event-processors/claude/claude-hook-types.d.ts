/**
 * Claude Hook Event Types
 * Based on official Claude Code documentation
 * https://docs.anthropic.com/en/docs/claude-code/hooks
 */
/**
 * Common fields present in all Claude hook events
 */
export interface ClaudeHookCommon {
    session_id: string;
    transcript_path: string;
    cwd: string;
    hook_event_name: string;
}
/**
 * PreToolUse event - before tool execution
 */
export interface ClaudePreToolUseEvent extends ClaudeHookCommon {
    hook_event_name: 'PreToolUse';
    tool_name: string;
    tool_input: unknown;
}
/**
 * PostToolUse event - after tool execution
 */
export interface ClaudePostToolUseEvent extends ClaudeHookCommon {
    hook_event_name: 'PostToolUse';
    tool_name: string;
    tool_input: unknown;
    tool_response: unknown;
}
/**
 * Notification event
 */
export interface ClaudeNotificationEvent extends ClaudeHookCommon {
    hook_event_name: 'Notification';
    message: string;
}
/**
 * UserPromptSubmit event - when user submits a prompt
 */
export interface ClaudeUserPromptSubmitEvent extends ClaudeHookCommon {
    hook_event_name: 'UserPromptSubmit';
    prompt: string;
}
/**
 * Stop event - when Claude finishes responding
 */
export interface ClaudeStopEvent extends ClaudeHookCommon {
    hook_event_name: 'Stop';
    stop_hook_active?: boolean;
}
/**
 * SubagentStop event - when a subagent (Task tool) finishes
 */
export interface ClaudeSubagentStopEvent extends ClaudeHookCommon {
    hook_event_name: 'SubagentStop';
    stop_hook_active?: boolean;
}
/**
 * PreCompact event - before context compaction
 */
export interface ClaudePreCompactEvent extends ClaudeHookCommon {
    hook_event_name: 'PreCompact';
    trigger: 'manual' | 'auto';
    custom_instructions?: string;
}
/**
 * SessionStart event - when session starts or resumes
 */
export interface ClaudeSessionStartEvent extends ClaudeHookCommon {
    hook_event_name: 'SessionStart';
    source: 'startup' | 'resume' | 'clear';
}
/**
 * Union type of all Claude hook events
 */
export type ClaudeHookEvent = ClaudePreToolUseEvent | ClaudePostToolUseEvent | ClaudeNotificationEvent | ClaudeUserPromptSubmitEvent | ClaudeStopEvent | ClaudeSubagentStopEvent | ClaudePreCompactEvent | ClaudeSessionStartEvent;
/**
 * Type guards for Claude events
 */
export declare function isClaudePreToolUse(data: unknown): data is ClaudePreToolUseEvent;
export declare function isClaudePostToolUse(data: unknown): data is ClaudePostToolUseEvent;
export declare function isClaudeNotification(data: unknown): data is ClaudeNotificationEvent;
export declare function isClaudeUserPromptSubmit(data: unknown): data is ClaudeUserPromptSubmitEvent;
export declare function isClaudeStop(data: unknown): data is ClaudeStopEvent;
export declare function isClaudeSubagentStop(data: unknown): data is ClaudeSubagentStopEvent;
export declare function isClaudePreCompact(data: unknown): data is ClaudePreCompactEvent;
export declare function isClaudeSessionStart(data: unknown): data is ClaudeSessionStartEvent;
/**
 * Base type guard for Claude events
 */
export declare function isClaudeEvent(data: unknown): data is ClaudeHookEvent;
/**
 * Known Claude tool names
 */
export declare const CLAUDE_TOOLS: {
    readonly TASK: "Task";
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
    readonly NOTEBOOK_READ: "NotebookRead";
    readonly NOTEBOOK_EDIT: "NotebookEdit";
    readonly TODO_WRITE: "TodoWrite";
    readonly EXIT_PLAN_MODE: "ExitPlanMode";
};
export type ClaudeToolName = (typeof CLAUDE_TOOLS)[keyof typeof CLAUDE_TOOLS] | string;
//# sourceMappingURL=claude-hook-types.d.ts.map