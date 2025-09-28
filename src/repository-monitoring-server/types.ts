/**
 * Type definitions for Repository Monitoring Server
 */

import type { FileTree } from '@principal-ai/repository-abstraction';
import type { QualityMetrics, PackageLayer } from '@principal-ai/codebase-composition';
import type { LensResult } from '@principal-ai/codebase-quality-lenses';

/**
 * Internal event names for communication between server and main process
 */
export enum MonitoringInternalEvent {
  METRICS_UPDATED = 'metrics-updated',
  GIT_STATUS_CHANGED = 'git-status-changed',
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
  lastGitStatus?: GitStatus;
  gitPollInterval?: NodeJS.Timeout;
  fsMonitorEnabled?: boolean;
  watchingMode?: 'minimal' | 'fallback' | 'none';
}

/**
 * Summary of all packages in repository
 */
export interface PackageSummary {
  isMonorepo: boolean;
  rootPackageName?: string;
  totalPackages: number;
  workspacePackages: Array<{ name?: string; path: string }>;
  totalDependencies: number;
  totalDevDependencies: number;
  availableScripts: string[];
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
 * Git status information
 */
export interface GitStatus {
  repoPath: string;
  branch: string;
  isDirty: boolean;
  hasUntracked: boolean;
  hasStaged: boolean;
  ahead: number;
  behind: number;
  watchingEnabled: boolean;
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
  | 'runTool';

/**
 * Message types that can be sent from server to main
 */
export type ServerToMainMessageType =
  | 'ready'
  | 'response'
  | 'error'
  | 'event';

/**
 * IPC Message Types - Main to Server
 */
export interface MainToServerMessage {
  id: string;
  type: MainToServerMessageType;
  path?: string;
  // For runTool command
  packagePath?: string;
  command?: string;
  toolName?: string;
}

/**
 * IPC Message Types - Server to Main
 */
export interface ServerToMainMessage {
  type: ServerToMainMessageType;
  id?: string;
  result?: any;
  error?: string;
  event?: {
    name: string;
    data: any;
  };
}