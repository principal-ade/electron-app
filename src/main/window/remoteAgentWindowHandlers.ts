import { ipcMain } from 'electron';
import { RemoteAgentWindowManager } from './remoteAgentWindowManager';
import { RemoteAgentWindowEvent } from '../../shared/main-process-api-interfaces/RemoteAgentWindowAPI';
import {
  RemoteAgentConfig,
  RemoteAgentWindowOptions,
} from '../../shared/types/remoteAgent.types';

/**
 * Register IPC handlers for remote agent window management
 */
export function registerRemoteAgentWindowHandlers(
  remoteAgentWindowManager: RemoteAgentWindowManager
): void {
  // Open remote agent
  ipcMain.handle(
    RemoteAgentWindowEvent.OPEN_REMOTE_AGENT,
    async (event, config: RemoteAgentConfig, options?: RemoteAgentWindowOptions) => {
      try {
        const agentId = await remoteAgentWindowManager.openRemoteAgent(config, options);
        return { success: true, agentId };
      } catch (error) {
        console.error('Failed to open remote agent:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // Close remote agent
  ipcMain.handle(
    RemoteAgentWindowEvent.CLOSE_REMOTE_AGENT,
    async (event, agentId: string) => {
      try {
        await remoteAgentWindowManager.closeRemoteAgent(agentId);
        return { success: true };
      } catch (error) {
        console.error('Failed to close remote agent:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // Focus remote agent
  ipcMain.handle(
    RemoteAgentWindowEvent.FOCUS_REMOTE_AGENT,
    async (event, agentId: string) => {
      try {
        remoteAgentWindowManager.focusRemoteAgent(agentId);
        return { success: true };
      } catch (error) {
        console.error('Failed to focus remote agent:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // List remote agents
  ipcMain.handle(RemoteAgentWindowEvent.LIST_REMOTE_AGENTS, async () => {
    try {
      const agents = remoteAgentWindowManager.listRemoteAgents();
      return { success: true, agents };
    } catch (error) {
      console.error('Failed to list remote agents:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Get remote agent state
  ipcMain.handle(
    RemoteAgentWindowEvent.GET_REMOTE_AGENT_STATE,
    async (event, agentId: string) => {
      try {
        const state = remoteAgentWindowManager.getRemoteAgentState(agentId);
        return { success: true, state };
      } catch (error) {
        console.error('Failed to get remote agent state:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // Send message to remote agent
  ipcMain.handle(
    RemoteAgentWindowEvent.SEND_MESSAGE_TO_REMOTE_AGENT,
    async (event, agentId: string, message: any) => {
      try {
        remoteAgentWindowManager.sendMessage(agentId, message);
        return { success: true };
      } catch (error) {
        console.error('Failed to send message to remote agent:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );
}

/**
 * Unregister IPC handlers
 */
export function unregisterRemoteAgentWindowHandlers(): void {
  ipcMain.removeHandler(RemoteAgentWindowEvent.OPEN_REMOTE_AGENT);
  ipcMain.removeHandler(RemoteAgentWindowEvent.CLOSE_REMOTE_AGENT);
  ipcMain.removeHandler(RemoteAgentWindowEvent.FOCUS_REMOTE_AGENT);
  ipcMain.removeHandler(RemoteAgentWindowEvent.LIST_REMOTE_AGENTS);
  ipcMain.removeHandler(RemoteAgentWindowEvent.GET_REMOTE_AGENT_STATE);
  ipcMain.removeHandler(RemoteAgentWindowEvent.SEND_MESSAGE_TO_REMOTE_AGENT);
}