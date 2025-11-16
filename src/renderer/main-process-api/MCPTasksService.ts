/**
 * Service layer for MCP Tasks management functionality
 * ALL window.mainProcess.mcpTasks calls MUST be encapsulated here
 */

import type { MCPTaskSubmission } from '../../shared/types/mcp-tasks.types';

export class MCPTasksService {
  /**
   * Get all tasks sorted by most recent first
   */
  static async getAllTasks(): Promise<MCPTaskSubmission[]> {
    return window.mainProcess.mcpTasks.getAllTasks();
  }

  /**
   * Get a single task by ID
   */
  static async getTask(taskId: string): Promise<MCPTaskSubmission | null> {
    return window.mainProcess.mcpTasks.getTask(taskId);
  }

  /**
   * Delete a task by ID
   */
  static async deleteTask(taskId: string): Promise<boolean> {
    return window.mainProcess.mcpTasks.deleteTask(taskId);
  }
}
