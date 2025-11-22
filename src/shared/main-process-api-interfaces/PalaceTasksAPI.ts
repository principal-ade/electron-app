/**
 * API for interacting with Memory Palace tasks
 */

import type {
  Task,
  TaskStatus,
  TaskQueryOptions as CoreTaskQueryOptions,
} from '@principal-ai/alexandria-core-library';

export type { Task, TaskStatus, TaskPriority } from '@principal-ai/alexandria-core-library';

export interface TaskQueryOptions extends Partial<CoreTaskQueryOptions> {
  // Extend with any additional UI-specific query options if needed
}

export interface GetTasksResponse {
  tasks: Task[];
  total: number;
}

export enum PalaceTasksAPIEvent {
  GET_TASKS = 'palace-tasks:get-tasks',
  GET_TASK = 'palace-tasks:get-task',
  UPDATE_TASK_STATUS = 'palace-tasks:update-task-status',
  DELETE_TASK = 'palace-tasks:delete-task',
}

export interface PalaceTasksAPI {
  /**
   * Get tasks for a repository
   */
  getTasks(
    repositoryPath: string,
    options?: TaskQueryOptions,
  ): Promise<GetTasksResponse>;

  /**
   * Get a specific task by ID
   */
  getTask(repositoryPath: string, taskId: string): Promise<Task | null>;

  /**
   * Update task status
   */
  updateTaskStatus(
    repositoryPath: string,
    taskId: string,
    status: TaskStatus,
  ): Promise<boolean>;

  /**
   * Delete a task permanently
   */
  deleteTask(repositoryPath: string, taskId: string): Promise<boolean>;
}
