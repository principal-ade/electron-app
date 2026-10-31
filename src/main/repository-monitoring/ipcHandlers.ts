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
  type LifecycleEvent,
  type LogTailRequest,
  type FileWatcherImpl,
} from '@principal-ai/repository-monitoring-server';
import { UserPreferencesHandler } from '../stores/userPreferencesHandler';
import { QualityLensService } from '../quality-lenses/QualityLensService';
import { applicationWindows, PrimaryWindowType } from '../window/types';
import { otelEventsManagerBridge } from '../services/OtelEventsManagerBridge';
import { registerHomeRepositoryRefreshHandlers } from './homeRepositoryRefreshHandlers';
import {
  resolveRepoMonitorDaemonEntryPath,
  resolveRepoMonitorLauncher,
} from './daemonLaunch';

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

/**
 * Send git status update to presence system (debounced)
 * Presence/collaboration WebSocket service has been removed; this is a no-op.
 */
function sendGitStatusToPresence(
  _status: GitStatusWithFiles,
  _manager: RepositoryMonitoringManager,
): void {
  // Presence/collaboration service removed — no-op.
}

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
 * Get or create the repository monitoring manager instance. Pass `seedConfig`
 * on the *first* call to inject startup-only settings (e.g. watcherImpl)
 * sourced from user preferences. Later calls receive the cached instance and
 * ignore the seed.
 *
 * The manager connects to the shared repo-monitor daemon (one per user, also
 * used by Subsystems Studio) and spawns it when nothing is listening.
 */
export function getManager(
  seedConfig: { watcherImpl?: FileWatcherImpl } = {},
): RepositoryMonitoringManager {
  if (!repositoryMonitoringManager) {
    const launcher = resolveRepoMonitorLauncher();
    const daemonEntryPath = resolveRepoMonitorDaemonEntryPath();
    console.log(
      `[RepositoryMonitoring] daemon launcher: ${launcher.runtime} node at ${launcher.nodeBinary}; bundle ${daemonEntryPath}`,
    );
    repositoryMonitoringManager = new RepositoryMonitoringManager({
      autoStart: true,
      logLevel: 'info',
      spawnedBy: 'desktop',
      nodeBinary: launcher.nodeBinary,
      daemonEntryPath,
      daemonEnv: launcher.env,
      watcherImpl: seedConfig.watcherImpl ?? 'parcel',
    });
  }
  return repositoryMonitoringManager;
}

/**
 * Register IPC handlers for repository monitoring
 */
