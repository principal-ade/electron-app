import Store from 'electron-store';
import { StorageProviderType, } from '../types';
/**
 * Electron Store Backend Implementation
 *
 * This backend uses electron-store for local file-based storage.
 * It provides persistent storage that survives app restarts.
 */
export class ElectronStoreLocalStorageProvider {
    name;
    store = null;
    watchers = new Map();
    constructor(name = StorageProviderType.ELECTRON_STORE) {
        this.name = name;
    }
    get isAvailable() {
        return this.store !== null;
    }
    /**
     * Initialize the electron-store backend
     */
    async initialize(config) {
        try {
            const storeOptions = {
                name: config?.path || this.name,
                defaults: config?.defaults || {},
                ...config?.options
            };
            // Handle encryption if specified
            if (config?.encryption?.enabled && config.encryption.key) {
                storeOptions.encryptionKey = config.encryption.key;
            }
            this.store = new Store(storeOptions);
            // Set up global change listener for watchers
            this.setupGlobalWatcher();
        }
        catch (error) {
            throw new Error(`Failed to initialize ElectronStoreBackend: ${error}`);
        }
    }
    /**
     * Get a value by key
     */
    async get(key, defaultValue) {
        if (!this.store) {
            throw new Error('ElectronStoreBackend not initialized');
        }
        try {
            return this.store.get(key, defaultValue);
        }
        catch (error) {
            throw new Error(`Failed to get key '${key}': ${error}`);
        }
    }
    /**
     * Set a value by key
     */
    async set(key, value) {
        if (!this.store) {
            throw new Error('ElectronStoreBackend not initialized');
        }
        try {
            this.store.set(key, value);
        }
        catch (error) {
            throw new Error(`Failed to set key '${key}': ${error}`);
        }
    }
    /**
     * Delete a key
     */
    async delete(key) {
        if (!this.store) {
            throw new Error('ElectronStoreBackend not initialized');
        }
        try {
            this.store.delete(key);
        }
        catch (error) {
            throw new Error(`Failed to delete key '${key}': ${error}`);
        }
    }
    /**
     * Check if a key exists
     */
    async has(key) {
        if (!this.store) {
            throw new Error('ElectronStoreBackend not initialized');
        }
        try {
            return this.store.has(key);
        }
        catch (error) {
            throw new Error(`Failed to check key '${key}': ${error}`);
        }
    }
    /**
     * Clear all data
     */
    async clear() {
        if (!this.store) {
            throw new Error('ElectronStoreBackend not initialized');
        }
        try {
            this.store.clear();
        }
        catch (error) {
            throw new Error(`Failed to clear store: ${error}`);
        }
    }
    /**
     * Get all keys
     */
    async keys() {
        if (!this.store) {
            throw new Error('ElectronStoreBackend not initialized');
        }
        try {
            // electron-store doesn't have a direct keys() method, 
            // so we use the store property to get all keys
            return Object.keys(this.store.store);
        }
        catch (error) {
            throw new Error(`Failed to get keys: ${error}`);
        }
    }
    /**
     * Get storage statistics
     */
    async getStats() {
        if (!this.store) {
            throw new Error('ElectronStoreBackend not initialized');
        }
        try {
            const data = this.store.store || {};
            const keys = Object.keys(data);
            // Calculate approximate size
            const jsonString = JSON.stringify(data);
            const sizeInBytes = new TextEncoder().encode(jsonString).length;
            return {
                totalKeys: keys.length,
                sizeBytes: sizeInBytes,
                metadata: {
                    filePath: this.store.path,
                    name: this.name
                }
            };
        }
        catch (error) {
            throw new Error(`Failed to get stats: ${error}`);
        }
    }
    /**
     * Close the storage backend
     */
    async close() {
        try {
            // Clear all watchers
            this.watchers.clear();
            // electron-store doesn't need explicit closing,
            // but we set store to null to indicate it's closed
            this.store = null;
        }
        catch (error) {
            throw new Error(`Failed to close ElectronStoreBackend: ${error}`);
        }
    }
    /**
     * Watch for changes to a specific key
     */
    watch(key, callback) {
        if (!this.store) {
            throw new Error('ElectronStoreBackend not initialized');
        }
        try {
            // Set up the watcher using electron-store's onDidChange method
            const unsubscribe = this.store.onDidChange(key, callback);
            // Track the unsubscribe function
            if (!this.watchers.has(key)) {
                this.watchers.set(key, []);
            }
            this.watchers.get(key).push(unsubscribe);
            // Return a function that removes this specific watcher
            return () => {
                unsubscribe();
                const keyWatchers = this.watchers.get(key);
                if (keyWatchers) {
                    const index = keyWatchers.indexOf(unsubscribe);
                    if (index > -1) {
                        keyWatchers.splice(index, 1);
                    }
                    if (keyWatchers.length === 0) {
                        this.watchers.delete(key);
                    }
                }
            };
        }
        catch (error) {
            throw new Error(`Failed to set up watcher for key '${key}': ${error}`);
        }
    }
    /**
     * Get the file path of the store
     */
    getFilePath() {
        if (!this.store) {
            throw new Error('ElectronStoreBackend not initialized');
        }
        return this.store.path;
    }
    /**
     * Get the raw store instance (for compatibility with existing code)
     */
    getStore() {
        if (!this.store) {
            throw new Error('ElectronStoreBackend not initialized');
        }
        return this.store;
    }
    /**
     * Set up global watcher for all changes (internal use)
     */
    setupGlobalWatcher() {
        if (!this.store)
            return;
        // This is already handled by individual key watchers
        // We could add global change detection here if needed
    }
    /**
     * Create a new ElectronStoreBackend with specific configuration
     */
    static async create(name, config) {
        const storageProvider = new ElectronStoreLocalStorageProvider(name);
        await storageProvider.initialize(config);
        return storageProvider;
    }
    /**
     * Migrate data from another backend (utility method)
     */
    async importData(data) {
        if (!this.store) {
            throw new Error('ElectronStoreBackend not initialized');
        }
        try {
            // Import data by setting each key-value pair
            for (const [key, value] of Object.entries(data)) {
                await this.set(key, value);
            }
        }
        catch (error) {
            throw new Error(`Failed to import data: ${error}`);
        }
    }
    /**
     * Export all data (utility method)
     */
    async exportData() {
        if (!this.store) {
            throw new Error('ElectronStoreBackend not initialized');
        }
        try {
            return { ...this.store.store };
        }
        catch (error) {
            throw new Error(`Failed to export data: ${error}`);
        }
    }
}
