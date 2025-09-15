/**
 * OpenCode Hook Types
 * Based on opencode-with-hooks implementation
 */
/**
 * OpenCode tool names (based on Claude tools)
 */
export const OPENCODE_TOOLS = {
    // File operations
    READ: 'Read',
    WRITE: 'Write',
    EDIT: 'Edit',
    MULTI_EDIT: 'MultiEdit',
    // Web operations
    WEB_FETCH: 'WebFetch',
    WEB_SEARCH: 'WebSearch',
    // System operations
    BASH: 'Bash',
    GREP: 'Grep',
    GLOB: 'Glob',
    LS: 'LS',
    // Other
    TODO_WRITE: 'TodoWrite',
    TASK: 'Task',
};
/**
 * Type guards
 */
export function isOpenCodeToolCall(data) {
    return (typeof data === 'object' &&
        data !== null &&
        'hook_event_name' in data &&
        (data.hook_event_name === 'tool_call' ||
            data.hook_event_name === 'tool_call_hook'));
}
export function isOpenCodeFileRead(data) {
    return (typeof data === 'object' &&
        data !== null &&
        'hook_event_name' in data &&
        (data.hook_event_name === 'file_read' ||
            data.hook_event_name === 'file_read_hook'));
}
export function isOpenCodeFileEdited(data) {
    return (typeof data === 'object' &&
        data !== null &&
        'hook_event_name' in data &&
        (data.hook_event_name === 'file_edited' ||
            data.hook_event_name === 'file_edited_hook'));
}
export function isOpenCodeWebAccess(data) {
    return (typeof data === 'object' &&
        data !== null &&
        'hook_event_name' in data &&
        (data.hook_event_name === 'web_access' ||
            data.hook_event_name === 'web_access_hook'));
}
export function isOpenCodeSessionStop(data) {
    return (typeof data === 'object' &&
        data !== null &&
        'hook_event_name' in data &&
        (data.hook_event_name === 'session_stop' ||
            data.hook_event_name === 'session_stop_hook'));
}
