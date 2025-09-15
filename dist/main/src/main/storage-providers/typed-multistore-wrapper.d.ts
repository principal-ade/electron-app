import { MultiStoreManager } from './MultiStoreManager';
import { StorageResult } from './types';
import { NamespaceData } from './typed-namespaces';
import { TypedMultiStoreManager, TypedStorageResult, NamespaceOperations } from './typed-storage-interface';
import { StorageNamespaces } from './all-namespaces';
import { StorageNamespaceConfig, StorageStats } from '../../shared/main-process-api-interfaces/StoreAPI';
/**
 * Type-safe wrapper around MultiStoreManager
 * Provides compile-time type safety for namespace operations
 * Supports both static namespaces (from enum) and dynamic namespaces (strings)
 */
export declare class TypedMultiStoreWrapper implements TypedMultiStoreManager {
    private multiStoreManager;
    private namespaceCache;
    constructor(multiStoreManager: MultiStoreManager);
    /**
     * Get namespace-specific operations with type safety
     * All namespaces are properly typed
     */
    namespace<K extends StorageNamespaces>(namespace: K): NamespaceOperations<K>;
    /**
     * Type-safe get operation
     * All namespaces are now properly typed in NamespaceDataTypes
     */
    get<K extends StorageNamespaces>(key: string, namespace: K, defaultValue?: NamespaceData<K>): Promise<TypedStorageResult<K>>;
    /**
     * Type-safe set operation
     * All namespaces are now properly typed in NamespaceDataTypes
     */
    set<K extends StorageNamespaces>(key: string, value: NamespaceData<K>, namespace: K): Promise<TypedStorageResult<K>>;
    /**
     * Delete a key from a namespace
     * All namespaces are properly typed
     */
    delete<K extends StorageNamespaces>(key: string, namespace: K): Promise<TypedStorageResult<K>>;
    /**
     * Check if a key exists in a namespace
     * Supports all known namespaces
     */
    has<K extends StorageNamespaces>(key: string, namespace: K): Promise<boolean>;
    /**
     * Get all keys in a namespace
     * Supports all known namespaces
     */
    keys<K extends StorageNamespaces>(namespace: K): Promise<string[]>;
    /**
     * Clear all data in a namespace
     * Supports all known namespaces
     */
    clearNamespace<K extends StorageNamespaces>(namespace: K): Promise<void>;
    /**
     * Alias for clearNamespace to match MultiStoreManager API
     */
    clear<K extends StorageNamespaces>(namespace: K): Promise<void>;
    /**
     * Get statistics for a namespace
     * Supports all known namespaces
     */
    getNamespaceStats<K extends StorageNamespaces>(namespace: K): Promise<StorageStats>;
    /**
     * Migrate data between namespaces with optional transformation
     */
    migrate<From extends StorageNamespaces, To extends StorageNamespaces>(fromNamespace: From, toNamespace: To, transformer?: (data: NamespaceData<From>) => NamespaceData<To>): Promise<void>;
    /**
     * Batch operations for better performance
     */
    batchGet<K extends StorageNamespaces>(namespace: K, keys: string[]): Promise<Map<string, NamespaceData<K>>>;
    /**
     * Get multiple values with the new optimized method
     */
    getMultiple<K extends StorageNamespaces>(keys: string[], namespace: K): Promise<StorageResult<Map<string, NamespaceData<K>>>>;
    batchSet<K extends StorageNamespaces>(namespace: K, items: Map<string, NamespaceData<K>>): Promise<void>;
    /**
     * Delete multiple keys with the new optimized method
     */
    deleteMultiple<K extends StorageNamespaces>(keys: string[], namespace: K): Promise<StorageResult<{
        deleted: string[];
        failed: string[];
    }>>;
    /**
     * Helper method to validate namespace string
     */
    isValidNamespace(namespace: string): namespace is StorageNamespaces;
    /**
     * Get all registered namespaces (both static and dynamic)
     */
    getNamespaces(): Map<StorageNamespaces, StorageNamespaceConfig>;
}
/**
 * Factory function to create a typed multi-store wrapper
 */
export declare function createTypedMultiStore(multiStoreManager: MultiStoreManager): TypedMultiStoreWrapper;
/**
 * Usage example showing type safety
 *
 * @example
 * ```typescript
 * const typedStore = createTypedMultiStore(multiStoreManager);
 *
 * // Type-safe operations
 * const userPrefs = await typedStore.get('settings', StorageNamespaces.USER_PREFERENCES);
 * // userPrefs.data is typed as UserPreferences
 *
 * await typedStore.set('repos', repositories, StorageNamespaces.REPOSITORIES);
 * // repositories must be of type Repository[]
 *
 * // Namespace-specific operations
 * const repoOps = typedStore.namespace(StorageNamespaces.REPOSITORIES);
 * const allRepos = await repoOps.getAll();
 * // allRepos is typed as Record<string, Repository[]>
 * ```
 */ 
//# sourceMappingURL=typed-multistore-wrapper.d.ts.map