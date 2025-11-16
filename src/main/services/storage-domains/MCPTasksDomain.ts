import { TypedMultiStoreWrapper } from '../../storage-providers/typed-multistore-wrapper';
import { StaticNamespaces } from '../../../shared/types/namespaces.types';
import { MCPTaskSubmission } from '../../../shared/types/mcp-tasks.types';

/**
 * Domain service for managing MCP task submissions
 * Handles storage operations for tasks submitted through the Principal MCP Bridge
 */
export class MCPTasksDomain {
  private auditLog: Array<{
    level: string;
    message: string;
    timestamp: number;
    data?: unknown;
  }> = [];

  constructor(private storage: TypedMultiStoreWrapper) {}

  private logAudit(level: string, message: string, data?: unknown): void {
    const entry = {
      level,
      message,
      timestamp: Date.now(),
      data,
    };
    this.auditLog.push(entry);
    console.log(
      `[MCPTasksDomain Audit] ${level.toUpperCase()}: ${message}`,
      data || '',
    );

    // Keep audit log size under control
    if (this.auditLog.length > 100) {
      this.auditLog = this.auditLog.slice(-50);
    }
  }

  /**
   * Generate a unique task ID
   */
  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get the store key for MCP tasks
   * We use a single key 'tasks-store' to store all tasks
   */
  private getStoreKey(): string {
    return 'tasks-store';
  }

  /**
   * Add a new task to the store
   */
  async addTask(
    submission: Omit<MCPTaskSubmission, 'taskId' | 'submittedAt'>,
  ): Promise<MCPTaskSubmission> {
    try {
      const storeKey = this.getStoreKey();

      // Get existing store data
      const result = await this.storage.get(storeKey, StaticNamespaces.MCP_TASKS);
      const existingStore = result.success ? result.data : null;

      // Create the new task
      const task: MCPTaskSubmission = {
        ...submission,
        taskId: this.generateTaskId(),
        submittedAt: Date.now(),
      };

      // Update the store with the new task
      const updatedStore = {
        tasks: existingStore ? [...existingStore.tasks, task] : [task],
      };

      await this.storage.set(storeKey, updatedStore, StaticNamespaces.MCP_TASKS);

      this.logAudit('info', 'Added new MCP task', {
        taskId: task.taskId,
        dependencyId: task.dependencyId,
      });

      return task;
    } catch (error: unknown) {
      this.logAudit('error', 'Failed to add task', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get all tasks sorted by most recent first
   */
  async getAllTasks(): Promise<MCPTaskSubmission[]> {
    try {
      const storeKey = this.getStoreKey();
      const result = await this.storage.get(storeKey, StaticNamespaces.MCP_TASKS);
      const store = result.success ? result.data : null;

      if (!store || !store.tasks) {
        return [];
      }

      // Sort by most recent first
      return [...store.tasks].sort((a, b) => b.submittedAt - a.submittedAt);
    } catch (error: unknown) {
      this.logAudit('error', 'Failed to get all tasks', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get a single task by ID
   */
  async getTask(taskId: string): Promise<MCPTaskSubmission | null> {
    try {
      const storeKey = this.getStoreKey();
      const result = await this.storage.get(storeKey, StaticNamespaces.MCP_TASKS);
      const store = result.success ? result.data : null;

      if (!store || !store.tasks) {
        return null;
      }

      return store.tasks.find((t: MCPTaskSubmission) => t.taskId === taskId) || null;
    } catch (error: unknown) {
      this.logAudit('error', 'Failed to get task', {
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Update an existing task
   */
  async updateTask(
    taskId: string,
    updates: Partial<MCPTaskSubmission>,
  ): Promise<MCPTaskSubmission | null> {
    try {
      const storeKey = this.getStoreKey();
      const result = await this.storage.get(storeKey, StaticNamespaces.MCP_TASKS);
      const store = result.success ? result.data : null;

      if (!store || !store.tasks) {
        return null;
      }

      const taskIndex = store.tasks.findIndex((t: MCPTaskSubmission) => t.taskId === taskId);
      if (taskIndex === -1) {
        return null;
      }

      // Update the task
      store.tasks[taskIndex] = {
        ...store.tasks[taskIndex],
        ...updates,
      };

      await this.storage.set(storeKey, store, StaticNamespaces.MCP_TASKS);

      this.logAudit('info', 'Updated MCP task', {
        taskId,
        updates,
      });

      return store.tasks[taskIndex];
    } catch (error: unknown) {
      this.logAudit('error', 'Failed to update task', {
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Delete a task by ID
   */
  async deleteTask(taskId: string): Promise<boolean> {
    try {
      const storeKey = this.getStoreKey();
      const result = await this.storage.get(storeKey, StaticNamespaces.MCP_TASKS);
      const store = result.success ? result.data : null;

      if (!store || !store.tasks) {
        return false;
      }

      const initialLength = store.tasks.length;
      store.tasks = store.tasks.filter((t: MCPTaskSubmission) => t.taskId !== taskId);

      if (store.tasks.length < initialLength) {
        await this.storage.set(storeKey, store, StaticNamespaces.MCP_TASKS);

        this.logAudit('info', 'Deleted MCP task', { taskId });
        return true;
      }

      return false;
    } catch (error: unknown) {
      this.logAudit('error', 'Failed to delete task', {
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
