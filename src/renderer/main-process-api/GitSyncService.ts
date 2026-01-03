import {
  GitSyncConfig,
  GitSyncConnectionResult,
  GitSyncStatus,
  GitSyncMessage,
  GitSyncRoomTokenRequest,
  GitSyncRoomTokenResponse,
} from '../../shared/main-process-api-interfaces/GitSyncAPI';

/**
 * Service layer for Git-sync functionality
 * ALL window.mainProcess.gitSync calls MUST be encapsulated here
 */
export class GitSyncService {
  /**
   * Connect to git-sync server for a repository
   */
  static async connect(
    config: GitSyncConfig,
  ): Promise<GitSyncConnectionResult> {
    try {
      return await window.mainProcess.gitSync.connect(config);
    } catch (error) {
      console.error('[GitSyncService] Failed to connect:', error);
      return {
        success: false,
        error: 'Failed to connect to git-sync server',
      };
    }
  }

  /**
   * Disconnect from git-sync server
   */
  static async disconnect(
    connectionId: string,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      return await window.mainProcess.gitSync.disconnect(connectionId);
    } catch (error) {
      console.error('[GitSyncService] Failed to disconnect:', error);
      return {
        success: false,
        message: 'Failed to disconnect from git-sync server',
      };
    }
  }

  /**
   * Get current connection status
   */
  static async getStatus(connectionId: string): Promise<GitSyncStatus | null> {
    try {
      return await window.mainProcess.gitSync.getStatus(connectionId);
    } catch (error) {
      console.error('[GitSyncService] Failed to get status:', error);
      return null;
    }
  }

  /**
   * Send a message through the git-sync connection
   */
  static async sendMessage(
    message: GitSyncMessage,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      return await window.mainProcess.gitSync.sendMessage(message);
    } catch (error) {
      console.error('[GitSyncService] Failed to send message:', error);
      return {
        success: false,
        error: 'Failed to send message',
      };
    }
  }

  /**
   * Get a room token for git-sync collaboration
   */
  static async getRoomToken(
    request: GitSyncRoomTokenRequest,
  ): Promise<GitSyncRoomTokenResponse> {
    try {
      return await window.mainProcess.gitSync.getRoomToken(request);
    } catch (error) {
      console.error('[GitSyncService] Failed to get room token:', error);
      return {
        success: false,
        error: 'Failed to get room token',
      };
    }
  }

  /**
   * Get the git-sync server URL
   */
  static async getServerUrl(): Promise<string> {
    try {
      return await window.mainProcess.gitSync.getServerUrl();
    } catch (error) {
      console.error('[GitSyncService] Failed to get server URL:', error);
      return 'ws://localhost:3001'; // Default fallback
    }
  }

  /**
   * Check if user has access to a repository
   */
  static async checkRepoAccess(
    repoUrl: string,
    token: string,
  ): Promise<boolean> {
    try {
      return await window.mainProcess.gitSync.checkRepoAccess(repoUrl, token);
    } catch (error) {
      console.error('[GitSyncService] Failed to check repo access:', error);
      return false;
    }
  }

  /**
   * Subscribe to git-sync messages
   * @returns Unsubscribe function
   */
  static onMessage(
    callback: (connectionKey: string, message: unknown) => void,
  ): () => void {
    try {
      return window.mainProcess.gitSync.onMessage(callback);
    } catch (error) {
      console.error('[GitSyncService] Failed to subscribe to messages:', error);
      return () => {}; // Return no-op unsubscribe function
    }
  }

  /**
   * Get all active connections across all renderer processes
   * This queries the main process for the source of truth
   */
  static async getAllConnections() {
    try {
      return await window.mainProcess.gitSync.getAllConnections();
    } catch (error) {
      console.error('[GitSyncService] Failed to get all connections:', error);
      return [];
    }
  }

  /**
   * Subscribe to connection-added events from main process
   * @returns Unsubscribe function
   */
  static onConnectionAdded(
    callback: (connectionId: string) => void,
  ): () => void {
    try {
      return window.mainProcess.gitSync.onConnectionAdded(callback);
    } catch (error) {
      console.error(
        '[GitSyncService] Failed to subscribe to connection-added:',
        error,
      );
      return () => {};
    }
  }

  /**
   * Subscribe to connection-removed events from main process
   * @returns Unsubscribe function
   */
  static onConnectionRemoved(
    callback: (connectionId: string) => void,
  ): () => void {
    try {
      return window.mainProcess.gitSync.onConnectionRemoved(callback);
    } catch (error) {
      console.error(
        '[GitSyncService] Failed to subscribe to connection-removed:',
        error,
      );
      return () => {};
    }
  }

  /**
   * Subscribe to connection-status-changed events from main process
   * @returns Unsubscribe function
   */
  static onConnectionStatusChanged(
    callback: (connectionId: string) => void,
  ): () => void {
    try {
      return window.mainProcess.gitSync.onConnectionStatusChanged(callback);
    } catch (error) {
      console.error(
        '[GitSyncService] Failed to subscribe to connection-status-changed:',
        error,
      );
      return () => {};
    }
  }

  /**
   * Check if a service is available
   */
  static async checkService(
    url: string,
    serviceName: string,
  ): Promise<{ available: boolean; status?: number; error?: string }> {
    try {
      return await window.mainProcess.gitSync.checkService(url, serviceName);
    } catch (error) {
      console.error('[GitSyncService] Failed to check service:', error);
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Set the environment (dev or prod) for GitSync servers
   */
  static async setEnvironment(
    environment: 'development' | 'production',
  ): Promise<void> {
    try {
      await window.mainProcess.gitSync.setEnvironment(environment);
    } catch (error) {
      console.error('[GitSyncService] Failed to set environment:', error);
    }
  }

  /**
   * Get the current environment
   */
  static async getEnvironment(): Promise<'development' | 'production'> {
    try {
      return await window.mainProcess.gitSync.getEnvironment();
    } catch (error) {
      console.error('[GitSyncService] Failed to get environment:', error);
      return 'development';
    }
  }

  /**
   * Get server presence data from the traffic controller
   * This fetches via the main process to avoid CORS issues
   */
  static async getServerPresence(): Promise<{
    success: boolean;
    data?: unknown;
    error?: string;
  }> {
    try {
      return await window.mainProcess.gitSync.getServerPresence();
    } catch (error) {
      console.error('[GitSyncService] Failed to get server presence:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
