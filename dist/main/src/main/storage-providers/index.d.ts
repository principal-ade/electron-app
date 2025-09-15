/**
 * Storage Abstraction Layer
 *
 * This module provides a multi-store storage abstraction that supports
 * multiple backends (electron-store, S3, etc.) with namespace routing.
 */
export type { StorageProvider, MultiStoreConfig, StorageResult, StorageEvent, StorageEventType, StorageEventCallback, MigrationOptions, MigrationResult } from './types';
export { StorageProviderType, } from './types';
export type { NamespaceDataTypes, NamespaceData, NamespaceKey } from './typed-namespaces';
export { TypedNamespaceRegistry, TypedStorageProvider, createTypedStorageProvider, isValidNamespace } from './typed-namespaces';
export type { TypedStorageProvider as ITypedStorageProvider, TypedStorageResult, NamespaceOperations, TypedMultiStoreManager } from './typed-storage-interface';
export { createNamespaceOperations, NamespaceDataValidator } from './typed-storage-interface';
export { TypedMultiStoreWrapper, createTypedMultiStore } from './typed-multistore-wrapper';
export type { AgentEventNamespace, AGENT_EVENT_NAMESPACES, isValidNamespace as isValidAllNamespace, getAllNamespaces, isStaticNamespace, isAgentEventNamespace } from './all-namespaces';
export { ElectronStoreLocalStorageProvider } from './providers/ElectronStoreLocalStorageProvider';
export { S3RemoteStorageProvider, type S3ProviderConfig } from './providers/S3RemoteStorageProvider';
export { MultiStoreManager } from './MultiStoreManager';
import { MultiStoreManager } from './MultiStoreManager';
import { TypedMultiStoreWrapper } from './typed-multistore-wrapper';
import { NamespaceOperations } from './typed-storage-interface';
import { NamespaceData } from './typed-namespaces';
import { StorageNamespaces } from './all-namespaces';
import { MultiStoreConfig } from './types';
/**
 * Create a new storage manager instance
 * Use this if you need multiple isolated storage managers
 */
export declare function createStorageManager(config?: Partial<MultiStoreConfig>): Promise<MultiStoreManager>;
/**
 * Reset the global typed storage manager
 * Closes the current instance and clears the reference
 */
export declare function resetTypedStorageManager(): Promise<void>;
/**
 * Initialize the global typed storage manager with configuration
 * This is the PRIMARY way to initialize storage - call this from initialization.ts
 */
export declare function initializeTypedStorageManager(config?: Partial<MultiStoreConfig>): Promise<void>;
/**
 * Get the global typed storage manager instance
 * IMPORTANT: initializeTypedStorageManager MUST be called first
 */
export declare function getTypedStorageManager(config?: Partial<MultiStoreConfig>): Promise<TypedMultiStoreWrapper>;
/**
 * Type-safe get operation using the global typed manager
 */
export declare function getTyped<K extends StorageNamespaces>(key: string, namespace: K, defaultValue?: NamespaceData<K>): Promise<NamespaceData<K> | undefined>;
/**
 * Type-safe set operation using the global typed manager
 */
export declare function setTyped<K extends StorageNamespaces>(key: string, value: NamespaceData<K>, namespace: K): Promise<void>;
/**
 * Get namespace-specific operations with type safety
 */
export declare function getNamespace<K extends StorageNamespaces>(namespace: K): Promise<NamespaceOperations<K>>;
//# sourceMappingURL=index.d.ts.map