/**
 * Claude Hook Types
 * Based on https://docs.anthropic.com/en/docs/claude-code/hooks
 */
export interface ClaudeHookData {
    session_id: string;
    transcript_path: string;
    cwd: string;
    hook_event_name: string;
    tool_name: string;
    tool_input: Record<string, unknown>;
}
export interface ClaudePreToolUseData extends ClaudeHookData {
    hook_event_name: 'PreToolUse';
}
export interface ClaudePostToolUseData extends ClaudeHookData {
    hook_event_name: 'PostToolUse';
    tool_response?: unknown;
}
export interface ClaudeStopHookData {
    session_id: string;
    transcript_path: string;
    cwd: string;
    hook_event_name: 'claude_stop_hook';
}
export type ClaudeHookInput = ClaudePreToolUseData | ClaudePostToolUseData | ClaudeStopHookData;
/**
 * Claude tool names as documented
 */
export declare const CLAUDE_TOOLS: {
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
    readonly NOTEBOOK_READ: "NotebookRead";
    readonly NOTEBOOK_EDIT: "NotebookEdit";
    readonly TASK: "Task";
    readonly EXIT_PLAN_MODE: "ExitPlanMode";
};
export type ClaudeToolName = (typeof CLAUDE_TOOLS)[keyof typeof CLAUDE_TOOLS];
/**
 * Type guards
 */
export declare function isClaudePreToolUse(data: unknown): data is ClaudePreToolUseData;
export declare function isClaudePostToolUse(data: unknown): data is ClaudePostToolUseData;
export declare function isClaudeStopHook(data: unknown): data is ClaudeStopHookData;
