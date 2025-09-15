/**
 * Service layer for agent auto-update functionality
 * ALL window.mainProcess.agentUpdate calls MUST be encapsulated here
 */
export class AgentAutoUpdateService {
    /**
     * Check all agents for updates
     */
    static async checkAllForUpdates() {
        return window.mainProcess.agentUpdate.checkAllForUpdates();
    }
    /**
     * Check a specific agent for updates
     */
    static async checkForUpdate(agentType) {
        return window.mainProcess.agentUpdate.checkForUpdate(agentType);
    }
    /**
     * Get update preferences
     */
    static async getUpdatePreferences() {
        return window.mainProcess.agentUpdate.getUpdatePreferences();
    }
    /**
     * Save update preferences
     */
    static async saveUpdatePreferences(preferences) {
        return window.mainProcess.agentUpdate.saveUpdatePreferences(preferences);
    }
    /**
     * Get stored update info for an agent
     */
    static async getStoredUpdateInfo(agentType) {
        return window.mainProcess.agentUpdate.getStoredUpdateInfo(agentType);
    }
    /**
     * Clear stored update info for an agent
     */
    static async clearStoredUpdateInfo(agentType) {
        return window.mainProcess.agentUpdate.clearStoredUpdateInfo(agentType);
    }
    /**
     * Listen for update available events
     */
    static onUpdateAvailable(callback) {
        return window.mainProcess.agentUpdate.onUpdateAvailable(callback);
    }
}
