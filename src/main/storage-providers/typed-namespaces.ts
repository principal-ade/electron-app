import {
  NormalizedAgentSessionEvent,
  SupportedAgent,
} from '@principal-ai/agent-monitoring';

import { Repository } from '../../shared/types/repository.types';
import { LLMConfiguration } from '../../shared/main-process-api-interfaces/LLMModelsAPI';
import {
  StorageNamespaceConfig,
  NamespaceCategory,
} from '../../shared/main-process-api-interfaces/StoreAPI';
import { AgentSessionEvent } from '../../shared/main-process-api-interfaces';
import { UserPreferences } from '../../shared/types/userPreferences.types';
import { AgentSessionRecord } from '../../shared/sessionTypes';
import { SecretMetadata } from '../../shared/main-process-api-interfaces/SecretsAPI';

// TODO: Define proper AIConfiguration interface
interface AIConfiguration {
  [key: string]: unknown;
}

import { StaticNamespaces, StorageProvider } from './types';
import { StorageNamespaces } from './all-namespaces';

export interface SessionSummary {
  sessionId: string;
  provider: string;
  workingDirectory: string;
  startTime: number;
  endTime?: number;
  lastUpdateTime: number;
  totalEvents: number;
  fileAccessCount: number;
  fileWriteCount: number;
  toolCallCount: number;
  repositoriesAccessed: string[];
  isActive: boolean;
  archivePath?: string; // Path to archived file if archived
}

export interface ArchiveConfiguration {
  // Auto-archiving settings
  autoArchive: {
    enabled: boolean;
    // Archive sessions after this period of inactivity (in hours)
    inactivityThreshold: number; // Default: 24 hours
    // Archive completed sessions after this delay (in seconds)
    completedSessionDelay: number; // Default: 5 seconds
    // Check for stale sessions every X minutes
    checkInterval: number; // Default: 60 minutes
  };

  // Storage management
  storage: {
    // Maximum age for archived files (in days)
    maxArchiveAge: number; // Default: 30 days
    // Maximum age for session summaries (in days)
    maxSummaryAge: number; // Default: 7 days
    // Maximum total size for archives (in MB)
    maxArchiveSize: number; // Default: 1000 MB
    // Compress archives to save space
    compressArchives: boolean; // Default: true
  };

  // Session handling
  sessions: {
    // Archive sessions even without Stop event
    archiveIncompleteSessions: boolean; // Default: true
    // Minimum event count to archive a session
    minEventsToArchive: number; // Default: 5
    // Include raw events in the archive files (they are always removed from the active store)
    keepRawEvents: boolean; // Default: true - preserves original data for reprocessing
    // Archive sessions by repository
    groupByRepository: boolean; // Default: false
  };

  // Export settings
  export: {
    // Default export format
    defaultFormat: 'json' | 'csv' | 'markdown';
    // Include raw events in export
    includeRawEvents: boolean; // Default: false
    // Include session metrics
    includeMetrics: boolean; // Default: true
  };
}

// AgentEventNamespaces has been moved to shared/types/namespaces.types.ts
import { AgentEventNamespaces } from '../../shared/types/namespaces.types';

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
  configUsed?: any;
  commandExecuted: string;

  // Results and performance
  output?: {
    stdout: string;
    stderr: string;
    exitCode?: number;
  };

  results?: any; // Tool-specific results (e.g., knip analysis results)
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
 * Agent event indexes structure
 * Maps each agent's event namespace to its list of event keys
 */
export interface AgentEventIndexes {
  [AgentEventNamespaces.CLAUDE]: string[];
  [AgentEventNamespaces.OPENCODE]: string[];
  [AgentEventNamespaces.CLINE]: string[];
}

// Type mapping from SupportedAgent to specific namespace
type AgentNamespaceMap = {
  [SupportedAgent.CLAUDE]: AgentEventNamespaces.CLAUDE;
  [SupportedAgent.OPENCODE]: AgentEventNamespaces.OPENCODE;
  [SupportedAgent.CLINE]: AgentEventNamespaces.CLINE;
};

export function getAgentEventNamespace<T extends SupportedAgent>(
  agent: T,
): AgentNamespaceMap[T] {
  const namespaceMap: AgentNamespaceMap = {
    [SupportedAgent.CLAUDE]: AgentEventNamespaces.CLAUDE,
    [SupportedAgent.OPENCODE]: AgentEventNamespaces.OPENCODE,
    [SupportedAgent.CLINE]: AgentEventNamespaces.CLINE,
  };
  return namespaceMap[agent];
}

