/**
 * Claude Hook Event Types
 * Based on official Claude Code documentation
 * https://docs.anthropic.com/en/docs/claude-code/hooks
 */
/**
 * Type guards for Claude events
 */
export function isClaudePreToolUse(data) {
    return isClaudeEvent(data) && data.hook_event_name === 'PreToolUse';
}
export function isClaudePostToolUse(data) {
    return isClaudeEvent(data) && data.hook_event_name === 'PostToolUse';
}
export function isClaudeNotification(data) {
    return isClaudeEvent(data) && data.hook_event_name === 'Notification';
}
export function isClaudeUserPromptSubmit(data) {
    return isClaudeEvent(data) && data.hook_event_name === 'UserPromptSubmit';
}
export function isClaudeStop(data) {
    return isClaudeEvent(data) && data.hook_event_name === 'Stop';
}
export function isClaudeSubagentStop(data) {
    return isClaudeEvent(data) && data.hook_event_name === 'SubagentStop';
}
export function isClaudePreCompact(data) {
    return isClaudeEvent(data) && data.hook_event_name === 'PreCompact';
}
export function isClaudeSessionStart(data) {
    return isClaudeEvent(data) && data.hook_event_name === 'SessionStart';
}
/**
 * Base type guard for Claude events
 */
export function isClaudeEvent(data) {
    return (typeof data === 'object' &&
        data !== null &&
        'session_id' in data &&
        'transcript_path' in data &&
        'cwd' in data &&
        'hook_event_name' in data);
}
/**
 * Known Claude tool names
 */
export const CLAUDE_TOOLS = {
    // Subagent
    TASK: 'Task',
    // File operations
    READ: 'Read',
    WRITE: 'Write',
    EDIT: 'Edit',
    MULTI_EDIT: 'MultiEdit',
    // Search operations
    BASH: 'Bash',
    GLOB: 'Glob',
    GREP: 'Grep',
    LS: 'LS',
    // Web operations
    WEB_FETCH: 'WebFetch',
    WEB_SEARCH: 'WebSearch',
    // Notebook operations
    NOTEBOOK_READ: 'NotebookRead',
    NOTEBOOK_EDIT: 'NotebookEdit',
    // Other
    TODO_WRITE: 'TodoWrite',
    EXIT_PLAN_MODE: 'ExitPlanMode',
};
//# sourceMappingURL=claude-hook-types.js.map