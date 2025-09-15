/**
 * VS Code implementation of SearchStorageAdapter
 * Uses VS Code's storageUri for file-based persistent storage of large index data
 * and workspace state for small metadata
 */
import { SearchStorageAdapter, IndexMetadata } from '../../types';
export interface VSCodeAPI {
    ExtensionContext: {
        workspaceState: {
            get<T>(key: string): T | undefined;
            update(key: string, value: any): Promise<void>;
            keys(): readonly string[];
        };
        storageUri?: {
            fsPath: string;
        };
        globalStorageUri?: {
            fsPath: string;
        };
    };
}
export declare class VSCodeStorageAdapter implements SearchStorageAdapter {
    private context;
    private storagePrefix;
    private saveTimeout;
    private storagePath;
    constructor(context: any, storagePrefix?: string);
    private initializeStoragePath;
    private getStorageKey;
    private getIndexFilePath;
    saveIndex(key: string, data: any): Promise<void>;
    loadIndex(key: string): Promise<any | null>;
    deleteIndex(key: string): Promise<void>;
    hasIndex(key: string): Promise<boolean>;
    getIndexMetadata(key: string): Promise<IndexMetadata | null>;
    /**
     * Get all search-related keys in storage
     */
    getAllKeys(): Promise<string[]>;
    /**
     * Clear all search-related data
     */
    clearAll(): Promise<void>;
    /**
     * Clean up resources
     */
    dispose(): void;
}
//# sourceMappingURL=VSCodeStorageAdapter.d.ts.map