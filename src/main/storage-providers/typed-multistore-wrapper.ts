import { MultiStoreManager } from './MultiStoreManager';
import { StaticNamespaces, StorageResult } from './types';
import { NamespaceData, isValidNamespace } from './typed-namespaces';
import {
  TypedMultiStoreManager,
  TypedStorageResult,
  NamespaceOperations,
  createNamespaceOperations,
  NamespaceDataValidator,
} from './typed-storage-interface';
import { StorageNamespaces, isStaticNamespace } from './all-namespaces';
import {
  StorageNamespaceConfig,
  StorageStats,
} from '../../shared/main-process-api-interfaces/StoreAPI';

/**
 * Type-safe wrapper around MultiStoreManager
 * Provides compile-time type safety for namespace operations
 * Supports both static namespaces (from enum) and dynamic namespaces (strings)
 */
export class TypedMultiStoreWrapper implements TypedMultiStoreManager {
  private namespaceCache: Map<string, NamespaceOperations<StorageNamespaces>>;

  constructor(private multiStoreManager: MultiStoreManager) {
    this.namespaceCache = new Map();
  }

  /**
   * Get namespace-specific operations with type safety
   * All namespaces are properly typed
   */
  namespace<K extends StorageNamespaces>(namespace: K): NamespaceOperations<K> {
    if (!this.namespaceCache.has(namespace)) {
      // Get the namespace config from MultiStoreManager
      const namespaces = this.multiStoreManager.getNamespaces();
      const config = namespaces.get(namespace);
      if (!config) {
        throw new Error(
          `Namespace ${namespace} is not registered in MultiStoreManager`,
        );
      }

      // Use the proper method that handles both dedicated and shared providers
      const provider =
        this.multiStoreManager.getProviderForNamespace(namespace);

      const operations = createNamespaceOperations(namespace, provider);
      this.namespaceCache.set(namespace, operations);
    }

    return this.namespaceCache.get(namespace)! as NamespaceOperations<K>;
  }

  /**
   * Type-safe get operation
   * All namespaces are now properly typed in NamespaceDataTypes
   */
  async get<K extends StorageNamespaces>(
    key: string,
    namespace: K,
    defaultValue?: NamespaceData<K>,
  ): Promise<TypedStorageResult<K>> {
    try {
      const result = await this.multiStoreManager.get(
        key,
        namespace,
        defaultValue,
      );

      // Only validate if it's a static namespace
      if (
        result.success &&
        result.data !== undefined &&
        isStaticNamespace(namespace)
      ) {
        if (
          !NamespaceDataValidator.validateNamespaceData(namespace, result.data)
        ) {
          console.warn(
            `Data validation failed for namespace ${namespace}, key ${key}`,
          );
        }
      }

      return {
        ...result,
        namespace,
        data: result.data as NamespaceData<K>,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        namespace,
      };
    }
  }

  /**
   * Type-safe set operation
   * All namespaces are now properly typed in NamespaceDataTypes
   */
  async set<K extends StorageNamespaces>(
    key: string,
    value: NamespaceData<K>,
    namespace: K,
  ): Promise<TypedStorageResult<K>> {
    try {
      // Only validate if it's a static namespace
      if (isStaticNamespace(namespace)) {
        if (
          !NamespaceDataValidator.validateNamespaceData(
            namespace as StaticNamespaces,
            value,
          )
        ) {
          console.warn(
            `Data validation failed for namespace ${namespace}, key ${key}`,
          );
        }
      }

      const result = await this.multiStoreManager.set(key, value, namespace);

      return {
        ...result,
        namespace,
        data: value,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        namespace,
      };
    }
  }

  /**
   * Delete a key from a namespace
   * All namespaces are properly typed
   */
  async delete<K extends StorageNamespaces>(
    key: string,
    namespace: K,
  ): Promise<TypedStorageResult<K>> {
    try {
      await this.multiStoreManager.delete(key, namespace);

      return {
        success: true,
        data: undefined,
        namespace,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        namespace,
      };
    }
  }

  /**
   * Check if a key exists in a namespace
   * Supports all known namespaces
   */
  async has<K extends StorageNamespaces>(
    key: string,
    namespace: K,
  ): Promise<boolean> {
    const result = await this.multiStoreManager.has(key, namespace);
    return result.success && result.data === true;
  }

  /**
   * Get all keys in a namespace
   * Supports all known namespaces
   */
  async keys<K extends StorageNamespaces>(namespace: K): Promise<string[]> {
    const result = await this.multiStoreManager.keys(namespace);
    return result.success ? result.data || [] : [];
  }

