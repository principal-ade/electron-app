export class StoreService {
    static get(key, namespace, defaultValue) {
        return window.mainProcess.store.get(key, namespace, defaultValue);
    }
    static set(key, value, namespace) {
        return window.mainProcess.store.set(key, value, namespace);
    }
    static delete(key, namespace) {
        return window.mainProcess.store.delete(key, namespace);
    }
    static has(key, namespace) {
        return window.mainProcess.store.has(key, namespace);
    }
    static clear(namespace) {
        return window.mainProcess.store.clear(namespace);
    }
    static keys(namespace) {
        return window.mainProcess.store.keys(namespace);
    }
    static listNamespaces() {
        return window.mainProcess.store.listNamespaces();
    }
    static getFilePath(namespace) {
        return window.mainProcess.store.getFilePath(namespace);
    }
    static getNamespaceFilePath(namespace) {
        return window.mainProcess.store.getNamespaceFilePath(namespace);
    }
    static getStats(namespace) {
        return window.mainProcess.store.getStats(namespace);
    }
    static getNamespaceStats(namespace) {
        return window.mainProcess.store.getNamespaceStats(namespace);
    }
    static scanHookFallbackFiles() {
        return window.mainProcess.store.scanHookFallbackFiles();
    }
    static getSessionStorageMetrics() {
        return window.mainProcess.store.getSessionStorageMetrics();
    }
    static cleanupSessionStorage(options) {
        return window.mainProcess.store.cleanupSessionStorage(options);
    }
    static watch(key, namespace) {
        return window.mainProcess.store.watch(key, namespace);
    }
    static onStorageChanged(callback) {
        return window.mainProcess.store.onStorageChanged(callback);
    }
}
