import { SessionViewService } from '../../main-process-api/SessionViewService';

// Re-export types from shared interfaces for backward compatibility
export type {
  SessionStatistics,
  SessionViewResult,
} from '../../../shared/main-process-api-interfaces/SessionViewAPI';
export type {
  SessionView,
  SessionSegment,
} from '../../../shared/sessionViewTypes';

/**
 * Session View API for renderer process
 * @deprecated Use SessionViewService directly instead
 */
export class SessionViewAPI {
  /**
   * Get a complete session view with segments
   * @deprecated Use SessionViewService.getSessionView instead
   */
  static async getSessionView(sessionId: string) {
    return SessionViewService.getSessionView(sessionId);
  }

  /**
   * Get details for a specific segment
   * @deprecated Use SessionViewService.getSegment instead
   */
  static async getSegment(sessionId: string, segmentId: string) {
    return SessionViewService.getSegment(sessionId, segmentId);
  }

  /**
   * Get session statistics
   * @deprecated Use SessionViewService.getStatistics instead
   */
  static async getStatistics(sessionId: string) {
    return SessionViewService.getStatistics(sessionId);
  }
}
