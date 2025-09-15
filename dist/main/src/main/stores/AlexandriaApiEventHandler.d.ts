/**
 * Main process handler for Alexandria repository management
 */
import type { AlexandriaAPI } from '../../shared/main-process-api-interfaces/AlexandriaAPI';
import type { AlexandriaEntry } from '@a24z/core-library';
export declare class AlexandriaApiEventHandler implements AlexandriaAPI {
    private registryService;
    constructor();
    onRepositoryChange(): () => void;
    /**
     * Broadcast Alexandria events to all windows
     */
    private broadcastAlexandriaEvent;
    getRepositories(): Promise<AlexandriaEntry[]>;
    getRepository(name: string): Promise<AlexandriaEntry | null>;
    getRepositoryByPath(path: string): Promise<AlexandriaEntry | null>;
    registerRepository(name: string, path: string): Promise<AlexandriaEntry>;
    removeRepository(name: string): Promise<boolean>;
    searchRepositories(query: string): Promise<AlexandriaEntry[]>;
    getRepositoriesWithViews(): Promise<AlexandriaEntry[]>;
    refreshRepository(name: string): Promise<AlexandriaEntry | null>;
    getRepositoryCount(): Promise<number>;
    /**
     * Clean up handlers when shutting down
     */
    destroy(): void;
}
/**
 * Register Alexandria IPC handlers
 */
export declare function registerAlexandriaHandlers(): void;
//# sourceMappingURL=AlexandriaApiEventHandler.d.ts.map