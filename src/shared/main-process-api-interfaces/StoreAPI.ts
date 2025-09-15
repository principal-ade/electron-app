import { StorageNamespaces } from "../types/namespaces.types";

/**
 * Configuration for storage providers
 */
export interface StorageProviderConfig {
  /** The storage path or identifier */
  path?: string;
  /** Storage provider-specific options */
  options?: Record<string, unknown>;
  /** Default values for this storage provider */
  defaults?: Record<string, unknown>;
  /** Encryption settings */
  encryption?: {
    enabled: boolean;
    key?: string;
  };
}

/**
 * Storage statistics
 */
export interface StorageStats {
  /** Total number of keys */
  totalKeys: number;
  /** Size in bytes (approximate) */
  sizeBytes: number;
  /** Storage provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Namespace categories for organization
 */
export enum NamespaceCategory {
  CORE = 'core',           // Core application data (preferences, repositories, etc.)
  AGENT_SESSION_EVENTS = 'agent-session-events', // Agent provider event storage
  CACHE = 'cache'          // Temporary/cache data
}
/**
 * Storage namespace configuration
 */
export interface StorageNamespaceConfig {
  /** Unique identifier for this namespace */
  name: StorageNamespaces;
  /** Description of this namespace */
  description?: string;
  /** The storage provider to use for this namespace */
  storageProvider: string;
  /** Configuration for this namespace */
  config?: StorageProviderConfig;
  /** Whether this namespace is the primary/default one */
  isPrimary?: boolean;
  /** Whether this namespace is read-only */
  readOnly?: boolean;
  /** Category for organizing namespaces */
  category?: NamespaceCategory;
}

export interface HookFallbackFile {
  fileName: string;
  cli: string;
  path: string;
  size?: number;
  lastModified?: Date;
  isError?: boolean;
  isSettings?: boolean;
}

export interface SessionStorageMetrics {
  totalStorageUsed: number;
  archiveFiles: {
    count: number;
    totalSize: number;
    oldestFile?: string;
  };
  processedEvents: {
    sessionCount: number;
    totalSize: number;
  };
  rawEvents: Record<string, {
    eventCount: number;
    totalSize: number;
  }>;
}

export interface CleanupOptions {
  olderThanDays: number;
  includeArchives: boolean;
  includeProcessed: boolean;
}

export interface CleanupResult {
  deletedCount: number;
  freedSpace: number;
}

export enum StoreEvents {
  // Core CRUD operations
  GET = 'store:get',
  SET = 'store:set',
  DELETE = 'store:delete',
  HAS = 'store:has',
  CLEAR = 'store:clear',
  KEYS = 'store:keys',
  
  // Namespace management
  LIST_NAMESPACES = 'store:list-namespaces',
  GET_FILE_PATH = 'store:get-file-path',
  GET_NAMESPACE_FILE_PATH = 'store:get-namespace-file-path',
  GET_STATS = 'store:get-stats',
  GET_NAMESPACE_STATS = 'store:get-namespace-stats',
  
  // Session and fallback management
  SCAN_HOOK_FALLBACK_FILES = 'store:scan-hook-fallback-files',
  GET_SESSION_STORAGE_METRICS = 'store:get-session-storage-metrics',
  CLEANUP_SESSION_STORAGE = 'store:cleanup-session-storage',
  
  // Watch events
  WATCH = 'store:watch',
  UNWATCH = 'store:unwatch',
  STORAGE_CHANGED = 'store:storage-changed',
  
  // Migration
  MIGRATE = 'store:migrate',
}

export interface StoreAPI {
  // Core CRUD operations with optional namespace
  get: <T = unknown>(key: string, namespace?: StorageNamespaces, defaultValue?: T) => Promise<T>;
  set: <T = unknown>(key: string, value: T, namespace?: StorageNamespaces) => Promise<void>;
  delete: (key: string, namespace?: StorageNamespaces) => Promise<void>;
  has: (key: string, namespace?: StorageNamespaces) => Promise<boolean>;
  clear: (namespace?: StorageNamespaces) => Promise<void>;
  keys: (namespace?: StorageNamespaces) => Promise<string[]>;
  
  // Namespace management
  listNamespaces: () => Promise<StorageNamespaceConfig[]>;
  getFilePath: (namespace?: StorageNamespaces) => Promise<string>;
  getNamespaceFilePath: (namespace: StorageNamespaces) => Promise<string>;
  getStats: (namespace?: StorageNamespaces) => Promise<StorageStats>;
  getNamespaceStats: (namespace: StorageNamespaces) => Promise<StorageStats>;
  
  // Session and fallback management
  scanHookFallbackFiles: () => Promise<HookFallbackFile[]>;
  getSessionStorageMetrics: () => Promise<SessionStorageMetrics>;
  cleanupSessionStorage: (options: CleanupOptions) => Promise<CleanupResult>;
  
  // Watch for changes
  watch: (key: string, namespace?: StorageNamespaces) => Promise<() => void>;
  onStorageChanged: (
    callback: (event: { namespace: StorageNamespaces; key: string; value: unknown; oldValue: unknown }) => void
  ) => () => void;
}