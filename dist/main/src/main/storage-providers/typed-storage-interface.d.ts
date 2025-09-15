import { StorageProvider, StorageResult, StaticNamespaces } from './types';
import { NamespaceDataTypes, NamespaceData } from './typed-namespaces';
import { StorageNamespaces } from './all-namespaces';
import { StorageStats } from '../../shared/main-process-api-interfaces/StoreAPI';
/**
 * Extended storage provider interface with type-safe namespace operations
 */
export interface TypedStorageProvider<T = any> extends StorageProvider {
    /**
     * Get a value with namespace-specific typing
     */
    getTyped<K extends StorageNamespaces>(namespace: K, key: string, defaultValue?: NamespaceData<K>): Promise<NamespaceData<K> | undefined>;
    /**
     * Set a value with namespace-specific typing
     */
    setTyped<K extends StorageNamespaces>(namespace: K, key: string, value: NamespaceData<K>): Promise<void>;
    /**
     * Batch get multiple keys from a namespace
     */
    batchGet<K extends StorageNamespaces>(namespace: K, keys: string[]): Promise<Map<string, NamespaceData<K>>>;
    /**
     * Batch set multiple key-value pairs in a namespace
     */
    batchSet<K extends StorageNamespaces>(namespace: K, items: Map<string, NamespaceData<K>>): Promise<void>;
}
/**
 * Type-safe storage result
 */
export interface TypedStorageResult<K extends StorageNamespaces> extends StorageResult {
    data?: NamespaceData<K>;
    namespace: K;
}
/**
 * Namespace-specific storage operations
 */
export interface NamespaceOperations<K extends StorageNamespaces> {
    get(key: string, defaultValue?: NamespaceData<K>): Promise<NamespaceData<K> | undefined>;
    set(key: string, value: NamespaceData<K>): Promise<void>;
    delete(key: string): Promise<void>;
    has(key: string): Promise<boolean>;
    keys(): Promise<string[]>;
    clear(): Promise<void>;
    getAll(): Promise<Record<string, NamespaceData<K>>>;
}
/**
 * Type-safe multi-store manager interface
 */
export interface TypedMultiStoreManager {
    /**
     * Get namespace-specific operations
     */
    namespace<K extends StorageNamespaces>(namespace: K): NamespaceOperations<K>;
    /**
     * Get a value from a specific namespace with type safety
     */
    get<K extends StorageNamespaces>(key: string, namespace: K, defaultValue?: NamespaceData<K>): Promise<TypedStorageResult<K>>;
    /**
     * Set a value in a specific namespace with type safety
     */
    set<K extends StorageNamespaces>(key: string, value: NamespaceData<K>, namespace: K): Promise<TypedStorageResult<K>>;
    /**
     * Delete a key from a namespace
     */
    delete<K extends StorageNamespaces>(key: string, namespace: K): Promise<TypedStorageResult<K>>;
    /**
     * Check if a key exists in a namespace
     */
    has<K extends StorageNamespaces>(key: string, namespace: K): Promise<boolean>;
    /**
     * Get all keys in a namespace
     */
    keys<K extends StorageNamespaces>(namespace: K): Promise<string[]>;
    /**
     * Clear all data in a namespace
     */
    clearNamespace<K extends StorageNamespaces>(namespace: K): Promise<void>;
    /**
     * Get statistics for a namespace
     */
    getNamespaceStats<K extends StorageNamespaces>(namespace: K): Promise<StorageStats>;
    /**
     * Migrate data between namespaces with type safety
     */
    migrate<From extends StorageNamespaces, To extends StorageNamespaces>(fromNamespace: From, toNamespace: To, transformer?: (data: NamespaceData<From>) => NamespaceData<To>): Promise<void>;
}
/**
 * Create a namespace-specific operations wrapper
 */
export declare function createNamespaceOperations<K extends StorageNamespaces>(namespace: K, provider: StorageProvider): NamespaceOperations<K>;
/**
 * Type predicates for namespace data validation
 */
export declare class NamespaceDataValidator {
    static isUserPreferences(data: any): data is NamespaceDataTypes[StaticNamespaces.USER_PREFERENCES];
    static isRepositories(data: any): data is NamespaceDataTypes[StaticNamespaces.REPOSITORIES];
    static isAIConfiguration(data: any): data is NamespaceDataTypes[StaticNamespaces.AI_CONFIGURATION];
    static isAgentSessions(data: any): data is NamespaceDataTypes[StaticNamespaces.AGENT_SESSIONS];
    static isLLMModels(data: any): data is NamespaceDataTypes[StaticNamespaces.LLM_MODELS];
    static isToolContainerState(data: any): data is NamespaceDataTypes[StaticNamespaces.DOCKER_CONTAINERS];
    static isDockerAnalysisSession(data: any): data is NamespaceDataTypes[StaticNamespaces.DOCKER_SESSIONS];
    static validateNamespaceData<K extends StorageNamespaces>(namespace: K, data: any): data is NamespaceData<K>;
}
//# sourceMappingURL=typed-storage-interface.d.ts.map