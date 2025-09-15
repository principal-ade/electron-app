export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  completedAt?: number;
  projectPath: string;
  sessionId?: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
}

const TODOS_STORAGE_KEY = 'projectTodos';

export class TodoStorageService {
  static async getTodos(
    projectPath?: string,
    sessionId?: string,
  ): Promise<TodoItem[]> {
    try {
      const allTodos = await window.mainProcess.store.get(TODOS_STORAGE_KEY);
      if (allTodos && Array.isArray(allTodos)) {
        let filteredTodos = allTodos;

        // Filter by project path if provided
        if (projectPath) {
          filteredTodos = filteredTodos.filter(
            (todo) => todo.projectPath === projectPath,
          );
        }

        // Filter by session ID if provided
        if (sessionId) {
          filteredTodos = filteredTodos.filter(
            (todo) => todo.sessionId === sessionId,
          );
        }

        // Sort by creation date (newest first) and completed status
        return filteredTodos.sort((a, b) => {
          // Incomplete todos first
          if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
          }
          // Then by creation date
          return b.createdAt - a.createdAt;
        });
      }
    } catch (error) {
      console.error('Error reading todos from electron store:', error);
    }
    return [];
  }

  static async addTodo(
    todo: Omit<TodoItem, 'id' | 'createdAt'>,
  ): Promise<TodoItem> {
    try {
      const allTodos = await this.getTodos();
      const newTodo: TodoItem = {
        ...todo,
        id: `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now(),
        completed: false,
      };

      allTodos.push(newTodo);
      await window.mainProcess.store.set(TODOS_STORAGE_KEY, allTodos);

      return newTodo;
    } catch (error) {
      console.error('Error saving todo to electron store:', error);
      throw error;
    }
  }

  static async updateTodo(
    id: string,
    updates: Partial<TodoItem>,
  ): Promise<TodoItem | null> {
    try {
      const allTodos = await this.getTodos();
      const todoIndex = allTodos.findIndex((todo) => todo.id === id);

      if (todoIndex === -1) {
        return null;
      }

      const updatedTodo = {
        ...allTodos[todoIndex],
        ...updates,
        // Handle completion timestamp
        completedAt: updates.completed ? Date.now() : undefined,
      };

      allTodos[todoIndex] = updatedTodo;
      await window.mainProcess.store.set(TODOS_STORAGE_KEY, allTodos);

      return updatedTodo;
    } catch (error) {
      console.error('Error updating todo:', error);
      throw error;
    }
  }

  static async deleteTodo(id: string): Promise<boolean> {
    try {
      const allTodos = await this.getTodos();
      const filteredTodos = allTodos.filter((todo) => todo.id !== id);

      if (filteredTodos.length === allTodos.length) {
        return false; // Todo not found
      }

      await window.mainProcess.store.set(TODOS_STORAGE_KEY, filteredTodos);
      return true;
    } catch (error) {
      console.error('Error deleting todo:', error);
      throw error;
    }
  }

  static async deleteProjectTodos(projectPath: string): Promise<number> {
    try {
      const allTodos = await this.getTodos();
      const filteredTodos = allTodos.filter(
        (todo) => todo.projectPath !== projectPath,
      );
      const deletedCount = allTodos.length - filteredTodos.length;

      await window.mainProcess.store.set(TODOS_STORAGE_KEY, filteredTodos);
      return deletedCount;
    } catch (error) {
      console.error('Error deleting project todos:', error);
      throw error;
    }
  }

  static async getProjectStats(
    projectPath: string,
  ): Promise<{ total: number; completed: number; pending: number }> {
    const todos = await this.getTodos(projectPath);
    return {
      total: todos.length,
      completed: todos.filter((t) => t.completed).length,
      pending: todos.filter((t) => !t.completed).length,
    };
  }
}
