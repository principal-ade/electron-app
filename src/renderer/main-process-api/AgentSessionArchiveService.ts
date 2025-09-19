/**
 * Service layer for Agent Session Archive functionality
 * ALL window.mainProcess.agentSessionArchive calls MUST be encapsulated here
 */

import type {
  ArchiveConfiguration,
  ArchivedSessionSummary,
  ArchiveStatistics,
  ArchiveSessionOptions,
} from '../../shared/main-process-api-interfaces/AgentSessionArchiveAPI';
import type { SessionState } from '../../shared/event-processing/SessionEventProcessor';

export class AgentSessionArchiveService {
  /**
   * Archive a session
   */
  static async archiveSession(
    sessionId: string,
    options?: ArchiveSessionOptions,
  ): Promise<void> {
    return window.mainProcess.agentSessionArchive.archiveSession(
      sessionId,
      options,
    );
  }

  /**
   * List all archived sessions
   */
  static async listArchivedSessions(): Promise<ArchivedSessionSummary[]> {
    return window.mainProcess.agentSessionArchive.listArchivedSessions();
  }

  /**
   * Get an archived session
   */
  static async getArchivedSession(
    sessionId: string,
  ): Promise<SessionState | null> {
    return window.mainProcess.agentSessionArchive.getArchivedSession(sessionId);
  }

  /**
   * Delete an archived session
   */
  static async deleteArchivedSession(sessionId: string): Promise<void> {
    return window.mainProcess.agentSessionArchive.deleteArchivedSession(
      sessionId,
    );
  }

  /**
   * Get archive configuration
   */
  static async getConfiguration(): Promise<ArchiveConfiguration> {
    return window.mainProcess.agentSessionArchive.getConfiguration();
  }

  /**
   * Update archive configuration
   */
  static async updateConfiguration(
    config: Partial<ArchiveConfiguration>,
  ): Promise<void> {
    return window.mainProcess.agentSessionArchive.updateConfiguration(config);
  }

  /**
   * Reset configuration to defaults
   */
  static async resetConfiguration(): Promise<void> {
    return window.mainProcess.agentSessionArchive.resetConfiguration();
  }

  /**
   * Archive all sessions
   */
  static async archiveAllInactive(): Promise<number> {
    return window.mainProcess.agentSessionArchive.archiveAllInactive();
  }

  /**
   * Get archive statistics
   */
  static async getStatistics(): Promise<ArchiveStatistics> {
    return window.mainProcess.agentSessionArchive.getStatistics();
  }

  /**
   * Restore an archived session
   */
  static async restoreArchivedSession(sessionId: string): Promise<void> {
    return window.mainProcess.agentSessionArchive.restoreArchivedSession(
      sessionId,
    );
  }
}
