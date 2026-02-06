import {
  StorageNamespaceConfig,
  NamespaceCategory,
} from '../../shared/main-process-api-interfaces/StoreAPI';
import { UserPreferences } from '../../shared/types/userPreferences.types';
import { SecretMetadata } from '../../shared/main-process-api-interfaces/SecretsAPI';

import { StaticNamespaces, StorageProvider } from './types';
import { StorageNamespaces } from './all-namespaces';

/**
 * Links Management Data Types
 */

/**
 * Repository link interface
 */
export interface RepositoryLink {
  id: string;
  label: string;
  url: string;
  description?: string;
  category?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Link metadata interface
 */
export interface LinkMetadata {
  repoId: string;
  repoPath: string;
  createdAt: number;
  updatedAt: number;
  linkCount: number;
}

/**
 * Stored links data structure
 */
export interface StoredLinks {
  links: RepositoryLink[];
  metadata: LinkMetadata;
}

/**
 * Docker Management Data Types
 */

/**
 * Analysis tool configuration for Docker containers
 */
export interface AnalysisToolConfig {
  toolName: string;
  dockerImage: string;
  version: string;
  installCommand?: string;
  defaultCommand: string[];
  configFiles: string[];
  supportedFrameworks: string[];
  workingDirectory: string;
  mountStrategy: 'read-only' | 'read-write' | 'copy';
}

/**
 * Tool container state for persistent containers
 */
export interface ToolContainerState {
  id: string;
  toolName: string;
  containerId: string;
  imageId: string;
  status: 'ready' | 'busy' | 'stopped' | 'error';
  created: number;
  lastUsed: number;

  // Current analysis session
  currentSession?: {
    sessionId: string;
    projectPath: string;
    startTime: number;
  };

  // Performance tracking
  metrics: {
    totalAnalyses: number;
    avgExecutionTime: number;
    uptime: number;
    errorCount: number;
  };

  // Health status
  health?: {
    lastHealthCheck: number;
    isResponsive: boolean;
    memoryUsage?: number;
    cpuUsage?: number;
  };
}

/**
 * Docker analysis session tracking
 */
export interface DockerAnalysisSession {
  id: string;
  toolName: string;
  containerId: string;
  repositoryUrl: string;
  packagePath?: string;

  // Session state
  status:
    | 'preparing'
    | 'mounting'
    | 'running'
    | 'completed'
    | 'failed'
    | 'cancelled';
  startTime: number;
  endTime?: number;

  // Configuration used
  configSource: 'repository' | 'generated' | 'default';
  configUsed?: unknown; // Tool-specific configuration object
  commandExecuted: string;

  // Results and performance
  output?: {
    stdout: string;
    stderr: string;
    exitCode?: number;
  };

  results?: unknown; // Tool-specific results (e.g., knip analysis results)
  error?: string;

  // Performance metrics
  metrics: {
    preparationTime?: number; // Time to prepare container
    mountTime?: number; // Time to mount/copy files
    executionTime?: number; // Time for actual analysis
    totalTime?: number; // Total session time
    memoryPeak?: number; // Peak memory usage
    cpuTime?: number; // CPU time used
  };

  // File handling
  fileOperations?: {
    filesScanned?: number;
    filesCopied?: number;
    totalSize?: number;
    mountPath?: string;
  };
}

/**
 * Type-safe namespace data type definitions
 * Each namespace has its own strongly-typed data structure
 */
export interface NamespaceDataTypes {
  [StaticNamespaces.USER_PREFERENCES]: UserPreferences;
  [StaticNamespaces.CACHE]: Record<string, unknown>;
  [StaticNamespaces.TEMP]: Record<string, unknown>;

  // Docker Management namespaces
  [StaticNamespaces.DOCKER_CONTAINERS]: ToolContainerState; // Persistent container state
  [StaticNamespaces.DOCKER_SESSIONS]: DockerAnalysisSession; // Analysis session tracking

  // Secrets Management namespace
  [StaticNamespaces.SECRETS_METADATA]: SecretMetadata; // Metadata for encrypted secrets

  // Links Management namespace
  [StaticNamespaces.REPOSITORY_LINKS]: StoredLinks; // Repository links and bookmarks
}

/**
 * Type-safe namespace registry
 * Maps namespaces to their configuration and ensures type safety
 */
export class TypedNamespaceRegistry {
  private namespaceConfigs: Map<StorageNamespaces, StorageNamespaceConfig>;

  constructor() {
    this.namespaceConfigs = new Map();
    this.initializeDefaultNamespaces();
  }

