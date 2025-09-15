import { ipcRenderer } from 'electron';
import { SystemEvents } from '../../shared/main-process-api-interfaces/SystemAPI';
export const systemAPI = {
    // Existing methods
    getPlatform: async () => {
        return ipcRenderer.invoke(SystemEvents.GET_PLATFORM);
    },
    getSystemInfo: async () => {
        return ipcRenderer.invoke(SystemEvents.GET_SYSTEM_INFO);
    },
    // New methods for migration
    executeCommand: async (options) => {
        return ipcRenderer.invoke(SystemEvents.EXECUTE_COMMAND, options);
    },
    openDialog: async (options) => {
        return ipcRenderer.invoke(SystemEvents.OPEN_DIALOG, options);
    },
    checkForUpdateManually: async () => {
        return ipcRenderer.invoke(SystemEvents.CHECK_FOR_UPDATE_MANUALLY);
    },
    restartApp: async () => {
        return ipcRenderer.invoke(SystemEvents.RESTART_APP);
    },
    // Event listeners
    onUpdateCheckComplete: (callback) => {
        const subscription = (_event, result) => callback(result);
        ipcRenderer.on(SystemEvents.UPDATE_CHECK_COMPLETE, subscription);
        return () => ipcRenderer.removeListener(SystemEvents.UPDATE_CHECK_COMPLETE, subscription);
    },
};
