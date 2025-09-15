/**
 * Storage Abstraction Layer
 *
 * This module provides a multi-store storage abstraction that supports
 * multiple backends (electron-store, S3, etc.) with namespace routing.
 */
export { StorageProviderType, } from './types';
export { TypedNamespaceRegistry, TypedStorageProvider, createTypedStorageProvider, isValidNamespace } from './typed-namespaces';
export { createNamespaceOperations, NamespaceDataValidator } from './typed-storage-interface';
// Export typed multistore wrapper
export { TypedMultiStoreWrapper, createTypedMultiStore } from './typed-multistore-wrapper';
// Export backends
export { ElectronStoreLocalStorageProvider } from './providers/ElectronStoreLocalStorageProvider';
export { S3RemoteStorageProvider } from './providers/S3RemoteStorageProvider';
// Export main manager
export { MultiStoreManager } from './MultiStoreManager';
// Create and export a singleton instance for convenient usage
import { MultiStoreManager } from './MultiStoreManager';
import { createTypedMultiStore } from './typed-multistore-wrapper';
// Single global typed manager - this is the ONLY global we should have
let globalTypedManager = null;
/**
 * Internal function to get or create the underlying storage manager
 * This should ONLY be called from getTypedStorageManager
 */
async function getOrCreateStorageManager(config) {
    const manager = new MultiStoreManager();
    await manager.initialize(config);
    return manager;
}
/**
 * Create a new storage manager instance
 * Use this if you need multiple isolated storage managers
 */
export async function createStorageManager(config) {
    const manager = new MultiStoreManager();
    await manager.initialize(config);
    return manager;
}
/**
 * Reset the global typed storage manager
 * Closes the current instance and clears the reference
 */
export async function resetTypedStorageManager() {
    if (globalTypedManager) {
        // Get the underlying manager and close it
        const manager = globalTypedManager.multiStoreManager;
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
export async function initializeTypedStorageManager(config) {
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
export async function getTypedStorageManager(config) {
    if (!globalTypedManager) {
        if (config) {
            // If config is provided, do initialization
            await initializeTypedStorageManager(config);
        }
        else {
            // No config means this is being called before initialization - this is an error
            throw new Error('TypedStorageManager not initialized! Call initializeTypedStorageManager() first from initialization.ts');
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
export async function getTyped(key, namespace, defaultValue) {
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
export async function setTyped(key, value, namespace) {
    const manager = await getTypedStorageManager();
    const result = await manager.set(key, value, namespace);
    if (!result.success) {
        throw result.error;
    }
}
/**
 * Get namespace-specific operations with type safety
 */
export async function getNamespace(namespace) {
    const manager = await getTypedStorageManager();
    return manager.namespace(namespace);
}
