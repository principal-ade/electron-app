/**
 * Claude Hook Types
 * Based on https://docs.anthropic.com/en/docs/claude-code/hooks
 */
/**
 * Claude tool names as documented
 */
export const CLAUDE_TOOLS = {
    READ: 'Read',
    WRITE: 'Write',
    EDIT: 'Edit',
    MULTI_EDIT: 'MultiEdit',
    WEB_FETCH: 'WebFetch',
    WEB_SEARCH: 'WebSearch',
    BASH: 'Bash',
    GREP: 'Grep',
    GLOB: 'Glob',
    LS: 'LS',
    TODO_WRITE: 'TodoWrite',
    NOTEBOOK_READ: 'NotebookRead',
    NOTEBOOK_EDIT: 'NotebookEdit',
    TASK: 'Task',
    EXIT_PLAN_MODE: 'ExitPlanMode',
};
/**
 * Type guards
 */
export function isClaudePreToolUse(data) {
    return (typeof data === 'object' &&
        data !== null &&
        'hook_event_name' in data &&
        data.hook_event_name === 'PreToolUse');
}
export function isClaudePostToolUse(data) {
    return (typeof data === 'object' &&
        data !== null &&
        'hook_event_name' in data &&
        data.hook_event_name === 'PostToolUse');
}
export function isClaudeStopHook(data) {
    return (typeof data === 'object' &&
        data !== null &&
        'hook_event_name' in data &&
        data.hook_event_name === 'claude_stop_hook');
}
