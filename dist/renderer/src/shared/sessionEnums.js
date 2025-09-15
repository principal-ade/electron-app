/**
 * Shared enums for session tracking
 * Used by both main and renderer processes
 */
// Event types for session timeline
export var SessionEventType;
(function (SessionEventType) {
    SessionEventType["FILE_READ"] = "file-read";
    SessionEventType["FILE_WRITE"] = "file-write";
    SessionEventType["TOOL"] = "tool";
    SessionEventType["WEB"] = "web";
    SessionEventType["STOP"] = "stop";
    SessionEventType["GROUPED"] = "grouped";
})(SessionEventType || (SessionEventType = {}));
// Last event type for session tracking
export var LastEventType;
(function (LastEventType) {
    LastEventType["FILE_READ"] = "file-read";
    LastEventType["FILE_WRITE"] = "file-write";
    LastEventType["TOOL"] = "tool";
    LastEventType["WEB"] = "web";
    LastEventType["STOP"] = "stop";
})(LastEventType || (LastEventType = {}));
// NEW: Consolidated event activity types for lastEvent field
export var EventActivityType;
(function (EventActivityType) {
    EventActivityType["READ"] = "read";
    EventActivityType["WRITE"] = "write";
    EventActivityType["EDIT"] = "edit";
    EventActivityType["TOOL"] = "tool";
    EventActivityType["WEB"] = "web";
    EventActivityType["STOP"] = "stop";
    EventActivityType["BASH"] = "bash";
    EventActivityType["NOTIFICATION"] = "notification";
    EventActivityType["TODO_WRITE"] = "todo_write";
})(EventActivityType || (EventActivityType = {}));
// Tool names that we track
export var ToolName;
(function (ToolName) {
    // File operations
    ToolName["READ"] = "Read";
    ToolName["WRITE"] = "Write";
    ToolName["EDIT"] = "Edit";
    ToolName["MULTI_EDIT"] = "MultiEdit";
    // Notebook operations
    ToolName["NOTEBOOK_READ"] = "NotebookRead";
    ToolName["NOTEBOOK_WRITE"] = "NotebookWrite";
    ToolName["NOTEBOOK_EDIT"] = "NotebookEdit";
    // Search operations
    ToolName["GREP"] = "Grep";
    ToolName["GLOB"] = "Glob";
    ToolName["LS"] = "LS";
    // Other operations
    ToolName["BASH"] = "Bash";
    ToolName["WEB_FETCH"] = "WebFetch";
    ToolName["WEB_SEARCH"] = "WebSearch";
    ToolName["TODO_WRITE"] = "TodoWrite";
    ToolName["TASK"] = "Task";
    ToolName["EXIT_PLAN_MODE"] = "ExitPlanMode";
})(ToolName || (ToolName = {}));
// Tool categories for UI display
export var ToolType;
(function (ToolType) {
    ToolType["READ"] = "read";
    ToolType["WRITE"] = "write";
    ToolType["EDIT"] = "edit";
    ToolType["SEARCH"] = "search";
    ToolType["OTHER"] = "other";
})(ToolType || (ToolType = {}));
// File operation types
export var FileOperation;
(function (FileOperation) {
    FileOperation["CREATE"] = "create";
    FileOperation["UPDATE"] = "update";
    FileOperation["DELETE"] = "delete";
    FileOperation["RENAME"] = "rename";
})(FileOperation || (FileOperation = {}));
// Stop event triggers
export var StopTrigger;
(function (StopTrigger) {
    StopTrigger["MANUAL"] = "manual";
    StopTrigger["AUTOMATIC"] = "automatic";
    StopTrigger["ERROR"] = "error";
    StopTrigger["TIMEOUT"] = "timeout";
})(StopTrigger || (StopTrigger = {}));
// Auto-commit status
export var AutoCommitStatus;
(function (AutoCommitStatus) {
    AutoCommitStatus["PENDING"] = "pending";
    AutoCommitStatus["SUCCESS"] = "success";
    AutoCommitStatus["FAILED"] = "failed";
    AutoCommitStatus["SKIPPED"] = "skipped";
})(AutoCommitStatus || (AutoCommitStatus = {}));
// Session priority levels
export var SessionPriority;
(function (SessionPriority) {
    SessionPriority["HIGH"] = "high";
    SessionPriority["MEDIUM"] = "medium";
    SessionPriority["LOW"] = "low";
})(SessionPriority || (SessionPriority = {}));
// Tool colors for visualization
export const TOOL_COLORS = {
    [ToolType.READ]: '#4CAF50',
    [ToolType.WRITE]: '#FF9800',
    [ToolType.EDIT]: '#2196F3',
    [ToolType.SEARCH]: '#9C27B0',
    [ToolType.OTHER]: '#607D8B',
};
// Tool icons for visualization
export const TOOL_ICONS = {
    [ToolName.READ]: 'file-read',
    [ToolName.WRITE]: 'file-write',
    [ToolName.EDIT]: 'file-edit',
    [ToolName.MULTI_EDIT]: 'file-edit',
    [ToolName.NOTEBOOK_READ]: 'notebook-read',
    [ToolName.NOTEBOOK_WRITE]: 'notebook-write',
    [ToolName.NOTEBOOK_EDIT]: 'notebook-edit',
    [ToolName.GREP]: 'search',
    [ToolName.GLOB]: 'folder-search',
    [ToolName.LS]: 'folder',
    [ToolName.BASH]: 'terminal',
    [ToolName.WEB_FETCH]: 'globe',
    [ToolName.WEB_SEARCH]: 'search-globe',
    [ToolName.TODO_WRITE]: 'checklist',
    [ToolName.TASK]: 'task',
    [ToolName.EXIT_PLAN_MODE]: 'exit',
};
// Helper to categorize tools
export function getToolType(toolName) {
    switch (toolName) {
        case ToolName.READ:
        case ToolName.NOTEBOOK_READ:
            return ToolType.READ;
        case ToolName.WRITE:
        case ToolName.NOTEBOOK_WRITE:
            return ToolType.WRITE;
        case ToolName.EDIT:
        case ToolName.MULTI_EDIT:
        case ToolName.NOTEBOOK_EDIT:
            return ToolType.EDIT;
        case ToolName.GREP:
        case ToolName.GLOB:
        case ToolName.LS:
            return ToolType.SEARCH;
        default:
            return ToolType.OTHER;
    }
}
// Helper to get tool color
export function getToolColor(toolName) {
    const type = getToolType(toolName);
    return TOOL_COLORS[type];
}
// Helper to get tool icon
export function getToolIcon(toolName) {
    return TOOL_ICONS[toolName] || 'tool';
}
