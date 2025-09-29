import { RemoteAgentWindowService } from '../main-process-api/RemoteAgentWindowService';
import {
  RemoteAgentConfig,
  RemoteAgentWindowOptions,
  RemoteAgentWindowState,
} from '../../shared/types/remoteAgent.types';

/**
 * Service for managing remote agent windows
 */
export class RemoteAgentService {
  private stateChangeListeners: Set<
    (agentId: string, state: RemoteAgentWindowState) => void
  > = new Set();
  private messageListeners: Set<(agentId: string, message: any) => void> = new Set();
  private unsubscribeStateChange?: () => void;
  private unsubscribeMessage?: () => void;

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Open a remote agent in a new window
   */
  async openRemoteAgent(
    config: RemoteAgentConfig,
    options?: RemoteAgentWindowOptions
  ): Promise<string> {
    try {
      const agentId = await RemoteAgentWindowService.openRemoteAgent(config, options);
      return agentId;
    } catch (error) {
      console.error('Failed to open remote agent:', error);
      throw error;
    }
  }

  /**
   * Close a remote agent window
   */
  async closeRemoteAgent(agentId: string): Promise<void> {
    try {
      await RemoteAgentWindowService.closeRemoteAgent(agentId);
    } catch (error) {
      console.error('Failed to close remote agent:', error);
      throw error;
    }
  }

  /**
   * Focus a remote agent window
   */
  async focusRemoteAgent(agentId: string): Promise<void> {
    try {
      await RemoteAgentWindowService.focusRemoteAgent(agentId);
    } catch (error) {
      console.error('Failed to focus remote agent:', error);
      throw error;
    }
  }

  /**
   * List all remote agents
   */
  async listRemoteAgents(): Promise<RemoteAgentConfig[]> {
    try {
      return await RemoteAgentWindowService.listRemoteAgents();
    } catch (error) {
      console.error('Failed to list remote agents:', error);
      throw error;
    }
  }

  /**
   * Get the state of a remote agent
   */
  async getRemoteAgentState(agentId: string): Promise<RemoteAgentWindowState> {
    try {
      return await RemoteAgentWindowService.getRemoteAgentState(agentId);
    } catch (error) {
      console.error('Failed to get remote agent state:', error);
      throw error;
    }
  }

  /**
   * Send a message to a remote agent
   */
  async sendMessageToRemoteAgent(agentId: string, message: any): Promise<void> {
    try {
      await RemoteAgentWindowService.sendMessageToRemoteAgent(agentId, message);
    } catch (error) {
      console.error('Failed to send message to remote agent:', error);
      throw error;
    }
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(callback: (agentId: string, state: RemoteAgentWindowState) => void): () => void {
    this.stateChangeListeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.stateChangeListeners.delete(callback);
    };
  }

  /**
   * Subscribe to messages from remote agents
   */
  onMessage(callback: (agentId: string, message: any) => void): () => void {
    this.messageListeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.messageListeners.delete(callback);
    };
  }

  /**
   * Setup event listeners from main process
   */
  private setupEventListeners(): void {
    // Listen for state changes
    this.unsubscribeStateChange = RemoteAgentWindowService.onRemoteAgentStateChanged(
      (agentId, state) => {
        this.stateChangeListeners.forEach((listener) => {
          try {
            listener(agentId, state);
          } catch (error) {
            console.error('Error in state change listener:', error);
          }
        });
      }
    );

    // Listen for messages
    this.unsubscribeMessage = RemoteAgentWindowService.onRemoteAgentMessage((agentId, message) => {
      this.messageListeners.forEach((listener) => {
        try {
          listener(agentId, message);
        } catch (error) {
          console.error('Error in message listener:', error);
        }
      });
    });
  }

  /**
   * Cleanup listeners
   */
  destroy(): void {
    this.unsubscribeStateChange?.();
    this.unsubscribeMessage?.();
    this.stateChangeListeners.clear();
    this.messageListeners.clear();
  }
}

// Export singleton instance
export const remoteAgentService = new RemoteAgentService();