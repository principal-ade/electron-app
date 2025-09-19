import { ipcRenderer } from 'electron';

import {
  StoreAPI,
  StoreEvents,
  HookFallbackFile,
  SessionStorageMetrics,
  CleanupOptions,
  CleanupResult,
} from '../../shared/main-process-api-interfaces/StoreAPI';
import {
  StorageNamespaceConfig,
  StorageStats,
} from '../../shared/main-process-api-interfaces/StoreAPI';
import { StorageNamespaces } from '../../shared/types/namespaces.types';

export const storeAPI: StoreAPI = {
  get: <T = any>(
    key: string,
    namespace?: StorageNamespaces,
    defaultValue?: T,
  ): Promise<T> => {
    return ipcRenderer.invoke(StoreEvents.GET, key, namespace, defaultValue);
  },

  set: <T = any>(
    key: string,
    value: T,
    namespace?: StorageNamespaces,
  ): Promise<void> => {
    return ipcRenderer.invoke(StoreEvents.SET, key, value, namespace);
  },

  delete: (key: string, namespace?: StorageNamespaces): Promise<void> => {
    return ipcRenderer.invoke(StoreEvents.DELETE, key, namespace);
  },

  has: (key: string, namespace?: StorageNamespaces): Promise<boolean> => {
    return ipcRenderer.invoke(StoreEvents.HAS, key, namespace);
  },

  clear: (namespace?: StorageNamespaces): Promise<void> => {
    return ipcRenderer.invoke(StoreEvents.CLEAR, namespace);
  },

  keys: (namespace?: StorageNamespaces): Promise<string[]> => {
    return ipcRenderer.invoke(StoreEvents.KEYS, namespace);
  },

  listNamespaces: (): Promise<StorageNamespaceConfig[]> => {
    return ipcRenderer.invoke(StoreEvents.LIST_NAMESPACES);
  },

  getFilePath: (namespace?: StorageNamespaces): Promise<string> => {
    return ipcRenderer.invoke(StoreEvents.GET_FILE_PATH, namespace);
  },

  getNamespaceFilePath: (namespace: StorageNamespaces): Promise<string> => {
    return ipcRenderer.invoke(StoreEvents.GET_NAMESPACE_FILE_PATH, namespace);
  },

  getStats: (namespace?: StorageNamespaces): Promise<StorageStats> => {
    return ipcRenderer.invoke(StoreEvents.GET_STATS, namespace);
  },

  getNamespaceStats: (namespace: StorageNamespaces): Promise<StorageStats> => {
    return ipcRenderer.invoke(StoreEvents.GET_NAMESPACE_STATS, namespace);
  },

  scanHookFallbackFiles: (): Promise<HookFallbackFile[]> => {
    return ipcRenderer.invoke(StoreEvents.SCAN_HOOK_FALLBACK_FILES);
  },

  getSessionStorageMetrics: (): Promise<SessionStorageMetrics> => {
    return ipcRenderer.invoke(StoreEvents.GET_SESSION_STORAGE_METRICS);
  },

  cleanupSessionStorage: (options: CleanupOptions): Promise<CleanupResult> => {
    return ipcRenderer.invoke(StoreEvents.CLEANUP_SESSION_STORAGE, options);
  },

  // Watch functionality removed for performance reasons
  // Future implementation should be more targeted if needed
  watch: (
    _key: string,
    _namespace?: StorageNamespaces,
  ): Promise<() => void> => {
    console.warn(
      'Watch functionality has been removed for performance reasons',
    );
    return Promise.resolve(() => {});
  },

  // Storage change events removed for performance reasons
  // Broadcasting all changes to all windows was too expensive
  onStorageChanged: (
    _callback: (event: {
      namespace: StorageNamespaces;
      key: string;
      value: any;
      oldValue: any;
    }) => void,
  ): (() => void) => {
    console.warn('onStorageChanged has been removed for performance reasons');
    return () => {};
  },
};
