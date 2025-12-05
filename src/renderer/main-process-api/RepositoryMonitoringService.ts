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
} from '../../shared/main-process-api-interfaces/RepositoryMonitoringAPI';

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
   * Enable git watching for a repository
   */
  static async enableGitWatching(
    repoPath: string,
  ): Promise<RepositoryMonitoringResult> {
    try {
      return await window.mainProcess.repositoryMonitoring.enableGitWatching(
        repoPath,
      );
    } catch (error) {
      console.error(
        '[RepositoryMonitoring] Error enabling git watching:',
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Disable git watching for a repository
   */
  static async disableGitWatching(
    repoPath: string,
  ): Promise<RepositoryMonitoringResult> {
    try {
      return await window.mainProcess.repositoryMonitoring.disableGitWatching(
        repoPath,
      );
    } catch (error) {
      console.error(
        '[RepositoryMonitoring] Error disabling git watching:',
        error,
      );
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
  static onGitStatusChanged(callback: (status: GitStatus) => void): () => void {
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
      payload: import('../../shared/main-process-api-interfaces/RepositoryMonitoringAPI').BuildArtifactsDetectedPayload,
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
}
