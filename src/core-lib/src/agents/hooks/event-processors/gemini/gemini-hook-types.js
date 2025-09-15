/**
 * Gemini Hook Event Types
 * Based on official Gemini CLI documentation
 * https://github.com/principle-md/gemini-cli/blob/add-hooks-feature/docs/hooks.md
 */
/**
 * Type guards for Gemini events
 */
export function isGeminiPreToolUse(data) {
    return isGeminiEvent(data) && data.hook_event_name === 'PreToolUse';
}
export function isGeminiPostToolUse(data) {
    return isGeminiEvent(data) && data.hook_event_name === 'PostToolUse';
}
export function isGeminiNotification(data) {
    return isGeminiEvent(data) && data.hook_event_name === 'Notification';
}
export function isGeminiUserPromptSubmit(data) {
    return isGeminiEvent(data) && data.hook_event_name === 'UserPromptSubmit';
}
export function isGeminiStop(data) {
    return isGeminiEvent(data) && data.hook_event_name === 'Stop';
}
export function isGeminiSubagentStop(data) {
    return isGeminiEvent(data) && data.hook_event_name === 'SubagentStop';
}
export function isGeminiPreCompact(data) {
    return isGeminiEvent(data) && data.hook_event_name === 'PreCompact';
}
export function isGeminiSessionStart(data) {
    return isGeminiEvent(data) && data.hook_event_name === 'SessionStart';
}
/**
 * Base type guard for Gemini events
 */
export function isGeminiEvent(data) {
    return (typeof data === 'object' &&
        data !== null &&
        'session_id' in data &&
        'transcript_path' in data &&
        'working_directory' in data &&
        'hook_event_name' in data);
}
/**
 * Known Gemini tool names
 * Based on the documentation
 */
export const GEMINI_TOOLS = {
    // File operations
    READ_FILE: 'read_file',
    WRITE_FILE: 'write_file',
    EDIT_FILE: 'str_replace_editor',
    // Search operations
    BASH: 'bash',
    GLOB: 'glob',
    GREP: 'grep',
    LIST_FILES: 'list_files',
    // Web operations
    WEB_SEARCH: 'web_search',
    GET_URL: 'get_url',
    // Task management
    TASK: 'task',
    TODO_UPDATE: 'todo_update',
    // Other
    ASK_FOLLOWUP: 'ask_followup_question',
    ATTEMPT_COMPLETION: 'attempt_completion',
};
