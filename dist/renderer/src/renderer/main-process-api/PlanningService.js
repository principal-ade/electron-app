/**
 * PlanningService - Service layer for planning event subscriptions
 *
 * This service encapsulates all window.mainProcess.planning calls to maintain
 * clean architecture and separation of concerns.
 *
 * ALL calls to window.mainProcess.planning MUST be made through this service.
 */
/**
 * Service for managing planning event subscriptions
 */
export class PlanningService {
    /**
     * Subscribe to slide update events from the planning MCP bridge
     * @param callback - Function to handle slide update events
     * @returns Cleanup function to remove the listener
     */
    static onSlideUpdated(callback) {
        try {
            return window.mainProcess.planning.onSlideUpdated(callback);
        }
        catch (error) {
            console.error('[PlanningService] Failed to subscribe to slide updates:', error);
            // Return a no-op cleanup function
            return () => { };
        }
    }
    /**
     * Subscribe to slide navigation events from the planning MCP bridge
     * @param callback - Function to handle slide navigation events
     * @returns Cleanup function to remove the listener
     */
    static onSlideNavigated(callback) {
        try {
            return window.mainProcess.planning.onSlideNavigated(callback);
        }
        catch (error) {
            console.error('[PlanningService] Failed to subscribe to slide navigation:', error);
            // Return a no-op cleanup function
            return () => { };
        }
    }
    /**
     * Subscribe to document load events from the planning MCP bridge
     * @param callback - Function to handle document load events
     * @returns Cleanup function to remove the listener
     */
    static onDocumentLoaded(callback) {
        try {
            return window.mainProcess.planning.onDocumentLoaded(callback);
        }
        catch (error) {
            console.error('[PlanningService] Failed to subscribe to document loads:', error);
            // Return a no-op cleanup function
            return () => { };
        }
    }
    /**
     * Subscribe to agent document request events
     * @param callback - Function to handle agent document requests
     * @returns Cleanup function to remove the listener
     */
    static onAgentDocumentRequest(callback) {
        try {
            return window.mainProcess.planning.onAgentDocumentRequest(callback);
        }
        catch (error) {
            console.error('[PlanningService] Failed to subscribe to agent document requests:', error);
            // Return a no-op cleanup function
            return () => { };
        }
    }
    /**
     * Send response to an agent document request
     * @param requestId - The request ID to respond to
     * @param response - The response data
     */
    static async sendAgentDocumentResponse(requestId, response) {
        try {
            await window.mainProcess.planning.sendAgentDocumentResponse(requestId, response);
        }
        catch (error) {
            console.error('[PlanningService] Failed to send agent document response:', error);
            throw new Error('Failed to send agent document response');
        }
    }
}
