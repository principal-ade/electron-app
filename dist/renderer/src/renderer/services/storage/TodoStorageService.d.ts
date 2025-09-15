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
export declare class TodoStorageService {
    static getTodos(projectPath?: string, sessionId?: string): Promise<TodoItem[]>;
    static addTodo(todo: Omit<TodoItem, 'id' | 'createdAt'>): Promise<TodoItem>;
    static updateTodo(id: string, updates: Partial<TodoItem>): Promise<TodoItem | null>;
    static deleteTodo(id: string): Promise<boolean>;
    static deleteProjectTodos(projectPath: string): Promise<number>;
    static getProjectStats(projectPath: string): Promise<{
        total: number;
        completed: number;
        pending: number;
    }>;
}
//# sourceMappingURL=TodoStorageService.d.ts.map