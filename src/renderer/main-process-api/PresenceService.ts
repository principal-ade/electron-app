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
      return await window.mainProcess.presence.getUsersInRepository(
        owner,
        repo,
      );
    } catch (error) {
      console.error(
        '[PresenceService] Failed to get users in repository:',
        error,
      );
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
      console.error(
        '[PresenceService] Failed to subscribe to presence:',
        error,
      );
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
      console.error(
        '[PresenceService] Failed to unsubscribe from presence:',
        error,
      );
    }
  }

  /**
   * Connect to Git-Sync for presence tracking only (no repository required)
   */
  static async connectToPresence(token: string): Promise<{
    success: boolean;
    connectionId?: string;
    message?: string;
    error?: string;
  }> {
    try {
      return await window.mainProcess.presence.connectToPresence(token);
    } catch (error) {
      console.error('[PresenceService] Failed to connect to presence:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect',
      };
    }
  }

  /**
   * Disconnect from presence-only connection
   */
  static async disconnectFromPresence(): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      return await window.mainProcess.presence.disconnectFromPresence();
    } catch (error) {
      console.error(
        '[PresenceService] Failed to disconnect from presence:',
        error,
      );
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to disconnect',
      };
    }
  }

  /**
   * Listen for presence events via IPC
   */
  static onPresenceEvent(
    callback: (event: {
      type: string;
      payload: Record<string, unknown>;
      timestamp: number;
    }) => void,
  ): () => void {
    try {
      return window.mainProcess.presence.onPresenceEvent(callback);
    } catch (error) {
      console.error(
        '[PresenceService] Failed to set up presence event listener:',
        error,
      );
      // Return no-op cleanup function
      return () => {};
    }
  }

  /**
   * Report that a repository has been opened
   */
  static async reportRepositoryOpened(
    owner: string,
    repo: string,
    branch: string,
    localPath?: string,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      return await window.mainProcess.presence.reportRepositoryOpened(
        owner,
        repo,
        branch,
        localPath,
      );
    } catch (error) {
      console.error(
        '[PresenceService] Failed to report repository opened:',
        error,
      );
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to report repository opened',
      };
    }
  }

  /**
   * Report that a repository has been closed
   */
  static async reportRepositoryClosed(
    owner: string,
    repo: string,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      return await window.mainProcess.presence.reportRepositoryClosed(
        owner,
        repo,
      );
    } catch (error) {
      console.error(
        '[PresenceService] Failed to report repository closed:',
        error,
      );
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to report repository closed',
      };
    }
  }

  /**
   * Report that a repository is now the active/focused one
   */
  static async reportActiveRepository(
    owner: string,
    repo: string,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      return await window.mainProcess.presence.reportActiveRepository(
        owner,
        repo,
      );
    } catch (error) {
      console.error(
        '[PresenceService] Failed to report active repository:',
        error,
      );
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to report active repository',
      };
    }
  }

  /**
   * Update user status
   */
  static async updateStatus(
    status: 'online' | 'away',
    message?: string,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      return await window.mainProcess.presence.updateStatus(status, message);
    } catch (error) {
      console.error('[PresenceService] Failed to update status:', error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to update status',
      };
    }
  }

  /**
   * Set user visibility (visible/invisible mode)
   */
  static async setVisibility(
    visible: boolean,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      return await window.mainProcess.presence.setVisibility(visible);
    } catch (error) {
      console.error('[PresenceService] Failed to set visibility:', error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to set visibility',
      };
    }
  }

  /**
   * Send a heartbeat to keep presence alive
   */
  static async sendHeartbeat(): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      return await window.mainProcess.presence.sendHeartbeat();
    } catch (error) {
      console.error('[PresenceService] Failed to send heartbeat:', error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to send heartbeat',
      };
    }
  }
}
