/**
 * PresenceIPC - IPC handlers for presence operations
 *
 * Provides IPC endpoints for presence operations that renderers can call.
 * Uses the GitSyncWebSocketManager to fetch presence data from the traffic controller.
 */

import { ipcMain } from 'electron';
import { PresenceEvent } from '../../window/main-process-api-implementations/presenceApi';
import { PresenceData, UserPresence } from '../../shared/main-process-api-interfaces/PresenceAPI';
import { gitSyncWebSocketManager } from './GitSyncWebSocketManager';

class PresenceIPC {
  constructor() {
    this.setupHandlers();
    console.log('[PresenceIPC] Initialized');
  }

  private setupHandlers() {
    // Handler for presence:get-users
    ipcMain.handle(
      PresenceEvent.GET_USERS,
      async (): Promise<PresenceData> => {
        console.log('[PresenceIPC] Get users requested');

        const result = await gitSyncWebSocketManager.fetchPresenceData();

        if (!result.success || !result.data) {
          throw new Error(result.error || 'Failed to fetch presence data');
        }

        return result.data as PresenceData;
      },
    );

    // Handler for presence:get-users-in-repo
    ipcMain.handle(
      PresenceEvent.GET_USERS_IN_REPO,
      async (
        event,
        owner: string,
        repo: string,
      ): Promise<{ repoId: string; users: UserPresence[]; totalUsers: number }> => {
        console.log('[PresenceIPC] Get users in repo requested:', owner, repo);

        const result = await gitSyncWebSocketManager.fetchRepositoryPresence(owner, repo);

        if (!result.success || !result.data) {
          throw new Error(result.error || 'Failed to fetch repository presence');
        }

        return result.data as { repoId: string; users: UserPresence[]; totalUsers: number };
      },
    );

    // Handler for presence:get-user
    ipcMain.handle(
      PresenceEvent.GET_USER,
      async (event, userId: string): Promise<UserPresence | null> => {
        console.log('[PresenceIPC] Get user requested:', userId);

        const result = await gitSyncWebSocketManager.fetchUserPresence(userId);

        if (!result.success) {
          if (result.error === 'User not found') {
            return null;
          }
          throw new Error(result.error || 'Failed to fetch user presence');
        }

        return result.data as UserPresence;
      },
    );

    // Handler for presence:subscribe
    ipcMain.handle(
      PresenceEvent.SUBSCRIBE,
      async (): Promise<boolean> => {
        console.log('[PresenceIPC] Subscribe to presence requested');

        return await gitSyncWebSocketManager.subscribeToPresence();
      },
    );

    // Handler for presence:unsubscribe
    ipcMain.handle(
      PresenceEvent.UNSUBSCRIBE,
      async (): Promise<void> => {
        console.log('[PresenceIPC] Unsubscribe from presence requested');
        // For now, we don't need to do anything as leaving the room
        // is handled automatically when disconnecting
      },
    );
  }
}

// Create and export singleton instance
export const presenceIPC = new PresenceIPC();
