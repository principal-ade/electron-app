import { ipcRenderer } from 'electron';
import {
  MCPTasksAPI,
  MCPTasksEvents,
} from '../../shared/main-process-api-interfaces/MCPTasksAPI';
import { MCPTaskSubmission } from '../../shared/types/mcp-tasks.types';

export const mcpTasksAPI: MCPTasksAPI = {
  getAllTasks: (): Promise<MCPTaskSubmission[]> => {
    return ipcRenderer.invoke(MCPTasksEvents.GET_ALL_TASKS);
  },

  getTask: (taskId: string): Promise<MCPTaskSubmission | null> => {
    return ipcRenderer.invoke(MCPTasksEvents.GET_TASK, taskId);
  },

  deleteTask: (taskId: string): Promise<boolean> => {
    return ipcRenderer.invoke(MCPTasksEvents.DELETE_TASK, taskId);
  },
};
