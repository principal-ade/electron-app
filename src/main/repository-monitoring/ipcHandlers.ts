/**
 * IPC Handlers for Repository Monitoring
 * Updated for separate process architecture
 */

import { ipcMain, BrowserWindow } from 'electron';
import { RepositoryMonitoringManager } from './RepositoryMonitoringManager';
import {
  RepositoryMonitoringAPIEvent,
  GitStatusMetadata,
  type ToolExecutionRequest,
  type WorkspaceChangeEventPayload,
  type RepositoryCacheSyncEvent,
} from '../../shared/main-process-api-interfaces/RepositoryMonitoringAPI';
import { MonitoringInternalEvent } from '../../repository-monitoring-server/types';
import { QualityLensService } from '../quality-lenses/QualityLensService';

// Type alias for git state event payload (structure defined in repository-monitoring-server)
type GitStateEventPayload = { event: { type: string }; [key: string]: unknown };

// Create singleton manager instance
let repositoryMonitoringManager: RepositoryMonitoringManager | null = null;

/**
 * Get or create the repository monitoring manager instance
 */
export function getManager(): RepositoryMonitoringManager {
  if (!repositoryMonitoringManager) {
    repositoryMonitoringManager = new RepositoryMonitoringManager({
      autoStart: true,
      restartOnCrash: true,
      maxRestartAttempts: 3,
      logLevel: 'info',
    });
  }
  return repositoryMonitoringManager;
}

/**
 * Register IPC handlers for repository monitoring
 */
