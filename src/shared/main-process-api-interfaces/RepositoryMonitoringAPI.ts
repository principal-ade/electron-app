/**
 * Repository Monitoring API - IPC events and interfaces
 */

import type { FileTree } from '@principal-ai/repository-abstraction';
import type {
  PackageLayer,
  PackageCommand,
} from '@principal-ai/codebase-composition';
import type { GitState } from '@principal-ai/repository-monitoring';

// Tool execution types (moved from main/quality-lenses/QualityLensService.ts)
export interface ToolExecutionRequest {
  repoPath: string;
  packageLayer: PackageLayer;
  packageCommand: PackageCommand;
}

export interface QualityContext {
  lensId?: string;
  operation?: string;
  availableLenses?: string[];
  missingLenses?: string[];
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

  // NEW: Quality metrics context
  qualityContext?: QualityContext;
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

export type CacheSlice = 'gitStatus' | 'fileTree' | 'packages' | 'gitRemote';

export interface CacheError {
  message: string;
  name?: string;
  stack?: string;
  code?: string | number;
}

export interface CacheEntry<T> {
  data?: T;
  version: number;
  hash?: string;
  timestamp: number;
  error?: CacheError;
}

export interface PackagesData {
  packages: PackageLayer[];
  summary: PackageSummary;
}

export interface GitRemoteInfo {
  remoteUrl: string;
  defaultBranch?: string;
  remoteBranches: string[];
  accessible: boolean;
  authMethods?: {
    ssh: boolean;
    https: boolean;
  };
  upstreamStatus?: {
    ahead: number;
    behind: number;
    upToDate: boolean;
  };
  lastFetched?: number;
  fetchError?: string;
}

export interface CacheSliceDataMap {
  gitStatus: GitStatusWithFiles;
  fileTree: FileTree;
  packages: PackagesData;
  gitRemote: GitRemoteInfo;
}

export type RepositoryCacheSlices = {
  [K in CacheSlice]?: CacheEntry<CacheSliceDataMap[K]>;
};

export interface RepositoryCacheSnapshot {
  repoPath: string;
  slices: RepositoryCacheSlices;
}

export interface RepositoryCacheSyncEvent<K extends CacheSlice = CacheSlice> {
  repoPath: string;
  slice: K;
  entry: CacheEntry<CacheSliceDataMap[K]>;
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
  GET_SERVER_STATUS = 'repository-monitoring:get-server-status',
  START_MONITORING = 'repository-monitoring:start',
  STOP_MONITORING = 'repository-monitoring:stop',
  GET_GIT_STATUS = 'repository-monitoring:get-git-status',
  GET_GIT_STATUS_WITH_FILES = 'repository-monitoring:get-git-status-with-files',
  ENABLE_GIT_WATCHING = 'repository-monitoring:enable-git-watching',
  DISABLE_GIT_WATCHING = 'repository-monitoring:disable-git-watching',
  GIT_STATUS_CHANGED = 'repository-monitoring:git-status-changed',
  GIT_STATE_EVENT = 'repository-monitoring:git-state-event',
  WORKSPACE_CHANGED = 'repository-monitoring:workspace-change',
  CACHE_SYNC = 'repository-monitoring:cache-sync',
  EXECUTE_TOOL = 'repository-monitoring:execute-tool',
  GET_CACHE_SNAPSHOT = 'repository-monitoring:get-cache-snapshot',
  GET_GIT_REMOTE_INFO = 'repository-monitoring:get-git-remote-info',
  INVALIDATE_GIT_REMOTE_CACHE = 'repository-monitoring:invalidate-git-remote-cache',
  BUILD_ARTIFACTS_DETECTED = 'repository-monitoring:build-artifacts-detected',
  RUN_QUALITY_ENRICHMENT = 'repository-monitoring:run-quality-enrichment',
}

export interface RepositoryMonitoringResult {
  success: boolean;
  error?: string;
}

export type FileChangeType = 'add' | 'change' | 'unlink';

export interface FileChange {
  type: FileChangeType;
  path: string;
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

export type GitStatus = GitStatusMetadata;

export interface ResourceSnapshot {
  timestamp: number;
  memory: number; // RSS in bytes
  cpu: number; // Percentage 0-100
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
  changes?: FileChange[];
}

export interface BuildArtifactsDetectedPayload {
  repoPath: string;
  artifacts: string[];
  timestamp: number;
}

export interface MonitoringStatus {
  repositories: RepositoryInfo[]; // List of registered repositories with details
  currentMemory: number; // Current RSS in bytes
  currentCpu: number; // Current CPU percentage
  history: ResourceSnapshot[]; // Last 30 snapshots (1 minute of data)
}

export interface ServerStatus {
  running: boolean;
  ready: boolean;
  restartAttempts: number;
}

export interface RepositoryMonitoringAPI {
  getFileTree(repoPath: string): Promise<FileTree | null>;
  getPackages(
    repoPath: string,
  ): Promise<{ packages: PackageLayer[]; summary: PackageSummary } | null>;
  getRepositoryCacheSnapshot(
    repoPath: string,
  ): Promise<RepositoryCacheSnapshot>;
  registerRepository(repoPath: string): Promise<RepositoryMonitoringResult>;
  unregisterRepository(repoPath: string): Promise<RepositoryMonitoringResult>;
  refreshRepository(repoPath: string): Promise<RepositoryMonitoringResult>;
  getMonitoringStatus(): Promise<MonitoringStatus>;
  getServerStatus(): Promise<ServerStatus>;
  startMonitoring(): Promise<void>;
  stopMonitoring(): Promise<void>;
  getGitStatus(repoPath: string): Promise<GitStatusMetadata | null>;
  getGitStatusWithFiles(repoPath: string): Promise<GitStatusWithFiles | null>;
  enableGitWatching(repoPath: string): Promise<RepositoryMonitoringResult>;
  disableGitWatching(repoPath: string): Promise<RepositoryMonitoringResult>;
  onGitStatusChanged(callback: (status: GitStatusMetadata) => void): () => void;
  onWorkspaceChange(
    callback: (event: WorkspaceChangeEventPayload) => void,
  ): () => void;
  onCacheSync(callback: (event: RepositoryCacheSyncEvent) => void): () => void;
  onBuildArtifactsDetected(
    callback: (payload: BuildArtifactsDetectedPayload) => void,
  ): () => void;
  runQualityEnrichment(
    repoPath: string,
  ): Promise<{ success: boolean; error?: string }>;
  executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResponse>;
  getGitRemoteInfo(repoPath: string): Promise<GitRemoteInfo | null>;
  invalidateGitRemoteCache(
    repoPath: string,
  ): Promise<RepositoryMonitoringResult>;
}
