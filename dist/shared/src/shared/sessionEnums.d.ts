/**
 * Shared enums for session tracking
 * Used by both main and renderer processes
 */
export declare enum SessionEventType {
    FILE_READ = "file-read",
    FILE_WRITE = "file-write",
    TOOL = "tool",
    WEB = "web",
    STOP = "stop",
    GROUPED = "grouped"
}
export declare enum LastEventType {
    FILE_READ = "file-read",
    FILE_WRITE = "file-write",
    TOOL = "tool",
    WEB = "web",
    STOP = "stop"
}
export declare enum EventActivityType {
    READ = "read",
    WRITE = "write",
    EDIT = "edit",
    TOOL = "tool",
    WEB = "web",
    STOP = "stop",
    BASH = "bash",
    NOTIFICATION = "notification",
    TODO_WRITE = "todo_write"
}
export declare enum ToolName {
    READ = "Read",
    WRITE = "Write",
    EDIT = "Edit",
    MULTI_EDIT = "MultiEdit",
    NOTEBOOK_READ = "NotebookRead",
    NOTEBOOK_WRITE = "NotebookWrite",
    NOTEBOOK_EDIT = "NotebookEdit",
    GREP = "Grep",
    GLOB = "Glob",
    LS = "LS",
    BASH = "Bash",
    WEB_FETCH = "WebFetch",
    WEB_SEARCH = "WebSearch",
    TODO_WRITE = "TodoWrite",
    TASK = "Task",
    EXIT_PLAN_MODE = "ExitPlanMode"
}
export declare enum ToolType {
    READ = "read",
    WRITE = "write",
    EDIT = "edit",
    SEARCH = "search",
    OTHER = "other"
}
export declare enum FileOperation {
    CREATE = "create",
    UPDATE = "update",
    DELETE = "delete",
    RENAME = "rename"
}
export declare enum StopTrigger {
    MANUAL = "manual",
    AUTOMATIC = "automatic",
    ERROR = "error",
    TIMEOUT = "timeout"
}
export declare enum AutoCommitStatus {
    PENDING = "pending",
    SUCCESS = "success",
    FAILED = "failed",
    SKIPPED = "skipped"
}
export declare enum SessionPriority {
    HIGH = "high",
    MEDIUM = "medium",
    LOW = "low"
}
export declare const TOOL_COLORS: Record<ToolType, string>;
export declare const TOOL_ICONS: Record<ToolName, string>;
export declare function getToolType(toolName: string): ToolType;
export declare function getToolColor(toolName: string): string;
export declare function getToolIcon(toolName: string): string;
//# sourceMappingURL=sessionEnums.d.ts.map