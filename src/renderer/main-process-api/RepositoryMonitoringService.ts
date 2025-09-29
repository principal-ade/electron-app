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
  ToolExecutionRequest,
  ToolExecutionResponse,
  PackageSummary
} from '../../shared/main-process-api-interfaces/RepositoryMonitoringAPI';

export class RepositoryMonitoringService {
  /**
   * Get FileTree for a repository
   */
  static async getFileTree(repoPath: string): Promise<FileTree | null> {
    try {
      return await window.mainProcess.repositoryMonitoring.getFileTree(repoPath);
    } catch (error) {
      console.error('[RepositoryMonitoring] Error getting file tree:', error);
      return null;
    }
  }

  /**
   * Get packages from a repository
   */
  static async getPackages(repoPath: string): Promise<{ packages: PackageLayer[]; summary: PackageSummary } | null> {
    try {
      return await window.mainProcess.repositoryMonitoring.getPackages(repoPath);
    } catch (error) {
      console.error('[RepositoryMonitoring] Error getting packages:', error);
      return null;
    }
  }

  /**
   * Register a repository for monitoring
   */
  static async registerRepository(repoPath: string): Promise<RepositoryMonitoringResult> {
    try {
      return await window.mainProcess.repositoryMonitoring.registerRepository(repoPath);
    } catch (error) {
      console.error('[RepositoryMonitoring] Error registering repository:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Unregister a repository from monitoring
   */
  static async unregisterRepository(repoPath: string): Promise<RepositoryMonitoringResult> {
    try {
      return await window.mainProcess.repositoryMonitoring.unregisterRepository(repoPath);
    } catch (error) {
      console.error('[RepositoryMonitoring] Error unregistering repository:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Refresh repository data (clear cache and rebuild)
   */
  static async refreshRepository(repoPath: string): Promise<RepositoryMonitoringResult> {
    try {
      return await window.mainProcess.repositoryMonitoring.refreshRepository(repoPath);
    } catch (error) {
      console.error('[RepositoryMonitoring] Error refreshing repository:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get monitoring status including resource usage
   */
  static async getMonitoringStatus(): Promise<MonitoringStatus> {
    try {
      return await window.mainProcess.repositoryMonitoring.getMonitoringStatus();
    } catch (error) {
      console.error('[RepositoryMonitoring] Error getting monitoring status:', error);
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
      return await window.mainProcess.repositoryMonitoring.getGitStatus(repoPath);
    } catch (error) {
      console.error('[RepositoryMonitoring] Error getting git status:', error);
      return null;
    }
  }

  /**
   * Get git status with file lists for a repository
   */
  static async getGitStatusWithFiles(repoPath: string): Promise<GitStatusWithFiles | null> {
    try {
      return await window.mainProcess.repositoryMonitoring.getGitStatusWithFiles(repoPath);
    } catch (error) {
      console.error('[RepositoryMonitoring] Error getting git status with files:', error);
      return null;
    }
  }

  /**
   * Enable git watching for a repository
   */
  static async enableGitWatching(repoPath: string): Promise<RepositoryMonitoringResult> {
    try {
      return await window.mainProcess.repositoryMonitoring.enableGitWatching(repoPath);
    } catch (error) {
      console.error('[RepositoryMonitoring] Error enabling git watching:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Disable git watching for a repository
   */
  static async disableGitWatching(repoPath: string): Promise<RepositoryMonitoringResult> {
    try {
      return await window.mainProcess.repositoryMonitoring.disableGitWatching(repoPath);
    } catch (error) {
      console.error('[RepositoryMonitoring] Error disabling git watching:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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
   * Execute a tool using quality lenses
   */
  static async executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResponse | null> {
    try {
      return await window.mainProcess.repositoryMonitoring.executeTool(request);
    } catch (error) {
      console.error('[RepositoryMonitoring] Error executing tool:', error);
      return null;
    }
  }
}