/**
 * IPC Handlers for Repository Monitoring
 * Updated to use @principal-ai/repository-monitoring-server package
 */

import { ipcMain, BrowserWindow } from 'electron';
import {
  RepositoryMonitoringManager,
  RepositoryMonitoringAPIEvent,
  type GitStatusWithFiles,
  type ToolExecutionRequest,
  type WorkspaceChangeEventPayload,
  type RepositoryCacheSyncEvent,
} from '@principal-ai/repository-monitoring-server';
import { QualityLensService } from '../quality-lenses/QualityLensService';
import { applicationWindows, PrimaryWindowType } from '../window/types';
import { AlexandriaRegistryService } from '../stores/AlexandriaRegistryService';
import { otelEventsManagerBridge } from '../services/OtelEventsManagerBridge';

// Type alias for git state event payload (structure defined in repository-monitoring-server)
type GitStateEventPayload = { event: { type: string }; [key: string]: unknown };

// MonitoringInternalEvent constants (matching the package)
const MonitoringInternalEvent = {
  METRICS_UPDATED: 'metrics-updated',
  GIT_STATUS_CHANGED: 'git-status-changed',
  GIT_STATE_EVENT: 'git-state-event',
  WORKSPACE_CHANGED: 'workspace-changed',
  CACHE_SYNC: 'cache-sync',
  BUILD_ARTIFACTS_DETECTED: 'build-artifacts-detected',
} as const;

// Create singleton manager instance
let repositoryMonitoringManager: RepositoryMonitoringManager | null = null;

// Cache for workspace repo paths to avoid repeated async lookups
const workspaceRepoPathsCache = new Map<
  string,
  { paths: Set<string>; timestamp: number }
>();
const WORKSPACE_CACHE_TTL = 5000; // 5 seconds

/**
 * Check if a window should receive events for a given repository path.
 * - MAIN windows receive all events
 * - REPOSITORY and DEV_WORKSPACE windows receive events for their specific repo
 * - WORKSPACE windows receive events for all repos in their workspace
 */
async function shouldWindowReceiveRepoEvent(
  windowId: number,
  repoPath: string,
): Promise<boolean> {
  const appWindow = applicationWindows.get(windowId);
  if (!appWindow || appWindow.window.isDestroyed()) {
    return false;
  }

  const metadata = appWindow.metadata;
  if (!metadata) {
    return false;
  }

  switch (metadata.primaryType) {
    case PrimaryWindowType.MAIN:
      return true;

    case PrimaryWindowType.REPOSITORY:
    case PrimaryWindowType.DEV_WORKSPACE:
      // Single repo windows: check if event matches their repo
      return metadata.localPath === repoPath;

    case PrimaryWindowType.WORKSPACE: {
      // Workspace windows: check if repo is in workspace
      if (!metadata.workspaceId) {
        return false;
      }

      // Check cache first
      const cached = workspaceRepoPathsCache.get(metadata.workspaceId);
      const now = Date.now();

      if (cached && now - cached.timestamp < WORKSPACE_CACHE_TTL) {
        return cached.paths.has(repoPath);
      }

      // Cache miss or stale - fetch from service
      try {
        const service = AlexandriaRegistryService.getInstance();
        const repos = await service.getRepositoriesInWorkspace(
          metadata.workspaceId,
        );
        // Convert branded paths to plain strings for comparison
        const paths = new Set(repos.map((r) => String(r.path)));
        workspaceRepoPathsCache.set(metadata.workspaceId, {
          paths,
          timestamp: now,
        });
        return paths.has(repoPath);
      } catch (error) {
        console.error(
          `[RepositoryMonitoring] Failed to get workspace repos:`,
          error,
        );
        return false;
      }
    }

    default:
      return false;
  }
}

/**
 * Broadcast a repository event to relevant windows only.
 * Uses setImmediate to yield to the event loop between sends.
 */
