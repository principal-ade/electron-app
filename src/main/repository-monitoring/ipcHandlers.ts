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
import type { SharedGitStatus } from '@principal-ai/control-tower-core';
import { QualityLensService } from '../quality-lenses/QualityLensService';
import { applicationWindows, PrimaryWindowType } from '../window/types';
import { otelEventsManagerBridge } from '../services/OtelEventsManagerBridge';
import { gitSyncWebSocketManager } from '../services/GitSyncWebSocketManager';

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

// Debounce map for git status presence updates
const gitStatusPresenceDebounceMap = new Map<string, NodeJS.Timeout>();
const GIT_STATUS_PRESENCE_DEBOUNCE_MS = 1000; // 1 second debounce

/**
 * Convert GitStatusWithFiles to SharedGitStatus for presence sharing
 */
function convertToSharedGitStatus(status: GitStatusWithFiles): SharedGitStatus {
  return {
    branch: status.branch,
    isDirty: status.isDirty,
    hasStaged: status.hasStaged,
    hasUntracked: status.hasUntracked,
    ahead: status.ahead,
    behind: status.behind,
    modifiedFiles: status.modifiedFiles,
    stagedFiles: status.stagedFiles,
    untrackedFiles: status.untrackedFiles,
    deletedFiles: status.deletedFiles,
    lastChangedAt: status.lastChangedAt,
  };
}

/**
 * Parse owner/repo from a git remote URL
 * Based on GitRemoteService.checkAuthMethods logic
 */
function parseOwnerRepoFromUrl(url: string): { owner: string; repo: string } | null {
  // Try SSH format (git@service:owner/repo.git)
  let match = /git@[^:]+:([^/]+)\/(.+?)(?:\.git)?$/.exec(url);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }

  // Try HTTPS format (https://service/owner/repo.git)
  match = /https?:\/\/[^/]+\/([^/]+)\/([^/.]+)(?:\.git)?/.exec(url);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }

  return null;
}

/**
 * Parse GitHub owner/repo from a local repository path.
 * Attempts to extract from git remote URL or path structure.
 */
async function parseOwnerRepoFromPath(
  repoPath: string,
  manager: RepositoryMonitoringManager,
): Promise<{ owner: string; repo: string } | null> {
  try {
    const remoteInfo = await manager.getGitRemoteInfo(repoPath);
    if (remoteInfo?.remoteUrl) {
      return parseOwnerRepoFromUrl(remoteInfo.remoteUrl);
    }
  } catch (error) {
    console.debug(
      '[RepositoryMonitoring] Failed to get remote info for presence update:',
      error,
    );
  }
  return null;
}

/**
 * Send git status update to presence system (debounced)
 */
