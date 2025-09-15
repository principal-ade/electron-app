import { HookFallbackFile, SessionStorageMetrics, CleanupOptions, CleanupResult, StorageStats, StorageNamespaceConfig } from '../../shared/main-process-api-interfaces/StoreAPI';
import { StorageNamespaces } from '../../shared/types/namespaces.types';
export declare class StoreService {
    static get<T = any>(key: string, namespace?: StorageNamespaces, defaultValue?: T): Promise<T>;
    static set<T = any>(key: string, value: T, namespace?: StorageNamespaces): Promise<void>;
    static delete(key: string, namespace?: StorageNamespaces): Promise<void>;
    static has(key: string, namespace?: StorageNamespaces): Promise<boolean>;
    static clear(namespace?: StorageNamespaces): Promise<void>;
    static keys(namespace?: StorageNamespaces): Promise<string[]>;
    static listNamespaces(): Promise<StorageNamespaceConfig[]>;
    static getFilePath(namespace?: StorageNamespaces): Promise<string>;
    static getNamespaceFilePath(namespace: StorageNamespaces): Promise<string>;
    static getStats(namespace?: StorageNamespaces): Promise<StorageStats>;
    static getNamespaceStats(namespace: StorageNamespaces): Promise<StorageStats>;
    static scanHookFallbackFiles(): Promise<HookFallbackFile[]>;
    static getSessionStorageMetrics(): Promise<SessionStorageMetrics>;
    static cleanupSessionStorage(options: CleanupOptions): Promise<CleanupResult>;
    static watch(key: string, namespace?: StorageNamespaces): Promise<() => void>;
    static onStorageChanged(callback: (event: {
        namespace: string;
        key: string;
        value: any;
        oldValue: any;
    }) => void): () => void;
}
//# sourceMappingURL=StoreService.d.ts.map