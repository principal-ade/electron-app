/**
 * Service layer for Agent Session Archive functionality
 * ALL window.mainProcess.agentSessionArchive calls MUST be encapsulated here
 */
export class AgentSessionArchiveService {
    /**
     * Archive a session
     */
    static async archiveSession(sessionId, options) {
        return window.mainProcess.agentSessionArchive.archiveSession(sessionId, options);
    }
    /**
     * List all archived sessions
     */
    static async listArchivedSessions() {
        return window.mainProcess.agentSessionArchive.listArchivedSessions();
    }
    /**
     * Get an archived session
     */
    static async getArchivedSession(sessionId) {
        return window.mainProcess.agentSessionArchive.getArchivedSession(sessionId);
    }
    /**
     * Delete an archived session
     */
    static async deleteArchivedSession(sessionId) {
        return window.mainProcess.agentSessionArchive.deleteArchivedSession(sessionId);
    }
    /**
     * Get archive configuration
     */
    static async getConfiguration() {
        return window.mainProcess.agentSessionArchive.getConfiguration();
    }
    /**
     * Update archive configuration
     */
    static async updateConfiguration(config) {
        return window.mainProcess.agentSessionArchive.updateConfiguration(config);
    }
    /**
     * Reset configuration to defaults
     */
    static async resetConfiguration() {
        return window.mainProcess.agentSessionArchive.resetConfiguration();
    }
    /**
     * Archive all sessions
     */
    static async archiveAllInactive() {
        return window.mainProcess.agentSessionArchive.archiveAllInactive();
    }
    /**
     * Get archive statistics
     */
    static async getStatistics() {
        return window.mainProcess.agentSessionArchive.getStatistics();
    }
    /**
     * Restore an archived session
     */
    static async restoreArchivedSession(sessionId) {
        return window.mainProcess.agentSessionArchive.restoreArchivedSession(sessionId);
    }
}