export function registerRepositoryMonitoringHandlers(): void {
  console.log('[RepositoryMonitoring] Registering IPC handlers');

  const manager = getManager();
  const qualityLensService = QualityLensService.getInstance();

  // Get FileTree for a repository
  ipcMain.handle(
    RepositoryMonitoringAPIEvent.GET_FILE_TREE,
    async (_event, repoPath: string) => {
      console.log(
        `[RepositoryMonitoring] GET_FILE_TREE request for: ${repoPath}`,
      );
      try {
        const fileTree = await manager.getFileTree(repoPath);
        console.log(
          `[RepositoryMonitoring] GET_FILE_TREE result: ${fileTree ? 'SUCCESS' : 'NULL'}`,
        );
        if (fileTree) {
          console.log(
            `[RepositoryMonitoring] FileTree details: ${fileTree.allFiles?.length || 0} files, SHA: ${fileTree.sha}`,
          );
        }
        return fileTree;
      } catch (error) {
        console.error('[RepositoryMonitoring] Error getting file tree:', error);
        return null;
      }
    },
  );

  // Get packages from a repository
  ipcMain.handle(
    RepositoryMonitoringAPIEvent.GET_PACKAGES,
    async (_event, repoPath: string) => {
      console.log(
        `[RepositoryMonitoring] GET_PACKAGES request for: ${repoPath}`,
      );
      try {
        const result = await manager.getPackages(repoPath);
        console.log(
          `[RepositoryMonitoring] GET_PACKAGES result: ${result ? `${result.packages.length} packages found` : 'NULL'}`,
        );
        return result;
      } catch (error) {
        console.error('[RepositoryMonitoring] Error getting packages:', error);
        return null;
      }
    },
  );

  // Get cache snapshot for a repository
  ipcMain.handle(
    RepositoryMonitoringAPIEvent.GET_CACHE_SNAPSHOT,
    async (_event, repoPath: string) => {
      console.log(
        `[RepositoryMonitoring] GET_CACHE_SNAPSHOT request for: ${repoPath}`,
      );
      try {
        const snapshot = await manager.getRepositoryCacheSnapshot(repoPath);
        return snapshot;
      } catch (error) {
        console.error(
          '[RepositoryMonitoring] Error getting cache snapshot:',
          error,
        );
        return { repoPath, slices: {} };
      }
    },
  );

  // Register a repository for monitoring
  ipcMain.handle(
    RepositoryMonitoringAPIEvent.REGISTER,
    async (_event, repoPath: string) => {
      console.log(`[RepositoryMonitoring] REGISTER request for: ${repoPath}`);
      try {
        await manager.registerRepository(repoPath);
        console.log(`[RepositoryMonitoring] REGISTER success for: ${repoPath}`);
        return { success: true };
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
    },
  );

  // Unregister a repository
  ipcMain.handle(
    RepositoryMonitoringAPIEvent.UNREGISTER,
    async (_event, repoPath: string) => {
      try {
        await manager.unregisterRepository(repoPath);
        return { success: true };
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
    },
  );

  // Refresh repository data
  ipcMain.handle(
    RepositoryMonitoringAPIEvent.REFRESH,
    async (_event, repoPath: string) => {
      try {
        await manager.refreshRepository(repoPath);
        return { success: true };
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
    },
  );

  // Get quality metrics (for Phase 2)
  ipcMain.handle(
    RepositoryMonitoringAPIEvent.GET_METRICS,
    async (_event, repoPath: string) => {
      try {
        const metrics = await manager.getQualityMetrics(repoPath);
        return metrics;
      } catch (error) {
        console.error('[RepositoryMonitoring] Error getting metrics:', error);
        return null;
      }
    },
  );

  // Get Monitoring Status (resource usage)
  ipcMain.handle(
    RepositoryMonitoringAPIEvent.GET_MONITORING_STATUS,
    async () => {
      console.log('[RepositoryMonitoring] GET_MONITORING_STATUS request');
      try {
        const status = await manager.getMonitoringStatus();
        return status;
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
    },
  );

  // Start monitoring
  ipcMain.handle(RepositoryMonitoringAPIEvent.START_MONITORING, async () => {
    console.log('[RepositoryMonitoring] START_MONITORING request');
    try {
      await manager.start();
      return { success: true };
    } catch (error) {
      console.error('[RepositoryMonitoring] Error starting monitoring:', error);
      throw error;
    }
  });

  // Stop monitoring
  ipcMain.handle(RepositoryMonitoringAPIEvent.STOP_MONITORING, async () => {
    console.log('[RepositoryMonitoring] STOP_MONITORING request');
    try {
      await manager.stop();
      return { success: true };
    } catch (error) {
      console.error('[RepositoryMonitoring] Error stopping monitoring:', error);
      throw error;
    }
  });

  // Get git status for a repository
  ipcMain.handle(
    RepositoryMonitoringAPIEvent.GET_GIT_STATUS,
    async (_event, repoPath: string) => {
      console.log(
        `[RepositoryMonitoring] GET_GIT_STATUS request for: ${repoPath}`,
      );
      try {
        const status = await manager.getGitStatus(repoPath);
        return status;
      } catch (error) {
        console.error(
          '[RepositoryMonitoring] Error getting git status:',
          error,
        );
        return null;
      }
    },
  );

  // Get git status with file lists for a repository
  ipcMain.handle(
    RepositoryMonitoringAPIEvent.GET_GIT_STATUS_WITH_FILES,
    async (_event, repoPath: string) => {
      console.log(
        `[RepositoryMonitoring] GET_GIT_STATUS_WITH_FILES request for: ${repoPath}`,
      );
      try {
        const status = await manager.getGitStatusWithFiles(repoPath);
        return status;
      } catch (error) {
        console.error(
          '[RepositoryMonitoring] Error getting git status with files:',
          error,
        );
        return null;
      }
    },
  );

  // Enable git watching for a repository
  ipcMain.handle(
    RepositoryMonitoringAPIEvent.ENABLE_GIT_WATCHING,
    async (_event, repoPath: string) => {
      console.log(
        `[RepositoryMonitoring] ENABLE_GIT_WATCHING request for: ${repoPath}`,
      );
      try {
        await manager.enableGitWatching(repoPath);
        return { success: true };
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
    },
  );

  // Disable git watching for a repository
  ipcMain.handle(
    RepositoryMonitoringAPIEvent.DISABLE_GIT_WATCHING,
    async (_event, repoPath: string) => {
      console.log(
        `[RepositoryMonitoring] DISABLE_GIT_WATCHING request for: ${repoPath}`,
      );
      try {
        await manager.disableGitWatching(repoPath);
        return { success: true };
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
    },
  );

  // Get git remote info for a repository
  ipcMain.handle(
    RepositoryMonitoringAPIEvent.GET_GIT_REMOTE_INFO,
    async (_event, repoPath: string) => {
      console.log(
        `[RepositoryMonitoring] GET_GIT_REMOTE_INFO request for: ${repoPath}`,
      );
      try {
        const remoteInfo = await manager.getGitRemoteInfo(repoPath);
        return remoteInfo;
      } catch (error) {
        console.error(
          '[RepositoryMonitoring] Error getting git remote info:',
          error,
        );
        return null;
      }
    },
  );

  // Invalidate git remote cache for a repository
  ipcMain.handle(
    RepositoryMonitoringAPIEvent.INVALIDATE_GIT_REMOTE_CACHE,
    async (_event, repoPath: string) => {
      console.log(
        `[RepositoryMonitoring] INVALIDATE_GIT_REMOTE_CACHE request for: ${repoPath}`,
      );
      try {
        await manager.invalidateGitRemoteCache(repoPath);
        return { success: true };
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
    },
  );

  // Execute tool using quality lenses
  ipcMain.handle(
    RepositoryMonitoringAPIEvent.EXECUTE_TOOL,
    async (_event, request: ToolExecutionRequest) => {
      console.log(
        `[RepositoryMonitoring] EXECUTE_TOOL request for: ${request.toolName} in ${request.repoPath}`,
      );
      try {
        const result = await qualityLensService.executeTool(request);
        console.log(
          `[RepositoryMonitoring] EXECUTE_TOOL result: ${result.success ? 'SUCCESS' : 'FAILED'} (exit code: ${result.exitCode})`,
        );
        return result;
      } catch (error) {
        console.error('[RepositoryMonitoring] Error executing tool:', error);
        return {
          success: false,
          toolName: request.toolName,
          command: request.command,
          packagePath: request.packagePath,
          exitCode: 1,
          duration: 0,
          stdout: '',
          stderr: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  // Forward events from manager to renderer windows
  manager.on(MonitoringInternalEvent.METRICS_UPDATED, (data: unknown) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
      window.webContents.send(
        RepositoryMonitoringAPIEvent.METRICS_UPDATED,
        data,
      );
    });
  });

  // Forward git status change events to renderer windows
  manager.on(
    MonitoringInternalEvent.GIT_STATUS_CHANGED,
    (data: GitStatusMetadata) => {
      const windows = BrowserWindow.getAllWindows();
      windows.forEach((window) => {
        window.webContents.send(
          RepositoryMonitoringAPIEvent.GIT_STATUS_CHANGED,
          data,
        );
      });
    },
  );

  // Forward git state events to renderer windows
  manager.on(MonitoringInternalEvent.GIT_STATE_EVENT, (payload: GitStateEventPayload) => {
    console.log(
      '[RepositoryMonitoring] Forwarding git state event to renderer:',
      payload.event.type,
    );
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
      window.webContents.send(
        RepositoryMonitoringAPIEvent.GIT_STATE_EVENT,
        payload,
      );
    });
  });

  manager.on(
    MonitoringInternalEvent.WORKSPACE_CHANGED,
    (payload: WorkspaceChangeEventPayload) => {
      console.log(
        `[RepositoryMonitoring] Forwarding workspace change to renderer for ${payload.repoPath}`,
      );
      const windows = BrowserWindow.getAllWindows();
      windows.forEach((window) => {
        window.webContents.send(
          RepositoryMonitoringAPIEvent.WORKSPACE_CHANGED,
          payload,
        );
      });
    },
  );

  // Forward cache sync events to renderer windows
  manager.on(
    MonitoringInternalEvent.CACHE_SYNC,
    (event: RepositoryCacheSyncEvent) => {
      console.log(
        `[RepositoryMonitoring] Forwarding cache sync to renderer: ${event.repoPath} - ${event.slice}`,
      );
      const windows = BrowserWindow.getAllWindows();
      windows.forEach((window) => {
        window.webContents.send(RepositoryMonitoringAPIEvent.CACHE_SYNC, event);
      });
    },
  );

  console.log('[RepositoryMonitoring] IPC handlers registered');
}
