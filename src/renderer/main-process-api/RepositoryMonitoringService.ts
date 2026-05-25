/**
 * Repository Monitoring Service - Renderer process API
 * Communicates with the main process Repository Monitoring Server
 * Uses preload API to access IPC methods safely without direct electron imports
 */

import type { FileTree } from '@principal-ai/repository-abstraction';
import type { PackageLayer } from '@principal-ai/codebase-composition';
import type {
  RepositoryMonitoringResult,
  MonitoringStatus,
  GitStatus,
  GitStatusWithFiles,
  GitRemoteInfo,
  ToolExecutionRequest,
  ToolExecutionResponse,
  PackageSummary,
  RepositoryCacheSnapshot,
  RepositoryCacheSyncEvent,
  WorkspaceChangeEventPayload,
  ServerDiagnostics,
  LifecycleEvent,
  LogTailRequest,
  LogTailResponse,
} from '@principal-ai/repository-monitoring-server';

export class RepositoryMonitoringService {
  /**
   * Get FileTree for a repository
   */
  static async getFileTree(repoPath: string): Promise<FileTree | null> {
    try {
      return await window.mainProcess.repositoryMonitoring.getFileTree(
        repoPath,
      );
    } catch (error) {
      console.error('[RepositoryMonitoring] Error getting file tree:', error);
      return null;
    }
  }

  /**
   * Get packages from a repository
   */
  static async getPackages(
    repoPath: string,
  ): Promise<{ packages: PackageLayer[]; summary: PackageSummary } | null> {
    try {
      return await window.mainProcess.repositoryMonitoring.getPackages(
        repoPath,
      );
    } catch (error) {
      console.error('[RepositoryMonitoring] Error getting packages:', error);
      return null;
    }
  }

  /**
   * Get the registry-backed cache snapshot for a repository
   */
  static async getRepositoryCacheSnapshot(
    repoPath: string,
  ): Promise<RepositoryCacheSnapshot> {
    try {
      return await window.mainProcess.repositoryMonitoring.getRepositoryCacheSnapshot(
        repoPath,
      );
    } catch (error) {
      console.error(
        '[RepositoryMonitoring] Error getting cache snapshot:',
        error,
      );
      return { repoPath, slices: {} };
    }
  }

