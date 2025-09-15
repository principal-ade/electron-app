import { EventEmitter } from 'events';
import { StaticNamespaces, StorageProviderType, } from './types';
import { NamespaceCategory } from '../../shared/main-process-api-interfaces/StoreAPI';
import { ElectronStoreLocalStorageProvider } from './providers/ElectronStoreLocalStorageProvider';
import { S3RemoteStorageProvider } from './providers/S3RemoteStorageProvider';
// Define SupportedLLMProvider enum locally since ai.types was removed
var SupportedLLMProvider;
(function (SupportedLLMProvider) {
    SupportedLLMProvider["OPENROUTER"] = "openrouter";
    SupportedLLMProvider["OLLAMA"] = "ollama";
    SupportedLLMProvider["OPENAI"] = "openai";
})(SupportedLLMProvider || (SupportedLLMProvider = {}));
import { AGENT_INFO, SupportedAgent } from "@principal-ai/agent-monitoring";
/**
 * Multi-Store Manager
 *
 * Manages multiple storage providers and provides a unified API for accessing
 * different storage namespaces. Supports routing operations to different backends
 * based on namespace configuration.
 */
export class MultiStoreManager extends EventEmitter {
    storageProviders = new Map();
    namespaceProviders = new Map(); // Namespace-specific providers
    namespaces = new Map();
    isInitialized = false;
    constructor() {
        super();
    }
    /**
     * Initialize the multi-store manager with configuration
     *
     * @param config Optional configuration containing:
     *   - storageProviders: Custom storage provider implementations (defaults to electron-store and S3)
     *   - namespaces: DYNAMIC namespaces to add (agent-specific, runtime-discovered, etc.)
     *                 Static namespaces from StaticNamespaces enum are always included
     */
    async initialize(config) {
        try {
            // Step 1: Register storage backends (electron-store, S3, etc.)
            if (!config?.storageProviders || config.storageProviders.size === 0) {
                await this.registerDefaultBackends();
            }
            else {
                // Use provided backends
                this.storageProviders = new Map(config.storageProviders);
            }
            // Step 2: Set up all static namespaces from StorageNamespaces enum
            this.setupDefaultNamespaces();
            // Step 3: Validate that ALL static namespaces are registered
            const missingStaticNamespaces = [];
            for (const staticNamespace of Object.values(StaticNamespaces)) {
                if (!this.namespaces.has(staticNamespace)) {
                    missingStaticNamespaces.push(staticNamespace);
                }
            }
            if (missingStaticNamespaces.length > 0) {
                throw new Error(`Missing required static namespaces in setupDefaultNamespaces(): ${missingStaticNamespaces.join(', ')}. ` +
                    `All namespaces from StorageNamespaces enum must be initialized.`);
            }
            // Step 4: Add dynamic namespaces (agent-specific, runtime configs, etc.)
            if (config?.namespaces && config.namespaces.length > 0) {
                for (const namespace of config.namespaces) {
                    if (!namespace.name) {
                        console.error('MultiStoreManager: Dynamic namespace missing name:', namespace);
                        continue;
                    }
                    // Add dynamic namespace (will override if a static one exists with same name)
                    this.namespaces.set(namespace.name, namespace);
                }
            }
            // Step 5: Initialize all storage backends
            await this.initializeBackends();
            this.isInitialized = true;
            this.emit('initialized');
        }
        catch (error) {
            throw new Error(`Failed to initialize MultiStoreManager: ${error}`);
        }
    }
    /**
     * Register a storage backend
     */
    async registerStorageProvider(name, storageProvider) {
        if (this.storageProviders.has(name)) {
            throw new Error(`Storage provider '${name}' is already registered`);
        }
        this.storageProviders.set(name, storageProvider);
        // Initialize the backend if the manager is already initialized
        if (this.isInitialized && !storageProvider.isAvailable) {
            await storageProvider.initialize();
        }
    }
    /**
     * Register a storage namespace
     */
    registerNamespace(namespace) {
        if (!this.storageProviders.has(namespace.storageProvider)) {
            throw new Error(`Storage provider '${namespace.storageProvider}' not found for namespace '${namespace.name}'`);
        }
        this.namespaces.set(namespace.name, namespace);
    }
    /**
     * Register multiple storage namespaces at once
     */
    registerNamespaces(namespaces) {
        for (const namespace of namespaces) {
            this.registerNamespace(namespace);
        }
    }
    /**
     * Get a value from a specific namespace
     */
    async get(key, namespace, defaultValue) {
        try {
            const storageProvider = this.getStorageProviderForNamespace(namespace);
            console.log(`MultiStoreManager.get: Getting key '${key}' from namespace '${namespace}'`);
            const data = await storageProvider.get(key, defaultValue);
            return {
                success: true,
                data,
                storageProvider: storageProvider.name,
                namespace: namespace
            };
        }
        catch (error) {
            this.emitEvent('error', namespace, undefined, key, undefined, undefined, error);
            return {
                success: false,
                error: error,
                storageProvider: this.getNamespaceConfig(namespace)?.storageProvider,
                namespace: namespace
            };
        }
    }
    /**
     * Set a value in a specific namespace
     */
    async set(key, value, namespace) {
        try {
            const storageProvider = this.getStorageProviderForNamespace(namespace);
            const oldValue = await storageProvider.get(key);
            await storageProvider.set(key, value);
            this.emitEvent('set', namespace, storageProvider.name, key, value, oldValue);
            return {
                success: true,
                storageProvider: storageProvider.name,
                namespace: namespace
            };
        }
        catch (error) {
            this.emitEvent('error', namespace, undefined, key, value, undefined, error);
            return {
                success: false,
                error: error,
                storageProvider: this.getNamespaceConfig(namespace)?.storageProvider,
                namespace: namespace
            };
        }
    }
    /**
     * Delete a key from a specific namespace
     */
    async delete(key, namespace) {
        try {
            const storageProvider = this.getStorageProviderForNamespace(namespace);
            const oldValue = await storageProvider.get(key);
            await storageProvider.delete(key);
            this.emitEvent('delete', namespace, storageProvider.name, key, undefined, oldValue);
            return {
                success: true,
                storageProvider: storageProvider.name,
                namespace: namespace
            };
        }
        catch (error) {
            this.emitEvent('error', namespace, undefined, key, undefined, undefined, error);
            return {
                success: false,
                error: error,
                storageProvider: this.getNamespaceConfig(namespace)?.storageProvider,
                namespace: namespace
            };
        }
    }
    /**
     * Check if a key exists in a specific namespace
     */
    async has(key, namespace) {
        try {
            const storageProvider = this.getStorageProviderForNamespace(namespace);
            const exists = await storageProvider.has(key);
            return {
                success: true,
                data: exists,
                storageProvider: storageProvider.name,
                namespace: namespace
            };
        }
        catch (error) {
            return {
                success: false,
                data: false,
                error: error,
                storageProvider: this.getNamespaceConfig(namespace)?.storageProvider,
                namespace: namespace
            };
        }
    }
    /**
     * Clear all data in a specific namespace
     */
    async clear(namespace) {
        try {
            const storageProvider = this.getStorageProviderForNamespace(namespace);
            await storageProvider.clear();
            this.emitEvent('clear', namespace, storageProvider.name);
            return {
                success: true,
                storageProvider: storageProvider.name,
                namespace: namespace
            };
        }
        catch (error) {
            this.emitEvent('error', namespace, undefined, undefined, undefined, undefined, error);
            return {
                success: false,
                error: error,
                storageProvider: this.getNamespaceConfig(namespace)?.storageProvider,
                namespace: namespace
            };
        }
    }
    /**
     * Get multiple values from a specific namespace in a single batch operation
     */
    async getMultiple(keys, namespace) {
        try {
            const storageProvider = this.getStorageProviderForNamespace(namespace);
            console.log(`MultiStoreManager.getMultiple: Getting ${keys.length} keys from namespace '${namespace}'`);
            const results = new Map();
            // Batch fetch all values - most providers can optimize this internally
            // Split into chunks to avoid overwhelming the system
            const CHUNK_SIZE = 100;
            for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
                const chunk = keys.slice(i, Math.min(i + CHUNK_SIZE, keys.length));
                const promises = chunk.map(async (key) => {
                    try {
                        const value = await storageProvider.get(key);
                        if (value !== undefined) {
                            results.set(key, value);
                        }
                    }
                    catch (error) {
                        // Log but don't fail the entire batch
                        console.warn(`Failed to get key '${key}':`, error);
                    }
                });
                await Promise.all(promises);
                // Log progress for large batches
                if (keys.length > CHUNK_SIZE * 2) {
                    console.log(`MultiStoreManager.getMultiple: Processed ${Math.min(i + CHUNK_SIZE, keys.length)}/${keys.length} keys`);
                }
            }
            console.log(`MultiStoreManager.getMultiple: Retrieved ${results.size} of ${keys.length} keys`);
            return {
                success: true,
                data: results,
                storageProvider: storageProvider.name,
                namespace: namespace
            };
        }
        catch (error) {
            return {
                success: false,
                data: new Map(),
                error: error,
                storageProvider: this.getNamespaceConfig(namespace)?.storageProvider,
                namespace: namespace
            };
        }
    }
    /**
     * Delete multiple keys from a specific namespace in a single batch operation
     */
    async deleteMultiple(keys, namespace) {
        try {
            const storageProvider = this.getStorageProviderForNamespace(namespace);
            console.log(`MultiStoreManager.deleteMultiple: Deleting ${keys.length} keys from namespace '${namespace}'`);
            const deleted = [];
            const failed = [];
            // Batch delete all keys - most providers can optimize this internally
            const promises = keys.map(async (key) => {
                try {
                    await storageProvider.delete(key);
                    deleted.push(key);
                }
                catch (error) {
                    console.warn(`Failed to delete key '${key}':`, error);
                    failed.push(key);
                }
            });
            await Promise.all(promises);
            console.log(`MultiStoreManager.deleteMultiple: Deleted ${deleted.length} keys, ${failed.length} failed`);
            return {
                success: true,
                data: { deleted, failed },
                storageProvider: storageProvider.name,
                namespace: namespace
            };
        }
        catch (error) {
            return {
                success: false,
                data: { deleted: [], failed: keys },
                error: error,
                storageProvider: this.getNamespaceConfig(namespace)?.storageProvider,
                namespace: namespace
            };
        }
    }
    /**
     * Get all keys from a specific namespace
     */
    async keys(namespace) {
        try {
            const storageProvider = this.getStorageProviderForNamespace(namespace);
            console.log(`MultiStoreManager.keys: Getting keys for namespace '${namespace}'`);
            const keys = await storageProvider.keys();
            // Only log actual keys for small sets to avoid console spam
            if (keys.length > 10) {
                console.log(`MultiStoreManager.keys: Retrieved ${keys.length} keys for '${namespace}'`);
            }
            else {
                console.log(`MultiStoreManager.keys: Keys retrieved successfully for '${namespace}':`, keys);
            }
            return {
                success: true,
                data: keys,
                storageProvider: storageProvider.name,
                namespace: namespace
            };
        }
        catch (error) {
            return {
                success: false,
                data: [],
                error: error,
                storageProvider: this.getNamespaceConfig(namespace)?.storageProvider,
                namespace: namespace
            };
        }
    }
    /**
     * Get statistics for a specific namespace
     */
    async getStats(namespace) {
        try {
            console.log(`MultiStoreManager.getStats: Getting stats for namespace '${namespace}'`);
            const storageProvider = this.getStorageProviderForNamespace(namespace);
            console.log(`MultiStoreManager.getStats: Got provider '${storageProvider.name}', isAvailable: ${storageProvider.isAvailable}`);
            const stats = await storageProvider.getStats();
            console.log(`MultiStoreManager.getStats: Stats retrieved successfully for '${namespace}'`);
            return {
                success: true,
                data: stats,
                storageProvider: storageProvider.name,
                namespace: namespace
            };
        }
        catch (error) {
            console.error(`MultiStoreManager.getStats: Error getting stats for namespace '${namespace}':`, error);
            return {
                success: false,
                error: error,
                storageProvider: this.getNamespaceConfig(namespace)?.storageProvider,
                namespace: namespace
            };
        }
    }
    /**
     * Watch for changes in a specific namespace
     */
    watch(key, callback, namespace) {
        const storageProvider = this.getStorageProviderForNamespace(namespace);
        if (!storageProvider.watch) {
            console.warn(`Storage provider '${storageProvider.name}' does not support watching`);
            return () => { }; // Return no-op unsubscribe
        }
        return storageProvider.watch(key, (newValue, oldValue) => {
            const event = {
                type: 'set',
                namespace: namespace,
                storageProvider: storageProvider.name,
                key,
                value: newValue,
                oldValue,
                timestamp: Date.now()
            };
            callback(event);
        });
    }
    /**
     * Migrate data between namespaces
     */
    async migrate(options) {
        const result = {
            success: true,
            migratedKeys: [],
            failedKeys: [],
            totalProcessed: 0,
            errors: []
        };
        try {
            const sourceStorageProvider = this.getStorageProviderForNamespace(options.fromNamespace);
            const targetStorageProvider = this.getStorageProviderForNamespace(options.toNamespace);
            // Get keys to migrate
            const keysToMigrate = options.keys || await sourceStorageProvider.keys();
            const batchSize = options.batchSize || 10;
            // Process in batches
            for (let i = 0; i < keysToMigrate.length; i += batchSize) {
                const batch = keysToMigrate.slice(i, i + batchSize);
                for (const key of batch) {
                    try {
                        const value = await sourceStorageProvider.get(key);
                        if (value !== undefined) {
                            await targetStorageProvider.set(key, value);
                            if (options.deleteSource) {
                                await sourceStorageProvider.delete(key);
                            }
                            result.migratedKeys.push(key);
                        }
                        result.totalProcessed++;
                    }
                    catch (error) {
                        result.failedKeys.push(key);
                        result.errors.push(error);
                        result.success = false;
                    }
                }
            }
        }
        catch (error) {
            result.success = false;
            result.errors.push(error);
        }
        return result;
    }
    /**
     * Get all registered backends
     */
    getStorageProviders() {
        return new Map(this.storageProviders);
    }
    /**
     * Get a specific backend by name
     */
    getStorageProvider(name) {
        return this.storageProviders.get(name);
    }
    /**
     * Get the storage provider for a specific namespace
     * This properly handles both dedicated and shared providers
     */
    getProviderForNamespace(namespace) {
        return this.getStorageProviderForNamespace(namespace);
    }
    /**
     * Get all registered namespaces
     */
    getNamespaces() {
        return new Map(this.namespaces);
    }
    /**
     * Close all backends and clean up
     */
    async close() {
        try {
            // Close all shared providers
            const sharedClosePromises = Array.from(this.storageProviders.values()).map(storageProvider => storageProvider.close());
            // Close all namespace-specific providers
            const namespaceClosePromises = Array.from(this.namespaceProviders.values()).map(storageProvider => storageProvider.close());
            await Promise.all([...sharedClosePromises, ...namespaceClosePromises]);
            this.storageProviders.clear();
            this.namespaceProviders.clear();
            this.namespaces.clear();
            this.isInitialized = false;
            this.emit('closed');
        }
        catch (error) {
            throw new Error(`Failed to close MultiStoreManager: ${error}`);
        }
    }
    /**
     * Get the backend for a specific namespace
     */
    getStorageProviderForNamespace(namespace) {
        const namespaceConfig = this.namespaces.get(namespace);
        if (!namespaceConfig) {
            throw new Error(`Namespace '${namespace}' not found`);
        }
        // Check if this namespace has a dedicated provider
        const dedicatedProvider = this.namespaceProviders.get(namespace);
        if (dedicatedProvider) {
            // For dedicated providers that aren't initialized yet, initialize them on-demand
            if (!dedicatedProvider.isAvailable) {
                console.warn(`Dedicated storage provider for namespace '${namespace}' not yet initialized, initializing now...`);
                // Try to initialize it synchronously if possible, otherwise throw error
                // Since initialize is async, we can't do it here synchronously
                // Instead, we should ensure all providers are initialized during startup
                throw new Error(`Dedicated storage provider for namespace '${namespace}' is not available. This usually means initialization failed or is still in progress.`);
            }
            return dedicatedProvider;
        }
        // Otherwise use the shared provider
        const storageProvider = this.storageProviders.get(namespaceConfig.storageProvider);
        if (!storageProvider) {
            throw new Error(`Storage provider '${namespaceConfig.storageProvider}' not found`);
        }
        if (!storageProvider.isAvailable) {
            throw new Error(`Storage provider '${namespaceConfig.storageProvider}' is not available`);
        }
        return storageProvider;
    }
    /**
     * Get namespace configuration
     */
    getNamespaceConfig(namespace) {
        return this.namespaces.get(namespace);
    }
    /**
     * Register default backends
     */
    async registerDefaultBackends() {
        // Register electron-store backend
        const electronStoreLocalStorageProvider = new ElectronStoreLocalStorageProvider('default-electron-store');
        this.storageProviders.set(StorageProviderType.ELECTRON_STORE, electronStoreLocalStorageProvider);
        // Register S3 backend (stub)
        const s3StorageProvider = new S3RemoteStorageProvider('default-s3');
        this.storageProviders.set(StorageProviderType.S3, s3StorageProvider);
    }
    /**
     * Set up default namespaces
     * This sets up ALL static namespaces defined in the StorageNamespaces enum
     * Dynamic namespaces (like agent-specific ones) are added separately via config
     */
    setupDefaultNamespaces() {
        const defaultNamespaces = [
            {
                name: StaticNamespaces.USER_PREFERENCES,
                storageProvider: StorageProviderType.ELECTRON_STORE,
                category: NamespaceCategory.CORE,
                isPrimary: true,
                config: {
                    path: 'user-preferences',
                    defaults: {
                        autoCommitOnStop: false
                    }
                }
            },
            {
                name: StaticNamespaces.REPOSITORIES,
                storageProvider: StorageProviderType.ELECTRON_STORE,
                category: NamespaceCategory.CORE,
                config: {
                    path: 'repositories',
                    defaults: {
                        repositories: []
                    }
                }
            },
            {
                name: StaticNamespaces.AI_CONFIGURATION,
                storageProvider: StorageProviderType.ELECTRON_STORE,
                category: NamespaceCategory.CORE,
                config: {
                    path: 'ai-configuration',
                    defaults: {
                        aiConfiguration: {
                            defaultProvider: SupportedLLMProvider.OPENROUTER,
                            providers: {
                                ollama: {
                                    type: SupportedLLMProvider.OLLAMA,
                                    enabled: false,
                                    baseUrl: 'http://localhost:11434',
                                    model: 'llama2', // TODO: Models should be dynamically loaded
                                },
                            },
                            conversations: [],
                            activeConversationId: null,
                        }
                    }
                }
            },
            {
                name: StaticNamespaces.LLM_MODELS,
                storageProvider: StorageProviderType.ELECTRON_STORE,
                category: NamespaceCategory.CORE,
                config: {
                    path: 'llm-models',
                    defaults: {}
                }
            },
            {
                name: StaticNamespaces.CACHE,
                storageProvider: StorageProviderType.ELECTRON_STORE,
                category: NamespaceCategory.CACHE,
                config: {
                    path: 'cache'
                }
            },
            {
                name: StaticNamespaces.TEMP,
                storageProvider: StorageProviderType.ELECTRON_STORE,
                category: NamespaceCategory.CACHE,
                config: {
                    path: 'temp'
                }
            },
            {
                name: StaticNamespaces.AGENT_SESSIONS,
                storageProvider: StorageProviderType.ELECTRON_STORE,
                category: NamespaceCategory.AGENT_SESSION_EVENTS,
                isPrimary: true,
                config: {
                    path: 'agent-sessions',
                    defaults: {}
                }
            },
            {
                name: StaticNamespaces.SESSION_SUMMARIES,
                storageProvider: StorageProviderType.ELECTRON_STORE,
                category: NamespaceCategory.CORE,
                config: {
                    path: 'session-summaries',
                    defaults: {}
                }
            },
            {
                name: StaticNamespaces.ARCHIVE_CONFIGURATION,
                storageProvider: StorageProviderType.ELECTRON_STORE,
                category: NamespaceCategory.CORE,
                config: {
                    path: 'archive-configuration',
                    defaults: {}
                }
            },
            {
                name: StaticNamespaces.GLOBAL_SESSION_REGISTRY,
                storageProvider: StorageProviderType.ELECTRON_STORE,
                category: NamespaceCategory.CORE,
                isPrimary: true,
                config: {
                    path: 'global-session-registry',
                    defaults: {}
                }
            },
            {
                name: StaticNamespaces.AGENT_EVENT_INDEXES,
                storageProvider: StorageProviderType.ELECTRON_STORE,
                category: NamespaceCategory.CORE,
                config: {
                    path: 'agent-event-indexes',
                    defaults: {
                        [AGENT_INFO[SupportedAgent.CLAUDE].storageEventsNamespace]: [],
                        [AGENT_INFO[SupportedAgent.GEMINI].storageEventsNamespace]: [],
                        [AGENT_INFO[SupportedAgent.OPENCODE].storageEventsNamespace]: []
                    }
                }
            },
            {
                name: StaticNamespaces.MCP_BRIDGE_DATA,
                storageProvider: StorageProviderType.ELECTRON_STORE,
                category: NamespaceCategory.CORE,
                config: {
                    path: 'mcp-bridge-data',
                    defaults: {}
                }
            },
            {
                name: StaticNamespaces.DOCKER_CONTAINERS,
                storageProvider: StorageProviderType.ELECTRON_STORE,
                category: NamespaceCategory.CORE,
                config: {
                    path: 'docker-containers',
                    defaults: {}
                }
            },
            {
                name: StaticNamespaces.DOCKER_SESSIONS,
                storageProvider: StorageProviderType.ELECTRON_STORE,
                category: NamespaceCategory.CORE,
                config: {
                    path: 'docker-sessions',
                    defaults: {}
                }
            },
            {
                name: StaticNamespaces.SECRETS_METADATA,
                storageProvider: StorageProviderType.ELECTRON_STORE,
                category: NamespaceCategory.CORE,
                config: {
                    path: 'secrets-metadata',
                    defaults: {}
                }
            }
        ];
        // Note: Dynamic namespaces (like agent-specific event stores) are added 
        // during initialization via the config parameter
        for (const namespace of defaultNamespaces) {
            this.namespaces.set(namespace.name, namespace);
        }
    }
    /**
     * Initialize all registered backends
     */
    async initializeBackends() {
        const initPromises = [];
        // Each namespace gets its own storage provider instance
        for (const [namespaceName, namespace] of this.namespaces) {
            if (namespace.storageProvider === StorageProviderType.ELECTRON_STORE) {
                console.log(`MultiStoreManager: Creating ElectronStore for namespace '${namespaceName}'`);
                // Create a dedicated ElectronStore instance for this namespace
                const dedicatedProvider = new ElectronStoreLocalStorageProvider(`${namespaceName}-store`);
                this.namespaceProviders.set(namespaceName, dedicatedProvider);
                // Initialize it with the namespace-specific config
                initPromises.push(dedicatedProvider.initialize(namespace.config));
            }
            else {
                // For non-electron-store providers, use shared instances
                const storageProvider = this.storageProviders.get(namespace.storageProvider);
                if (storageProvider && !storageProvider.isAvailable) {
                    initPromises.push(storageProvider.initialize(namespace.config));
                }
            }
        }
        await Promise.all(initPromises);
    }
    /**
     * Emit storage event
     */
    emitEvent(type, namespace, storageProvider, key, value, oldValue, error) {
        const event = {
            type,
            namespace: namespace,
            storageProvider: storageProvider || 'unknown',
            key,
            value,
            oldValue,
            timestamp: Date.now(),
            error
        };
        this.emit('storage-event', event);
        this.emit(type, event);
    }
}
