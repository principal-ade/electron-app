/**
 * Storage Initialization
 *
 * Handles initialization of the storage system
 * Moved from services/store.ts as part of refactoring
 */
import {
  initializeTypedStorageManager,
  getTypedStorageManager,
  TypedMultiStoreWrapper,
} from '../storage-providers';

// Track initialization state
let storageInitialized = false;
let storageInitPromise: Promise<void> | null = null;

/**
 * Initialize the storage system with the new abstraction layer
 */
export async function initializeStorage(): Promise<void> {
  // Return existing promise if initialization is in progress
  if (storageInitPromise) {
    return storageInitPromise;
  }

  // If already initialized, return immediately
  if (storageInitialized) {
    return;
  }

  storageInitPromise = doInitializeStorage();
  return storageInitPromise;
}

async function doInitializeStorage(): Promise<void> {
  try {
    // Initialize storage - all namespaces are now static and handled by MultiStoreManager.setupDefaultNamespaces()
    await initializeTypedStorageManager({
      namespaces: [], // No dynamic namespaces anymore
    });

    storageInitialized = true;
  } catch (error) {
    console.error('[Storage] Failed to initialize storage system:', error);
    storageInitPromise = null; // Reset promise on error
    throw error; // Re-throw to prevent silent failures
  }
}

/**
 * Get the typed storage manager instance
 * Ensures storage is initialized before returning
 */
export async function getTypedStorageManagerInstance(): Promise<TypedMultiStoreWrapper> {
  // Ensure storage is initialized
  if (!storageInitialized) {
    await initializeStorage();
  }
  // Return the typed wrapper from the global instance
  return getTypedStorageManager();
}
