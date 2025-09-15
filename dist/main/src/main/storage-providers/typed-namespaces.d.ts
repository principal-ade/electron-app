import { NormalizedAgentSessionEvent, SupportedAgent } from "@principal-ai/agent-monitoring";
import { Repository } from '../../shared/types/repository.types';
import { LLMConfiguration } from '../../shared/main-process-api-interfaces/LLMModelsAPI';
import { StorageNamespaceConfig, NamespaceCategory } from '../../shared/main-process-api-interfaces/StoreAPI';
import { AgentSessionEvent } from '../../shared/main-process-api-interfaces';
import { UserPreferences } from '../../shared/types/userPreferences.types';
import { AgentSessionRecord } from '../../shared/sessionTypes';
import { SecretMetadata } from '../../shared/main-process-api-interfaces/SecretsAPI';
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
    archivePath?: string;
}
export interface ArchiveConfiguration {
    autoArchive: {
        enabled: boolean;
        inactivityThreshold: number;
        completedSessionDelay: number;
        checkInterval: number;
    };
    storage: {
        maxArchiveAge: number;
        maxSummaryAge: number;
        maxArchiveSize: number;
        compressArchives: boolean;
    };
    sessions: {
        archiveIncompleteSessions: boolean;
        minEventsToArchive: number;
        keepRawEvents: boolean;
        groupByRepository: boolean;
    };
    export: {
        defaultFormat: 'json' | 'csv' | 'markdown';
        includeRawEvents: boolean;
        includeMetrics: boolean;
    };
}
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
    currentSession?: {
        sessionId: string;
        projectPath: string;
        startTime: number;
    };
    metrics: {
        totalAnalyses: number;
        avgExecutionTime: number;
        uptime: number;
        errorCount: number;
    };
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
    status: 'preparing' | 'mounting' | 'running' | 'completed' | 'failed' | 'cancelled';
    startTime: number;
    endTime?: number;
    configSource: 'repository' | 'generated' | 'default';
    configUsed?: any;
    commandExecuted: string;
    output?: {
        stdout: string;
        stderr: string;
        exitCode?: number;
    };
    results?: any;
    error?: string;
    metrics: {
        preparationTime?: number;
        mountTime?: number;
        executionTime?: number;
        totalTime?: number;
        memoryPeak?: number;
        cpuTime?: number;
    };
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
    [AgentEventNamespaces.GEMINI]: string[];
    [AgentEventNamespaces.OPENCODE]: string[];
}
type AgentNamespaceMap = {
    [SupportedAgent.CLAUDE]: AgentEventNamespaces.CLAUDE;
    [SupportedAgent.GEMINI]: AgentEventNamespaces.GEMINI;
    [SupportedAgent.OPENCODE]: AgentEventNamespaces.OPENCODE;
};
export declare function getAgentEventNamespace<T extends SupportedAgent>(agent: T): AgentNamespaceMap[T];
/**
 * Type-safe namespace data type definitions
 * Each namespace has its own strongly-typed data structure
 */
export interface NamespaceDataTypes {
    [StaticNamespaces.USER_PREFERENCES]: UserPreferences;
    [StaticNamespaces.REPOSITORIES]: Repository;
    [StaticNamespaces.AI_CONFIGURATION]: AIConfiguration;
    [StaticNamespaces.LLM_MODELS]: LLMConfiguration;
    [StaticNamespaces.CACHE]: Record<string, any>;
    [StaticNamespaces.TEMP]: Record<string, any>;
    [StaticNamespaces.AGENT_SESSIONS]: ProcessedSessionData;
    [StaticNamespaces.GLOBAL_SESSION_REGISTRY]: GlobalSessionRegistry;
    [StaticNamespaces.SESSION_SUMMARIES]: SessionSummary;
    [StaticNamespaces.ARCHIVE_CONFIGURATION]: ArchiveConfiguration;
    [StaticNamespaces.AGENT_EVENT_INDEXES]: AgentEventIndexes;
    [StaticNamespaces.MCP_BRIDGE_DATA]: any;
    [StaticNamespaces.DOCKER_CONTAINERS]: ToolContainerState;
    [StaticNamespaces.DOCKER_SESSIONS]: DockerAnalysisSession;
    [StaticNamespaces.SECRETS_METADATA]: SecretMetadata;
    [AgentEventNamespaces.CLAUDE]: AgentSessionEvent;
    [AgentEventNamespaces.GEMINI]: AgentSessionEvent;
    [AgentEventNamespaces.OPENCODE]: AgentSessionEvent;
}
/**
 * Processed agent session data
 * Stores session metadata and flat list of events
 */
