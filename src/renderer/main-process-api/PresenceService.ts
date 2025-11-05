import {
  PresenceData,
  UserPresence,
} from '../../shared/main-process-api-interfaces/PresenceAPI';

/**
 * Service layer for Presence functionality
 * ALL window.mainProcess.presence calls MUST be encapsulated here
 */
export class PresenceService {
  /**
   * Get all currently online users
   */
  static async getUsers(): Promise<PresenceData> {
    try {
      return await window.mainProcess.presence.getUsers();
    } catch (error) {
      console.error('[PresenceService] Failed to get users:', error);
      throw error;
    }
  }

  /**
   * Get users in a specific repository
   */
  static async getUsersInRepository(
    owner: string,
    repo: string,
  ): Promise<{ repoId: string; users: UserPresence[]; totalUsers: number }> {
    try {
      return await window.mainProcess.presence.getUsersInRepository(owner, repo);
    } catch (error) {
      console.error('[PresenceService] Failed to get users in repository:', error);
      throw error;
    }
  }

  /**
   * Get presence for a specific user
   */
  static async getUser(userId: string): Promise<UserPresence | null> {
    try {
      return await window.mainProcess.presence.getUser(userId);
    } catch (error) {
      console.error('[PresenceService] Failed to get user:', error);
      throw error;
    }
  }

  /**
   * Subscribe to global presence events
   */
  static async subscribeToPresence(): Promise<boolean> {
    try {
      return await window.mainProcess.presence.subscribeToPresence();
    } catch (error) {
      console.error('[PresenceService] Failed to subscribe to presence:', error);
      return false;
    }
  }

  /**
   * Unsubscribe from presence events
   */
  static async unsubscribeFromPresence(): Promise<void> {
    try {
      await window.mainProcess.presence.unsubscribeFromPresence();
    } catch (error) {
      console.error('[PresenceService] Failed to unsubscribe from presence:', error);
    }
  }

  /**
   * Listen for presence events via IPC
   */
  static onPresenceEvent(callback: (event: {
    type: string;
    payload: Record<string, unknown>;
    timestamp: number;
  }) => void): () => void {
    try {
      return window.mainProcess.presence.onPresenceEvent(callback);
    } catch (error) {
      console.error('[PresenceService] Failed to set up presence event listener:', error);
      // Return no-op cleanup function
      return () => {};
    }
  }
}