/**
 * Type-safe namespace data type definitions
 * Each namespace has its own strongly-typed data structure
 */
export interface NamespaceDataTypes {
  [StaticNamespaces.USER_PREFERENCES]: UserPreferences;
  [StaticNamespaces.REPOSITORIES]: Repository; // Individual repository stored by key
  [StaticNamespaces.AI_CONFIGURATION]: AIConfiguration;
  [StaticNamespaces.LLM_MODELS]: LLMConfiguration;
  [StaticNamespaces.CACHE]: Record<string, any>;
  [StaticNamespaces.TEMP]: Record<string, any>;
  [StaticNamespaces.AGENT_SESSIONS]: ProcessedSessionData; // Canonical session storage
  [StaticNamespaces.GLOBAL_SESSION_REGISTRY]: GlobalSessionRegistry; // Global session index and active session tracking
  [StaticNamespaces.SESSION_SUMMARIES]: SessionSummary; // Recent session summaries for quick access
  [StaticNamespaces.ARCHIVE_CONFIGURATION]: ArchiveConfiguration; // Archive system configuration settings
  [StaticNamespaces.AGENT_EVENT_INDEXES]: AgentEventIndexes; // Centralized storage for agent event indexes
  [StaticNamespaces.MCP_BRIDGE_DATA]: any; // MCP Bridge data storage (MCPBridgeDataEntry from MCPBridgeDataStore)

  // Docker Management namespaces
  [StaticNamespaces.DOCKER_CONTAINERS]: ToolContainerState; // Persistent container state
  [StaticNamespaces.DOCKER_SESSIONS]: DockerAnalysisSession; // Analysis session tracking

  // Secrets Management namespace
  [StaticNamespaces.SECRETS_METADATA]: SecretMetadata; // Metadata for encrypted secrets

  // Agent event namespaces - these store individual events by key
  // The storage system handles key-value pairs, so each event is stored separately
  [AgentEventNamespaces.CLAUDE]: AgentSessionEvent;
  [AgentEventNamespaces.OPENCODE]: AgentSessionEvent;
  [AgentEventNamespaces.CLINE]: AgentSessionEvent;
}

/**
 * Processed agent session data
 * Stores session metadata and flat list of events
 */
export interface ProcessedSessionData {
  // Session identification
  sessionId: string;
  provider: SupportedAgent;
  workingDirectory: string;

  // Timing
  startTime: number;
  lastUpdateTime: number;

  // Flat list of all normalized events from core
  // Events have normalizedWorkingDirectory set to git root when in a repository
  events: NormalizedAgentSessionEvent[];

  // Aggregates for quick access (optional, for performance)
  totalEvents: number;

  // Repository tracking with git root paths for efficient detection
  // Multiple entries can have the same remoteUrl (different clones)
  repositoriesAccessed?: Array<{
    remoteUrl: string;
    gitRoot: string;
  }>;

  // Basic counters (optional, for performance)
  counters?: {
    fileAccesses: number;
    fileWrites: number;
    toolCalls: number;
    webAccesses: number;
  };

  // File tracking maps for centralized event processor
  fileAccesses?: Record<
    string,
    Array<{
      timestamp: number;
      normalizedPath?: string;
      metadata?: any;
    }>
  >;
  fileWrites?: Record<
    string,
    Array<{
      timestamp: number;
      operation: string;
      normalizedPath?: string;
      metadata?: any;
    }>
  >;

  // Additional file tracking arrays
  filesRead?: string[];
  filesWritten?: string[];

  // Metadata storage
  metadata?: Record<string, any>;

  // File context tracking
  fileContexts?: {
    repositories: string[]; // Git roots accessed (unique)
    systemFiles: number; // Count of system files accessed
    configFiles: number; // Count of config files accessed
    tempFiles: number; // Count of temp files accessed
    externalFiles: string[]; // Notable external files accessed (non-repo, non-system)
  };
}

/**
 * Global session registry data
 * Stores global session index and active session tracking across directories
 */
export interface GlobalSessionRegistry {
  // Global session index - sessionId -> session data
  sessions: Record<string, AgentSessionRecord>;

  // Active session tracking - directory -> active sessionId
  activeSessionsByDirectory: Record<string, string>;
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
    const result: Record<string, any> = {};

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
    return this.provider.watch(namespacedKey, callback);
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
 * Now supports ALL namespaces including agent event namespaces
 */
export type NamespaceData<K extends keyof NamespaceDataTypes> =
  NamespaceDataTypes[K];

/**
 * Helper type for namespace keys
 */
export type NamespaceKey = keyof NamespaceDataTypes;