export interface ProcessedSessionData {
    sessionId: string;
    provider: SupportedAgent;
    workingDirectory: string;
    startTime: number;
    lastUpdateTime: number;
    events: NormalizedAgentSessionEvent[];
    totalEvents: number;
    repositoriesAccessed?: Array<{
        remoteUrl: string;
        gitRoot: string;
    }>;
    counters?: {
        fileAccesses: number;
        fileWrites: number;
        toolCalls: number;
        webAccesses: number;
    };
    fileAccesses?: Record<string, Array<{
        timestamp: number;
        normalizedPath?: string;
        metadata?: any;
    }>>;
    fileWrites?: Record<string, Array<{
        timestamp: number;
        operation: string;
        normalizedPath?: string;
        metadata?: any;
    }>>;
    filesRead?: string[];
    filesWritten?: string[];
    metadata?: Record<string, any>;
    fileContexts?: {
        repositories: string[];
        systemFiles: number;
        configFiles: number;
        tempFiles: number;
        externalFiles: string[];
    };
}
/**
 * Global session registry data
 * Stores global session index and active session tracking across directories
 */
export interface GlobalSessionRegistry {
    sessions: Record<string, AgentSessionRecord>;
    activeSessionsByDirectory: Record<string, string>;
}
/**
 * Type-safe namespace registry
 * Maps namespaces to their configuration and ensures type safety
 */
export declare class TypedNamespaceRegistry {
    private namespaceConfigs;
    constructor();
    private initializeDefaultNamespaces;
    register(namespace: StorageNamespaces, config: StorageNamespaceConfig): void;
    getConfig(namespace: StorageNamespaces): StorageNamespaceConfig | undefined;
    getAllConfigs(): StorageNamespaceConfig[];
    getConfigsByCategory(category: NamespaceCategory): StorageNamespaceConfig[];
}
/**
 * Type-safe storage provider wrapper
 * Provides strongly-typed get/set operations for each namespace
 */
export declare class TypedStorageProvider {
    private provider;
    private registry;
    constructor(provider: StorageProvider, registry: TypedNamespaceRegistry);
    /**
     * Get a value with proper type inference based on namespace
     */
    get<K extends StorageNamespaces>(namespace: K, key: string): Promise<NamespaceDataTypes[K] | undefined>;
    /**
     * Set a value with type checking based on namespace
     */
    set<K extends StorageNamespaces>(namespace: K, key: string, value: NamespaceDataTypes[K]): Promise<void>;
    /**
     * Get all data for a namespace
     */
    getNamespaceData<K extends StorageNamespaces>(namespace: K): Promise<Record<string, NamespaceDataTypes[K]>>;
    /**
     * Delete a key from a namespace
     */
    delete<K extends StorageNamespaces>(namespace: K, key: string): Promise<void>;
    /**
     * Check if a key exists in a namespace
     */
    has<K extends StorageNamespaces>(namespace: K, key: string): Promise<boolean>;
    /**
     * Clear all data in a namespace
     */
    clearNamespace<K extends StorageNamespaces>(namespace: K): Promise<void>;
    /**
     * Watch for changes in a namespace
     */
    watch<K extends StorageNamespaces>(namespace: K, key: string, callback: (newValue: NamespaceDataTypes[K] | undefined, oldValue: NamespaceDataTypes[K] | undefined) => void): (() => void) | undefined;
    private getNamespacedKey;
}
/**
 * Factory function to create a typed storage provider
 */
export declare function createTypedStorageProvider(provider: StorageProvider): TypedStorageProvider;
/**
 * Type guard to check if a string is a valid namespace
 */
export declare function isValidNamespace(namespace: string): namespace is StorageNamespaces;
/**
 * Helper type for namespace-specific operations
 * Now supports ALL namespaces including agent event namespaces
 */
export type NamespaceData<K extends keyof NamespaceDataTypes> = NamespaceDataTypes[K];
/**
 * Helper type for namespace keys
 */
export type NamespaceKey = keyof NamespaceDataTypes;
export {};
//# sourceMappingURL=typed-namespaces.d.ts.map