import type { SessionViewAPI, SessionViewResult, SessionStatistics } from '../../shared/main-process-api-interfaces/SessionViewAPI';
import type { SessionView, SessionSegment } from '../../shared/sessionViewTypes';


/**
 * Service layer for session view operations
 * Encapsulates all session view related IPC communication
 */
export class SessionViewService {
  private static api: SessionViewAPI = window.mainProcess.sessionView;

  /**
   * Get a complete session view with segments
   * @param sessionId - The session ID to retrieve
   * @returns Promise resolving to session view result
   */
  static async getSessionView(sessionId: string): Promise<SessionViewResult<SessionView>> {
    return await this.api.getSessionView(sessionId);
  }

  /**
   * Get details for a specific segment
   * @param sessionId - The session ID containing the segment
   * @param segmentId - The specific segment ID to retrieve
   * @returns Promise resolving to session segment result
   */
  static async getSegment(sessionId: string, segmentId: string): Promise<SessionViewResult<SessionSegment>> {
    return await this.api.getSegment(sessionId, segmentId);
  }

  /**
   * Get session statistics
   * @param sessionId - The session ID to get statistics for
   * @returns Promise resolving to session statistics result
   */
  static async getStatistics(sessionId: string): Promise<SessionViewResult<SessionStatistics>> {
    return await this.api.getStatistics(sessionId);
  }
}