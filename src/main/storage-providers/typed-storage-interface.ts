import { StorageProvider, StorageResult, StaticNamespaces } from './types';
import {
  NamespaceDataTypes,
  TypedNamespaceRegistry,
  NamespaceData,
} from './typed-namespaces';
import { StorageNamespaces } from './all-namespaces';
import { StorageStats } from '../../shared/main-process-api-interfaces/StoreAPI';

/**
 * Extended storage provider interface with type-safe namespace operations
 */
export interface TypedStorageProvider<T = any> extends StorageProvider {
  /**
   * Get a value with namespace-specific typing
   */
  getTyped<K extends StorageNamespaces>(
    namespace: K,
    key: string,
    defaultValue?: NamespaceData<K>,
  ): Promise<NamespaceData<K> | undefined>;

  /**
   * Set a value with namespace-specific typing
   */
  setTyped<K extends StorageNamespaces>(
    namespace: K,
    key: string,
    value: NamespaceData<K>,
  ): Promise<void>;

  /**
   * Batch get multiple keys from a namespace
   */
  batchGet<K extends StorageNamespaces>(
    namespace: K,
    keys: string[],
  ): Promise<Map<string, NamespaceData<K>>>;

  /**
   * Batch set multiple key-value pairs in a namespace
   */
  batchSet<K extends StorageNamespaces>(
    namespace: K,
    items: Map<string, NamespaceData<K>>,
  ): Promise<void>;
}

/**
 * Type-safe storage result
 */
export interface TypedStorageResult<K extends StorageNamespaces>
  extends StorageResult {
  data?: NamespaceData<K>;
  namespace: K;
}

/**
 * Namespace-specific storage operations
 */
export interface NamespaceOperations<K extends StorageNamespaces> {
  get(
    key: string,
    defaultValue?: NamespaceData<K>,
  ): Promise<NamespaceData<K> | undefined>;
  set(key: string, value: NamespaceData<K>): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
  getAll(): Promise<Record<string, NamespaceData<K>>>;
}

/**
 * Type-safe multi-store manager interface
 */
export interface TypedMultiStoreManager {
  /**
   * Get namespace-specific operations
   */
  namespace<K extends StorageNamespaces>(namespace: K): NamespaceOperations<K>;

  /**
   * Get a value from a specific namespace with type safety
   */
  get<K extends StorageNamespaces>(
    key: string,
    namespace: K,
    defaultValue?: NamespaceData<K>,
  ): Promise<TypedStorageResult<K>>;

  /**
   * Set a value in a specific namespace with type safety
   */
  set<K extends StorageNamespaces>(
    key: string,
    value: NamespaceData<K>,
    namespace: K,
  ): Promise<TypedStorageResult<K>>;

  /**
   * Delete a key from a namespace
   */
  delete<K extends StorageNamespaces>(
    key: string,
    namespace: K,
  ): Promise<TypedStorageResult<K>>;

  /**
   * Check if a key exists in a namespace
   */
  has<K extends StorageNamespaces>(key: string, namespace: K): Promise<boolean>;

  /**
   * Get all keys in a namespace
   */
  keys<K extends StorageNamespaces>(namespace: K): Promise<string[]>;

  /**
   * Clear all data in a namespace
   */
  clearNamespace<K extends StorageNamespaces>(namespace: K): Promise<void>;

  /**
   * Get statistics for a namespace
   */
  getNamespaceStats<K extends StorageNamespaces>(
    namespace: K,
  ): Promise<StorageStats>;

  /**
   * Migrate data between namespaces with type safety
   */
  migrate<From extends StorageNamespaces, To extends StorageNamespaces>(
    fromNamespace: From,
    toNamespace: To,
    transformer?: (data: NamespaceData<From>) => NamespaceData<To>,
  ): Promise<void>;
}

/**
 * Create a namespace-specific operations wrapper
 */
