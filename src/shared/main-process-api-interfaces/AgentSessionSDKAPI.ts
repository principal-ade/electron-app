/**
 * SDK-based Agent Session API
 *
 * This API uses the new SDK event format (RepoNormalizedUniversalAgentSessionEvent)
 * and provides repository-based session grouping instead of directory-based.
 */

import type { SessionState } from '../event-processing/SessionEventProcessor';
import type { RepoNormalizedUniversalAgentSessionEvent } from '@principal-ai/agent-monitoring';

/**
 * Session summary with SDK fields
 */
export interface SessionSummary {
  sessionId: string;
  repository: string; // Repository root instead of directory
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
  fileAccessCount?: number;
  fileWriteCount?: number;
  customName?: string;
}

/**
 * Project/repository-based session grouping
 */
export interface ProjectSessions {
  repository: string; // Repository root path
  repositoryName?: string; // Repository name
  summaries: SessionSummary[];
}

/**
 * IPC event names for SDK session operations
 */
export enum AgentSessionSDKAPIEvents {
  // Query operations
  GET_ACTIVE_SESSIONS_BY_PROJECT = 'sdk-sessions:get-active-by-project',
  GET_SESSIONS_FOR_DIRECTORY = 'sdk-sessions:get-for-directory',
  GET_SESSION = 'sdk-sessions:get-session',
  GET_SESSION_EVENTS = 'sdk-sessions:get-events',

  // Mutations
  UPDATE_SESSION_METADATA = 'sdk-sessions:update-metadata',
  DELETE_FROM_ACTIVE = 'sdk-sessions:delete-from-active',
  REPROCESS_SESSION = 'sdk-sessions:reprocess',

  // Debug operations
  GET_RAW_SESSION_EVENTS = 'sdk-sessions:get-raw-events',
  CHECK_EVENT_SERVER_HEALTH = 'sdk-sessions:check-event-server-health',

  // Events (for real-time updates)
  SESSION_CREATED = 'sdk-sessions:created',
  SESSION_UPDATED = 'sdk-sessions:updated',
  CLI_PROVIDER_EVENT = 'sdk-sessions:cli-event',
  PROCESSED_EVENT = 'sdk-sessions:processed-event',
}

/**
 * SDK-based Agent Session API interface
 */
export interface AgentSessionSDKAPI {
  // Get active sessions grouped by project/repository
  getActiveSessionsByProject: () => Promise<ProjectSessions[]>;

  // Get sessions for a specific directory (compatibility helper)
  getActiveSessionsForDirectory: (
    directory: string,
  ) => Promise<ProjectSessions | null>;

  // Get a specific session by ID
  getSDKSession: (
    sessionId: string,
    repository: string,
  ) => Promise<SessionState | null>;

  // Get events for a session in SDK format
  getSDKSessionEvents: (
    sessionId: string,
  ) => Promise<RepoNormalizedUniversalAgentSessionEvent[] | null>;

  // Check event server health
  checkEventServerHealth: () => Promise<{
    isRunning: boolean;
    port?: number;
    healthStatus?: 'healthy' | 'unhealthy' | 'unknown';
    error?: string;
  }>;

  onProcessedEvent: (
    callback: (event: RepoNormalizedUniversalAgentSessionEvent) => void,
  ) => () => void;
}
