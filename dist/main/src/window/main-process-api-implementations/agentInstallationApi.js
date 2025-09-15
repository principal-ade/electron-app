import { ipcRenderer } from 'electron';
import { AgentInstallationEvents, } from '../../shared/main-process-api-interfaces/AgentInstallationAPI';
export const agentInstallationAPI = {
    onInstallProgress: (agentType, callback) => {
        const subscription = (_event, data) => {
            if (data.agentType !== agentType) {
                return;
            }
            callback(data);
        };
        ipcRenderer.on(AgentInstallationEvents.INSTALL_PROGRESS, subscription);
        return () => {
            ipcRenderer.removeListener(AgentInstallationEvents.INSTALL_PROGRESS, subscription);
        };
    },
    onInstallComplete: (agentType, callback) => {
        const subscription = (_event, data) => {
            if (data.agentType !== agentType) {
                return;
            }
            callback(data);
        };
        ipcRenderer.on(AgentInstallationEvents.INSTALL_COMPLETE, subscription);
        return () => {
            ipcRenderer.removeListener(AgentInstallationEvents.INSTALL_COMPLETE, subscription);
        };
    },
    onInstallError: (agentType, callback) => {
        const subscription = (_event, data) => {
            if (data.agentType !== agentType) {
                return;
            }
            callback(data.error);
        };
        ipcRenderer.on(AgentInstallationEvents.INSTALL_ERROR, subscription);
        return () => {
            ipcRenderer.removeListener(AgentInstallationEvents.INSTALL_ERROR, subscription);
        };
    },
    checkInstallation: (agentType) => {
        return ipcRenderer.invoke(AgentInstallationEvents.CHECK_INSTALLATION, agentType);
    },
    install: (agentType) => {
        return ipcRenderer.invoke(AgentInstallationEvents.INSTALL, agentType);
    },
    onUninstallComplete: (agentType, callback) => {
        const subscription = (_event, data) => {
            if (data.agentType !== agentType) {
                return;
            }
            callback();
        };
        ipcRenderer.on(AgentInstallationEvents.UNINSTALL_COMPLETE, subscription);
        return () => {
            ipcRenderer.removeListener(AgentInstallationEvents.UNINSTALL_COMPLETE, subscription);
        };
    },
    uninstall: (agentType) => {
        return ipcRenderer.invoke(AgentInstallationEvents.UNINSTALL, agentType);
    },
    checkForUpdates: (agentType) => {
        return ipcRenderer.invoke(AgentInstallationEvents.CHECK_FOR_UPDATES, agentType);
    },
    getAvailableVersions: (agentType) => {
        return ipcRenderer.invoke(AgentInstallationEvents.GET_AVAILABLE_VERSIONS, agentType);
    },
    getLatestVersion: (agentType) => {
        return ipcRenderer.invoke(AgentInstallationEvents.GET_LATEST_VERSION, agentType);
    },
    update: (agentType) => {
        return ipcRenderer.invoke(AgentInstallationEvents.UPDATE, agentType);
    },
};
