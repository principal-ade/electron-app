"use strict";
/**
 * Claude Hook Types
 * Based on https://docs.anthropic.com/en/docs/claude-code/hooks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLAUDE_TOOLS = void 0;
exports.isClaudePreToolUse = isClaudePreToolUse;
exports.isClaudePostToolUse = isClaudePostToolUse;
exports.isClaudeStopHook = isClaudeStopHook;
/**
 * Claude tool names as documented
 */
exports.CLAUDE_TOOLS = {
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
function isClaudePreToolUse(data) {
    return (typeof data === 'object' &&
        data !== null &&
        'hook_event_name' in data &&
        data.hook_event_name === 'PreToolUse');
}
function isClaudePostToolUse(data) {
    return (typeof data === 'object' &&
        data !== null &&
        'hook_event_name' in data &&
        data.hook_event_name === 'PostToolUse');
}
function isClaudeStopHook(data) {
    return (typeof data === 'object' &&
        data !== null &&
        'hook_event_name' in data &&
        data.hook_event_name === 'claude_stop_hook');
}