function sendGitStatusToPresence(
  status: GitStatusWithFiles,
  manager: RepositoryMonitoringManager,
): void {
  const repoPath = status.repoPath;

  // Clear existing debounce timer
  const existingTimer = gitStatusPresenceDebounceMap.get(repoPath);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Set new debounced timer
  const timer = setTimeout(async () => {
    gitStatusPresenceDebounceMap.delete(repoPath);

    const ownerRepo = await parseOwnerRepoFromPath(repoPath, manager);
    if (!ownerRepo) {
      console.debug(
        '[RepositoryMonitoring] Cannot send git status to presence - no owner/repo for:',
        repoPath,
      );
      return;
    }

    const sharedStatus = convertToSharedGitStatus(status);
    console.log(`[RepositoryMonitoring] Sending git status to presence for ${ownerRepo.owner}/${ownerRepo.repo}:`, {
      isDirty: sharedStatus.isDirty,
      branch: sharedStatus.branch,
      modifiedFiles: sharedStatus.modifiedFiles?.length || 0,
      stagedFiles: sharedStatus.stagedFiles?.length || 0,
      sharedStatus,
    });

    const result = await gitSyncWebSocketManager.reportRepositoryStatusUpdate(
      ownerRepo.owner,
      ownerRepo.repo,
      sharedStatus,
    );

    if (result.success) {
      console.log(
        `[RepositoryMonitoring] Successfully sent git status to presence for ${ownerRepo.owner}/${ownerRepo.repo}`,
        result,
      );
    } else {
      console.error(
        `[RepositoryMonitoring] Failed to send git status to presence for ${ownerRepo.owner}/${ownerRepo.repo}`,
        result,
      );
    }
  }, GIT_STATUS_PRESENCE_DEBOUNCE_MS);

  gitStatusPresenceDebounceMap.set(repoPath, timer);
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
 */
export function getManager(
  seedConfig: { watcherImpl?: FileWatcherImpl } = {},
): RepositoryMonitoringManager {
  if (!repositoryMonitoringManager) {
    repositoryMonitoringManager = new RepositoryMonitoringManager({
      autoStart: true,
      restartOnCrash: true,
      maxRestartAttempts: 3,
      logLevel: 'info',
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

  // Get rich diagnostics snapshot (phase, PID, lifecycle history, log buffers)
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
          requestedWatcherImpl: 'parcel' as const,
          watcherImplFallbackReason: null,
          lifecycleHistory: [],
          stdoutTail: [],
          stderrTail: [],
        };
      }
    },
  );

  // Get tail of the main + worker log files
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
          workerLog: { path: '', content: '', error: message },
        };
      }
    },
  );

  // Switch the worker's filesystem watcher implementation at runtime. The
  // request is persisted to UserPreferences so it survives app restarts, and
  // the worker is restarted in-place so the change is immediately visible.
  ipcMain.handle(
    'repository-monitoring:set-watcher-impl',
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
          // stop() is sync; the auto-restart machinery would then bring a new
          // worker up. We do an explicit start() here so the UI sees the
          // 'stopping -> spawning' transitions immediately rather than going
          // through the crash-recovery path.
          manager.stop();
          await manager.start();
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

  // Forward worker lifecycle transitions (spawning -> ready -> running
  // -> stopping/crashed -> restarting -> stopped/fatal) so the renderer
  // can show "why is the server in this state".
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

// Repos heartbeat interval (30 seconds)
const REPOS_HEARTBEAT_INTERVAL_MS = 30000;
let reposHeartbeatTimer: NodeJS.Timeout | null = null;

/**
 * Get all repository paths that have open windows
 */
function getOpenRepositoryPaths(): Set<string> {
  const repoPaths = new Set<string>();

  for (const appWindow of applicationWindows.values()) {
    if (appWindow.window.isDestroyed()) {
      continue;
    }

    const metadata = appWindow.metadata;
    if (!metadata?.localPath) {
      continue;
    }

    // Include REPOSITORY and DEV_WORKSPACE windows (they have a single repo)
    // WORKSPACE windows contain multiple repos (handled separately via workspace API)
    if (
      metadata.primaryType === PrimaryWindowType.REPOSITORY ||
      metadata.primaryType === PrimaryWindowType.DEV_WORKSPACE
    ) {
      repoPaths.add(metadata.localPath);
    }
  }

  return repoPaths;
}

/**
 * Start the periodic repos heartbeat that syncs open repositories with the presence server.
 * This ensures the server has an accurate view of which repos are open on this device.
 */
function startReposHeartbeat(manager: RepositoryMonitoringManager): void {
  // Clear any existing timer
  if (reposHeartbeatTimer) {
    clearInterval(reposHeartbeatTimer);
  }

  // Function to gather and send heartbeat
  const sendHeartbeat = async () => {
    try {
      // Get only repos that have open windows
      const openRepoPaths = getOpenRepositoryPaths();

      if (openRepoPaths.size === 0) {
        // Send empty heartbeat to clear any stale repos on server
        await gitSyncWebSocketManager.sendReposHeartbeat([]);
        return;
      }

      // Gather repo entries with git status
      const repos: import('@principal-ai/control-tower-core').RepoHeartbeatEntry[] = [];

      for (const repoPath of openRepoPaths) {
        try {
          // Get owner/repo from remote
          const ownerRepo = await parseOwnerRepoFromPath(repoPath, manager);
          if (!ownerRepo) {
            continue; // Skip repos without remote info
          }

          const repoId = `${ownerRepo.owner}/${ownerRepo.repo}`;

          // Get git status
          const gitStatus = await manager.getGitStatusWithFiles(repoPath);
          const sharedStatus = gitStatus ? convertToSharedGitStatus(gitStatus) : undefined;

          repos.push({
            repoId,
            branch: gitStatus?.branch || 'main',
            gitStatus: sharedStatus,
          });
        } catch (error) {
          console.debug(
            `[RepositoryMonitoring] Failed to get info for repo ${repoPath}:`,
            error,
          );
        }
      }

      if (repos.length > 0) {
        console.log('[RepositoryMonitoring] Sending repos heartbeat:', JSON.stringify(repos, null, 2));
        const result = await gitSyncWebSocketManager.sendReposHeartbeat(repos);
        if (result.success) {
          console.log(
            `[RepositoryMonitoring] Repos heartbeat sent successfully: ${repos.length} repos`,
            result,
          );
        } else {
          console.error('[RepositoryMonitoring] Repos heartbeat failed:', result);
        }
      }
    } catch (error) {
      console.error('[RepositoryMonitoring] Failed to send repos heartbeat:', error);
    }
  };

  // Send initial heartbeat after a short delay (allow connections to establish)
  setTimeout(sendHeartbeat, 5000);

  // Start periodic heartbeat
  reposHeartbeatTimer = setInterval(sendHeartbeat, REPOS_HEARTBEAT_INTERVAL_MS);
  console.log('[RepositoryMonitoring] Repos heartbeat started (30s interval)');
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
