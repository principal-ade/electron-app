/**
 * SDK-based Agent Session API implementation for the renderer
 */

import { ipcRenderer, type IpcRendererEvent } from 'electron';

import type { RepoNormalizedUniversalAgentSessionEvent } from '@principal-ai/agent-monitoring';
import {
  AgentSessionSDKAPIEvents,
  AgentSessionSDKAPI,
} from '../../shared/main-process-api-interfaces/AgentSessionSDKAPI';

// Track MessagePorts per repository
// Using 'unknown' type since MessagePort is a DOM type not available in preload's type context
const eventPorts: Map<string, unknown> = new Map();

// Track event subscribers per repository
const eventSubscribers: Map<
  string,
  Set<(event: RepoNormalizedUniversalAgentSessionEvent) => void>
> = new Map();

// Track port ready callbacks
const portReadyCallbacks: Set<(data: { repository: string }) => void> =
  new Set();

// MessagePort interface for type safety
interface MessagePortLike {
  onmessage: ((event: { data: unknown }) => void) | null;
  start: () => void;
  close: () => void;
}

/**
 * Handle incoming MessagePort for a repository
 */
function handleEventPort(repository: string, port: MessagePortLike): void {
  // Clean up existing port if any
  const existingPort = eventPorts.get(repository) as
    | MessagePortLike
    | undefined;
  if (existingPort) {
    existingPort.close();
  }

  // Store the new port
  eventPorts.set(repository, port);

  // Set up message handler
  port.onmessage = (event: { data: unknown }) => {
    const data = event.data as { type?: string; event?: unknown } | undefined;
    if (data?.type === 'AGENT_EVENT' && data.event) {
      const agentEvent = data.event as RepoNormalizedUniversalAgentSessionEvent;

      // Notify subscribers for this repository
      const subscribers = eventSubscribers.get(repository);
      if (subscribers) {
        subscribers.forEach((callback) => {
          try {
            callback(agentEvent);
          } catch (error) {
            console.error(
              '[AgentSessionSDKApi] Error in event subscriber:',
              error,
            );
          }
        });
      }
    }
  };

  // Start receiving messages
  port.start();

  // Notify port ready callbacks
  portReadyCallbacks.forEach((callback) => {
    try {
      callback({ repository });
    } catch (error) {
      console.error(
        '[AgentSessionSDKApi] Error in port ready callback:',
        error,
      );
    }
  });
}

// Listen for MessagePort transfers from main process
ipcRenderer.on(
  AgentSessionSDKAPIEvents.EVENT_PORT_READY,
  (event: IpcRendererEvent, data: { repository: string }) => {
    // The MessagePort comes in event.ports array
    const ports = (event as unknown as { ports?: MessagePortLike[] }).ports;
    if (ports && ports.length > 0) {
      handleEventPort(data.repository, ports[0]);
    } else {
      console.error(
        '[AgentSessionSDKApi] EVENT_PORT_READY received without port',
      );
    }
  },
);

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
   * @deprecated Use registerEventPort instead for direct MessagePort communication
   */
  onProcessedEvent: (
    _callback: (event: RepoNormalizedUniversalAgentSessionEvent) => void,
  ) => {
    // No longer used - events come via MessagePorts registered with registerEventPort
    return () => {
      // No-op unsubscribe
    };
  },

  /**
   * Register for events from a specific repository via direct MessagePort
   */
  registerEventPort: async (repository: string): Promise<boolean> => {
    try {
      const result = await ipcRenderer.invoke(
        AgentSessionSDKAPIEvents.REGISTER_EVENT_PORT,
        repository,
      );
      return result === true;
    } catch (error) {
      console.error(
        '[AgentSessionSDKApi] Failed to register event port:',
        error,
      );
      return false;
    }
  },

  /**
   * Unregister from events for a repository
   */
  unregisterEventPort: async (repository: string): Promise<void> => {
    // Close local port
    const port = eventPorts.get(repository) as MessagePortLike | undefined;
    if (port) {
      port.close();
      eventPorts.delete(repository);
    }

    // Remove subscribers
    eventSubscribers.delete(repository);

    // Notify main process
    try {
      await ipcRenderer.invoke(
        AgentSessionSDKAPIEvents.UNREGISTER_EVENT_PORT,
        repository,
      );
    } catch (error) {
      console.error(
        '[AgentSessionSDKApi] Failed to unregister event port:',
        error,
      );
    }
  },

  /**
   * Callback for when a MessagePort is ready
   */
  onEventPortReady: (
    callback: (data: { repository: string }) => void,
  ): (() => void) => {
    portReadyCallbacks.add(callback);

    return () => {
      portReadyCallbacks.delete(callback);
    };
  },

  /**
   * Subscribe to events for a specific repository
   * Call this after registerEventPort succeeds
   */
  subscribeToRepositoryEvents: (
    repository: string,
    callback: (event: RepoNormalizedUniversalAgentSessionEvent) => void,
  ): (() => void) => {
    if (!eventSubscribers.has(repository)) {
      eventSubscribers.set(repository, new Set());
    }
    eventSubscribers.get(repository)!.add(callback);

    return () => {
      const subscribers = eventSubscribers.get(repository);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          eventSubscribers.delete(repository);
        }
      }
    };
  },
};
