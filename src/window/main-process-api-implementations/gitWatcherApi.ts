import { ipcRenderer } from 'electron';
import {
  GitStatus,
  GitWatcherEvents,
  WatchResult,
} from '../../shared/main-process-api-interfaces/GitWatcherAPI';

export const gitWatcherAPI = {
  watchRepository: async (repoPath: string): Promise<WatchResult> => {
    return ipcRenderer.invoke(GitWatcherEvents.WATCH_REPOSITORY, repoPath);
  },

  unwatchRepository: async (repoPath: string): Promise<WatchResult> => {
    return ipcRenderer.invoke(GitWatcherEvents.UNWATCH_REPOSITORY, repoPath);
  },

  getStatus: async (repoPath: string): Promise<GitStatus | null> => {
    return ipcRenderer.invoke(GitWatcherEvents.GET_STATUS, repoPath);
  },

  getAllStatuses: async (): Promise<Record<string, GitStatus>> => {
    return ipcRenderer.invoke(GitWatcherEvents.GET_ALL_STATUSES);
  },

  refreshStatus: async (repoPath: string): Promise<GitStatus | null> => {
    return ipcRenderer.invoke(GitWatcherEvents.REFRESH_STATUS, repoPath);
  },

  // Event listener management
  onStatusUpdate: (callback: (status: GitStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: GitStatus) =>
      callback(status);
    ipcRenderer.on(GitWatcherEvents.STATUS_UPDATE, handler);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(GitWatcherEvents.STATUS_UPDATE, handler);
    };
  },
};
