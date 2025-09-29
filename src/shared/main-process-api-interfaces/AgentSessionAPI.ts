/**
 * Session API - Clean interface for session operations
 * The main process handles all storage details internally
 */

import type { SessionState } from '../event-processing/SessionEventProcessor';
import type { RepoNormalizedUniversalAgentSessionEvent } from '@principal-ai/agent-monitoring';

export interface SessionSummary {
  sessionId: string;
  directory: string;
  agentCLI: string;
  startTime: number;
  lastActivity: number;
  endTime?: number;
  active: boolean;
  needsReview?: boolean;
  eventCount: number;
  fileCount?: number;
  toolUseCount?: number;
  repositoriesAccessed?: string[];
  // UI-required fields for filtering and display
  fileAccessCount?: number;
  fileWriteCount?: number;
  customName?: string;
}

export interface DirectorySessions {
  directory: string;
  summaries: SessionSummary[];
}

export enum AgentSessionAPIEvents {
  // Query operations
  GET_ACTIVE_SESSIONS = 'sessions:get-active',
  GET_SESSIONS_FOR_DIRECTORY = 'sessions:get-for-directory',
  GET_SESSION = 'sessions:get-session',
  GET_SESSION_EVENTS = 'sessions:get-events',

  // Mutations
  DELETE_SESSION = 'sessions:delete',
  CLEAR_DIRECTORY_SESSIONS = 'sessions:clear-directory',
  UPDATE_SESSION_METADATA = 'sessions:update-metadata',

  // Events
  SESSION_CREATED = 'sessions:created',
  SESSION_UPDATED = 'sessions:updated',
  SESSION_DELETED = 'sessions:deleted',
}

export interface AgentSessionAPI {
  // Get active sessions (fast, from live storage)
  getActiveSessions: () => Promise<DirectorySessions[]>;

  // Get sessions for a specific directory
  getSessionsForDirectory: (directory: string) => Promise<{
    active: SessionSummary[];
  }>;

  // Get a specific session by ID
  getSession: (
    sessionId: string,
    directory: string,
  ) => Promise<SessionState | null>;

  // Get normalized events for a session
  getSessionEvents: (
    sessionId: string,
  ) => Promise<RepoNormalizedUniversalAgentSessionEvent[] | null>;

  // Delete a session
  deleteSession: (sessionId: string, directory: string) => Promise<boolean>;

  // Clear all sessions for a directory
  clearSessionsForDirectory: (directory: string) => Promise<boolean>;

  // Update session metadata (e.g., custom name)
  updateSessionMetadata: (
    sessionId: string,
    directory: string,
    metadata: { customName?: string },
  ) => Promise<boolean>;

  // Reprocess events for a session
  reprocessSession: (
    sessionId: string,
  ) => Promise<{ success: boolean; processedCount?: number; error?: string }>;

  // Get raw session events (from agent-session-events API)
  getRawSessionEvents: (sessionId: string) => Promise<any[] | null>;

  // Event listeners
  onSessionCreated: (
    callback: (data: { sessionId: string; directory: string }) => void,
  ) => () => void;
  onSessionUpdated: (
    callback: (data: { sessionId: string; directory: string }) => void,
  ) => () => void;
  onSessionDeleted: (
    callback: (data: { sessionId: string; directory: string }) => void,
  ) => () => void;

  // Real-time event listeners
  onCliProviderEvent: (callback: (event: any) => void) => () => void;
  onProcessedEvent: (callback: (event: any) => void) => () => void;
}
