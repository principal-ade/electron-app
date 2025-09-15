import { ipcRenderer } from 'electron';
import { StoreEvents, } from '../../shared/main-process-api-interfaces/StoreAPI';
export const storeAPI = {
    get: (key, namespace, defaultValue) => {
        return ipcRenderer.invoke(StoreEvents.GET, key, namespace, defaultValue);
    },
    set: (key, value, namespace) => {
        return ipcRenderer.invoke(StoreEvents.SET, key, value, namespace);
    },
    delete: (key, namespace) => {
        return ipcRenderer.invoke(StoreEvents.DELETE, key, namespace);
    },
    has: (key, namespace) => {
        return ipcRenderer.invoke(StoreEvents.HAS, key, namespace);
    },
    clear: (namespace) => {
        return ipcRenderer.invoke(StoreEvents.CLEAR, namespace);
    },
    keys: (namespace) => {
        return ipcRenderer.invoke(StoreEvents.KEYS, namespace);
    },
    listNamespaces: () => {
        return ipcRenderer.invoke(StoreEvents.LIST_NAMESPACES);
    },
    getFilePath: (namespace) => {
        return ipcRenderer.invoke(StoreEvents.GET_FILE_PATH, namespace);
    },
    getNamespaceFilePath: (namespace) => {
        return ipcRenderer.invoke(StoreEvents.GET_NAMESPACE_FILE_PATH, namespace);
    },
    getStats: (namespace) => {
        return ipcRenderer.invoke(StoreEvents.GET_STATS, namespace);
    },
    getNamespaceStats: (namespace) => {
        return ipcRenderer.invoke(StoreEvents.GET_NAMESPACE_STATS, namespace);
    },
    scanHookFallbackFiles: () => {
        return ipcRenderer.invoke(StoreEvents.SCAN_HOOK_FALLBACK_FILES);
    },
    getSessionStorageMetrics: () => {
        return ipcRenderer.invoke(StoreEvents.GET_SESSION_STORAGE_METRICS);
    },
    cleanupSessionStorage: (options) => {
        return ipcRenderer.invoke(StoreEvents.CLEANUP_SESSION_STORAGE, options);
    },
    // Watch functionality removed for performance reasons
    // Future implementation should be more targeted if needed
    watch: (key, namespace) => {
        console.warn('Watch functionality has been removed for performance reasons');
        return Promise.resolve(() => { });
    },
    // Storage change events removed for performance reasons  
    // Broadcasting all changes to all windows was too expensive
    onStorageChanged: (callback) => {
        console.warn('onStorageChanged has been removed for performance reasons');
        return () => { };
    },
};