export async function registerRepositoryMonitoringHandlers(): Promise<void> {
  console.log('[RepositoryMonitoring] Registering IPC handlers');

  // Read the watcher impl preference before constructing the manager so the
  // first worker spawns with the right adapter. If reading the pref fails
  // (e.g. first run before the store is initialized) we default to 'parcel'.
  let watcherImpl: FileWatcherImpl = 'parcel';
  try {
    const prefs = await UserPreferencesHandler.getInstance().getUserPreferences();
    if (prefs.repositoryMonitoringWatcherImpl === 'chokidar') {
      watcherImpl = 'chokidar';
    }
  } catch (error) {
    console.warn(
      '[RepositoryMonitoring] Could not read watcherImpl preference, using default:',
      error,
    );
  }

  const manager = getManager({ watcherImpl });
  const qualityLensService = QualityLensService.getInstance();

  registerHomeRepositoryRefreshHandlers(manager, (status) => {
    void broadcastToRelevantWindows(
      RepositoryMonitoringAPIEvent.GIT_STATUS_CHANGED,
      status,
    );
  });
  ipcMain.handle(
    RepositoryMonitoringAPIEvent.REFRESH_GIT_STATUS,
    async (_event, repoPath: string) => manager.refreshGitStatus(repoPath),
  );

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

  // Get connection status
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
      return { connected: false, reconnectAttempts: 0 };
    }
  });

  // Get rich diagnostics snapshot (phase, daemon PID, lifecycle history)
  ipcMain.handle(
    RepositoryMonitoringAPIEvent.GET_DIAGNOSTICS,
    async () => {
      try {
        return manager.getDiagnostics();
      } catch (error) {
        console.error(
          '[RepositoryMonitoring] Error getting diagnostics:',
          error,
        );
        // Return an inert diagnostic snapshot on error so the UI can render
        // "no data" rather than crashing.
        return {
          phase: 'idle' as const,
          connected: false,
          daemonPid: null,
          startedAt: null,
          lastConnectedAt: null,
          phaseEnteredAt: Date.now(),
          reconnectAttempts: 0,
          disconnectRequested: false,
          lastError: {
            message: error instanceof Error ? error.message : String(error),
          },
          lastDisconnect: null,
          watcherImpl: null,
          requestedWatcherImpl: 'parcel' as const,
          watcherImplFallbackReason: null,
          lifecycleHistory: [],
          daemon: null,
        };
      }
    },
  );

  // Daemon-wide snapshot: process status plus every repo's cache slices
  ipcMain.handle(RepositoryMonitoringAPIEvent.GET_DAEMON_DIAGNOSTICS, async () => {
    return manager.getDaemonDiagnostics();
  });

  // Get tail of the main + daemon log files
  ipcMain.handle(
    RepositoryMonitoringAPIEvent.GET_LOG_TAIL,
    async (_event, request?: LogTailRequest) => {
      try {
        return await manager.getLogTail(request);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[RepositoryMonitoring] Error reading log tail:', error);
        return {
          mainLog: { path: '', content: '', error: message },
          daemonLog: { path: '', content: '', error: message },
        };
      }
    },
  );

  // Switch the daemon's filesystem watcher implementation. The request is
  // persisted to UserPreferences so it survives app restarts, and the shared
  // daemon is restarted so the change is immediately visible (other clients
  // reconnect on their own).
  ipcMain.handle(
    RepositoryMonitoringAPIEvent.SET_WATCHER_IMPL,
    async (_event, impl: FileWatcherImpl) => {
      if (impl !== 'parcel' && impl !== 'chokidar') {
        return { success: false, error: `Invalid watcher impl: ${String(impl)}` };
      }
      try {
        const changed = manager.setWatcherImpl(impl);
        // Always persist, even when unchanged, so the preference is normalized.
        await UserPreferencesHandler.getInstance().updateUserPreferences({
          repositoryMonitoringWatcherImpl: impl,
        });
        if (changed) {
          await manager.restartDaemon();
        }
        return { success: true, changed };
      } catch (error) {
        console.error(
          '[RepositoryMonitoring] Failed to switch watcher impl:',
          error,
        );
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  // Replace the shared daemon with a fresh one (every client reconnects).
  ipcMain.handle(RepositoryMonitoringAPIEvent.RESTART_DAEMON, async () => {
    console.log('[RepositoryMonitoring] RESTART_DAEMON request');
    try {
      await manager.restartDaemon();
      return { success: true };
    } catch (error) {
      console.error('[RepositoryMonitoring] Error restarting daemon:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
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

  // Forward daemon connection transitions (connecting -> connected
  // -> reconnecting/disconnecting -> disconnected/unreachable) so the
  // renderer can show "why is the connection in this state".
  manager.on('lifecycle', (event: LifecycleEvent) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send(
          RepositoryMonitoringAPIEvent.LIFECYCLE_EVENT,
          event,
        );
      }
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

      // Also send to presence system (debounced) for sharing with other users
      sendGitStatusToPresence(data, manager);
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

  // Start the repos heartbeat timer
  startReposHeartbeat(manager);
}

// Repos heartbeat removed with presence/collaboration service.
let reposHeartbeatTimer: NodeJS.Timeout | null = null;

/**
 * Start the periodic repos heartbeat that syncs open repositories with the presence server.
 * Presence/collaboration WebSocket service has been removed; this is a no-op.
 */
function startReposHeartbeat(_manager: RepositoryMonitoringManager): void {
  // Presence/collaboration service removed — no-op.
}

/**
 * Stop the repos heartbeat timer (call on app shutdown)
 */
export function stopReposHeartbeat(): void {
  if (reposHeartbeatTimer) {
    clearInterval(reposHeartbeatTimer);
    reposHeartbeatTimer = null;
    console.log('[RepositoryMonitoring] Repos heartbeat stopped');
  }
}
