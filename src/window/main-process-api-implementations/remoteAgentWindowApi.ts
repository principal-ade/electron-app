/**
 * RemoteAgentWindowAPI preload implementation
 * Provides type-safe access to remote agent window operations
 */

import { ipcRenderer } from 'electron';
import type { RemoteAgentWindowAPI } from '../../shared/main-process-api-interfaces/RemoteAgentWindowAPI';
import { RemoteAgentWindowEvent } from '../../shared/main-process-api-interfaces/RemoteAgentWindowAPI';
import type {
  RemoteAgentConfig,
  RemoteAgentWindowOptions,
  RemoteAgentWindowState,
  RemoteAgentMessage,
} from '../../shared/types/remoteAgent.types';

/**
 * Remote Agent Window API implementation for preload script
 */
export const remoteAgentWindowAPI: RemoteAgentWindowAPI = {
  /**
   * Open a remote agent in a new window
   */
  openRemoteAgent: async (
    config: RemoteAgentConfig,
    options?: RemoteAgentWindowOptions
  ): Promise<string> => {
    const result = await ipcRenderer.invoke(
      RemoteAgentWindowEvent.OPEN_REMOTE_AGENT,
      config,
      options
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to open remote agent');
    }

    return result.agentId;
  },

  /**
   * Close a remote agent window
   */
  closeRemoteAgent: async (agentId: string): Promise<void> => {
    const result = await ipcRenderer.invoke(
      RemoteAgentWindowEvent.CLOSE_REMOTE_AGENT,
      agentId
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to close remote agent');
    }
  },

  /**
   * Focus a remote agent window
   */
  focusRemoteAgent: async (agentId: string): Promise<void> => {
    const result = await ipcRenderer.invoke(
      RemoteAgentWindowEvent.FOCUS_REMOTE_AGENT,
      agentId
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to focus remote agent');
    }
  },

  /**
   * List all remote agents
   */
  listRemoteAgents: async (): Promise<RemoteAgentConfig[]> => {
    const result = await ipcRenderer.invoke(RemoteAgentWindowEvent.LIST_REMOTE_AGENTS);

    if (!result.success) {
      throw new Error(result.error || 'Failed to list remote agents');
    }

    return result.agents;
  },

  /**
   * Get the state of a remote agent
   */
  getRemoteAgentState: async (agentId: string): Promise<RemoteAgentWindowState> => {
    const result = await ipcRenderer.invoke(
      RemoteAgentWindowEvent.GET_REMOTE_AGENT_STATE,
      agentId
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to get remote agent state');
    }

    return result.state;
  },

  /**
   * Send a message to a remote agent
   */
  sendMessageToRemoteAgent: async (agentId: string, message: RemoteAgentMessage): Promise<void> => {
    const result = await ipcRenderer.invoke(
      RemoteAgentWindowEvent.SEND_MESSAGE_TO_REMOTE_AGENT,
      agentId,
      message
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to send message to remote agent');
    }
  },

  /**
   * Subscribe to remote agent state changes
   */
  onRemoteAgentStateChanged: (
    callback: (agentId: string, state: RemoteAgentWindowState) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: { agentId: string; state: RemoteAgentWindowState }
    ) => {
      callback(data.agentId, data.state);
    };

    ipcRenderer.on(RemoteAgentWindowEvent.REMOTE_AGENT_STATE_CHANGED, listener);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(
        RemoteAgentWindowEvent.REMOTE_AGENT_STATE_CHANGED,
        listener
      );
    };
  },

  /**
   * Subscribe to messages from remote agents
   */
  onRemoteAgentMessage: (
    callback: (agentId: string, message: RemoteAgentMessage) => void
  ): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { agentId: string; message: RemoteAgentMessage }) => {
      callback(data.agentId, data.message);
    };

    ipcRenderer.on(RemoteAgentWindowEvent.REMOTE_AGENT_MESSAGE, listener);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(RemoteAgentWindowEvent.REMOTE_AGENT_MESSAGE, listener);
    };
  },

  /**
   * Switch to a different remote agent
   */
  switchToAgent: async (agentId: string): Promise<void> => {
    const result = await ipcRenderer.invoke(
      RemoteAgentWindowEvent.SWITCH_TO_AGENT,
      agentId
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to switch to agent');
    }
  },

  /**
   * Get the active agent ID
   */
  getActiveAgentId: async (): Promise<string | null> => {
    const result = await ipcRenderer.invoke(RemoteAgentWindowEvent.GET_ACTIVE_AGENT_ID);

    if (!result.success) {
      throw new Error(result.error || 'Failed to get active agent ID');
    }

    return result.agentId;
  },

  /**
   * Subscribe to agent list changes
   */
  onRemoteAgentListChanged: (
    callback: (agents: RemoteAgentConfig[], activeAgentId: string | null) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: { agents: RemoteAgentConfig[]; activeAgentId: string | null }
    ) => {
      callback(data.agents, data.activeAgentId);
    };

    ipcRenderer.on(RemoteAgentWindowEvent.REMOTE_AGENT_LIST_CHANGED, listener);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(RemoteAgentWindowEvent.REMOTE_AGENT_LIST_CHANGED, listener);
    };
  },

  /**
   * Subscribe to active agent changes
   */
  onRemoteAgentActiveChanged: (
    callback: (agentId: string) => void
  ): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { agentId: string }) => {
      callback(data.agentId);
    };

    ipcRenderer.on(RemoteAgentWindowEvent.REMOTE_AGENT_ACTIVE_CHANGED, listener);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(RemoteAgentWindowEvent.REMOTE_AGENT_ACTIVE_CHANGED, listener);
    };
  },
};