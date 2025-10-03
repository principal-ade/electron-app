import type {
  GetTasksResponse,
  TaskQueryOptions,
  Task,
  TaskStatus,
} from '../../shared/main-process-api-interfaces/PalaceTasksAPI';

export class PalaceTasksService {
  static async getTasks(
    repositoryPath: string,
    options?: TaskQueryOptions
  ): Promise<GetTasksResponse> {
    return window.mainProcess.palaceTasks.getTasks(repositoryPath, options);
  }

  static async getTask(repositoryPath: string, taskId: string): Promise<Task | null> {
    return window.mainProcess.palaceTasks.getTask(repositoryPath, taskId);
  }

  static async updateTaskStatus(
    repositoryPath: string,
    taskId: string,
    status: TaskStatus
  ): Promise<boolean> {
    return window.mainProcess.palaceTasks.updateTaskStatus(
      repositoryPath,
      taskId,
      status
    );
  }
}
