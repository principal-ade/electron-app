import {
  HookFallbackFile,
  SessionStorageMetrics,
  CleanupOptions,
  CleanupResult,
  StorageStats,
  StorageNamespaceConfig,
} from '../../shared/main-process-api-interfaces/StoreAPI';
import { StorageNamespaces } from '../../shared/types/namespaces.types';

export class StoreService {
  static get<T = any>(
    key: string,
    namespace?: StorageNamespaces,
    defaultValue?: T,
  ): Promise<T> {
    return window.mainProcess.store.get(key, namespace, defaultValue);
  }

  static set<T = any>(
    key: string,
    value: T,
    namespace?: StorageNamespaces,
  ): Promise<void> {
    return window.mainProcess.store.set(key, value, namespace);
  }

  static delete(key: string, namespace?: StorageNamespaces): Promise<void> {
    return window.mainProcess.store.delete(key, namespace);
  }

  static has(key: string, namespace?: StorageNamespaces): Promise<boolean> {
    return window.mainProcess.store.has(key, namespace);
  }

  static clear(namespace?: StorageNamespaces): Promise<void> {
    return window.mainProcess.store.clear(namespace);
  }

  static keys(namespace?: StorageNamespaces): Promise<string[]> {
    return window.mainProcess.store.keys(namespace);
  }

  static listNamespaces(): Promise<StorageNamespaceConfig[]> {
    return window.mainProcess.store.listNamespaces();
  }

  static getFilePath(namespace?: StorageNamespaces): Promise<string> {
    return window.mainProcess.store.getFilePath(namespace);
  }

  static getNamespaceFilePath(namespace: StorageNamespaces): Promise<string> {
    return window.mainProcess.store.getNamespaceFilePath(namespace);
  }

  static getStats(namespace?: StorageNamespaces): Promise<StorageStats> {
    return window.mainProcess.store.getStats(namespace);
  }

  static getNamespaceStats(
    namespace: StorageNamespaces,
  ): Promise<StorageStats> {
    return window.mainProcess.store.getNamespaceStats(namespace);
  }

  static scanHookFallbackFiles(): Promise<HookFallbackFile[]> {
    return window.mainProcess.store.scanHookFallbackFiles();
  }

  static getSessionStorageMetrics(): Promise<SessionStorageMetrics> {
    return window.mainProcess.store.getSessionStorageMetrics();
  }

  static cleanupSessionStorage(
    options: CleanupOptions,
  ): Promise<CleanupResult> {
    return window.mainProcess.store.cleanupSessionStorage(options);
  }

  static watch(
    key: string,
    namespace?: StorageNamespaces,
  ): Promise<() => void> {
    return window.mainProcess.store.watch(key, namespace);
  }

  static onStorageChanged(
    callback: (event: {
      namespace: string;
      key: string;
      value: any;
      oldValue: any;
    }) => void,
  ): () => void {
    return window.mainProcess.store.onStorageChanged(callback);
  }
}