async function broadcastToRelevantWindows<T extends { repoPath: string }>(
  eventName: string,
  payload: T,
): Promise<void> {
  const windowIds = Array.from(applicationWindows.keys());

  for (const windowId of windowIds) {
    const shouldReceive = await shouldWindowReceiveRepoEvent(
      windowId,
      payload.repoPath,
    );
    if (shouldReceive) {
      const appWindow = applicationWindows.get(windowId);
      if (appWindow && !appWindow.window.isDestroyed()) {
        // Yield to event loop before each send
        setImmediate(() => {
          if (!appWindow.window.isDestroyed()) {
            appWindow.window.webContents.send(eventName, payload);
          }
        });
      }
    }
  }
}

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

        // Initial sync to otel-events-manager
        const fileTree = await manager.getFileTree(repoPath);
        if (fileTree) {
          otelEventsManagerBridge.pushWorkspace({
            id: repoPath,
            rootPath: repoPath,
            fileTree,
          });
        }

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
        // Notify events manager that workspace is removed
        otelEventsManagerBridge.removeWorkspace(repoPath);
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

  // Get Server Status (running state)
  ipcMain.handle(RepositoryMonitoringAPIEvent.GET_SERVER_STATUS, async () => {
    console.log('[RepositoryMonitoring] GET_SERVER_STATUS request');
    try {
      const status = manager.getStatus();
      return status;
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
  });

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

  // Acquire a watch reference for a repository
  ipcMain.handle(
    RepositoryMonitoringAPIEvent.ACQUIRE_WATCH,
    async (_event, repoPath: string, referenceId: string) => {
      console.log(
        `[RepositoryMonitoring] ACQUIRE_WATCH request for: ${repoPath} (reference: ${referenceId})`,
      );
      try {
        await manager.acquireWatch(repoPath, referenceId);
        return { success: true };
      } catch (error) {
        console.error('[RepositoryMonitoring] Error acquiring watch:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  // Release a watch reference for a repository
  ipcMain.handle(
    RepositoryMonitoringAPIEvent.RELEASE_WATCH,
    async (_event, repoPath: string, referenceId: string) => {
      console.log(
        `[RepositoryMonitoring] RELEASE_WATCH request for: ${repoPath} (reference: ${referenceId})`,
      );
      try {
        await manager.releaseWatch(repoPath, referenceId);
        return { success: true };
      } catch (error) {
        console.error('[RepositoryMonitoring] Error releasing watch:', error);
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
        `[RepositoryMonitoring] EXECUTE_TOOL request for: ${request.packageCommand.lensId || request.packageCommand.name} in ${request.repoPath}`,
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
          toolName:
            request.packageCommand.lensId || request.packageCommand.name,
          command: request.packageCommand.command,
          packagePath: request.packageLayer.packageData.path,
          exitCode: 1,
          duration: 0,
          stdout: '',
          stderr: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  // Run quality enrichment on-demand
  ipcMain.handle(
    RepositoryMonitoringAPIEvent.RUN_QUALITY_ENRICHMENT,
    async (_event, repoPath: string) => {
      console.log(
        `[RepositoryMonitoring] RUN_QUALITY_ENRICHMENT request for: ${repoPath}`,
      );
      try {
        await manager.runQualityEnrichment(repoPath);
        return { success: true };
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
    },
  );

  // Manually trigger workspace sync to otel-events-manager
  ipcMain.handle(
    'repository-monitoring:sync-workspace',
    async (_event, repoPath: string) => {
      console.log(
        `[RepositoryMonitoring] SYNC_WORKSPACE request for: ${repoPath}`,
      );
      try {
        const fileTree = await manager.getFileTree(repoPath);
        if (!fileTree) {
          return {
            success: false,
            error: 'Failed to get file tree for workspace',
          };
        }

        const result = await otelEventsManagerBridge.pushWorkspace({
          id: repoPath,
          rootPath: repoPath,
          fileTree,
        });

        console.log(
          `[RepositoryMonitoring] SYNC_WORKSPACE result: ${result.success ? 'SUCCESS' : 'FAILED'}`,
        );
        return result;
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

  // Forward git status change events to relevant renderer windows only
  // Event now includes file arrays (GitStatusWithFiles) for efficiency
  manager.on(
    MonitoringInternalEvent.GIT_STATUS_CHANGED,
    (data: GitStatusWithFiles) => {
      broadcastToRelevantWindows(
        RepositoryMonitoringAPIEvent.GIT_STATUS_CHANGED,
        data,
      );
    },
  );

  // Forward git state events to relevant renderer windows only
  manager.on(
    MonitoringInternalEvent.GIT_STATE_EVENT,
    (payload: GitStateEventPayload) => {
      console.log(
        '[RepositoryMonitoring] Forwarding git state event to renderer:',
        payload.event.type,
      );
      // GitStateEventPayload should have repoPath from the monitoring worker
      const repoPath = payload.repoPath;
      if (typeof repoPath === 'string') {
        broadcastToRelevantWindows(
          RepositoryMonitoringAPIEvent.GIT_STATE_EVENT,
          { ...payload, repoPath },
        );
      } else {
        // Fallback: broadcast to all windows if no repoPath
        const windows = BrowserWindow.getAllWindows();
        windows.forEach((window) => {
          window.webContents.send(
            RepositoryMonitoringAPIEvent.GIT_STATE_EVENT,
            payload,
          );
        });
      }
    },
  );

  manager.on(
    MonitoringInternalEvent.WORKSPACE_CHANGED,
    async (payload: WorkspaceChangeEventPayload) => {
      console.log(
        `[RepositoryMonitoring] Forwarding workspace change to renderer for ${payload.repoPath}`,
      );
      broadcastToRelevantWindows(
        RepositoryMonitoringAPIEvent.WORKSPACE_CHANGED,
        payload,
      );

      // Sync workspace to otel-events-manager for trace matching
      try {
        const fileTree = await manager.getFileTree(payload.repoPath);
        if (fileTree) {
          otelEventsManagerBridge.pushWorkspace({
            id: payload.repoPath,
            rootPath: payload.repoPath,
            fileTree,
          });
        }
      } catch (err) {
        console.debug(
          '[RepositoryMonitoring] Failed to sync workspace to events manager:',
          err instanceof Error ? err.message : String(err),
        );
      }
    },
  );

  // Forward cache sync events to relevant renderer windows only
  manager.on(
    MonitoringInternalEvent.CACHE_SYNC,
    (event: RepositoryCacheSyncEvent) => {
      broadcastToRelevantWindows(
        RepositoryMonitoringAPIEvent.CACHE_SYNC,
        event,
      );
    },
  );

  // Forward build artifacts detected events to relevant renderer windows only
  manager.on(
    MonitoringInternalEvent.BUILD_ARTIFACTS_DETECTED,
    (
      payload: import('@principal-ai/repository-monitoring-server').BuildArtifactsDetectedPayload,
    ) => {
      console.log(
        `[RepositoryMonitoring] Forwarding build artifacts detected to renderer: ${payload.repoPath} - ${payload.artifacts.length} artifacts`,
      );
      broadcastToRelevantWindows(
        RepositoryMonitoringAPIEvent.BUILD_ARTIFACTS_DETECTED,
        payload,
      );
    },
  );

  console.log('[RepositoryMonitoring] IPC handlers registered');
}