export function createNamespaceOperations<K extends StorageNamespaces>(
  namespace: K,
  provider: StorageProvider,
): NamespaceOperations<K> {
  const getNamespacedKey = (key: string) => `${namespace}:${key}`;

  return {
    async get(key: string, defaultValue?: NamespaceData<K>) {
      return provider.get<NamespaceData<K>>(
        getNamespacedKey(key),
        defaultValue,
      );
    },

    async set(key: string, value: NamespaceData<K>) {
      return provider.set(getNamespacedKey(key), value);
    },

    async delete(key: string) {
      return provider.delete(getNamespacedKey(key));
    },

    async has(key: string) {
      return provider.has(getNamespacedKey(key));
    },

    async keys() {
      const allKeys = await provider.keys();
      const prefix = `${namespace}:`;
      return allKeys
        .filter((k) => k.startsWith(prefix))
        .map((k) => k.slice(prefix.length));
    },

    async clear() {
      const namespaceKeys = await this.keys();
      for (const key of namespaceKeys) {
        await this.delete(key);
      }
    },

    async getAll() {
      const namespaceKeys = await this.keys();
      const result: Record<string, NamespaceData<K>> = {};

      for (const key of namespaceKeys) {
        const value = await this.get(key);
        if (value !== undefined) {
          result[key] = value;
        }
      }

      return result;
    },
  };
}

/**
 * Type predicates for namespace data validation
 */
export class NamespaceDataValidator {
  static isUserPreferences(
    data: any,
  ): data is NamespaceDataTypes[StaticNamespaces.USER_PREFERENCES] {
    // UserPreferences can have various optional fields, so just check it's an object
    // The actual fields are: defaultEditor, defaultView, ollamaModel, agentAutoUpdate, etc.
    return data && typeof data === 'object';
  }

  static isRepositories(
    data: any,
  ): data is NamespaceDataTypes[StaticNamespaces.REPOSITORIES] {
    // Individual repository object, not an array
    return (
      data &&
      typeof data === 'object' &&
      'remoteUrl' in data &&
      'name' in data &&
      'localClones' in data &&
      Array.isArray(data.localClones)
    );
  }

  static isAIConfiguration(
    data: any,
  ): data is NamespaceDataTypes[StaticNamespaces.AI_CONFIGURATION] {
    return (
      data &&
      typeof data === 'object' &&
      'defaultProvider' in data &&
      'providers' in data
    );
  }


  static isLLMModels(
    data: any,
  ): data is NamespaceDataTypes[StaticNamespaces.LLM_MODELS] {
    return (
      data &&
      typeof data === 'object' &&
      'providers' in data &&
      'customModels' in data &&
      Array.isArray(data.customModels) &&
      'lastUpdated' in data
    );
  }

  static isToolContainerState(
    data: any,
  ): data is NamespaceDataTypes[StaticNamespaces.DOCKER_CONTAINERS] {
    return (
      data &&
      typeof data === 'object' &&
      'id' in data &&
      'toolName' in data &&
      'containerId' in data &&
      'imageId' in data &&
      'status' in data &&
      'created' in data &&
      'lastUsed' in data &&
      'metrics' in data &&
      data.metrics &&
      typeof data.metrics === 'object' &&
      'totalAnalyses' in data.metrics &&
      'avgExecutionTime' in data.metrics &&
      'uptime' in data.metrics &&
      'errorCount' in data.metrics
    );
  }

  static isDockerAnalysisSession(
    data: any,
  ): data is NamespaceDataTypes[StaticNamespaces.DOCKER_SESSIONS] {
    return (
      data &&
      typeof data === 'object' &&
      'id' in data &&
      'toolName' in data &&
      'containerId' in data &&
      'repositoryUrl' in data &&
      'status' in data &&
      'startTime' in data &&
      'configSource' in data &&
      'commandExecuted' in data &&
      'metrics' in data &&
      data.metrics &&
      typeof data.metrics === 'object'
    );
  }

  static validateNamespaceData<K extends StorageNamespaces>(
    namespace: K,
    data: any,
  ): data is NamespaceData<K> {
    switch (namespace) {
      case StaticNamespaces.USER_PREFERENCES:
        return this.isUserPreferences(data);
      case StaticNamespaces.REPOSITORIES:
        return this.isRepositories(data);
      case StaticNamespaces.AI_CONFIGURATION:
        return this.isAIConfiguration(data);
      case StaticNamespaces.LLM_MODELS:
        return this.isLLMModels(data);
      case StaticNamespaces.DOCKER_CONTAINERS:
        return this.isToolContainerState(data);
      case StaticNamespaces.DOCKER_SESSIONS:
        return this.isDockerAnalysisSession(data);
      default:
        return true; // For CACHE and TEMP, accept any data
    }
  }
}
