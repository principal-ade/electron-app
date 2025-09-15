import { ipcRenderer } from 'electron';
import { GitWatcherEvents } from '../../shared/main-process-api-interfaces/GitWatcherAPI';
export const gitWatcherAPI = {
    watchRepository: async (repoPath) => {
        return ipcRenderer.invoke(GitWatcherEvents.WATCH_REPOSITORY, repoPath);
    },
    unwatchRepository: async (repoPath) => {
        return ipcRenderer.invoke(GitWatcherEvents.UNWATCH_REPOSITORY, repoPath);
    },
    getStatus: async (repoPath) => {
        return ipcRenderer.invoke(GitWatcherEvents.GET_STATUS, repoPath);
    },
    getAllStatuses: async () => {
        return ipcRenderer.invoke(GitWatcherEvents.GET_ALL_STATUSES);
    },
    refreshStatus: async (repoPath) => {
        return ipcRenderer.invoke(GitWatcherEvents.REFRESH_STATUS, repoPath);
    },
    // Event listener management
    onStatusUpdate: (callback) => {
        const handler = (_event, status) => callback(status);
        ipcRenderer.on(GitWatcherEvents.STATUS_UPDATE, handler);
        // Return unsubscribe function
        return () => {
            ipcRenderer.removeListener(GitWatcherEvents.STATUS_UPDATE, handler);
        };
    }
};
