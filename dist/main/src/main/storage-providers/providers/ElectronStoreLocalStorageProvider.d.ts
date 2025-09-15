import Store from 'electron-store';
import { StorageProvider } from '../types';
import { StorageStats, StorageProviderConfig } from '../../../shared/main-process-api-interfaces/StoreAPI';
/**
 * Electron Store Backend Implementation
 *
 * This backend uses electron-store for local file-based storage.
 * It provides persistent storage that survives app restarts.
 */
export declare class ElectronStoreLocalStorageProvider implements StorageProvider {
    readonly name: string;
    private store;
    private watchers;
    constructor(name?: string);
    get isAvailable(): boolean;
    /**
     * Initialize the electron-store backend
     */
    initialize(config?: StorageProviderConfig): Promise<void>;
    /**
     * Get a value by key
     */
    get<T = any>(key: string, defaultValue?: T): Promise<T | undefined>;
    /**
     * Set a value by key
     */
    set<T = any>(key: string, value: T): Promise<void>;
    /**
     * Delete a key
     */
    delete(key: string): Promise<void>;
    /**
     * Check if a key exists
     */
    has(key: string): Promise<boolean>;
    /**
     * Clear all data
     */
    clear(): Promise<void>;
    /**
     * Get all keys
     */
    keys(): Promise<string[]>;
    /**
     * Get storage statistics
     */
    getStats(): Promise<StorageStats>;
    /**
     * Close the storage backend
     */
    close(): Promise<void>;
    /**
     * Watch for changes to a specific key
     */
    watch(key: string, callback: (newValue: any, oldValue: any) => void): () => void;
    /**
     * Get the file path of the store
     */
    getFilePath(): string;
    /**
     * Get the raw store instance (for compatibility with existing code)
     */
    getStore(): Store;
    /**
     * Set up global watcher for all changes (internal use)
     */
    private setupGlobalWatcher;
    /**
     * Create a new ElectronStoreBackend with specific configuration
     */
    static create(name: string, config?: StorageProviderConfig): Promise<ElectronStoreLocalStorageProvider>;
    /**
     * Migrate data from another backend (utility method)
     */
    importData(data: Record<string, any>): Promise<void>;
    /**
     * Export all data (utility method)
     */
    exportData(): Promise<Record<string, any>>;
}
//# sourceMappingURL=ElectronStoreLocalStorageProvider.d.ts.map