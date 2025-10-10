import { ipcMain } from 'electron';
import { MemoryPalace, NodeFileSystemAdapter } from '@a24z/core-library';
import type { ValidatedRepositoryPath } from '@a24z/core-library';
import {
  PalaceTasksAPIEvent,
  type GetTasksResponse,
  type TaskQueryOptions,
  type Task,
  type TaskStatus,
} from '../../shared/main-process-api-interfaces/PalaceTasksAPI';

/**
 * Register IPC handlers for Memory Palace task operations
 */
export function registerPalaceTasksHandlers() {
  // Get tasks for a repository
  ipcMain.handle(
    PalaceTasksAPIEvent.GET_TASKS,
    async (
      _event,
      repositoryPath: string,
      options?: TaskQueryOptions
    ): Promise<GetTasksResponse> => {
      try {
        const fsAdapter = new NodeFileSystemAdapter();
        const validatedPath = MemoryPalace.validateRepositoryPath(
          fsAdapter,
          repositoryPath
        ) as ValidatedRepositoryPath;
        const palace = new MemoryPalace(validatedPath, fsAdapter);

        const tasks = palace.getTasks(options);

        return {
          tasks,
          total: tasks.length,
        };
      } catch (error) {
        console.error('[PalaceTasksHandlers] Error getting tasks:', error);
        return {
          tasks: [],
          total: 0,
        };
      }
    }
  );

  // Get a specific task by ID
  ipcMain.handle(
    PalaceTasksAPIEvent.GET_TASK,
    async (_event, repositoryPath: string, taskId: string): Promise<Task | null> => {
      try {
        const fsAdapter = new NodeFileSystemAdapter();
        const validatedPath = MemoryPalace.validateRepositoryPath(
          fsAdapter,
          repositoryPath
        ) as ValidatedRepositoryPath;
        const palace = new MemoryPalace(validatedPath, fsAdapter);

        return palace.getTask(taskId);
      } catch (error) {
        console.error('[PalaceTasksHandlers] Error getting task:', error);
        return null;
      }
    }
  );

  // Update task status
  // TODO: Waiting on @a24z/core-library to implement updateTaskStatus method
  // Dependency task submitted - see .alexandria/work/tasks/active/
  ipcMain.handle(
    PalaceTasksAPIEvent.UPDATE_TASK_STATUS,
    async (
      _event,
      _repositoryPath: string,
      _taskId: string,
      _status: TaskStatus
    ): Promise<boolean> => {
      console.warn('[PalaceTasksHandlers] updateTaskStatus not yet implemented in @a24z/core-library');
      return false;
    }
  );

  // Delete a task permanently
  ipcMain.handle(
    PalaceTasksAPIEvent.DELETE_TASK,
    async (_event, repositoryPath: string, taskId: string): Promise<boolean> => {
      try {
        const fsAdapter = new NodeFileSystemAdapter();
        const validatedPath = MemoryPalace.validateRepositoryPath(
          fsAdapter,
          repositoryPath
        ) as ValidatedRepositoryPath;
        const palace = new MemoryPalace(validatedPath, fsAdapter);

        return palace.deleteTask(taskId);
      } catch (error) {
        console.error('[PalaceTasksHandlers] Error deleting task:', error);
        return false;
      }
    }
  );

  console.log('[PalaceTasksHandlers] Palace tasks IPC handlers registered');
}

/**
 * Unregister IPC handlers for Memory Palace task operations
 */
export function unregisterPalaceTasksHandlers() {
  ipcMain.removeHandler(PalaceTasksAPIEvent.GET_TASKS);
  ipcMain.removeHandler(PalaceTasksAPIEvent.GET_TASK);
  ipcMain.removeHandler(PalaceTasksAPIEvent.UPDATE_TASK_STATUS);
  ipcMain.removeHandler(PalaceTasksAPIEvent.DELETE_TASK);

  console.log('[PalaceTasksHandlers] Palace tasks IPC handlers unregistered');
}
