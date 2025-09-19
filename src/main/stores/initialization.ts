/**
 * Storage Initialization
 *
 * Handles initialization of the storage system with agent session event namespaces
 * Moved from services/store.ts as part of refactoring
 */
import { getAgentInfo, SUPPORTED_AGENTS } from '@principal-ai/agent-monitoring';
import { StorageProviderType } from '../storage-providers/types';
import { NamespaceCategory } from '../../shared/main-process-api-interfaces/StoreAPI';
import {
  initializeTypedStorageManager,
  getTypedStorageManager,
  TypedMultiStoreWrapper,
} from '../storage-providers';
import { StorageNamespaces } from '../../shared/types/namespaces.types';

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
    // Create DYNAMIC namespaces for agent session events based on agent info
    const dynamicAgentNamespaces = SUPPORTED_AGENTS.map((agent) => {
      const agentInfo = getAgentInfo(agent);

      // Check if agentInfo is valid
      if (!agentInfo) {
        console.error(`[Storage] No agent info found for ${agent}`);
        return null;
      }

      const namespaceName = agentInfo.storageEventsNamespace;

      if (!namespaceName) {
        console.error(
          `[Storage] Missing storageEventsNamespace for agent ${agent}`,
        );
        return null;
      }

      return {
        name: namespaceName as StorageNamespaces,
        storageProvider: StorageProviderType.ELECTRON_STORE,
        category: NamespaceCategory.AGENT_SESSION_EVENTS,
        description: `${agentInfo.displayName} session event storage`,
        config: {
          path: namespaceName,
          defaults: {},
        },
      };
    }).filter((ns) => ns !== null);

    // Filter out any namespaces with undefined names
    const validDynamicNamespaces = dynamicAgentNamespaces.filter((ns) => {
      if (!ns.name) {
        console.error('[Storage] Skipping namespace with undefined name:', ns);
        return false;
      }
      return true;
    });

    // Only agent namespaces are dynamic - everything else should be in StorageNamespaces enum
    const allDynamicNamespaces = validDynamicNamespaces;

    // Initialize storage with dynamic namespaces - static ones are handled by MultiStoreManager.setupDefaultNamespaces()
    await initializeTypedStorageManager({
      namespaces: allDynamicNamespaces,
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