  /**
   * Clear all data in a namespace
   * Supports all known namespaces
   */
  async clearNamespace<K extends StorageNamespaces>(
    namespace: K,
  ): Promise<void> {
    const namespaces = this.multiStoreManager.getNamespaces();
    const config = namespaces.get(namespace);
    if (!config) {
      throw new Error(
        `Namespace ${namespace} is not registered in MultiStoreManager`,
      );
    }

    await this.multiStoreManager.clear(namespace);
  }

  /**
   * Alias for clearNamespace to match MultiStoreManager API
   */
  async clear<K extends StorageNamespaces>(namespace: K): Promise<void> {
    return this.clearNamespace(namespace);
  }

  /**
   * Get statistics for a namespace
   * Supports all known namespaces
   */
  async getNamespaceStats<K extends StorageNamespaces>(
    namespace: K,
  ): Promise<StorageStats> {
    // Use the multiStoreManager's getStats method which properly handles namespace providers
    const result = await this.multiStoreManager.getStats(namespace);
    if (!result.success) {
      throw (
        result.error ||
        new Error(`Failed to get stats for namespace ${namespace}`)
      );
    }
    return result.data!;
  }

  /**
   * Migrate data between namespaces with optional transformation
   */
  async migrate<From extends StorageNamespaces, To extends StorageNamespaces>(
    fromNamespace: From,
    toNamespace: To,
    transformer?: (data: NamespaceData<From>) => NamespaceData<To>,
  ): Promise<void> {
    const fromOps = this.namespace(fromNamespace);
    const toOps = this.namespace(toNamespace);

    const allData = await fromOps.getAll();

    for (const [key, value] of Object.entries(allData)) {
      const transformedValue = transformer ? transformer(value) : value;
      await toOps.set(key, transformedValue as NamespaceData<To>);
    }
  }

  /**
   * Batch operations for better performance
   */
  async batchGet<K extends StorageNamespaces>(
    namespace: K,
    keys: string[],
  ): Promise<Map<string, NamespaceData<K>>> {
    // Use the new optimized getMultiple method
    const result = await this.multiStoreManager.getMultiple(keys, namespace);
    if (!result.success) {
      throw (
        result.error ||
        new Error(`Failed to batch get from namespace ${namespace}`)
      );
    }
    return result.data as Map<string, NamespaceData<K>>;
  }

  /**
   * Get multiple values with the new optimized method
   */
  async getMultiple<K extends StorageNamespaces>(
    keys: string[],
    namespace: K,
  ): Promise<StorageResult<Map<string, NamespaceData<K>>>> {
    const result = await this.multiStoreManager.getMultiple(keys, namespace);
    return {
      ...result,
      data: result.data as Map<string, NamespaceData<K>>,
    };
  }

  async batchSet<K extends StorageNamespaces>(
    namespace: K,
    items: Map<string, NamespaceData<K>>,
  ): Promise<void> {
    const operations = this.namespace(namespace);

    // Parallelize the set operations
    const promises = Array.from(items.entries()).map(([key, value]) =>
      operations.set(key, value),
    );

    await Promise.all(promises);
  }

  /**
   * Delete multiple keys with the new optimized method
   */
  async deleteMultiple<K extends StorageNamespaces>(
    keys: string[],
    namespace: K,
  ): Promise<StorageResult<{ deleted: string[]; failed: string[] }>> {
    return await this.multiStoreManager.deleteMultiple(keys, namespace);
  }

  /**
   * Helper method to validate namespace string
   */
  isValidNamespace(namespace: string): namespace is StorageNamespaces {
    return isValidNamespace(namespace);
  }

  /**
   * Get all registered namespaces (both static and dynamic)
   */
  getNamespaces(): Map<StorageNamespaces, StorageNamespaceConfig> {
    return this.multiStoreManager.getNamespaces();
  }
}

/**
 * Factory function to create a typed multi-store wrapper
 */
export function createTypedMultiStore(
  multiStoreManager: MultiStoreManager,
): TypedMultiStoreWrapper {
  return new TypedMultiStoreWrapper(multiStoreManager);
}

/**
 * Usage example showing type safety
 *
 * @example
 * ```typescript
 * const typedStore = createTypedMultiStore(multiStoreManager);
 *
 * // Type-safe operations
 * const userPrefs = await typedStore.get('settings', StorageNamespaces.USER_PREFERENCES);
 * // userPrefs.data is typed as UserPreferences
 *
 * await typedStore.set('repos', repositories, StorageNamespaces.REPOSITORIES);
 * // repositories must be of type Repository[]
 *
 * // Namespace-specific operations
 * const repoOps = typedStore.namespace(StorageNamespaces.REPOSITORIES);
 * const allRepos = await repoOps.getAll();
 * // allRepos is typed as Record<string, Repository[]>
 * ```
 */
