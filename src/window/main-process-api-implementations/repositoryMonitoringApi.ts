import { ipcRenderer } from 'electron';
import {
  RepositoryMonitoringAPIEvent,
  type GitStatusWithFiles,
  type WorkspaceChangeEventPayload,
  type ToolExecutionRequest,
  type RepositoryCacheSyncEvent,
  type BuildArtifactsDetectedPayload,
  type LifecycleEvent,
  type LogTailRequest,
} from '@principal-ai/repository-monitoring-server';
import type { ExtendedRepositoryMonitoringAPI } from '../../shared/main-process-api-interfaces';

export const repositoryMonitoringAPI: ExtendedRepositoryMonitoringAPI = {
  getFileTree: async (repoPath: string) => {
    return ipcRenderer.invoke(
      RepositoryMonitoringAPIEvent.GET_FILE_TREE,
      repoPath,
    );
  },

  getPackages: async (repoPath: string) => {
    return ipcRenderer.invoke(
      RepositoryMonitoringAPIEvent.GET_PACKAGES,
      repoPath,
    );
  },

  getRepositoryCacheSnapshot: async (repoPath: string) => {
    return ipcRenderer.invoke(
      RepositoryMonitoringAPIEvent.GET_CACHE_SNAPSHOT,
      repoPath,
    );
  },

  registerRepository: async (repoPath: string) => {
    return ipcRenderer.invoke(RepositoryMonitoringAPIEvent.REGISTER, repoPath);
  },

  unregisterRepository: async (repoPath: string) => {
    return ipcRenderer.invoke(
      RepositoryMonitoringAPIEvent.UNREGISTER,
      repoPath,
    );
  },

  refreshRepository: async (repoPath: string) => {
    return ipcRenderer.invoke(RepositoryMonitoringAPIEvent.REFRESH, repoPath);
  },

  getMonitoringStatus: async () => {
    return ipcRenderer.invoke(
      RepositoryMonitoringAPIEvent.GET_MONITORING_STATUS,
    );
  },

  getServerStatus: async () => {
    return ipcRenderer.invoke(RepositoryMonitoringAPIEvent.GET_SERVER_STATUS);
  },

  startMonitoring: async () => {
    return ipcRenderer.invoke(RepositoryMonitoringAPIEvent.START_MONITORING);
  },

  stopMonitoring: async () => {
    return ipcRenderer.invoke(RepositoryMonitoringAPIEvent.STOP_MONITORING);
  },

  getGitStatus: async (repoPath: string) => {
    return ipcRenderer.invoke(
      RepositoryMonitoringAPIEvent.GET_GIT_STATUS,
      repoPath,
    );
  },

  getGitStatusWithFiles: async (repoPath: string) => {
    return ipcRenderer.invoke(
      RepositoryMonitoringAPIEvent.GET_GIT_STATUS_WITH_FILES,
      repoPath,
    );
  },

  acquireWatch: async (repoPath: string, referenceId: string) => {
    return ipcRenderer.invoke(
      RepositoryMonitoringAPIEvent.ACQUIRE_WATCH,
      repoPath,
      referenceId,
    );
  },

  releaseWatch: async (repoPath: string, referenceId: string) => {
    return ipcRenderer.invoke(
      RepositoryMonitoringAPIEvent.RELEASE_WATCH,
      repoPath,
      referenceId,
    );
  },

  getGitRemoteInfo: async (repoPath: string) => {
    return ipcRenderer.invoke(
      RepositoryMonitoringAPIEvent.GET_GIT_REMOTE_INFO,
      repoPath,
    );
  },

  invalidateGitRemoteCache: async (repoPath: string) => {
    return ipcRenderer.invoke(
      RepositoryMonitoringAPIEvent.INVALIDATE_GIT_REMOTE_CACHE,
      repoPath,
    );
  },

  onGitStatusChanged: (
    callback: (status: GitStatusWithFiles) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      status: GitStatusWithFiles,
    ) => callback(status);
    ipcRenderer.on(RepositoryMonitoringAPIEvent.GIT_STATUS_CHANGED, handler);
    return () => {
      ipcRenderer.removeListener(
        RepositoryMonitoringAPIEvent.GIT_STATUS_CHANGED,
        handler,
      );
    };
  },

  onWorkspaceChange: (
    callback: (event: WorkspaceChangeEventPayload) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: WorkspaceChangeEventPayload,
    ) => callback(payload);
    ipcRenderer.on(RepositoryMonitoringAPIEvent.WORKSPACE_CHANGED, handler);
    return () => {
      ipcRenderer.removeListener(
        RepositoryMonitoringAPIEvent.WORKSPACE_CHANGED,
        handler,
      );
    };
  },

  onCacheSync: (() => {
    // Deduplication: track recent events to prevent electron-log induced duplicates
    const recentEvents = new Map<string, number>();
    const DEDUPE_WINDOW_MS = 50; // Ignore duplicate events within 50ms

    return (callback: (event: RepositoryCacheSyncEvent) => void): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        payload: RepositoryCacheSyncEvent,
      ) => {
        // Create a unique key for this event
        const eventKey = `${payload.repoPath}:${payload.slice}:${payload.entry?.version || ''}`;
        const now = Date.now();
        const lastSeen = recentEvents.get(eventKey);

        if (lastSeen && now - lastSeen < DEDUPE_WINDOW_MS) {
          // Duplicate event, skip
          return;
        }

        recentEvents.set(eventKey, now);

        // Clean up old entries periodically
        if (recentEvents.size > 100) {
          const cutoff = now - DEDUPE_WINDOW_MS * 2;
          for (const [key, time] of recentEvents) {
            if (time < cutoff) recentEvents.delete(key);
          }
        }

        callback(payload);
      };

      ipcRenderer.on(RepositoryMonitoringAPIEvent.CACHE_SYNC, handler);
      return () => {
        ipcRenderer.removeListener(
          RepositoryMonitoringAPIEvent.CACHE_SYNC,
          handler,
        );
      };
    };
  })(),

  onBuildArtifactsDetected: (
    callback: (payload: BuildArtifactsDetectedPayload) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: BuildArtifactsDetectedPayload,
    ) => callback(payload);
    ipcRenderer.on(
      RepositoryMonitoringAPIEvent.BUILD_ARTIFACTS_DETECTED,
      handler,
    );
    return () => {
      ipcRenderer.removeListener(
        RepositoryMonitoringAPIEvent.BUILD_ARTIFACTS_DETECTED,
        handler,
      );
    };
  },

  runQualityEnrichment: async (repoPath: string) => {
    return ipcRenderer.invoke(
      RepositoryMonitoringAPIEvent.RUN_QUALITY_ENRICHMENT,
      repoPath,
    );
  },

  executeTool: async (request: ToolExecutionRequest) => {
    return ipcRenderer.invoke(
      RepositoryMonitoringAPIEvent.EXECUTE_TOOL,
      request,
    );
  },

  getDiagnostics: async () => {
    return ipcRenderer.invoke(RepositoryMonitoringAPIEvent.GET_DIAGNOSTICS);
  },

  getLogTail: async (request?: LogTailRequest) => {
    return ipcRenderer.invoke(
      RepositoryMonitoringAPIEvent.GET_LOG_TAIL,
      request,
    );
  },

  onLifecycleEvent: (
    callback: (event: LifecycleEvent) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: LifecycleEvent,
    ) => callback(payload);
    ipcRenderer.on(RepositoryMonitoringAPIEvent.LIFECYCLE_EVENT, handler);
    return () => {
      ipcRenderer.removeListener(
        RepositoryMonitoringAPIEvent.LIFECYCLE_EVENT,
        handler,
      );
    };
  },

  setWatcherImpl: async (impl: 'parcel' | 'chokidar') => {
    return ipcRenderer.invoke('repository-monitoring:set-watcher-impl', impl);
  },

  // Manually trigger workspace sync to otel-events-manager
  syncWorkspace: async (repoPath: string) => {
    return ipcRenderer.invoke('repository-monitoring:sync-workspace', repoPath);
  },
};
