export class AgentInstallationService {
    static onInstallProgress(agentType, callback) {
        return window.mainProcess.agentInstallation.onInstallProgress(agentType, callback);
    }
    static onInstallComplete(agentType, callback) {
        return window.mainProcess.agentInstallation.onInstallComplete(agentType, callback);
    }
    static onInstallError(agentType, callback) {
        return window.mainProcess.agentInstallation.onInstallError(agentType, callback);
    }
    static checkInstallation(agentType) {
        return window.mainProcess.agentInstallation.checkInstallation(agentType);
    }
    static install(agentType, version) {
        return window.mainProcess.agentInstallation.install(agentType, version);
    }
    static onUninstallComplete(agentType, callback) {
        return window.mainProcess.agentInstallation.onUninstallComplete(agentType, callback);
    }
    static uninstall(agentType) {
        return window.mainProcess.agentInstallation.uninstall(agentType);
    }
    static checkForUpdates(agentType) {
        return window.mainProcess.agentInstallation.checkForUpdates(agentType);
    }
    static getAvailableVersions(agentType) {
        return window.mainProcess.agentInstallation.getAvailableVersions(agentType);
    }
    static getLatestVersion(agentType) {
        return window.mainProcess.agentInstallation.getLatestVersion(agentType);
    }
    static update(agentType) {
        return window.mainProcess.agentInstallation.update(agentType);
    }
}
