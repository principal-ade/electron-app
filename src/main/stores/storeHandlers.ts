import { ipcMain } from 'electron';
import {
  StaticNamespaces,
  StorageNamespaces,
} from '../../shared/types/namespaces.types';
import { getTypedStorageManagerInstance } from './initialization';
import { StoreEvents } from '../../shared/main-process-api-interfaces/StoreAPI';
import type {
  HookFallbackFile,
  SessionStorageMetrics,
  CleanupOptions,
  CleanupResult,
} from '../../shared/main-process-api-interfaces/StoreAPI';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { NamespaceOperations } from '../storage-providers/typed-storage-interface';
import { TypedMultiStoreWrapper } from '../storage-providers/typed-multistore-wrapper';
import { NamespaceData } from '../storage-providers/typed-namespaces';

/**
 * Register IPC handlers for Store operations
 */
export function registerStoreHandlers(): void {
  async function verifyNamespace(
    namespace: StorageNamespaces,
  ): Promise<NamespaceOperations<StorageNamespaces>> {
    const typedManager = await getTypedStorageManagerInstance();
    if (!typedManager.getNamespaces().has(namespace)) {
      throw new Error(
        `Namespace ${namespace} is not registered in MultiStoreManager`,
      );
    }
    return typedManager.namespace(namespace as StorageNamespaces);
  }

  async function getTypedManager(): Promise<TypedMultiStoreWrapper> {
    return await getTypedStorageManagerInstance();
  }

  // Core CRUD operations
  ipcMain.handle(
    StoreEvents.GET,
    async (
      _,
      key: string,
      namespace: StorageNamespaces,
      defaultValue?: unknown,
    ) => {
      try {
        const typedNamespace = await verifyNamespace(namespace);
        const result = await typedNamespace.get(key, defaultValue as NamespaceData<typeof namespace> | undefined);
        if (!result) {
          throw new Error(`Key ${key} not found in namespace ${namespace}`);
        }
        return result;
      } catch (error) {
        console.error('Error getting value from store:', error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    StoreEvents.SET,
    async (_, key: string, value: unknown, namespace: StorageNamespaces) => {
      try {
        const typedManager = await getTypedStorageManagerInstance();
        const result = await typedManager.set(
          key,
          value as NamespaceData<typeof namespace>,
          namespace as StorageNamespaces,
        );
        if (!result) {
          throw new Error(`Failed to set key ${key} in namespace ${namespace}`);
        }
      } catch (error) {
        console.error('Error setting value in store:', error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    StoreEvents.DELETE,
    async (_, key: string, namespace: string) => {
      try {
        const typedManager = await getTypedStorageManagerInstance();
        const result = await typedManager.delete(
          key,
          namespace as StorageNamespaces,
        );
        if (!result) {
          throw new Error(
            `Failed to delete key ${key} in namespace ${namespace}`,
          );
        }
      } catch (error) {
        console.error('Error deleting key from store:', error);
        throw error;
      }
    },
  );

  ipcMain.handle(StoreEvents.HAS, async (_, key: string, namespace: string) => {
    try {
      const typedManager = await getTypedManager();
      const result = await typedManager.has(
        key,
        namespace as StorageNamespaces,
      );
      return result;
    } catch (error) {
      console.error('Error checking key in store:', error);
      throw error;
    }
  });

  ipcMain.handle(StoreEvents.CLEAR, async (_, namespace: string) => {
    try {
      const typedManager = await getTypedManager();
      await typedManager.clear(namespace as StorageNamespaces);
    } catch (error) {
      console.error('Error clearing store:', error);
      throw error;
    }
  });

  ipcMain.handle(StoreEvents.KEYS, async (_, namespace: string) => {
    try {
      const typedManager = await getTypedManager();
      const keys = await typedManager.keys(namespace as StorageNamespaces);
      return keys;
    } catch (error) {
      console.error('Error getting keys from store:', error);
      throw error;
    }
  });

  // Namespace management
  ipcMain.handle(StoreEvents.LIST_NAMESPACES, async () => {
    try {
      const typedManager = await getTypedManager();
      const namespaces = typedManager.getNamespaces();

      // Convert Map to array and add compatibility fields for StoreViewer
      const namespacesArray = Array.from(namespaces.values()).map((ns) => ({
        ...ns,
        backend: ns.storageProvider, // Add backend field for compatibility
        readOnly: ns.readOnly || false,
      }));

      return namespacesArray;
    } catch (error) {
      console.error('Error listing namespaces:', error);
      throw error;
    }
  });

  ipcMain.handle(
    StoreEvents.GET_FILE_PATH,
    async (_, namespace: StorageNamespaces) => {
      try {
        const typedManager = await getTypedManager();

        // If no namespace provided, throw error
        if (!namespace) {
          throw new Error('Namespace is required for getting file path');
        }

        // For all namespaces, construct the path based on namespace config
        const namespaces = typedManager.getNamespaces();
        const ns = namespaces.get(namespace);
        if (ns && ns.config?.path) {
          const userDataPath = app.getPath('userData');
          return path.join(userDataPath, `${ns.config.path}.json`);
        }

        // Default path for unknown namespaces
        const userDataPath = app.getPath('userData');
        return path.join(userDataPath, `${namespace}.json`);
      } catch (error) {
        console.error('Error getting file path:', error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    StoreEvents.GET_NAMESPACE_FILE_PATH,
    async (_, namespace: StorageNamespaces) => {
      try {
        const typedManager = await getTypedManager();
        const namespaces = typedManager.getNamespaces();
        const ns = namespaces.get(namespace);

        if (ns && ns.config?.path) {
          const userDataPath = app.getPath('userData');
          return path.join(userDataPath, `${ns.config.path}.json`);
        }

        // Default path
        const userDataPath = app.getPath('userData');
        return path.join(userDataPath, `${namespace}.json`);
      } catch (error) {
        console.error('Error getting namespace file path:', error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    StoreEvents.GET_STATS,
    async (_, namespace?: StorageNamespaces) => {
      try {
        const typedManager = await getTypedManager();
        // If no namespace provided, get stats for the primary/default namespace
        const targetNamespace = namespace || StaticNamespaces.USER_PREFERENCES; // USER_PREFERENCES is marked as primary
        const stats = await typedManager.getNamespaceStats(targetNamespace);
        return stats;
      } catch (error) {
        console.error('Error getting stats:', error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    StoreEvents.GET_NAMESPACE_STATS,
    async (_, namespace: StorageNamespaces) => {
      try {
        const typedManager = await getTypedManager();
        const stats = await typedManager.getNamespaceStats(namespace);
        return stats;
      } catch (error) {
        console.error('Error getting namespace stats:', error);
        throw error;
      }
    },
  );

  // Session and fallback management
  ipcMain.handle(StoreEvents.SCAN_HOOK_FALLBACK_FILES, async () => {
    try {
      // This functionality is specific to the application's hook system
      // For now, return empty array - this would need to be integrated with the actual hook system
      const userDataPath = app.getPath('userData');
      const hookFallbackDir = path.join(userDataPath, 'hook-fallback');

      const files: HookFallbackFile[] = [];

      if (fs.existsSync(hookFallbackDir)) {
        const entries = fs.readdirSync(hookFallbackDir);
        for (const entry of entries) {
          const filePath = path.join(hookFallbackDir, entry);
          const stats = fs.statSync(filePath);

          // Parse filename to extract CLI name and type
          const match = entry.match(/^(.+?)-(events|errors|settings)\.json$/);
          if (match) {
            const [, cli, type] = match;
            files.push({
              fileName: entry,
              cli,
              path: filePath,
              size: stats.size,
              lastModified: stats.mtime,
              isError: type === 'errors',
              isSettings: type === 'settings',
            });
          }
        }
      }

      return files;
    } catch (error) {
      console.error('Error scanning hook fallback files:', error);
      return [];
    }
  });

  ipcMain.handle(StoreEvents.GET_SESSION_STORAGE_METRICS, async () => {
    try {
      // This would need to be integrated with the actual session storage system
      // For now, return mock data structure
      const metrics: SessionStorageMetrics = {
        totalStorageUsed: 0,
        archiveFiles: {
          count: 0,
          totalSize: 0,
        },
        processedEvents: {
          sessionCount: 0,
          totalSize: 0,
        },
        rawEvents: {},
      };

      // TODO: Integrate with actual session storage metrics
      return metrics;
    } catch (error) {
      console.error('Error getting session storage metrics:', error);
      throw error;
    }
  });

  ipcMain.handle(
    StoreEvents.CLEANUP_SESSION_STORAGE,
    async (_, _options: CleanupOptions) => {
      try {
        // This would need to be integrated with the actual session storage cleanup
        const result: CleanupResult = {
          deletedCount: 0,
          freedSpace: 0,
        };

        // TODO: Integrate with actual cleanup functionality
        return result;
      } catch (error) {
        console.error('Error cleaning up session storage:', error);
        throw error;
      }
    },
  );

  // Watch functionality removed - not currently used and expensive to maintain
  // Storage event listener removed - not currently used and expensive to maintain
  // Broadcasting all storage changes to all windows is inefficient
  // Future implementation should use more targeted event handling if needed
}

// Export function to cleanup on app quit
export async function cleanupStore(): Promise<void> {
  // The global storage manager is managed by the storage-providers module
  // We don't need to clean it up here as it's handled by resetStorageManager
}
