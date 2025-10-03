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
  private agentListListeners: Set<
    (agents: RemoteAgentConfig[], activeAgentId: string | null) => void
  > = new Set();
  private activeAgentListeners: Set<(agentId: string | null) => void> = new Set();
  private unsubscribeStateChange?: () => void;
  private unsubscribeMessage?: () => void;
  private unsubscribeListChange?: () => void;
  private unsubscribeActiveChange?: () => void;
  private agentList: RemoteAgentConfig[] = [];
  private activeAgentId: string | null = null;

  constructor() {
    this.setupEventListeners();
    void this.initializeAgentState();
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
      const agents = await RemoteAgentWindowService.listRemoteAgents();
      this.agentList = agents;
      this.notifyAgentListListeners();
      return agents;
    } catch (error) {
      console.error('Failed to list remote agents:', error);
      throw error;
    }
  }

  /**
   * Get the currently active remote agent id (cached)
   */
  getActiveAgentId(): string | null {
    return this.activeAgentId;
  }

  /**
   * Switch to an existing remote agent window
   */
  async switchToAgent(agentId: string): Promise<void> {
    try {
      await RemoteAgentWindowService.switchToAgent(agentId);
    } catch (error) {
      console.error('Failed to switch remote agent:', error);
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
   * Subscribe to agent list changes
   */
  onAgentListChange(
    callback: (agents: RemoteAgentConfig[], activeAgentId: string | null) => void
  ): () => void {
    this.agentListListeners.add(callback);
    callback(this.agentList, this.activeAgentId);

    return () => {
      this.agentListListeners.delete(callback);
    };
  }

  /**
   * Subscribe to active agent changes
   */
  onActiveAgentChange(callback: (agentId: string | null) => void): () => void {
    this.activeAgentListeners.add(callback);
    callback(this.activeAgentId);

    return () => {
      this.activeAgentListeners.delete(callback);
    };
  }

  /**
   * Check whether a remote agent is currently open
   */
  isAgentOpen(agentId: string): boolean {
    return this.agentList.some((agent) => agent.id === agentId);
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

    this.unsubscribeListChange = RemoteAgentWindowService.onRemoteAgentListChanged(
      (agents, activeAgentId) => {
        this.agentList = agents;
        this.activeAgentId = activeAgentId;
        this.notifyAgentListListeners();
        this.notifyActiveAgentListeners();
      },
    );

    this.unsubscribeActiveChange = RemoteAgentWindowService.onRemoteAgentActiveChanged((agentId) => {
      this.activeAgentId = agentId;
      this.notifyActiveAgentListeners();
    });
  }

  /**
   * Cleanup listeners
   */
  destroy(): void {
    this.unsubscribeStateChange?.();
    this.unsubscribeMessage?.();
    this.unsubscribeListChange?.();
    this.unsubscribeActiveChange?.();
    this.stateChangeListeners.clear();
    this.messageListeners.clear();
    this.agentListListeners.clear();
    this.activeAgentListeners.clear();
  }

  private async initializeAgentState(): Promise<void> {
    try {
      const [agents, activeAgentId] = await Promise.all([
        RemoteAgentWindowService.listRemoteAgents(),
        RemoteAgentWindowService.getActiveAgentId(),
      ]);
      this.agentList = agents;
      this.activeAgentId = activeAgentId;
      this.notifyAgentListListeners();
      this.notifyActiveAgentListeners();
    } catch (error) {
      console.error('Failed to initialize remote agent state:', error);
    }
  }

  private notifyAgentListListeners(): void {
    this.agentListListeners.forEach((listener) => {
      try {
        listener(this.agentList, this.activeAgentId);
      } catch (error) {
        console.error('Error in agent list listener:', error);
      }
    });
  }

  private notifyActiveAgentListeners(): void {
    this.activeAgentListeners.forEach((listener) => {
      try {
        listener(this.activeAgentId);
      } catch (error) {
        console.error('Error in active agent listener:', error);
      }
    });
  }
}

// Export singleton instance
export const remoteAgentService = new RemoteAgentService();