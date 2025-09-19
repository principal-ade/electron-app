/**
 * Agent Session Archive API for managing session archiving configuration and operations
 */
import type { SessionState } from '../event-processing/SessionEventProcessor';

export interface AgentSessionArchiveAPI {
  /**
   * Get current archive configuration
   */
  getConfiguration: () => Promise<ArchiveConfiguration>;

  /**
   * Update archive configuration
   */
  updateConfiguration: (config: Partial<ArchiveConfiguration>) => Promise<void>;

  /**
   * Reset configuration to defaults
   */
  resetConfiguration: () => Promise<void>;

  /**
   * Manually archive a session
   */
  archiveSession: (
    sessionId: string,
    options?: ArchiveSessionOptions,
  ) => Promise<void>;

  /**
   * Archive all inactive sessions
   */
  archiveAllInactive: () => Promise<number>;

  /**
   * Get archive statistics
   */
  getStatistics: () => Promise<ArchiveStatistics>;

  /**
   * List all archived sessions
   */
  listArchivedSessions: () => Promise<ArchivedSessionSummary[]>;

  /**
   * Get a specific archived session
   */
  getArchivedSession: (sessionId: string) => Promise<SessionState | null>;

  /**
   * Delete an archived session
   */
  deleteArchivedSession: (sessionId: string) => Promise<void>;

  /**
   * Restore an archived session to active
   */
  restoreArchivedSession: (sessionId: string) => Promise<void>;
}

export interface ArchiveConfiguration {
  autoArchive: {
    enabled: boolean;
    inactivityThreshold: number; // hours
    completedSessionDelay: number; // seconds
    checkInterval: number; // minutes
  };
  storage: {
    maxArchiveAge: number; // days
    maxSummaryAge: number; // days
    maxArchiveSize: number; // MB
    compressArchives: boolean;
  };
  sessions: {
    archiveIncompleteSessions: boolean;
    minEventsToArchive: number;
    keepRawEvents: boolean;
    groupByRepository: boolean;
  };
  export: {
    defaultFormat: string;
    includeRawEvents: boolean;
    includeMetrics: boolean;
  };
}

export interface ArchiveSessionOptions {
  skipCleanup?: boolean;
  skipProcessedDelete?: boolean;
}

export interface ArchiveStatistics {
  totalArchived: number;
  totalSize: number;
  oldestArchive: number;
  newestArchive: number;
}

export interface ArchivedSessionSummary {
  sessionId: string;
  directory: string;
  archivedAt: number;
  reason?: string;
  eventCount?: number;
  fileCount?: number;
  metadata?: Record<string, unknown>;
}
