import { StaticNamespaces } from './types';
/**
 * Create a namespace-specific operations wrapper
 */
export function createNamespaceOperations(namespace, provider) {
    const getNamespacedKey = (key) => `${namespace}:${key}`;
    return {
        async get(key, defaultValue) {
            return provider.get(getNamespacedKey(key), defaultValue);
        },
        async set(key, value) {
            return provider.set(getNamespacedKey(key), value);
        },
        async delete(key) {
            return provider.delete(getNamespacedKey(key));
        },
        async has(key) {
            return provider.has(getNamespacedKey(key));
        },
        async keys() {
            const allKeys = await provider.keys();
            const prefix = `${namespace}:`;
            return allKeys
                .filter(k => k.startsWith(prefix))
                .map(k => k.slice(prefix.length));
        },
        async clear() {
            const namespaceKeys = await this.keys();
            for (const key of namespaceKeys) {
                await this.delete(key);
            }
        },
        async getAll() {
            const namespaceKeys = await this.keys();
            const result = {};
            for (const key of namespaceKeys) {
                const value = await this.get(key);
                if (value !== undefined) {
                    result[key] = value;
                }
            }
            return result;
        }
    };
}
/**
 * Type predicates for namespace data validation
 */
export class NamespaceDataValidator {
    static isUserPreferences(data) {
        // UserPreferences can have various optional fields, so just check it's an object
        // The actual fields are: defaultEditor, defaultView, ollamaModel, agentAutoUpdate, etc.
        return data && typeof data === 'object';
    }
    static isRepositories(data) {
        // Individual repository object, not an array
        return data && typeof data === 'object' &&
            'remoteUrl' in data &&
            'name' in data &&
            'localClones' in data &&
            Array.isArray(data.localClones);
    }
    static isAIConfiguration(data) {
        return data && typeof data === 'object' &&
            'defaultProvider' in data &&
            'providers' in data;
    }
    static isAgentSessions(data) {
        return data && typeof data === 'object' &&
            'sessionId' in data &&
            'provider' in data &&
            'workingDirectory' in data &&
            'startTime' in data &&
            'lastUpdateTime' in data &&
            'events' in data &&
            Array.isArray(data.events) &&
            'totalEvents' in data;
    }
    static isLLMModels(data) {
        return data && typeof data === 'object' &&
            'providers' in data &&
            'customModels' in data &&
            Array.isArray(data.customModels) &&
            'lastUpdated' in data;
    }
    static isToolContainerState(data) {
        return data && typeof data === 'object' &&
            'id' in data &&
            'toolName' in data &&
            'containerId' in data &&
            'imageId' in data &&
            'status' in data &&
            'created' in data &&
            'lastUsed' in data &&
            'metrics' in data &&
            data.metrics && typeof data.metrics === 'object' &&
            'totalAnalyses' in data.metrics &&
            'avgExecutionTime' in data.metrics &&
            'uptime' in data.metrics &&
            'errorCount' in data.metrics;
    }
    static isDockerAnalysisSession(data) {
        return data && typeof data === 'object' &&
            'id' in data &&
            'toolName' in data &&
            'containerId' in data &&
            'repositoryUrl' in data &&
            'status' in data &&
            'startTime' in data &&
            'configSource' in data &&
            'commandExecuted' in data &&
            'metrics' in data &&
            data.metrics && typeof data.metrics === 'object';
    }
    static validateNamespaceData(namespace, data) {
        switch (namespace) {
            case StaticNamespaces.USER_PREFERENCES:
                return this.isUserPreferences(data);
            case StaticNamespaces.REPOSITORIES:
                return this.isRepositories(data);
            case StaticNamespaces.AI_CONFIGURATION:
                return this.isAIConfiguration(data);
            case StaticNamespaces.LLM_MODELS:
                return this.isLLMModels(data);
            case StaticNamespaces.AGENT_SESSIONS:
                return this.isAgentSessions(data);
            case StaticNamespaces.DOCKER_CONTAINERS:
                return this.isToolContainerState(data);
            case StaticNamespaces.DOCKER_SESSIONS:
                return this.isDockerAnalysisSession(data);
            default:
                return true; // For CACHE and TEMP, accept any data
        }
    }
}
