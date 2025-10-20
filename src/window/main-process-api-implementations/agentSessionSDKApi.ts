/**
 * SDK-based Agent Session API implementation for the renderer
 */

import { ipcRenderer, type IpcRendererEvent } from 'electron';

import type { RepoNormalizedUniversalAgentSessionEvent } from '@principal-ai/agent-monitoring';
import {
  AgentSessionSDKAPIEvents,
  AgentSessionSDKAPI,
} from '../../shared/main-process-api-interfaces/AgentSessionSDKAPI';

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
   * Check event server health
   */
  checkEventServerHealth: () =>
    ipcRenderer.invoke(AgentSessionSDKAPIEvents.CHECK_EVENT_SERVER_HEALTH),

  /**
   * Subscribe to processed events
   */
  onProcessedEvent: (
    callback: (event: RepoNormalizedUniversalAgentSessionEvent) => void,
  ) => {
    console.log(
      '[agentSessionSDKApi] Setting up IPC listener for:',
      AgentSessionSDKAPIEvents.PROCESSED_EVENT,
    );

    const handler = (
      _event: IpcRendererEvent,
      data: RepoNormalizedUniversalAgentSessionEvent,
    ) => {
      console.log(
        '[agentSessionSDKApi] ========== IPC EVENT RECEIVED ==========',
      );
      console.log('[agentSessionSDKApi] Event type:', data.eventType);
      console.log('[agentSessionSDKApi] Session ID:', data.sessionId);
      console.log('[agentSessionSDKApi] Tool name:', data.toolName);
      console.log('[agentSessionSDKApi] Full event:', data);
      callback(data);
    };

    ipcRenderer.on(AgentSessionSDKAPIEvents.PROCESSED_EVENT, handler);

    console.log('[agentSessionSDKApi] IPC listener registered successfully');

    // Return unsubscribe function
    return () => {
      console.log('[agentSessionSDKApi] Unsubscribing from IPC events');
      ipcRenderer.removeListener(
        AgentSessionSDKAPIEvents.PROCESSED_EVENT,
        handler,
      );
    };
  },
};
