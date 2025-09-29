/**
 * Repository Monitoring API - IPC events and interfaces
 */

import type { FileTree } from '@principal-ai/repository-abstraction';
import type { PackageLayer } from '@principal-ai/codebase-composition';
import type { GitState } from '@principal-ai/repository-monitoring';
// Tool execution types (moved from main/quality-lenses/QualityLensService.ts)
export interface ToolExecutionRequest {
  repoPath: string;
  packagePath?: string;
  toolName: string;
  command: string;
  args?: string[];
}

export interface ToolExecutionResponse {
  success: boolean;
  toolName: string;
  command: string;
  packagePath?: string;
  exitCode: number;
  duration: number;
  stdout: string;
  stderr: string;
  lensResult?: unknown;
  error?: string;
}

// Package summary interface
export interface PackageSummary {
  isMonorepo: boolean;
  rootPackageName?: string;
  totalPackages: number;
  workspacePackages: Array<{ name?: string; path: string }>;
  totalDependencies: number;
  totalDevDependencies: number;
  availableScripts: string[];
}

export enum RepositoryMonitoringAPIEvent {
  GET_FILE_TREE = 'repository-monitoring:get-file-tree',
  REGISTER = 'repository-monitoring:register',
  UNREGISTER = 'repository-monitoring:unregister',
  REFRESH = 'repository-monitoring:refresh',
  GET_METRICS = 'repository-monitoring:get-metrics',
  GET_PACKAGES = 'repository-monitoring:get-packages',
  METRICS_UPDATED = 'repository-monitoring:metrics-updated',
  GET_MONITORING_STATUS = 'repository-monitoring:get-status',
  START_MONITORING = 'repository-monitoring:start',
  STOP_MONITORING = 'repository-monitoring:stop',
  GET_GIT_STATUS = 'repository-monitoring:get-git-status',
  GET_GIT_STATUS_WITH_FILES = 'repository-monitoring:get-git-status-with-files',
  ENABLE_GIT_WATCHING = 'repository-monitoring:enable-git-watching',
  DISABLE_GIT_WATCHING = 'repository-monitoring:disable-git-watching',
  GIT_STATUS_CHANGED = 'repository-monitoring:git-status-changed',
  GIT_STATE_EVENT = 'repository-monitoring:git-state-event',
  WORKSPACE_CHANGED = 'repository-monitoring:workspace-change',
  EXECUTE_TOOL = 'repository-monitoring:execute-tool',
}

export interface RepositoryMonitoringResult {
  success: boolean;
  error?: string;
}

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

export interface ResourceSnapshot {
  timestamp: number;
  memory: number;  // RSS in bytes
  cpu: number;     // Percentage 0-100
}

export interface RepositoryInfo {
  path: string;
  gitWatchingEnabled: boolean;
  fsMonitorEnabled: boolean;
  watchingMode: 'minimal' | 'fallback' | 'none';
}

export interface WorkspaceChangeEventPayload {
  repoPath: string;
  state?: GitState;
}

export interface MonitoringStatus {
  repositories: RepositoryInfo[];  // List of registered repositories with details
  currentMemory: number;   // Current RSS in bytes
  currentCpu: number;      // Current CPU percentage
  history: ResourceSnapshot[];  // Last 30 snapshots (1 minute of data)
}

export interface RepositoryMonitoringAPI {
  getFileTree(repoPath: string): Promise<FileTree | null>;
  getPackages(repoPath: string): Promise<{ packages: PackageLayer[]; summary: PackageSummary } | null>;
  registerRepository(repoPath: string): Promise<RepositoryMonitoringResult>;
  unregisterRepository(repoPath: string): Promise<RepositoryMonitoringResult>;
  refreshRepository(repoPath: string): Promise<RepositoryMonitoringResult>;
  getMonitoringStatus(): Promise<MonitoringStatus>;
  startMonitoring(): Promise<void>;
  stopMonitoring(): Promise<void>;
  getGitStatus(repoPath: string): Promise<GitStatusMetadata | null>;
  getGitStatusWithFiles(repoPath: string): Promise<GitStatusWithFiles | null>;
  enableGitWatching(repoPath: string): Promise<RepositoryMonitoringResult>;
  disableGitWatching(repoPath: string): Promise<RepositoryMonitoringResult>;
  onGitStatusChanged(callback: (status: GitStatusMetadata) => void): () => void;
  onWorkspaceChange(callback: (event: WorkspaceChangeEventPayload) => void): () => void;
  executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResponse>;
}