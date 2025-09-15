import { SessionViewService } from '../../main-process-api/SessionViewService';
/**
 * Session View API for renderer process
 * @deprecated Use SessionViewService directly instead
 */
export class SessionViewAPI {
    /**
     * Get a complete session view with segments
     * @deprecated Use SessionViewService.getSessionView instead
     */
    static async getSessionView(sessionId) {
        return SessionViewService.getSessionView(sessionId);
    }
    /**
     * Get details for a specific segment
     * @deprecated Use SessionViewService.getSegment instead
     */
    static async getSegment(sessionId, segmentId) {
        return SessionViewService.getSegment(sessionId, segmentId);
    }
    /**
     * Get session statistics
     * @deprecated Use SessionViewService.getStatistics instead
     */
    static async getStatistics(sessionId) {
        return SessionViewService.getStatistics(sessionId);
    }
}
