/**
 * Storage Provider Interface
 * 
 * This interface defines a common API for different storage providers
 * including electron-store, S3, and potentially other storage providers.
 */
import { StorageNamespaceConfig, StorageStats, StorageProviderConfig } from '../../shared/main-process-api-interfaces/StoreAPI';
import { StaticNamespaces } from '../../shared/types/namespaces.types';

export interface StorageProvider {
  /** The name/identifier of this storage provider */
  readonly name: string;

  /** Description of this storage provider */
  readonly description?: string;
  
  /** Whether this storage provider is currently available/initialized */
  readonly isAvailable: boolean;

  /**
   * Initialize the storage provider
   * @param config Configuration specific to this storage provider
   */
  initialize(config?: StorageProviderConfig): Promise<void>;

  /**
   * Get a value by key
   * @param key The key to retrieve
   * @param defaultValue Optional default value if key doesn't exist
   */
  get<T = any>(key: string, defaultValue?: T): Promise<T | undefined>;

  /**
   * Set a value by key
   * @param key The key to set
   * @param value The value to store
   */
  set<T = any>(key: string, value: T): Promise<void>;

  /**
   * Delete a key
   * @param key The key to delete
   */
  delete(key: string): Promise<void>;

  /**
   * Check if a key exists
   * @param key The key to check
   */
  has(key: string): Promise<boolean>;

  /**
   * Clear all data in this storage provider
   */
  clear(): Promise<void>;

  /**
   * Get all keys
   */
  keys(): Promise<string[]>;

  /**
   * Get the size/stats of the storage provider
   */
  getStats(): Promise<StorageStats>;

  /**
   * Close/cleanup the storage provider
   */
  close(): Promise<void>;

  /**
   * Watch for changes to a specific key
   * @param key The key to watch
   * @param callback Function to call when the key changes
   * @returns Unsubscribe function
   */
  watch?(key: string, callback: (newValue: any, oldValue: any) => void): () => void;
}



/**
 * Multi-store manager configuration
 */
export interface MultiStoreConfig {
  /** Available storage providers */
  storageProviders: Map<string, StorageProvider>;
  /** Namespace configurations */
  namespaces: StorageNamespaceConfig[];
  /** Default namespace to use if none specified */
  defaultNamespace?: string;
  /** Global encryption settings */
  globalEncryption?: {
    enabled: boolean;
    key: string;
  };
}

/**
 * Storage operation result
 */
export interface StorageResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  storageProvider?: string;
  namespace?: string;
}

/**
 * Storage event types
 */
export type StorageEventType = 'set' | 'delete' | 'clear' | 'error';

/**
 * Storage event data
 */
export interface StorageEvent {
  type: StorageEventType;
  namespace: string;
  storageProvider: string;
  key?: string;
  value?: any;
  oldValue?: any;
  timestamp: number;
  error?: Error;
}

/**
 * Storage event callback
 */
export type StorageEventCallback = (event: StorageEvent) => void;

/**
 * Migration options for moving data between storage providers
 */
export interface MigrationOptions {
  /** Source namespace */
  fromNamespace: StaticNamespaces;
  /** Target namespace */
  toNamespace: StaticNamespaces;
  /** Keys to migrate (if empty, migrate all) */
  keys?: string[];
  /** Whether to delete from source after migration */
  deleteSource?: boolean;
  /** Batch size for migration */
  batchSize?: number;
}

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  migratedKeys: string[];
  failedKeys: string[];
  totalProcessed: number;
  errors: Error[];
}

/**
 * Supported storage provider types
 */
export enum StorageProviderType {
  ELECTRON_STORE = 'electron-store',
  S3 = 's3',
  MEMORY = 'memory',
  FILE_SYSTEM = 'filesystem'
}

// StaticNamespaces enum has been moved to shared/types/namespaces.types.ts
export { StaticNamespaces } from '../../shared/types/namespaces.types';