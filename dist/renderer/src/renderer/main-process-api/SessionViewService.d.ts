import type { SessionViewResult, SessionStatistics } from '../../shared/main-process-api-interfaces/SessionViewAPI';
import type { SessionView, SessionSegment } from '../../shared/sessionViewTypes';
/**
 * Service layer for session view operations
 * Encapsulates all session view related IPC communication
 */
export declare class SessionViewService {
    private static api;
    /**
     * Get a complete session view with segments
     * @param sessionId - The session ID to retrieve
     * @returns Promise resolving to session view result
     */
    static getSessionView(sessionId: string): Promise<SessionViewResult<SessionView>>;
    /**
     * Get details for a specific segment
     * @param sessionId - The session ID containing the segment
     * @param segmentId - The specific segment ID to retrieve
     * @returns Promise resolving to session segment result
     */
    static getSegment(sessionId: string, segmentId: string): Promise<SessionViewResult<SessionSegment>>;
    /**
     * Get session statistics
     * @param sessionId - The session ID to get statistics for
     * @returns Promise resolving to session statistics result
     */
    static getStatistics(sessionId: string): Promise<SessionViewResult<SessionStatistics>>;
}
//# sourceMappingURL=SessionViewService.d.ts.map