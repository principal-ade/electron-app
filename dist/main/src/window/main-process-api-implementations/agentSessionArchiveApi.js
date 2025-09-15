import { ipcRenderer } from 'electron';
/**
 * Agent Session Archive API implementation for renderer process
 */
export const agentSessionArchiveAPI = {
    /**
     * Get current archive configuration
     */
    getConfiguration: () => {
        return ipcRenderer.invoke('archive:get-config');
    },
    /**
     * Update archive configuration
     */
    updateConfiguration: (config) => {
        return ipcRenderer.invoke('archive:update-config', config);
    },
    /**
     * Reset configuration to defaults
     */
    resetConfiguration: () => {
        return ipcRenderer.invoke('archive:reset-configuration');
    },
    /**
     * Manually archive a session
     */
    archiveSession: (sessionId, options) => {
        return ipcRenderer.invoke('archive:archive-session', sessionId, options);
    },
    /**
     * Archive all inactive sessions
     */
    archiveAllInactive: () => {
        return ipcRenderer.invoke('archive:archive-all-inactive');
    },
    /**
     * Archive all sessions (alias for compatibility)
     */
    archiveAll: () => {
        return ipcRenderer.invoke('archive:archive-all');
    },
    /**
     * Get archive statistics
     */
    getStatistics: () => {
        return ipcRenderer.invoke('archive:get-statistics');
    },
    /**
     * List all archived sessions
     */
    listArchivedSessions: () => {
        return ipcRenderer.invoke('archive:list-archived-sessions');
    },
    /**
     * Get a specific archived session
     */
    getArchivedSession: (sessionId) => {
        return ipcRenderer.invoke('archive:get-archived-session', sessionId);
    },
    /**
     * Delete an archived session
     */
    deleteArchivedSession: (sessionId) => {
        return ipcRenderer.invoke('archive:delete-archived-session', sessionId);
    },
    /**
     * Restore an archived session to active
     */
    restoreArchivedSession: (sessionId) => {
        return ipcRenderer.invoke('archive:restore-archived-session', sessionId);
    },
    /**
     * Load an archived session (used by debug views)
     */
    loadSession: (sessionId) => {
        return ipcRenderer.invoke('archive:load-session', sessionId);
    },
};
