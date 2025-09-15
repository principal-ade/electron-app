/**
 * Service layer for session view operations
 * Encapsulates all session view related IPC communication
 */
export class SessionViewService {
    static api = window.mainProcess.sessionView;
    /**
     * Get a complete session view with segments
     * @param sessionId - The session ID to retrieve
     * @returns Promise resolving to session view result
     */
    static async getSessionView(sessionId) {
        return await this.api.getSessionView(sessionId);
    }
    /**
     * Get details for a specific segment
     * @param sessionId - The session ID containing the segment
     * @param segmentId - The specific segment ID to retrieve
     * @returns Promise resolving to session segment result
     */
    static async getSegment(sessionId, segmentId) {
        return await this.api.getSegment(sessionId, segmentId);
    }
    /**
     * Get session statistics
     * @param sessionId - The session ID to get statistics for
     * @returns Promise resolving to session statistics result
     */
    static async getStatistics(sessionId) {
        return await this.api.getStatistics(sessionId);
    }
}
