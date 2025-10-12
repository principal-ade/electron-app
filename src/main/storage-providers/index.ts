/**
 * Storage Abstraction Layer
 *
 * This module provides a multi-store storage abstraction that supports
 * multiple backends (electron-store, S3, etc.) with namespace routing.
 */

// Export types and interfaces
export type {
  StorageProvider,
  MultiStoreConfig,
  StorageResult,
  StorageEvent,
  StorageEventType,
  StorageEventCallback,
  MigrationOptions,
  MigrationResult,
} from './types';

export { StorageProviderType } from './types';

// Export typed namespace definitions
export type {
  NamespaceDataTypes,
  NamespaceData,
  NamespaceKey,
} from './typed-namespaces';

export {
  TypedNamespaceRegistry,
  TypedStorageProvider,
  createTypedStorageProvider,
  isValidNamespace,
} from './typed-namespaces';

// Export typed storage interfaces
export type {
  TypedStorageProvider as ITypedStorageProvider,
  TypedStorageResult,
  NamespaceOperations,
  TypedMultiStoreManager,
} from './typed-storage-interface';

export {
  createNamespaceOperations,
  NamespaceDataValidator,
} from './typed-storage-interface';

// Export typed multistore wrapper
export {
  TypedMultiStoreWrapper,
  createTypedMultiStore,
} from './typed-multistore-wrapper';

// Export all namespaces type system
export {
  isValidNamespace as isValidAllNamespace,
  getAllNamespaces,
  isStaticNamespace,
} from './all-namespaces';

// Export backends
export { ElectronStoreLocalStorageProvider } from './providers/ElectronStoreLocalStorageProvider';
export {
  S3RemoteStorageProvider,
  type S3ProviderConfig,
} from './providers/S3RemoteStorageProvider';

// Export main manager
export { MultiStoreManager } from './MultiStoreManager';

// Create and export a singleton instance for convenient usage
import { MultiStoreManager } from './MultiStoreManager';
import {
  TypedMultiStoreWrapper,
  createTypedMultiStore,
} from './typed-multistore-wrapper';
import { NamespaceOperations } from './typed-storage-interface';
import { NamespaceData } from './typed-namespaces';
import { StorageNamespaces } from './all-namespaces';

import { MultiStoreConfig } from './types';

// Type for accessing internal multiStoreManager property (private to this module)
type TypedWrapperInternal = { multiStoreManager: MultiStoreManager };

// Single global typed manager - this is the ONLY global we should have
let globalTypedManager: TypedMultiStoreWrapper | null = null;

/**
 * Internal function to get or create the underlying storage manager
 * This should ONLY be called from getTypedStorageManager
 */
async function getOrCreateStorageManager(
  config?: Partial<MultiStoreConfig>,
): Promise<MultiStoreManager> {
  const manager = new MultiStoreManager();
  await manager.initialize(config);
  return manager;
}

/**
 * Create a new storage manager instance
 * Use this if you need multiple isolated storage managers
 */
export async function createStorageManager(
  config?: Partial<MultiStoreConfig>,
): Promise<MultiStoreManager> {
  const manager = new MultiStoreManager();
  await manager.initialize(config);
  return manager;
}

/**
 * Reset the global typed storage manager
 * Closes the current instance and clears the reference
 */
export async function resetTypedStorageManager(): Promise<void> {
  if (globalTypedManager) {
    // Get the underlying manager and close it
    const manager = (globalTypedManager as unknown as TypedWrapperInternal)
      .multiStoreManager;
    if (manager) {
      await manager.close();
    }
    globalTypedManager = null;
  }
}

/**
 * Initialize the global typed storage manager with configuration
 * This is the PRIMARY way to initialize storage - call this from initialization.ts
 */
export async function initializeTypedStorageManager(
  config?: Partial<MultiStoreConfig>,
): Promise<void> {
  if (globalTypedManager) {
    return; // Already initialized
  }

  const manager = await getOrCreateStorageManager(config);
  globalTypedManager = createTypedMultiStore(manager);
}

/**
 * Get the global typed storage manager instance
 * IMPORTANT: initializeTypedStorageManager MUST be called first
 */
export async function getTypedStorageManager(
  config?: Partial<MultiStoreConfig>,
): Promise<TypedMultiStoreWrapper> {
  if (!globalTypedManager) {
    if (config) {
      // If config is provided, do initialization
      await initializeTypedStorageManager(config);
    } else {
      // No config means this is being called before initialization - this is an error
      throw new Error(
        'TypedStorageManager not initialized! Call initializeTypedStorageManager() first from initialization.ts',
      );
    }
  }

  if (!globalTypedManager) {
    throw new Error('Failed to initialize TypedStorageManager');
  }

  return globalTypedManager;
}

/**
 * Type-safe get operation using the global typed manager
 */
export async function getTyped<K extends StorageNamespaces>(
  key: string,
  namespace: K,
  defaultValue?: NamespaceData<K>,
): Promise<NamespaceData<K> | undefined> {
  const manager = await getTypedStorageManager();
  const result = await manager.get(key, namespace, defaultValue);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}

/**
 * Type-safe set operation using the global typed manager
 */
export async function setTyped<K extends StorageNamespaces>(
  key: string,
  value: NamespaceData<K>,
  namespace: K,
): Promise<void> {
  const manager = await getTypedStorageManager();
  const result = await manager.set(key, value, namespace);
  if (!result.success) {
    throw result.error;
  }
}

/**
 * Get namespace-specific operations with type safety
 */
export async function getNamespace<K extends StorageNamespaces>(
  namespace: K,
): Promise<NamespaceOperations<K>> {
  const manager = await getTypedStorageManager();
  return manager.namespace(namespace);
}
