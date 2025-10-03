/**
 * RemoteAgentWindowService - Service layer for remote agent window operations
 *
 * This service encapsulates all window.mainProcess.remoteAgentWindow calls to maintain
 * clean architecture and separation of concerns.
 *
 * ALL calls to window.mainProcess.remoteAgentWindow MUST be made through this service.
 */

import type {
  RemoteAgentConfig,
  RemoteAgentWindowOptions,
  RemoteAgentWindowState,
} from '../../shared/types/remoteAgent.types';

/**
 * Service for managing remote agent windows
 */
export class RemoteAgentWindowService {
  /**
   * Open a remote agent in a new window
   */
  static async openRemoteAgent(
    config: RemoteAgentConfig,
    options?: RemoteAgentWindowOptions
  ): Promise<string> {
    try {
      return await window.mainProcess.remoteAgentWindow.openRemoteAgent(config, options);
    } catch (error) {
      console.error('[RemoteAgentWindowService] Failed to open remote agent:', error);
      throw error;
    }
  }

  /**
   * Switch to a remote agent window
   */
  static async switchToAgent(agentId: string): Promise<void> {
    try {
      await window.mainProcess.remoteAgentWindow.switchToAgent(agentId);
    } catch (error) {
      console.error('[RemoteAgentWindowService] Failed to switch remote agent:', error);
      throw error;
    }
  }

  /**
   * Close a remote agent window
   */
  static async closeRemoteAgent(agentId: string): Promise<void> {
    try {
      await window.mainProcess.remoteAgentWindow.closeRemoteAgent(agentId);
    } catch (error) {
      console.error('[RemoteAgentWindowService] Failed to close remote agent:', error);
      throw error;
    }
  }

  /**
   * Focus a remote agent window
   */
  static async focusRemoteAgent(agentId: string): Promise<void> {
    try {
      await window.mainProcess.remoteAgentWindow.focusRemoteAgent(agentId);
    } catch (error) {
      console.error('[RemoteAgentWindowService] Failed to focus remote agent:', error);
      throw error;
    }
  }

  /**
   * List all remote agents
   */
  static async listRemoteAgents(): Promise<RemoteAgentConfig[]> {
    try {
      return await window.mainProcess.remoteAgentWindow.listRemoteAgents();
    } catch (error) {
      console.error('[RemoteAgentWindowService] Failed to list remote agents:', error);
      throw error;
    }
  }

  /**
   * Get the currently active remote agent id
   */
  static async getActiveAgentId(): Promise<string | null> {
    try {
      return await window.mainProcess.remoteAgentWindow.getActiveAgentId();
    } catch (error) {
      console.error('[RemoteAgentWindowService] Failed to get active remote agent id:', error);
      throw error;
    }
  }

  /**
   * Get the state of a remote agent
   */
  static async getRemoteAgentState(agentId: string): Promise<RemoteAgentWindowState> {
    try {
      return await window.mainProcess.remoteAgentWindow.getRemoteAgentState(agentId);
    } catch (error) {
      console.error('[RemoteAgentWindowService] Failed to get remote agent state:', error);
      throw error;
    }
  }

  /**
   * Send a message to a remote agent
   */
  static async sendMessageToRemoteAgent(agentId: string, message: any): Promise<void> {
    try {
      await window.mainProcess.remoteAgentWindow.sendMessageToRemoteAgent(agentId, message);
    } catch (error) {
      console.error('[RemoteAgentWindowService] Failed to send message to remote agent:', error);
      throw error;
    }
  }

  /**
   * Subscribe to remote agent state changes
   */
  static onRemoteAgentStateChanged(
    callback: (agentId: string, state: RemoteAgentWindowState) => void
  ): () => void {
    return window.mainProcess.remoteAgentWindow.onRemoteAgentStateChanged(callback);
  }

  /**
   * Subscribe to messages from remote agents
   */
  static onRemoteAgentMessage(
    callback: (agentId: string, message: any) => void
  ): () => void {
    return window.mainProcess.remoteAgentWindow.onRemoteAgentMessage(callback);
  }

  /**
   * Subscribe to remote agent list changes
   */
  static onRemoteAgentListChanged(
    callback: (agents: RemoteAgentConfig[], activeAgentId: string | null) => void
  ): () => void {
    return window.mainProcess.remoteAgentWindow.onRemoteAgentListChanged(callback);
  }

  /**
   * Subscribe to active remote agent changes
   */
  static onRemoteAgentActiveChanged(
    callback: (agentId: string | null) => void
  ): () => void {
    return window.mainProcess.remoteAgentWindow.onRemoteAgentActiveChanged(callback);
  }
}
