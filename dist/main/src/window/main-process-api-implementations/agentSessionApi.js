import { AgentSessionAPIEvents } from '../../shared/main-process-api-interfaces/AgentSessionAPI';
import { ipcRenderer } from 'electron';
/**
 * Clean Session Service for the renderer
 * Simply calls IPC methods - no knowledge of storage implementation
 */
export const agentSessionApi = {
    /**
     * Get active sessions (fast, from live storage)
     */
    getActiveSessions: () => ipcRenderer.invoke(AgentSessionAPIEvents.GET_ACTIVE_SESSIONS),
    /**
     * Get archived sessions (potentially slower, from file storage)
     */
    getArchivedSessions: () => ipcRenderer.invoke(AgentSessionAPIEvents.GET_ARCHIVED_SESSIONS),
    /**
     * Get sessions for a specific directory
     */
    getSessionsForDirectory: (directory) => ipcRenderer.invoke(AgentSessionAPIEvents.GET_SESSIONS_FOR_DIRECTORY, directory),
    /**
     * Get a specific session by ID
     */
    getSession: (sessionId, directory) => ipcRenderer.invoke(AgentSessionAPIEvents.GET_SESSION, sessionId, directory),
    /**
     * Get normalized events for a session
     */
    getSessionEvents: (sessionId) => ipcRenderer.invoke(AgentSessionAPIEvents.GET_SESSION_EVENTS, sessionId),
    /**
     * Delete a session
     */
    deleteSession: (sessionId, directory) => ipcRenderer.invoke(AgentSessionAPIEvents.DELETE_SESSION, sessionId, directory),
    /**
     * Clear all sessions for a directory
     */
    clearSessionsForDirectory: (directory) => ipcRenderer.invoke(AgentSessionAPIEvents.CLEAR_DIRECTORY_SESSIONS, directory),
    /**
     * Update session metadata (e.g., custom name)
     */
    updateSessionMetadata: (sessionId, directory, metadata) => ipcRenderer.invoke(AgentSessionAPIEvents.UPDATE_SESSION_METADATA, sessionId, directory, metadata),
    /**
     * Listen for session creation
     */
    onSessionCreated: (callback) => {
        const handler = (_, data) => callback(data);
        ipcRenderer.on(AgentSessionAPIEvents.SESSION_CREATED, handler);
        return () => {
            ipcRenderer.removeListener(AgentSessionAPIEvents.SESSION_CREATED, handler);
        };
    },
    /**
     * Listen for session updates
     */
    onSessionUpdated: (callback) => {
        const handler = (_, data) => callback(data);
        ipcRenderer.on(AgentSessionAPIEvents.SESSION_UPDATED, handler);
        return () => {
            ipcRenderer.removeListener(AgentSessionAPIEvents.SESSION_UPDATED, handler);
        };
    },
    /**
     * Listen for session deletions
     */
    onSessionDeleted: (callback) => {
        const handler = (_, data) => callback(data);
        ipcRenderer.on(AgentSessionAPIEvents.SESSION_DELETED, handler);
        return () => {
            ipcRenderer.removeListener(AgentSessionAPIEvents.SESSION_DELETED, handler);
        };
    },
    /**
     * Listen for session archival
     */
    onSessionArchived: (callback) => {
        const handler = (_, data) => callback(data);
        ipcRenderer.on(AgentSessionAPIEvents.SESSION_ARCHIVED, handler);
        return () => {
            ipcRenderer.removeListener(AgentSessionAPIEvents.SESSION_ARCHIVED, handler);
        };
    },
    /**
     * Delete from active storage only (preserve archive)
     */
    deleteFromActive: (sessionId) => ipcRenderer.invoke('sessions:delete-from-active', sessionId),
    /**
     * Reprocess events for a session
     */
    reprocessSession: (sessionId) => ipcRenderer.invoke('sessions:reprocess', sessionId),
    /**
     * Get raw session events (from agent-session-events API)
     */
    getRawSessionEvents: (sessionId) => ipcRenderer.invoke('sessions:get-raw-events', sessionId),
    /**
     * Listen for CLI provider events (real-time)
     */
    onCliProviderEvent: (callback) => {
        const handler = (_, event) => callback(event);
        ipcRenderer.on('cli-provider:event', handler);
        return () => {
            ipcRenderer.removeListener('cli-provider:event', handler);
        };
    },
    /**
     * Listen for processed events (real-time)
     */
    onProcessedEvent: (callback) => {
        const handler = (_, event) => callback(event);
        ipcRenderer.on('agent-session:processed-event', handler);
        return () => {
            ipcRenderer.removeListener('agent-session:processed-event', handler);
        };
    },
};
