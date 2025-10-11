import { ipcRenderer } from 'electron';
import {
  RepositoryMonitoringAPI,
  RepositoryMonitoringAPIEvent,
  GitStatusMetadata,
  type WorkspaceChangeEventPayload,
  type ToolExecutionRequest,
  type RepositoryCacheSyncEvent,
} from '../../shared/main-process-api-interfaces/RepositoryMonitoringAPI';

export const repositoryMonitoringAPI: RepositoryMonitoringAPI = {
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

  enableGitWatching: async (repoPath: string) => {
    return ipcRenderer.invoke(
      RepositoryMonitoringAPIEvent.ENABLE_GIT_WATCHING,
      repoPath,
    );
  },

  disableGitWatching: async (repoPath: string) => {
    return ipcRenderer.invoke(
      RepositoryMonitoringAPIEvent.DISABLE_GIT_WATCHING,
      repoPath,
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
    callback: (status: GitStatusMetadata) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      status: GitStatusMetadata,
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

  onCacheSync: (
    callback: (event: RepositoryCacheSyncEvent) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: RepositoryCacheSyncEvent,
    ) => callback(payload);
    ipcRenderer.on(RepositoryMonitoringAPIEvent.CACHE_SYNC, handler);
    return () => {
      ipcRenderer.removeListener(
        RepositoryMonitoringAPIEvent.CACHE_SYNC,
        handler,
      );
    };
  },

  executeTool: async (request: ToolExecutionRequest) => {
    return ipcRenderer.invoke(
      RepositoryMonitoringAPIEvent.EXECUTE_TOOL,
      request,
    );
  },
};
