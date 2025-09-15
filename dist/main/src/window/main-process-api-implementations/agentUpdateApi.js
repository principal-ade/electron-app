import { ipcRenderer } from 'electron';
export const agentUpdateAPI = {
    checkAllForUpdates: () => ipcRenderer.invoke('agent-auto-update:check-all'),
    checkForUpdate: (agentType) => ipcRenderer.invoke('agent-auto-update:check', agentType),
    getUpdatePreferences: () => ipcRenderer.invoke('agent-auto-update:get-preferences'),
    saveUpdatePreferences: (preferences) => ipcRenderer.invoke('agent-auto-update:save-preferences', preferences),
    getStoredUpdateInfo: (agentType) => ipcRenderer.invoke('agent-auto-update:get-stored-info', agentType),
    clearStoredUpdateInfo: (agentType) => ipcRenderer.invoke('agent-auto-update:clear-stored-info', agentType),
    onUpdateAvailable: (callback) => {
        const handler = (_event, update) => callback(update);
        ipcRenderer.on('agent-update-available', handler);
        return () => ipcRenderer.removeListener('agent-update-available', handler);
    },
};
