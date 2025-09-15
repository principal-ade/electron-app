/**
 * Service layer for Agent Session Events functionality
 * ALL window.mainProcess.agentSessionEvents calls MUST be encapsulated here
 */
export class AgentSessionEventsService {
    /**
     * Subscribe to session events
     */
    static async subscribe(provider) {
        return window.mainProcess.agentSessionEvents.subscribe(provider);
    }
    /**
     * Clear stored events
     */
    static async clearEvents(provider) {
        return window.mainProcess.agentSessionEvents.clearEvents(provider);
    }
    /**
     * Get session events
     */
    static async getSessionEvents(sessionId) {
        return window.mainProcess.agentSessionEvents.getSessionEvents(sessionId);
    }
    /**
     * Reprocess session events
     */
    static async reprocessSessionEvents(sessionId) {
        return window.mainProcess.agentSessionEvents.reprocessSessionEvents(sessionId);
    }
    /**
     * Reprocess all events
     */
    static async reprocessAllEvents() {
        return window.mainProcess.agentSessionEvents.reprocessAllEvents();
    }
    /**
     * Get recent events from CLI providers
     */
    static async getRecentEvents(provider) {
        return window.mainProcess.agentSessionEvents.getRecentEvents(provider);
    }
    /**
     * Process a fallback file
     */
    static async processFallbackFile(filePath, cli) {
        return window.mainProcess.agentSessionEvents.processFallbackFile(filePath, cli);
    }
}