  /**
   * Register a repository for monitoring
   */
  static async registerRepository(
    repoPath: string,
  ): Promise<RepositoryMonitoringResult> {
    try {
      return await window.mainProcess.repositoryMonitoring.registerRepository(
        repoPath,
      );
    } catch (error) {
      console.error(
        '[RepositoryMonitoring] Error registering repository:',
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Unregister a repository from monitoring
   */
  static async unregisterRepository(
    repoPath: string,
  ): Promise<RepositoryMonitoringResult> {
    try {
      return await window.mainProcess.repositoryMonitoring.unregisterRepository(
        repoPath,
      );
    } catch (error) {
      console.error(
        '[RepositoryMonitoring] Error unregistering repository:',
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Refresh repository data (clear cache and rebuild)
   */
  static async refreshRepository(
    repoPath: string,
  ): Promise<RepositoryMonitoringResult> {
    try {
      return await window.mainProcess.repositoryMonitoring.refreshRepository(
        repoPath,
      );
    } catch (error) {
      console.error(
        '[RepositoryMonitoring] Error refreshing repository:',
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get monitoring status including resource usage
   */
  static async getMonitoringStatus(): Promise<MonitoringStatus> {
    try {
      return await window.mainProcess.repositoryMonitoring.getMonitoringStatus();
    } catch (error) {
      console.error(
        '[RepositoryMonitoring] Error getting monitoring status:',
        error,
      );
      // Return empty status on error
      return {
        repositories: [],
        currentMemory: 0,
        currentCpu: 0,
        history: [],
      };
    }
  }

  /**
   * Get server status (running state)
   */
  static async getServerStatus(): Promise<{
    running: boolean;
    ready: boolean;
    restartAttempts: number;
  }> {
    try {
      return await window.mainProcess.repositoryMonitoring.getServerStatus();
    } catch (error) {
      console.error(
        '[RepositoryMonitoring] Error getting server status:',
        error,
      );
      // Return stopped status on error
      return {
        running: false,
        ready: false,
        restartAttempts: 0,
      };
    }
  }

  /**
   * Start the monitoring process
   */
  static async startMonitoring(): Promise<void> {
    try {
      await window.mainProcess.repositoryMonitoring.startMonitoring();
    } catch (error) {
      console.error('[RepositoryMonitoring] Error starting monitoring:', error);
      throw error;
    }
  }

  /**
   * Stop the monitoring process
   */
  static async stopMonitoring(): Promise<void> {
    try {
      await window.mainProcess.repositoryMonitoring.stopMonitoring();
    } catch (error) {
      console.error('[RepositoryMonitoring] Error stopping monitoring:', error);
      throw error;
    }
  }

  /**
   * Get git status for a repository
   */
  static async getGitStatus(repoPath: string): Promise<GitStatus | null> {
    try {
      return await window.mainProcess.repositoryMonitoring.getGitStatus(
        repoPath,
      );
    } catch (error) {
      console.error('[RepositoryMonitoring] Error getting git status:', error);
      return null;
    }
  }

  /**
   * Get git status with file lists for a repository
   */
  static async getGitStatusWithFiles(
    repoPath: string,
  ): Promise<GitStatusWithFiles | null> {
    try {
      return await window.mainProcess.repositoryMonitoring.getGitStatusWithFiles(
        repoPath,
      );
    } catch (error) {
      console.error(
        '[RepositoryMonitoring] Error getting git status with files:',
        error,
      );
      return null;
    }
  }

  /**
   * Acquire a watch reference for a repository.
   * Starts watching if this is the first reference.
   * @param repoPath - Path to the repository
   * @param referenceId - Unique identifier for this watch reference (e.g., workspace ID)
   */
  static async acquireWatch(
    repoPath: string,
    referenceId: string,
  ): Promise<RepositoryMonitoringResult> {
    try {
      return await window.mainProcess.repositoryMonitoring.acquireWatch(
        repoPath,
        referenceId,
      );
    } catch (error) {
      console.error('[RepositoryMonitoring] Error acquiring watch:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Release a watch reference for a repository.
   * Stops watching if this was the last reference.
   * @param repoPath - Path to the repository
   * @param referenceId - Unique identifier for the watch reference to release
   */
  static async releaseWatch(
    repoPath: string,
    referenceId: string,
  ): Promise<RepositoryMonitoringResult> {
    try {
      return await window.mainProcess.repositoryMonitoring.releaseWatch(
        repoPath,
        referenceId,
      );
    } catch (error) {
      console.error('[RepositoryMonitoring] Error releasing watch:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get git remote info for a repository
   */
  static async getGitRemoteInfo(
    repoPath: string,
  ): Promise<GitRemoteInfo | null> {
    try {
      return await window.mainProcess.repositoryMonitoring.getGitRemoteInfo(
        repoPath,
      );
    } catch (error) {
      console.error(
        '[RepositoryMonitoring] Error getting git remote info:',
        error,
      );
      return null;
    }
  }

  /**
   * Invalidate git remote cache for a repository
   */
  static async invalidateGitRemoteCache(
    repoPath: string,
  ): Promise<RepositoryMonitoringResult> {
    try {
      return await window.mainProcess.repositoryMonitoring.invalidateGitRemoteCache(
        repoPath,
      );
    } catch (error) {
      console.error(
        '[RepositoryMonitoring] Error invalidating git remote cache:',
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Subscribe to git status changes
   * @param callback Function to call when git status changes
   * @returns Cleanup function to unsubscribe
   */
  static onGitStatusChanged(
    callback: (status: GitStatusWithFiles) => void,
  ): () => void {
    return window.mainProcess.repositoryMonitoring.onGitStatusChanged(callback);
  }

  /**
   * Subscribe to workspace file changes
   * @param callback Function to call when workspace files change
   * @returns Cleanup function to unsubscribe
   */
  static onWorkspaceChange(
    callback: (event: WorkspaceChangeEventPayload) => void,
  ): () => void {
    return window.mainProcess.repositoryMonitoring.onWorkspaceChange(callback);
  }

  /**
   * Subscribe to cache synchronization events emitted by the worker
   */
  static onCacheSync(
    callback: (event: RepositoryCacheSyncEvent) => void,
  ): () => void {
    return window.mainProcess.repositoryMonitoring.onCacheSync(callback);
  }

  /**
   * Subscribe to build artifacts detected events
   */
  static onBuildArtifactsDetected(
    callback: (
      payload: import('@principal-ai/repository-monitoring-server').BuildArtifactsDetectedPayload,
    ) => void,
  ): () => void {
    return window.mainProcess.repositoryMonitoring.onBuildArtifactsDetected(
      callback,
    );
  }

  /**
   * Run quality enrichment for a repository (on-demand only)
   * This will run all quality lenses and update the package metrics
   */
  static async runQualityEnrichment(
    repoPath: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      return await window.mainProcess.repositoryMonitoring.runQualityEnrichment(
        repoPath,
      );
    } catch (error) {
      console.error(
        '[RepositoryMonitoring] Error running quality enrichment:',
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute a tool using quality lenses
   */
  static async executeTool(
    request: ToolExecutionRequest,
  ): Promise<ToolExecutionResponse | null> {
    try {
      return await window.mainProcess.repositoryMonitoring.executeTool(request);
    } catch (error) {
      console.error('[RepositoryMonitoring] Error executing tool:', error);
      return null;
    }
  }

  /**
   * Get a rich diagnostic snapshot of the monitoring worker:
   * current phase, PID, restart attempts, last error, last exit,
   * recent lifecycle history, and tail of worker stdout/stderr.
   */
  static async getDiagnostics(): Promise<ServerDiagnostics> {
    try {
      return await window.mainProcess.repositoryMonitoring.getDiagnostics();
    } catch (error) {
      console.error(
        '[RepositoryMonitoring] Error getting diagnostics:',
        error,
      );
      return {
        phase: 'idle',
        running: false,
        ready: false,
        workerPid: null,
        startedAt: null,
        lastReadyAt: null,
        phaseEnteredAt: Date.now(),
        restartAttempts: 0,
        maxRestartAttempts: 0,
        shutdownRequested: false,
        lastError: {
          message: error instanceof Error ? error.message : String(error),
        },
        lastExit: null,
        watcherImpl: null,
        requestedWatcherImpl: 'parcel',
        lifecycleHistory: [],
        stdoutTail: [],
        stderrTail: [],
      };
    }
  }

  /**
   * Read the tail of the main + worker log files.
   */
  static async getLogTail(
    request?: LogTailRequest,
  ): Promise<LogTailResponse> {
    try {
      return await window.mainProcess.repositoryMonitoring.getLogTail(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[RepositoryMonitoring] Error reading log tail:', error);
      return {
        mainLog: { path: '', content: '', error: message },
        workerLog: { path: '', content: '', error: message },
      };
    }
  }

  /**
   * Subscribe to worker lifecycle transitions (spawning, ready, running,
   * stopping, stopped, crashed, restarting, fatal).
   */
  static onLifecycleEvent(
    callback: (event: LifecycleEvent) => void,
  ): () => void {
    return window.mainProcess.repositoryMonitoring.onLifecycleEvent(callback);
  }

  /**
   * Switch the monitoring worker's filesystem watcher implementation.
   * Persists the choice and triggers a worker restart.
   */
  static async setWatcherImpl(
    impl: 'parcel' | 'chokidar',
  ): Promise<{ success: boolean; changed?: boolean; error?: string }> {
    try {
      return await window.mainProcess.repositoryMonitoring.setWatcherImpl(impl);
    } catch (error) {
      console.error(
        '[RepositoryMonitoring] Error setting watcher impl:',
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Manually trigger workspace sync to otel-events-manager
   * This pushes the current FileTree state to the events manager for trace matching
   */
  static async syncWorkspace(
    repoPath: string,
  ): Promise<{ success: boolean; registeredScopes?: string[]; error?: string }> {
    try {
      return await window.mainProcess.repositoryMonitoring.syncWorkspace(
        repoPath,
      );
    } catch (error) {
      console.error(
        '[RepositoryMonitoring] Error syncing workspace:',
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
