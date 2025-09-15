import { SupportedAgent } from "@principal-ai/agent-monitoring";
import { NamespaceCategory } from '../../shared/main-process-api-interfaces/StoreAPI';
import { StaticNamespaces } from './types';
// AgentEventNamespaces has been moved to shared/types/namespaces.types.ts
import { AgentEventNamespaces } from '../../shared/types/namespaces.types';
export function getAgentEventNamespace(agent) {
    const namespaceMap = {
        [SupportedAgent.CLAUDE]: AgentEventNamespaces.CLAUDE,
        [SupportedAgent.GEMINI]: AgentEventNamespaces.GEMINI,
        [SupportedAgent.OPENCODE]: AgentEventNamespaces.OPENCODE,
    };
    return namespaceMap[agent];
}
/**
 * Type-safe namespace registry
 * Maps namespaces to their configuration and ensures type safety
 */
export class TypedNamespaceRegistry {
    namespaceConfigs;
    constructor() {
        this.namespaceConfigs = new Map();
        this.initializeDefaultNamespaces();
    }
    initializeDefaultNamespaces() {
        // Core application data
        this.register(StaticNamespaces.USER_PREFERENCES, {
            name: StaticNamespaces.USER_PREFERENCES,
            description: 'User preferences and settings',
            storageProvider: 'electron-store',
            category: NamespaceCategory.CORE,
            isPrimary: true,
        });
        this.register(StaticNamespaces.REPOSITORIES, {
            name: StaticNamespaces.REPOSITORIES,
            description: 'Repository configurations and metadata',
            storageProvider: 'electron-store',
            category: NamespaceCategory.CORE,
        });
        this.register(StaticNamespaces.AI_CONFIGURATION, {
            name: StaticNamespaces.AI_CONFIGURATION,
            description: 'AI provider configurations and settings',
            storageProvider: 'electron-store',
            category: NamespaceCategory.CORE,
        });
        this.register(StaticNamespaces.LLM_MODELS, {
            name: StaticNamespaces.LLM_MODELS,
            description: 'LLM model configurations and custom models',
            storageProvider: 'electron-store',
            category: NamespaceCategory.CORE,
        });
        // Session data
        this.register(StaticNamespaces.AGENT_SESSIONS, {
            name: StaticNamespaces.AGENT_SESSIONS,
            description: 'Agent session data with flat event list',
            storageProvider: 'electron-store',
            category: NamespaceCategory.AGENT_SESSION_EVENTS,
            isPrimary: true,
        });
        // Cache and temporary data
        this.register(StaticNamespaces.CACHE, {
            name: StaticNamespaces.CACHE,
            description: 'General cache storage',
            storageProvider: 'memory',
            category: NamespaceCategory.CACHE,
        });
        this.register(StaticNamespaces.TEMP, {
            name: StaticNamespaces.TEMP,
            description: 'Temporary storage',
            storageProvider: 'memory',
            category: NamespaceCategory.CACHE,
        });
        // Docker Management
        this.register(StaticNamespaces.DOCKER_CONTAINERS, {
            name: StaticNamespaces.DOCKER_CONTAINERS,
            description: 'Docker container state and management for analysis tools',
            storageProvider: 'electron-store',
            category: NamespaceCategory.CORE,
        });
        this.register(StaticNamespaces.DOCKER_SESSIONS, {
            name: StaticNamespaces.DOCKER_SESSIONS,
            description: 'Docker analysis session tracking and history',
            storageProvider: 'electron-store',
            category: NamespaceCategory.CORE,
        });
    }
    register(namespace, config) {
        this.namespaceConfigs.set(namespace, config);
    }
    getConfig(namespace) {
        return this.namespaceConfigs.get(namespace);
    }
    getAllConfigs() {
        return Array.from(this.namespaceConfigs.values());
    }
    getConfigsByCategory(category) {
        return this.getAllConfigs().filter(config => config.category === category);
    }
}
/**
 * Type-safe storage provider wrapper
 * Provides strongly-typed get/set operations for each namespace
 */
export class TypedStorageProvider {
    provider;
    registry;
    constructor(provider, registry) {
        this.provider = provider;
        this.registry = registry;
    }
    /**
     * Get a value with proper type inference based on namespace
     */
    async get(namespace, key) {
        const namespacedKey = this.getNamespacedKey(namespace, key);
        return this.provider.get(namespacedKey);
    }
    /**
     * Set a value with type checking based on namespace
     */
    async set(namespace, key, value) {
        const namespacedKey = this.getNamespacedKey(namespace, key);
        return this.provider.set(namespacedKey, value);
    }
    /**
     * Get all data for a namespace
     */
    async getNamespaceData(namespace) {
        const keys = await this.provider.keys();
        const namespacePrefix = `${namespace}:`;
        const result = {};
        for (const key of keys) {
            if (key.startsWith(namespacePrefix)) {
                const shortKey = key.slice(namespacePrefix.length);
                const value = await this.provider.get(key);
                if (value !== undefined) {
                    result[shortKey] = value;
                }
            }
        }
        return result;
    }
    /**
     * Delete a key from a namespace
     */
    async delete(namespace, key) {
        const namespacedKey = this.getNamespacedKey(namespace, key);
        return this.provider.delete(namespacedKey);
    }
    /**
     * Check if a key exists in a namespace
     */
    async has(namespace, key) {
        const namespacedKey = this.getNamespacedKey(namespace, key);
        return this.provider.has(namespacedKey);
    }
    /**
     * Clear all data in a namespace
     */
    async clearNamespace(namespace) {
        const keys = await this.provider.keys();
        const namespacePrefix = `${namespace}:`;
        for (const key of keys) {
            if (key.startsWith(namespacePrefix)) {
                await this.provider.delete(key);
            }
        }
    }
    /**
     * Watch for changes in a namespace
     */
    watch(namespace, key, callback) {
        if (!this.provider.watch) {
            return undefined;
        }
        const namespacedKey = this.getNamespacedKey(namespace, key);
        return this.provider.watch(namespacedKey, callback);
    }
    getNamespacedKey(namespace, key) {
        return `${namespace}:${key}`;
    }
}
/**
 * Factory function to create a typed storage provider
 */
export function createTypedStorageProvider(provider) {
    const registry = new TypedNamespaceRegistry();
    return new TypedStorageProvider(provider, registry);
}
/**
 * Type guard to check if a string is a valid namespace
 */
export function isValidNamespace(namespace) {
    return Object.values(StaticNamespaces).includes(namespace);
}
