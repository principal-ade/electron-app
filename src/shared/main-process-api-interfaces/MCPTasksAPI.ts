/**
 * MCP Tasks API Interface
 * Manages MCP task submissions tracking
 */

import { MCPTaskSubmission } from '../types/mcp-tasks.types';

/**
 * IPC event channels for MCP tasks management
 */
export enum MCPTasksEvents {
  GET_ALL_TASKS = 'mcp-tasks:get-all-tasks',
  GET_TASK = 'mcp-tasks:get-task',
  DELETE_TASK = 'mcp-tasks:delete-task',
}

/**
 * MCP Tasks management API
 */
export interface MCPTasksAPI {
  /**
   * Get all tasks sorted by most recent first
   */
  getAllTasks: () => Promise<MCPTaskSubmission[]>;

  /**
   * Get a single task by ID
   */
  getTask: (taskId: string) => Promise<MCPTaskSubmission | null>;

  /**
   * Delete a task by ID
   */
  deleteTask: (taskId: string) => Promise<boolean>;
}
