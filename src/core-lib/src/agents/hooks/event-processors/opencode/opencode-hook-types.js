/**
 * OpenCode Hook Event Types (Anthropic-compatible)
 * Based on OpenCode's Anthropic hooks implementation
 * https://github.com/principle-md/opencode/blob/feature/comprehensive-hooks-integration/HOOKS_INTEGRATION.md
 */
/**
 * Type guards for OpenCode events
 */
export function isOpenCodePreToolUse(data) {
    return isOpenCodeEvent(data) && data.hook_event_name === 'PreToolUse';
}
export function isOpenCodePostToolUse(data) {
    return isOpenCodeEvent(data) && data.hook_event_name === 'PostToolUse';
}
export function isOpenCodeNotification(data) {
    return isOpenCodeEvent(data) && data.hook_event_name === 'Notification';
}
export function isOpenCodeUserPromptSubmit(data) {
    return isOpenCodeEvent(data) && data.hook_event_name === 'UserPromptSubmit';
}
export function isOpenCodeStop(data) {
    return isOpenCodeEvent(data) && data.hook_event_name === 'Stop';
}
export function isOpenCodeSubagentStop(data) {
    return isOpenCodeEvent(data) && data.hook_event_name === 'SubagentStop';
}
export function isOpenCodePreCompact(data) {
    return isOpenCodeEvent(data) && data.hook_event_name === 'PreCompact';
}
export function isOpenCodeSessionStart(data) {
    return isOpenCodeEvent(data) && data.hook_event_name === 'SessionStart';
}
/**
 * Base type guard for OpenCode events
 */
export function isOpenCodeEvent(data) {
    return (typeof data === 'object' &&
        data !== null &&
        'session_id' in data &&
        'transcript_path' in data &&
        'cwd' in data &&
        'hook_event_name' in data);
}
/**
 * Known OpenCode tool names (from Anthropic-compatible implementation)
 * Based on the documentation's tool list
 */
export const OPENCODE_TOOLS = {
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
    // Task management
    TASK: 'Task',
    TODO_WRITE: 'TodoWrite',
    // Notebook operations
    NOTEBOOK_READ: 'NotebookRead',
    NOTEBOOK_EDIT: 'NotebookEdit',
    // Other
    EXIT_PLAN_MODE: 'ExitPlanMode',
};
