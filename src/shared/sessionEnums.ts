/**
 * Shared enums for session tracking
 * Used by both main and renderer processes
 */

// Event types for session timeline
export enum SessionEventType {
  FILE_READ = 'file-read',
  FILE_WRITE = 'file-write',
  TOOL = 'tool',
  WEB = 'web',
  STOP = 'stop',
  GROUPED = 'grouped',
}

// Last event type for session tracking
export enum LastEventType {
  FILE_READ = 'file-read',
  FILE_WRITE = 'file-write',
  TOOL = 'tool',
  WEB = 'web',
  STOP = 'stop',
}

// NEW: Consolidated event activity types for lastEvent field
export enum EventActivityType {
  READ = 'read',
  WRITE = 'write',
  EDIT = 'edit',
  TOOL = 'tool',
  WEB = 'web',
  STOP = 'stop',
  BASH = 'bash',
  NOTIFICATION = 'notification',
  TODO_WRITE = 'todo_write',
}

// Tool names that we track
export enum ToolName {
  // File operations
  READ = 'Read',
  WRITE = 'Write',
  EDIT = 'Edit',
  MULTI_EDIT = 'MultiEdit',

  // Notebook operations
  NOTEBOOK_READ = 'NotebookRead',
  NOTEBOOK_WRITE = 'NotebookWrite',
  NOTEBOOK_EDIT = 'NotebookEdit',

  // Search operations
  GREP = 'Grep',
  GLOB = 'Glob',
  LS = 'LS',

  // Other operations
  BASH = 'Bash',
  WEB_FETCH = 'WebFetch',
  WEB_SEARCH = 'WebSearch',
  TODO_WRITE = 'TodoWrite',
  TASK = 'Task',
  EXIT_PLAN_MODE = 'ExitPlanMode',
}

// Tool categories for UI display
export enum ToolType {
  READ = 'read',
  WRITE = 'write',
  EDIT = 'edit',
  SEARCH = 'search',
  OTHER = 'other',
}

// File operation types
export enum FileOperation {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  RENAME = 'rename',
}

// Stop event triggers
export enum StopTrigger {
  MANUAL = 'manual',
  AUTOMATIC = 'automatic',
  ERROR = 'error',
  TIMEOUT = 'timeout',
}

// Auto-commit status

// Session priority levels
export enum SessionPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

// Tool colors for visualization
export const TOOL_COLORS: Record<ToolType, string> = {
  [ToolType.READ]: '#4CAF50',
  [ToolType.WRITE]: '#FF9800',
  [ToolType.EDIT]: '#2196F3',
  [ToolType.SEARCH]: '#9C27B0',
  [ToolType.OTHER]: '#607D8B',
};

// Tool icons for visualization
export const TOOL_ICONS: Record<ToolName, string> = {
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
export function getToolType(toolName: string): ToolType {
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
export function getToolColor(toolName: string): string {
  const type = getToolType(toolName);
  return TOOL_COLORS[type];
}

// Helper to get tool icon
export function getToolIcon(toolName: string): string {
  return TOOL_ICONS[toolName as ToolName] || 'tool';
}
