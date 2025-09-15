/**
 * SessionViewAPI interface for managing session view operations
 * Replaces direct IPC calls for session view channels
 */
import { SessionView, SessionSegment } from '../sessionViewTypes';
export interface SessionStatistics {
    totalEvents: number;
    uniqueFilesAccessed: number;
    uniqueFilesModified: number;
    totalToolCalls: number;
    totalWebAccesses: number;
    segmentCount: number;
    duration: number;
    repositoryCount: number;
}
export interface SessionViewResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}
/**
 * Main SessionViewAPI interface
 */
export interface SessionViewAPI {
    /**
     * Get a complete session view with segments
     * @param sessionId - The session ID to retrieve
     * @returns Promise resolving to session view result
     */
    getSessionView(sessionId: string): Promise<SessionViewResult<SessionView>>;
    /**
     * Get details for a specific segment
     * @param sessionId - The session ID containing the segment
     * @param segmentId - The specific segment ID to retrieve
     * @returns Promise resolving to session segment result
     */
    getSegment(sessionId: string, segmentId: string): Promise<SessionViewResult<SessionSegment>>;
    /**
     * Get session statistics
     * @param sessionId - The session ID to get statistics for
     * @returns Promise resolving to session statistics result
     */
    getStatistics(sessionId: string): Promise<SessionViewResult<SessionStatistics>>;
}
//# sourceMappingURL=SessionViewAPI.d.ts.map