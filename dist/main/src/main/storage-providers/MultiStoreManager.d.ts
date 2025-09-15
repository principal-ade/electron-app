import { EventEmitter } from 'events';
import { StorageProvider, MultiStoreConfig, StorageResult, StorageEventCallback, MigrationOptions, MigrationResult } from './types';
import { StorageNamespaceConfig, StorageStats } from '../../shared/main-process-api-interfaces/StoreAPI';
import { StorageNamespaces } from './all-namespaces';
/**
 * Multi-Store Manager
 *
 * Manages multiple storage providers and provides a unified API for accessing
 * different storage namespaces. Supports routing operations to different backends
 * based on namespace configuration.
 */
export declare class MultiStoreManager extends EventEmitter {
    private storageProviders;
    private namespaceProviders;
    private namespaces;
    private isInitialized;
    constructor();
    /**
     * Initialize the multi-store manager with configuration
     *
     * @param config Optional configuration containing:
     *   - storageProviders: Custom storage provider implementations (defaults to electron-store and S3)
     *   - namespaces: DYNAMIC namespaces to add (agent-specific, runtime-discovered, etc.)
     *                 Static namespaces from StaticNamespaces enum are always included
     */
    initialize(config?: Partial<MultiStoreConfig>): Promise<void>;
    /**
     * Register a storage backend
     */
    registerStorageProvider(name: string, storageProvider: StorageProvider): Promise<void>;
    /**
     * Register a storage namespace
     */
    registerNamespace(namespace: StorageNamespaceConfig): void;
    /**
     * Register multiple storage namespaces at once
     */
    registerNamespaces(namespaces: StorageNamespaceConfig[]): void;
    /**
     * Get a value from a specific namespace
     */
    get<T = any>(key: string, namespace: StorageNamespaces, defaultValue?: T): Promise<StorageResult<T>>;
    /**
     * Set a value in a specific namespace
     */
    set<T = any>(key: string, value: T, namespace: StorageNamespaces): Promise<StorageResult<void>>;
    /**
     * Delete a key from a specific namespace
     */
    delete(key: string, namespace: StorageNamespaces): Promise<StorageResult<void>>;
    /**
     * Check if a key exists in a specific namespace
     */
    has(key: string, namespace: StorageNamespaces): Promise<StorageResult<boolean>>;
    /**
     * Clear all data in a specific namespace
     */
    clear(namespace: StorageNamespaces): Promise<StorageResult<void>>;
    /**
     * Get multiple values from a specific namespace in a single batch operation
     */
    getMultiple<T = any>(keys: string[], namespace: StorageNamespaces): Promise<StorageResult<Map<string, T>>>;
    /**
     * Delete multiple keys from a specific namespace in a single batch operation
     */
    deleteMultiple(keys: string[], namespace: StorageNamespaces): Promise<StorageResult<{
        deleted: string[];
        failed: string[];
    }>>;
    /**
     * Get all keys from a specific namespace
     */
    keys(namespace: StorageNamespaces): Promise<StorageResult<string[]>>;
    /**
     * Get statistics for a specific namespace
     */
    getStats(namespace: StorageNamespaces): Promise<StorageResult<StorageStats>>;
    /**
     * Watch for changes in a specific namespace
     */
    watch(key: string, callback: StorageEventCallback, namespace: StorageNamespaces): () => void;
    /**
     * Migrate data between namespaces
     */
    migrate(options: MigrationOptions): Promise<MigrationResult>;
    /**
     * Get all registered backends
     */
    getStorageProviders(): Map<string, StorageProvider>;
    /**
     * Get a specific backend by name
     */
    getStorageProvider(name: string): StorageProvider | undefined;
    /**
     * Get the storage provider for a specific namespace
     * This properly handles both dedicated and shared providers
     */
    getProviderForNamespace(namespace: StorageNamespaces): StorageProvider;
    /**
     * Get all registered namespaces
     */
    getNamespaces(): Map<StorageNamespaces, StorageNamespaceConfig>;
    /**
     * Close all backends and clean up
     */
    close(): Promise<void>;
    /**
     * Get the backend for a specific namespace
     */
    private getStorageProviderForNamespace;
    /**
     * Get namespace configuration
     */
    private getNamespaceConfig;
    /**
     * Register default backends
     */
    private registerDefaultBackends;
    /**
     * Set up default namespaces
     * This sets up ALL static namespaces defined in the StorageNamespaces enum
     * Dynamic namespaces (like agent-specific ones) are added separately via config
     */
    private setupDefaultNamespaces;
    /**
     * Initialize all registered backends
     */
    private initializeBackends;
    /**
     * Emit storage event
     */
    private emitEvent;
}
//# sourceMappingURL=MultiStoreManager.d.ts.map