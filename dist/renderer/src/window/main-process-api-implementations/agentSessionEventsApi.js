import { ipcRenderer } from 'electron';
import { AgentSessionEventsAPIEvent } from '../../shared/main-process-api-interfaces/AgentSessionEventsAPI';
// Extend the existing API with watching capabilities
class AgentSessionEventsAPIExtended {
    eventListeners = new Map();
    constructor() {
        // Listen for real-time session events from main process
        ipcRenderer.on('session-event-update', (_event, update) => {
            this.notifyListeners(update);
        });
    }
    // Existing API methods
    subscribe = (provider) => ipcRenderer.invoke(AgentSessionEventsAPIEvent.SUBSCRIBE, provider);
    getRecentEvents = (provider) => ipcRenderer.invoke(AgentSessionEventsAPIEvent.GET_RECENT_EVENTS, provider);
    getSessionEvents = (sessionId) => ipcRenderer.invoke(AgentSessionEventsAPIEvent.GET_SESSION_EVENTS, sessionId);
    clearEvents = (provider) => ipcRenderer.invoke(AgentSessionEventsAPIEvent.CLEAR_EVENTS, provider);
    reprocessAllEvents = () => ipcRenderer.invoke(AgentSessionEventsAPIEvent.REPROCESS_ALL_EVENTS);
    reprocessSessionEvents = (sessionId) => ipcRenderer.invoke(AgentSessionEventsAPIEvent.REPROCESS_SESSION_EVENTS, sessionId);
    processFallbackFile = (filePath, cli) => ipcRenderer.invoke('agent-session-events:process-fallback-file', filePath, cli);
    // New watching methods
    /**
     * Watch for real-time session events for a directory
     */
    watchSessionEvents(directory, callback) {
        if (!this.eventListeners.has(directory)) {
            this.eventListeners.set(directory, new Set());
            // Tell main process we want real-time updates for this directory
            ipcRenderer.send('watch-session-events', directory);
        }
        this.eventListeners.get(directory).add(callback);
        // Return unsubscribe function
        return () => {
            const listeners = this.eventListeners.get(directory);
            if (listeners) {
                listeners.delete(callback);
                if (listeners.size === 0) {
                    this.eventListeners.delete(directory);
                    ipcRenderer.send('unwatch-session-events', directory);
                }
            }
        };
    }
    /**
     * Get live session statistics
     */
    async getSessionStats(sessionId) {
        return ipcRenderer.invoke('get-session-stats', sessionId);
    }
    notifyListeners(update) {
        // Notify directory-specific listeners
        const listeners = this.eventListeners.get(update.workingDirectory);
        if (listeners) {
            listeners.forEach(callback => callback(update));
        }
        // Also notify listeners watching parent directories
        for (const [dir, dirListeners] of this.eventListeners) {
            if (update.workingDirectory.startsWith(dir) && dir !== update.workingDirectory) {
                dirListeners.forEach(callback => callback(update));
            }
        }
    }
}
export const agentSessionEventsAPI = new AgentSessionEventsAPIExtended();
