import { ipcRenderer } from 'electron';
import {
  PalaceTasksAPIEvent,
  type PalaceTasksAPI,
  type TaskQueryOptions,
  type TaskStatus,
} from '../../shared/main-process-api-interfaces/PalaceTasksAPI';

export const palaceTasksApi: PalaceTasksAPI = {
  getTasks: (repositoryPath: string, options?: TaskQueryOptions) =>
    ipcRenderer.invoke(PalaceTasksAPIEvent.GET_TASKS, repositoryPath, options),

  getTask: (repositoryPath: string, taskId: string) =>
    ipcRenderer.invoke(PalaceTasksAPIEvent.GET_TASK, repositoryPath, taskId),

  updateTaskStatus: (
    repositoryPath: string,
    taskId: string,
    status: TaskStatus,
  ) =>
    ipcRenderer.invoke(
      PalaceTasksAPIEvent.UPDATE_TASK_STATUS,
      repositoryPath,
      taskId,
      status,
    ),

  deleteTask: (repositoryPath: string, taskId: string) =>
    ipcRenderer.invoke(PalaceTasksAPIEvent.DELETE_TASK, repositoryPath, taskId),
};
