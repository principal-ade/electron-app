/**
 * IPC API interface for Alexandria repository management
 */
import type { AlexandriaEntry } from '@a24z/core-library';
export declare enum AlexandriaEventType {
    ADDED = "added",
    UPDATED = "updated",
    REMOVED = "removed"
}
export interface AlexandriaChangeEvent {
    type: AlexandriaEventType;
    repository?: AlexandriaEntry;
    name?: string;
}
export declare enum AlexandriaAPIEvent {
    GET_ALL = "alexandria:get-all",
    GET = "alexandria:get",
    GET_BY_PATH = "alexandria:get-by-path",
    REGISTER = "alexandria:register",
    REMOVE = "alexandria:remove",
    SEARCH = "alexandria:search",
    GET_WITH_VIEWS = "alexandria:get-with-views",
    REFRESH = "alexandria:refresh",
    GET_COUNT = "alexandria:get-count",
    REPOSITORY_ADDED = "alexandria:repository-added",
    REPOSITORY_UPDATED = "alexandria:repository-updated",
    REPOSITORY_REMOVED = "alexandria:repository-removed"
}
export interface AlexandriaAPI {
    /**
     * Subscribe to repository change events
     * @param callback - Function to call when repositories change
     * @returns Unsubscribe function
     */
    onRepositoryChange(callback: (event: AlexandriaChangeEvent) => void): () => void;
    /**
     * Get all registered repositories
     */
    getRepositories(): Promise<AlexandriaEntry[]>;
    /**
     * Get a specific repository by name
     */
    getRepository(name: string): Promise<AlexandriaEntry | null>;
    /**
     * Get a repository by its local path
     */
    getRepositoryByPath(path: string): Promise<AlexandriaEntry | null>;
    /**
     * Register a new repository with a local path
     */
    registerRepository(name: string, path: string): Promise<AlexandriaEntry>;
    /**
     * Remove a repository from the registry
     */
    removeRepository(name: string): Promise<boolean>;
    /**
     * Search repositories by query
     */
    searchRepositories(query: string): Promise<AlexandriaEntry[]>;
    /**
     * Get repositories that have codebase views
     */
    getRepositoriesWithViews(): Promise<AlexandriaEntry[]>;
    /**
     * Refresh repository metadata (re-scan for views, etc)
     */
    refreshRepository(name: string): Promise<AlexandriaEntry | null>;
    /**
     * Get total repository count
     */
    getRepositoryCount(): Promise<number>;
}
//# sourceMappingURL=AlexandriaAPI.d.ts.map