  private initializeDefaultNamespaces() {
    // Core application data
    this.register(StaticNamespaces.USER_PREFERENCES, {
      name: StaticNamespaces.USER_PREFERENCES,
      description: 'User preferences and settings',
      storageProvider: 'electron-store',
      category: NamespaceCategory.CORE,
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

    // Links Management
    this.register(StaticNamespaces.REPOSITORY_LINKS, {
      name: StaticNamespaces.REPOSITORY_LINKS,
      description: 'Repository links and bookmarks',
      storageProvider: 'electron-store',
      category: NamespaceCategory.CORE,
    });
  }

  register(namespace: StorageNamespaces, config: StorageNamespaceConfig) {
    this.namespaceConfigs.set(namespace, config);
  }

  getConfig(namespace: StorageNamespaces): StorageNamespaceConfig | undefined {
    return this.namespaceConfigs.get(namespace);
  }

  getAllConfigs(): StorageNamespaceConfig[] {
    return Array.from(this.namespaceConfigs.values());
  }

  getConfigsByCategory(category: NamespaceCategory): StorageNamespaceConfig[] {
    return this.getAllConfigs().filter(
      (config) => config.category === category,
    );
  }
}

/**
 * Type-safe storage provider wrapper
 * Provides strongly-typed get/set operations for each namespace
 */
export class TypedStorageProvider {
  constructor(
    private provider: StorageProvider,
    private registry: TypedNamespaceRegistry,
  ) {}

  /**
   * Get a value with proper type inference based on namespace
   */
  async get<K extends StorageNamespaces>(
    namespace: K,
    key: string,
  ): Promise<NamespaceDataTypes[K] | undefined> {
    const namespacedKey = this.getNamespacedKey(namespace, key);
    return this.provider.get<NamespaceDataTypes[K]>(namespacedKey);
  }

  /**
   * Set a value with type checking based on namespace
   */
  async set<K extends StorageNamespaces>(
    namespace: K,
    key: string,
    value: NamespaceDataTypes[K],
  ): Promise<void> {
    const namespacedKey = this.getNamespacedKey(namespace, key);
    return this.provider.set(namespacedKey, value);
  }

  /**
   * Get all data for a namespace
   */
  async getNamespaceData<K extends StorageNamespaces>(
    namespace: K,
  ): Promise<Record<string, NamespaceDataTypes[K]>> {
    const keys = await this.provider.keys();
    const namespacePrefix = `${namespace}:`;
    const result: Record<string, NamespaceDataTypes[K]> = {};

    for (const key of keys) {
      if (key.startsWith(namespacePrefix)) {
        const shortKey = key.slice(namespacePrefix.length);
        const value = await this.provider.get(key);
        if (value !== undefined) {
          result[shortKey] = value as NamespaceDataTypes[K];
        }
      }
    }

    return result;
  }

  /**
   * Delete a key from a namespace
   */
  async delete<K extends StorageNamespaces>(
    namespace: K,
    key: string,
  ): Promise<void> {
    const namespacedKey = this.getNamespacedKey(namespace, key);
    return this.provider.delete(namespacedKey);
  }

  /**
   * Check if a key exists in a namespace
   */
  async has<K extends StorageNamespaces>(
    namespace: K,
    key: string,
  ): Promise<boolean> {
    const namespacedKey = this.getNamespacedKey(namespace, key);
    return this.provider.has(namespacedKey);
  }

  /**
   * Clear all data in a namespace
   */
  async clearNamespace<K extends StorageNamespaces>(
    namespace: K,
  ): Promise<void> {
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
  watch<K extends StorageNamespaces>(
    namespace: K,
    key: string,
    callback: (
      newValue: NamespaceDataTypes[K] | undefined,
      oldValue: NamespaceDataTypes[K] | undefined,
    ) => void,
  ): (() => void) | undefined {
    if (!this.provider.watch) {
      return undefined;
    }

    const namespacedKey = this.getNamespacedKey(namespace, key);
    return this.provider.watch(namespacedKey, (newValue: unknown, oldValue: unknown) => {
      callback(
        newValue as NamespaceDataTypes[K] | undefined,
        oldValue as NamespaceDataTypes[K] | undefined
      );
    });
  }

  private getNamespacedKey(namespace: StorageNamespaces, key: string): string {
    return `${namespace}:${key}`;
  }
}

/**
 * Factory function to create a typed storage provider
 */
export function createTypedStorageProvider(
  provider: StorageProvider,
): TypedStorageProvider {
  const registry = new TypedNamespaceRegistry();
  return new TypedStorageProvider(provider, registry);
}

/**
 * Type guard to check if a string is a valid namespace
 */
export function isValidNamespace(
  namespace: string,
): namespace is StorageNamespaces {
  return Object.values(StaticNamespaces).includes(
    namespace as StaticNamespaces,
  );
}

/**
 * Helper type for namespace-specific operations
 */
export type NamespaceData<K extends keyof NamespaceDataTypes> =
  NamespaceDataTypes[K];

/**
 * Helper type for namespace keys
 */
export type NamespaceKey = keyof NamespaceDataTypes;
