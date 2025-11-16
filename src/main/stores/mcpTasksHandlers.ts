/**
 * IPC handlers for MCP Tasks Management
 * Manages MCP task submissions tracking
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { MCPTasksEvents } from '../../shared/main-process-api-interfaces/MCPTasksAPI';
import { MCPTaskSubmission } from '../../shared/types/mcp-tasks.types';
import { MCPTasksDomain } from '../services/storage-domains/MCPTasksDomain';
import { getTypedStorageManager } from '../storage-providers';

/**
 * Register MCP tasks management IPC handlers
 */
export async function registerMCPTasksHandlers(): Promise<void> {
  // Initialize MCPTasksDomain with typed storage provider
  const typedStore = await getTypedStorageManager();
  const mcpTasksDomain = new MCPTasksDomain(typedStore);

  // Get all tasks
  ipcMain.handle(
    MCPTasksEvents.GET_ALL_TASKS,
    async (event: IpcMainInvokeEvent): Promise<MCPTaskSubmission[]> => {
      try {
        console.log('[MCPTasksHandlers] Getting all tasks');

        if (!validateSource(event)) {
          console.warn('[MCPTasksHandlers] Unauthorized request');
          return [];
        }

        return await mcpTasksDomain.getAllTasks();
      } catch (error: unknown) {
        console.error('[MCPTasksHandlers] Error getting all tasks:', error);
        return [];
      }
    },
  );

  // Get a single task by ID
  ipcMain.handle(
    MCPTasksEvents.GET_TASK,
    async (
      event: IpcMainInvokeEvent,
      taskId: string,
    ): Promise<MCPTaskSubmission | null> => {
      try {
        console.log('[MCPTasksHandlers] Getting task:', taskId);

        if (!validateSource(event)) {
          console.warn('[MCPTasksHandlers] Unauthorized request');
          return null;
        }

        if (!taskId) {
          console.error('[MCPTasksHandlers] Task ID is required');
          return null;
        }

        return await mcpTasksDomain.getTask(taskId);
      } catch (error: unknown) {
        console.error('[MCPTasksHandlers] Error getting task:', error);
        return null;
      }
    },
  );

  // Delete a task
  ipcMain.handle(
    MCPTasksEvents.DELETE_TASK,
    async (event: IpcMainInvokeEvent, taskId: string): Promise<boolean> => {
      try {
        console.log('[MCPTasksHandlers] Deleting task:', taskId);

        if (!validateSource(event)) {
          console.warn('[MCPTasksHandlers] Unauthorized request');
          return false;
        }

        if (!taskId) {
          console.error('[MCPTasksHandlers] Task ID is required');
          return false;
        }

        return await mcpTasksDomain.deleteTask(taskId);
      } catch (error: unknown) {
        console.error('[MCPTasksHandlers] Error deleting task:', error);
        return false;
      }
    },
  );

  console.log('[MCPTasksHandlers] All handlers registered successfully');
}

/**
 * Validate that the IPC request comes from our application
 */
function validateSource(event: IpcMainInvokeEvent): boolean {
  try {
    const url = event.sender.getURL();
    // Accept from file:// protocol (production) or localhost (development)
    const isValid =
      url.startsWith('file://') ||
      url.startsWith('http://localhost') ||
      url.includes('localhost:1212'); // Common Electron dev port

    if (!isValid) {
      console.warn('[MCPTasksHandlers] Rejected request from URL:', url);
    }

    return isValid;
  } catch (error) {
    console.error('[MCPTasksHandlers] Error validating source:', error);
    return false;
  }
}
