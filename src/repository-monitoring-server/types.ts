/**
 * Type definitions for Repository Monitoring Server
 */

import type { FileTree } from '@principal-ai/repository-abstraction';
import type { QualityMetrics, PackageLayer } from '@principal-ai/codebase-composition';
import type { LensResult } from '@principal-ai/codebase-quality-lenses';
import type { GitState } from '@principal-ai/repository-monitoring';
import type { PackageSummary, ToolExecutionRequest, ToolExecutionResponse } from '../shared/main-process-api-interfaces/RepositoryMonitoringAPI';

// Re-export PackageSummary from shared types
export type { PackageSummary } from '../shared/main-process-api-interfaces/RepositoryMonitoringAPI';

/**
 * Internal event names for communication between server and main process
 */
export enum MonitoringInternalEvent {
  METRICS_UPDATED = 'metrics-updated',
  GIT_STATUS_CHANGED = 'git-status-changed',
  GIT_STATE_EVENT = 'git-state-event',
  WORKSPACE_CHANGED = 'workspace-change',
}

/**
 * Repository state tracking
 */
export interface RepositoryState {
  path: string;
  lastUpdated: Date;
  isWatching: boolean;
  fileTree?: FileTree;
  metrics?: RepositoryMetrics;
  gitWatchingEnabled?: boolean;
  lastGitStatus?: GitStatusMetadata;
  gitPollInterval?: NodeJS.Timeout;
  fsMonitorEnabled?: boolean;
  watchingMode?: 'minimal' | 'fallback' | 'none';
  lastLocalChange?: string;
}


/**
 * Tool results - stores LensResult for each tool
 * Maps tool name to its lens execution result
 */
export interface ToolResults {
  tests?: LensResult;
  linting?: LensResult;
  types?: LensResult;
  formatting?: LensResult;
  [toolName: string]: LensResult | undefined; // Allow additional tools
}

/**
 * Quality suggestion priority
 */
export type SuggestionPriority = 'high' | 'medium' | 'low';

/**
 * Quality suggestion
 */
export interface QualitySuggestion {
  message: string;
  priority: SuggestionPriority;
  category: keyof QualityMetrics;
}

/**
 * Package with quality metrics
 * Extends PackageLayer with additional monitoring data
 */
export interface PackageWithMetrics {
  packageLayer: PackageLayer;
  metrics: QualityMetrics;
  availableTools: string[];
  toolResults: ToolResults;
  suggestions: QualitySuggestion[];
}

/**
 * Repository-level metrics
 */
export interface RepositoryMetrics {
  packages: PackageWithMetrics[];
  summary?: PackageSummary;
}

/**
 * Extended quality metrics (for UI compatibility)
 */
export interface ExtendedQualityMetrics extends RepositoryMetrics {
  timestamp: Date;
  repositoryPath: string;
}

/**
 * Cached FileTree entry
 */
export interface CachedFileTree {
  tree: FileTree;
  timestamp: number;
  sha: string;
}

/**
 * Cached metrics entry
 */
export interface CachedMetrics {
  metrics: RepositoryMetrics;
  timestamp: number;
}

/**
 * File change type
 */
export type FileChangeType = 'add' | 'change' | 'unlink';

/**
 * File change event
 */
export interface FileChange {
  type: FileChangeType;
  path: string;
}

/**
 * Git information for FileTree building
 */
export interface GitInfo {
  currentCommit: string;
  branch: string;
  isDirty: boolean;
}

/**
 * Git status metadata information (existing status snapshots)
 */
export interface GitStatusMetadata {
  repoPath: string;
  branch: string;
  isDirty: boolean;
  hasUntracked: boolean;
  hasStaged: boolean;
  ahead: number;
  behind: number;
  watchingEnabled: boolean;
  lastChangedAt?: string;
}

export interface GitStatusWithFiles extends GitStatusMetadata {
  modifiedFiles: string[];
  untrackedFiles: string[];
  stagedFiles: string[];
  createdFiles: string[];
  deletedFiles: string[];
}

/**
 * Git state event types from the library
 */
export type GitStateEventType = 'commit' | 'branch-switch' | 'merge' | 'dirty-state-change';

/**
 * Git state event - represents a git state transition
 * This is different from GitStatusMetadata which is a snapshot
 */
export interface GitStateEvent {
  type: GitStateEventType;
  repoPath: string;
  branch: string;
  fullSha: string;
  shortSha: string;
  isDirty: boolean;
  timestamp: number;
  previousBranch?: string; // For branch-switch events
  previousSha?: string; // For commit events
  mergeBase?: string; // For merge events
}

/**
 * Git state event payload passed through the system
 */
export interface GitStateEventPayload {
  event: GitStateEvent;
  affectedCacheFields: string[]; // Which cache fields should be updated
}

export interface WorkspaceChangeEventPayload {
  repoPath: string;
  state?: GitState;
}

/**
 * Tool execution result
 */

/**
 * Message types that can be sent from main to server
 */
export type MainToServerMessageType =
  | 'getFileTree'
  | 'getMetrics'
  | 'getPackages'
  | 'refresh'
  | 'register'
  | 'unregister'
  | 'getRegisteredPaths'
  | 'getRepositoryDetails'
  | 'getResourceMetrics'
  | 'getGitStatus'
  | 'getGitStatusWithFiles'
  | 'enableGitWatching'
  | 'disableGitWatching'
  | 'resolveDependency';

/**
 * Message types that can be sent from server to main
 */
export type ServerToMainMessageType =
  | 'ready'
  | 'response'
  | 'error'
  | 'event';

/**
 * Dependency resolution request
 */
export interface DependencyResolutionRequest {
  dependencyId: string;
  repositoryRoot?: string;
}

/**
 * Dependency resolution result
 */
export interface DependencyResolutionResult {
  dependencyId: string;
  found: boolean;
  alexandriaEntry?: {
    name: string;
    path: string;
    description?: string;
    remoteUrl?: string;
    lastCommit?: string;
    lastCommitMessage?: string;
    lastCommitAuthor?: string;
    lastCommitHash?: string;
  };
  packageInfo?: {
    name: string;
    version?: string;
    packagePath: string;
    isDevDependency: boolean;
  };
  suggestions?: {
    installCommands: string[];
    targetPackage?: string;
    packageManager?: string;
  };
}

/**
 * IPC Message Types - Main to Server
 */
export interface MainToServerMessage {
  id: string;
  type: MainToServerMessageType;
  path?: string;
  dependencyRequest?: DependencyResolutionRequest;
}

/**
 * IPC Message Types - Server to Main
 */
export interface ServerToMainMessage {
  type: ServerToMainMessageType;
  id?: string;
  result?: unknown;
  error?: string;
  event?: {
    name: string;
    data: unknown;
  };
}

export type { ToolExecutionRequest, ToolExecutionResponse };