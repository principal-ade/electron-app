/**
 * Gemini Hook Types
 * Based on Gemini CLI documentation and Claude-compatible structure
 */
/**
 * Gemini tool names (based on README)
 */
export const GEMINI_TOOLS = {
    READ_FILE: 'read_file',
    WRITE_FILE: 'write_file',
    REPLACE: 'replace',
    FIND: 'find',
    GREP: 'grep',
    RUN_SHELL: 'run_shell',
    WEB_FETCH: 'web_fetch',
    GOOGLE_WEB_SEARCH: 'google_web_search',
};
/**
 * Type guards
 */
export function isGeminiPreToolUse(data) {
    return (typeof data === 'object' &&
        data !== null &&
        'hook_event_name' in data &&
        'agent_type' in data &&
        data.hook_event_name === 'PreToolUse' &&
        data.agent_type === 'gemini');
}
export function isGeminiPostToolUse(data) {
    return (typeof data === 'object' &&
        data !== null &&
        'hook_event_name' in data &&
        'agent_type' in data &&
        data.hook_event_name === 'PostToolUse' &&
        data.agent_type === 'gemini');
}
export function isGeminiStopHook(data) {
    return (typeof data === 'object' &&
        data !== null &&
        'hook_event_name' in data &&
        'agent_type' in data &&
        data.hook_event_name === 'Stop' &&
        data.agent_type === 'gemini');
}
export function isGeminiNotification(data) {
    return (typeof data === 'object' &&
        data !== null &&
        'hook_event_name' in data &&
        'agent_type' in data &&
        data.hook_event_name === 'Notification' &&
        data.agent_type === 'gemini');
}
export function isGeminiSubagentStop(data) {
    return (typeof data === 'object' &&
        data !== null &&
        'hook_event_name' in data &&
        'agent_type' in data &&
        data.hook_event_name === 'SubagentStop' &&
        data.agent_type === 'gemini');
}
export function isGeminiPreCompact(data) {
    return (typeof data === 'object' &&
        data !== null &&
        'hook_event_name' in data &&
        'agent_type' in data &&
        data.hook_event_name === 'PreCompact' &&
        data.agent_type === 'gemini');
}
//# sourceMappingURL=types.js.map