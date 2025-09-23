/**
 * SDK-based Agent Session API implementation for the renderer
 */

import {
  AgentSessionSDKAPIEvents,
  AgentSessionSDKAPI,
} from '../../shared/main-process-api-interfaces/AgentSessionSDKAPI';
import { ipcRenderer } from 'electron';

/**
 * SDK Session API implementation that calls IPC methods
 */
export const agentSessionSDKApi: AgentSessionSDKAPI = {
  /**
   * Get active sessions grouped by project
   */
  getActiveSessionsByProject: () =>
    ipcRenderer.invoke(AgentSessionSDKAPIEvents.GET_ACTIVE_SESSIONS_BY_PROJECT),

  /**
   * Get sessions for a specific directory (maps to repository)
   */
  getActiveSessionsForDirectory: (directory: string) =>
    ipcRenderer.invoke(
      AgentSessionSDKAPIEvents.GET_SESSIONS_FOR_DIRECTORY,
      directory,
    ),

  /**
   * Get a specific session by ID
   */
  getSDKSession: (sessionId: string, repository: string) =>
    ipcRenderer.invoke(
      AgentSessionSDKAPIEvents.GET_SESSION,
      sessionId,
      repository,
    ),

  /**
   * Get events for a session in SDK format
   */
  getSDKSessionEvents: (sessionId: string) =>
    ipcRenderer.invoke(AgentSessionSDKAPIEvents.GET_SESSION_EVENTS, sessionId),

  /**
   * Update session metadata
   */
  updateSessionMetadata: (
    sessionId: string,
    repository: string,
    metadata: { customName?: string },
  ) =>
    ipcRenderer.invoke(
      AgentSessionSDKAPIEvents.UPDATE_SESSION_METADATA,
      sessionId,
      repository,
      metadata,
    ),

  /**
   * Delete from active storage
   */
  deleteFromActive: (sessionId: string) =>
    ipcRenderer.invoke(AgentSessionSDKAPIEvents.DELETE_FROM_ACTIVE, sessionId),

  /**
   * Reprocess session
   */
  reprocessSession: (sessionId: string) =>
    ipcRenderer.invoke(AgentSessionSDKAPIEvents.REPROCESS_SESSION, sessionId),

  /**
   * Get raw session events
   */
  getRawSessionEvents: (sessionId: string) =>
    ipcRenderer.invoke(
      AgentSessionSDKAPIEvents.GET_RAW_SESSION_EVENTS,
      sessionId,
    ),

  /**
   * Subscribe to session updates
   */
  onSessionUpdated: (
    callback: (data: { sessionId: string; repository: string }) => void,
  ) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on(AgentSessionSDKAPIEvents.SESSION_UPDATED, handler);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(
        AgentSessionSDKAPIEvents.SESSION_UPDATED,
        handler,
      );
    };
  },

  /**
   * Subscribe to CLI provider events
   */
  onCliProviderEvent: (callback: (event: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on(AgentSessionSDKAPIEvents.CLI_PROVIDER_EVENT, handler);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(
        AgentSessionSDKAPIEvents.CLI_PROVIDER_EVENT,
        handler,
      );
    };
  },

  /**
   * Subscribe to processed events
   */
  onProcessedEvent: (callback: (event: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on(AgentSessionSDKAPIEvents.PROCESSED_EVENT, handler);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(
        AgentSessionSDKAPIEvents.PROCESSED_EVENT,
        handler,
      );
    };
  },
};