/**
 * AlexandriaRegistryService - Service for managing Alexandria repositories
 * Uses AlexandriaOutpostManager from @a24z/core-library for local repository management
 */
import type { AlexandriaEntry } from '@a24z/core-library';
export declare class AlexandriaRegistryService {
    private static instance;
    private outpostManager;
    private initialized;
    private constructor();
    static getInstance(): AlexandriaRegistryService;
    /**
     * Get all repositories with path information
     */
    getRepositories(): Promise<AlexandriaEntry[]>;
    /**
     * Get repository by name
     */
    getRepository(name: string): Promise<AlexandriaEntry | null>;
    /**
     * Get repository by local path
     */
    getRepositoryByPath(path: string): Promise<AlexandriaEntry | null>;
    /**
     * Register a new repository with local path
     */
    registerRepository(name: string, path: string): Promise<AlexandriaEntry>;
    /**
     * Add a repository from a remote URL (for UI compatibility)
     * This will register it without a local path initially
     */
    addRepository(params: {
        name: string;
        remoteUrl?: string;
        localPath?: string;
        description?: string;
    }): Promise<AlexandriaEntry>;
    /**
     * Remove a repository by name
     */
    removeRepository(name: string): Promise<boolean>;
    /**
     * Get total repository count
     */
    getRepositoryCount(): Promise<number>;
    /**
     * Search repositories by name or description
     */
    searchRepositories(query: string): Promise<AlexandriaEntry[]>;
    /**
     * Get repositories with views
     */
    getRepositoriesWithViews(): Promise<AlexandriaEntry[]>;
    /**
     * Refresh repository metadata (re-scan for views)
     */
    refreshRepository(name: string): Promise<AlexandriaEntry | null>;
}
//# sourceMappingURL=AlexandriaRegistryService.d.ts.map