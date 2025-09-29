import {
  AgentSessionAPIEvents,
  AgentSessionAPI,
} from '../../shared/main-process-api-interfaces/AgentSessionAPI';
import { ipcRenderer } from 'electron';
import type { RepoNormalizedUniversalAgentSessionEvent } from '@principal-ai/agent-monitoring';
import type { AgentSessionEvent } from '../../shared/main-process-api-interfaces/AgentSessionEventsAPI';

/**
 * Clean Session Service for the renderer
 * Simply calls IPC methods - no knowledge of storage implementation
 */
export const agentSessionApi: AgentSessionAPI = {
  /**
   * Get active sessions (fast, from live storage)
   */
  getActiveSessions: () =>
    ipcRenderer.invoke(AgentSessionAPIEvents.GET_ACTIVE_SESSIONS),

  /**
   * Get sessions for a specific directory
   */
  getSessionsForDirectory: (directory: string) =>
    ipcRenderer.invoke(
      AgentSessionAPIEvents.GET_SESSIONS_FOR_DIRECTORY,
      directory,
    ),

  /**
   * Get a specific session by ID
   */
  getSession: (sessionId: string, directory: string) =>
    ipcRenderer.invoke(AgentSessionAPIEvents.GET_SESSION, sessionId, directory),

  /**
   * Get normalized events for a session
   */
  getSessionEvents: (sessionId: string) =>
    ipcRenderer.invoke(AgentSessionAPIEvents.GET_SESSION_EVENTS, sessionId),

  /**
   * Delete a session
   */
  deleteSession: (sessionId: string, directory: string) =>
    ipcRenderer.invoke(
      AgentSessionAPIEvents.DELETE_SESSION,
      sessionId,
      directory,
    ),

  /**
   * Clear all sessions for a directory
   */
  clearSessionsForDirectory: (directory: string) =>
    ipcRenderer.invoke(
      AgentSessionAPIEvents.CLEAR_DIRECTORY_SESSIONS,
      directory,
    ),

  /**
   * Update session metadata (e.g., custom name)
   */
  updateSessionMetadata: (
    sessionId: string,
    directory: string,
    metadata: { customName?: string },
  ) =>
    ipcRenderer.invoke(
      AgentSessionAPIEvents.UPDATE_SESSION_METADATA,
      sessionId,
      directory,
      metadata,
    ),

  /**
   * Listen for session creation
   */
  onSessionCreated: (
    callback: (data: { sessionId: string; directory: string }) => void,
  ) => {
    const handler = (
      _event: unknown,
      data: { sessionId: string; directory: string },
    ) => callback(data);
    ipcRenderer.on(AgentSessionAPIEvents.SESSION_CREATED, handler);
    return () => {
      ipcRenderer.removeListener(
        AgentSessionAPIEvents.SESSION_CREATED,
        handler,
      );
    };
  },

  /**
   * Listen for session updates
   */
  onSessionUpdated: (
    callback: (data: { sessionId: string; directory: string }) => void,
  ) => {
    const handler = (
      _event: unknown,
      data: { sessionId: string; directory: string },
    ) => callback(data);
    ipcRenderer.on(AgentSessionAPIEvents.SESSION_UPDATED, handler);
    return () => {
      ipcRenderer.removeListener(
        AgentSessionAPIEvents.SESSION_UPDATED,
        handler,
      );
    };
  },

  /**
   * Listen for session deletions
   */
  onSessionDeleted: (
    callback: (data: { sessionId: string; directory: string }) => void,
  ) => {
    const handler = (
      _event: unknown,
      data: { sessionId: string; directory: string },
    ) => callback(data);
    ipcRenderer.on(AgentSessionAPIEvents.SESSION_DELETED, handler);
    return () => {
      ipcRenderer.removeListener(
        AgentSessionAPIEvents.SESSION_DELETED,
        handler,
      );
    };
  },

  /**
   * Reprocess events for a session
   */
  reprocessSession: (sessionId: string) =>
    ipcRenderer.invoke('sessions:reprocess', sessionId),

  /**
   * Get raw session events (from agent-session-events API)
   */
  getRawSessionEvents: (sessionId: string) =>
    ipcRenderer.invoke('sessions:get-raw-events', sessionId) as Promise<
      AgentSessionEvent[] | null
    >,

  /**
   * Listen for CLI provider events (real-time)
   */
  onCliProviderEvent: (
    callback: (event: RepoNormalizedUniversalAgentSessionEvent) => void,
  ) => {
    const handler = (
      _event: unknown,
      event: RepoNormalizedUniversalAgentSessionEvent,
    ) => callback(event);
    ipcRenderer.on('cli-provider:event', handler);
    return () => {
      ipcRenderer.removeListener('cli-provider:event', handler);
    };
  },

  /**
   * Listen for processed events (real-time)
   */
  onProcessedEvent: (
    callback: (event: RepoNormalizedUniversalAgentSessionEvent) => void,
  ) => {
    const handler = (
      _event: unknown,
      event: RepoNormalizedUniversalAgentSessionEvent,
    ) => callback(event);
    ipcRenderer.on('agent-session:processed-event', handler);
    return () => {
      ipcRenderer.removeListener('agent-session:processed-event', handler);
    };
  },
};
