/**
 * GitSyncWebSocketManager - Manages WebSocket connections to the traffic controller
 *
 * This service runs in the main process and handles all WebSocket connections
 * to the git-sync traffic controller, ensuring secure token handling and
 * centralized connection management.
 */

import WebSocket from 'ws';
import { BrowserWindow } from 'electron';
import { GitSyncEvent } from '../../window/main-process-api-implementations/gitSyncApi';
import type {
  GitSyncConfig,
  GitSyncStatus,
} from '../../shared/main-process-api-interfaces/GitSyncAPI';
import fetch from 'node-fetch';

interface ConnectionInfo {
  connectionId: string;
  repoId: string;
  repoPath: string;
  branch: string;
  windowId: number; // Track which window owns this connection
  ws: WebSocket;
  status: GitSyncStatus;
  token: string;
  reconnectTimer?: NodeJS.Timeout;
  pingInterval?: NodeJS.Timeout;
}

interface RoomTokenInfo {
  access_token: string;
  permissions: {
    canRead: boolean;
    canWrite: boolean;
    canAdmin?: boolean;
  };
  repository: string;
  branch: string;
  expiresIn: number;
}

interface GitSyncMessage {
  type: string;
  payload?: GitSyncMessage | Record<string, unknown>;
  peer?: {
    agentId: string;
    userId: string;
    branch?: string;
  };
  [key: string]: unknown;
}

/**
 * Singleton service that manages WebSocket connections to the traffic controller
 */
export class GitSyncWebSocketManager {
  private static instance: GitSyncWebSocketManager;
  private connections: Map<string, ConnectionInfo> = new Map();
  private serverUrl: string;
  private authServerUrl: string;
  private readonly RECONNECT_DELAY = 5000;
  private readonly PING_INTERVAL = 30000;

  // Hardcoded defaults
  private readonly DEFAULT_DEV_SERVER = 'ws://localhost:3001';
  private readonly DEFAULT_DEV_AUTH = 'http://localhost:3000';
  private readonly DEFAULT_PROD_SERVER = 'wss://repository-traffic-controller-production.rj36caac972nm.us-east-1.cs.amazonlightsail.com';
  private readonly DEFAULT_PROD_AUTH = 'https://principal-ade.com';

  private constructor() {
    // Default to production servers, override with environment variables if needed
    this.serverUrl = process.env.GIT_SYNC_SERVER_URL || this.DEFAULT_PROD_SERVER;
    this.authServerUrl = process.env.AUTH_SERVER_URL || this.DEFAULT_PROD_AUTH;

    console.log(
      '[GitSyncWebSocketManager] Initialized with server:',
      this.serverUrl,
    );
    console.log(
      '[GitSyncWebSocketManager] Initialized with auth server:',
      this.authServerUrl,
    );
  }

  static getInstance(): GitSyncWebSocketManager {
    if (!GitSyncWebSocketManager.instance) {
      GitSyncWebSocketManager.instance = new GitSyncWebSocketManager();
    }
    return GitSyncWebSocketManager.instance;
  }

  /**
   * Get server URL
   */
  getServerUrl(): string {
    return this.serverUrl;
  }

  /**
   * Get auth server URL
   */
  getAuthServerUrl(): string {
    return this.authServerUrl;
  }

  /**
   * Set environment (dev or prod) - updates both server URLs
   */
  setEnvironment(environment: 'development' | 'production'): void {
    if (environment === 'production') {
      this.serverUrl = this.DEFAULT_PROD_SERVER;
      this.authServerUrl = this.DEFAULT_PROD_AUTH;
    } else {
      this.serverUrl = this.DEFAULT_DEV_SERVER;
      this.authServerUrl = this.DEFAULT_DEV_AUTH;
    }
    console.log(
      `[GitSyncWebSocketManager] Environment set to ${environment}:`,
      { serverUrl: this.serverUrl, authServerUrl: this.authServerUrl },
    );
  }

  /**
   * Get current environment based on server URLs
   */
  getCurrentEnvironment(): 'development' | 'production' {
    return this.serverUrl === this.DEFAULT_PROD_SERVER ? 'production' : 'development';
  }

  /**
   * Connect to the traffic controller for a specific repository
   */
  async connect(
    config: GitSyncConfig,
    windowId: number,
  ): Promise<{
    success: boolean;
    connectionId?: string;
    message?: string;
    error?: string;
  }> {
    const connectionId = `${config.repoId}:${config.branch}`;

    // Check if already connected
    const existing = this.connections.get(connectionId);
    if (existing?.ws?.readyState === WebSocket.OPEN) {
      console.log('[GitSyncWebSocketManager] Already connected:', connectionId);
      return {
        success: true,
        connectionId,
        message: 'Already connected',
      };
    }

    try {
      // Validate token
      if (!config.token) {
        return {
          success: false,
          error: 'GitHub token is required',
        };
      }

      // Get room token from OAuth server
      const roomToken = await this.getRoomToken(config);

      // Create WebSocket connection
      const wsUrl = `${this.serverUrl}/ws`;
      console.log('[GitSyncWebSocketManager] Connecting to:', wsUrl);

      const ws = new WebSocket(wsUrl);

      // Set up connection info
      const connectionInfo: ConnectionInfo = {
        connectionId,
        repoId: config.repoId,
        repoPath: config.repoPath,
        branch: config.branch,
        windowId,
        ws,
        token: config.token,
        status: {
          connected: false,
          authenticated: false,
          repoId: config.repoId,
          branch: config.branch,
          activeLocks: [],
          queuedLocks: 0,
          peers: [],
        },
      };

      // Store connection IMMEDIATELY before setting up handlers
      // This ensures the connection is in the Map before any events fire
      this.connections.set(connectionId, connectionInfo);

      return new Promise((resolve, reject) => {
        let errorOccurred = false;

        // Connection error handler
        const handleError = (error: Error) => {
          if (errorOccurred) return; // Prevent duplicate error handling
          errorOccurred = true;

          console.error('[GitSyncWebSocketManager] WebSocket error:', error);

          // Clean up: remove from Map since connection failed
          this.connections.delete(connectionId);

          reject({
            success: false,
            error: error.message || 'WebSocket error',
          });
        };

        // Connection opened
        ws.on('open', () => {
          console.log('[GitSyncWebSocketManager] Connected:', connectionId);
          connectionInfo.status.connected = true;

          // Authenticate with room token
          this.authenticate(connectionInfo, roomToken);

          // Start ping interval
          this.startPingInterval(connectionInfo);

          // Broadcast connection-added event to all renderers
          this.broadcastConnectionEvent('connection-added', connectionId);

          resolve({
            success: true,
            connectionId,
            message: 'Connected to traffic controller',
          });
        });

        // Receive messages
        ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(connectionInfo, message);
          } catch (error) {
            console.error(
              '[GitSyncWebSocketManager] Failed to parse message:',
              error,
            );
          }
        });

        // Connection error
        ws.on('error', handleError);

        // Connection closed
        ws.on('close', () => {
          console.log('[GitSyncWebSocketManager] Disconnected:', connectionId);
          connectionInfo.status.connected = false;
          connectionInfo.status.authenticated = false;
          this.stopPingInterval(connectionInfo);

          // Broadcast disconnect event to renderers
          this.broadcastToRenderers(GitSyncEvent.ON_MESSAGE, connectionId, {
            type: 'disconnected',
          });

          // Check if connection still exists in Map before reconnecting
          // If it was manually disconnected, it won't be in the Map
          const stillExists = this.connections.has(connectionId);

          if (!stillExists) {
            // Connection was manually removed, don't reconnect
            console.log(
              '[GitSyncWebSocketManager] Connection was manually disconnected, not reconnecting',
            );
            // Broadcast connection-removed event only if manually disconnected
            this.broadcastConnectionEvent('connection-removed', connectionId);
            return;
          }

          // Auto-reconnect after delay (only if not an error scenario and still in Map)
          if (!errorOccurred) {
            this.scheduleReconnect(connectionInfo, config);
          }
        });
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to connect';
      console.error('[GitSyncWebSocketManager] Failed to connect:', error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get room token from the landing-page auth server
   */
  private async getRoomToken(config: GitSyncConfig): Promise<RoomTokenInfo> {
    try {
      console.log(
        '[GitSyncWebSocketManager] Requesting room token from auth server',
      );

      // Generate a stable device ID
      const agentId = `electron-${Date.now()}`;

      // Use the configured auth server URL
      const authServerUrl = this.authServerUrl;

      // Call landing-page's room-token endpoint
      const response = await fetch(`${authServerUrl}/api/auth/cli/room-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repository: config.repoId,
          branch: config.branch,
          github_token: config.token,
          device_id: agentId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to get room token: ${response.status}`,
        );
      }

      const data = await response.json();

      return {
        access_token: data.access_token,
        permissions: {
          canRead: data.permissions?.canJoin || false,
          canWrite: data.permissions?.canEdit || false,
          canAdmin: data.permissions?.canAdmin,
        },
        repository: config.repoId,
        branch: config.branch,
        expiresIn: data.expires_in || 3600,
      };
    } catch (error) {
      console.error(
        '[GitSyncWebSocketManager] Failed to get room token:',
        error,
      );
      throw error;
    }
  }

  /**
   * Authenticate with the traffic controller using JWT
   */
  private authenticate(
    connectionInfo: ConnectionInfo,
    roomToken: RoomTokenInfo,
  ) {
    // Send JWT authentication message in Control Tower Core format
    // Control Tower Core v0.1.3 expects: { type: 'authenticate', payload: { type: 'jwt', token: '...' } }
    // The JWT contains all required fields: userId, repoId, agentId, permissions
    const authMessage = {
      type: 'authenticate', // Must be 'authenticate', not 'auth'
      payload: {
        type: 'jwt',
        token: roomToken.access_token,
      },
    };

    console.log(
      '[GitSyncWebSocketManager] Sending JWT auth message for:',
      connectionInfo.connectionId,
    );
    this.sendMessage(connectionInfo, authMessage);
  }

  /**
   * Send a message through the WebSocket
   */
  private sendMessage(connectionInfo: ConnectionInfo, message: GitSyncMessage) {
    if (connectionInfo.ws?.readyState === WebSocket.OPEN) {
      const messageStr = JSON.stringify(message);
      console.log(
        '[GitSyncWebSocketManager] Sending message:',
        message.type,
        messageStr,
      );
      connectionInfo.ws.send(messageStr);
    } else {
      console.warn(
        '[GitSyncWebSocketManager] Cannot send message, not connected. ReadyState:',
        connectionInfo.ws?.readyState,
      );
    }
  }

  /**
   * Handle incoming messages from the traffic controller
   */
  private handleMessage(
    connectionInfo: ConnectionInfo,
    message: GitSyncMessage,
  ) {
    console.log(
      '[GitSyncWebSocketManager] Received message:',
      message.type,
      message,
    );

    // Unwrap server_message envelope
    if (message.type === 'server_message' && message.payload) {
      console.log(
        '[GitSyncWebSocketManager] Unwrapping server_message:',
        message.payload.type,
      );
      this.handleMessage(connectionInfo, message.payload);
      return;
    }

    switch (message.type) {
      case 'auth_success':
        connectionInfo.status.authenticated = true;
        console.log(
          '[GitSyncWebSocketManager] Authenticated:',
          connectionInfo.connectionId,
        );
        // Broadcast to renderers
        this.broadcastToRenderers(
          GitSyncEvent.ON_MESSAGE,
          connectionInfo.connectionId,
          message,
        );
        break;

      case 'auth_error':
      case 'error':
        console.error(
          '[GitSyncWebSocketManager] Error from traffic controller:',
          message,
        );
        this.broadcastToRenderers(
          GitSyncEvent.ON_MESSAGE,
          connectionInfo.connectionId,
          message,
        );
        break;

      case 'peer_joined':
        // Add peer to status
        if (message.peer) {
          connectionInfo.status.peers.push({
            agentId: message.peer.agentId,
            userId: message.peer.userId,
            branch: message.peer.branch || connectionInfo.branch,
          });
        }
        this.broadcastToRenderers(
          GitSyncEvent.ON_MESSAGE,
          connectionInfo.connectionId,
          message,
        );
        this.broadcastConnectionEvent(
          'connection-status-changed',
          connectionInfo.connectionId,
        );
        break;

      case 'peer_left':
        // Remove peer from status
        if (message.peer) {
          connectionInfo.status.peers = connectionInfo.status.peers.filter(
            (p) => p.agentId !== message.peer.agentId,
          );
        }
        this.broadcastToRenderers(
          GitSyncEvent.ON_MESSAGE,
          connectionInfo.connectionId,
          message,
        );
        this.broadcastConnectionEvent(
          'connection-status-changed',
          connectionInfo.connectionId,
        );
        break;

      case 'pong':
        // Heartbeat response
        break;

      default:
        // Forward all other messages to renderers
        this.broadcastToRenderers(
          GitSyncEvent.ON_MESSAGE,
          connectionInfo.connectionId,
          message,
        );
        break;
    }
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(connectionInfo: ConnectionInfo) {
    this.stopPingInterval(connectionInfo);

    connectionInfo.pingInterval = setInterval(() => {
      this.sendMessage(connectionInfo, { type: 'ping' });
    }, this.PING_INTERVAL);
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(connectionInfo: ConnectionInfo) {
    if (connectionInfo.pingInterval) {
      clearInterval(connectionInfo.pingInterval);
      connectionInfo.pingInterval = undefined;
    }
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(
    connectionInfo: ConnectionInfo,
    config: GitSyncConfig,
  ) {
    if (connectionInfo.reconnectTimer) {
      clearTimeout(connectionInfo.reconnectTimer);
    }

    connectionInfo.reconnectTimer = setTimeout(() => {
      console.log(
        '[GitSyncWebSocketManager] Attempting to reconnect:',
        connectionInfo.connectionId,
      );
      // Use the original windowId for reconnection
      this.connect(config, connectionInfo.windowId).catch((error) => {
        console.error('[GitSyncWebSocketManager] Reconnect failed:', error);
      });
    }, this.RECONNECT_DELAY);
  }

  /**
   * Disconnect from traffic controller
   */
  async disconnect(
    connectionId: string,
  ): Promise<{ success: boolean; message?: string }> {
    const connectionInfo = this.connections.get(connectionId);

    if (!connectionInfo) {
      return {
        success: false,
        message: 'Connection not found',
      };
    }

    // Stop ping and reconnect timers
    this.stopPingInterval(connectionInfo);
    if (connectionInfo.reconnectTimer) {
      clearTimeout(connectionInfo.reconnectTimer);
    }

    // Remove from connections map FIRST to prevent auto-reconnect
    // When we delete it, the WebSocket close handler won't be able to reconnect
    this.connections.delete(connectionId);

    // Then close WebSocket (this will trigger the 'close' event which broadcasts the event)
    if (connectionInfo.ws) {
      connectionInfo.ws.close();
    }

    console.log('[GitSyncWebSocketManager] Disconnected:', connectionId);

    return {
      success: true,
      message: 'Disconnected',
    };
  }

  /**
   * Get connection status
   */
  getStatus(connectionId: string): GitSyncStatus | null {
    const connectionInfo = this.connections.get(connectionId);
    return connectionInfo?.status || null;
  }

  /**
   * Get all active connections - source of truth for connection state
   * Returns connection info for all repositories across all renderer processes
   */
  getAllConnections(): Array<{
    connectionId: string;
    repoId: string;
    repoPath: string;
    branch: string;
    status: GitSyncStatus;
  }> {
    const connections: Array<{
      connectionId: string;
      repoId: string;
      repoPath: string;
      branch: string;
      status: GitSyncStatus;
    }> = [];

    for (const [connectionId, conn] of this.connections.entries()) {
      connections.push({
        connectionId,
        repoId: conn.repoId,
        repoPath: conn.repoPath,
        branch: conn.branch,
        status: conn.status,
      });
    }

    return connections;
  }

  /**
   * Send a message through a connection
   */
  async sendMessageToConnection(
    connectionId: string,
    message: GitSyncMessage,
  ): Promise<{ success: boolean; error?: string }> {
    const connectionInfo = this.connections.get(connectionId);

    if (!connectionInfo) {
      return {
        success: false,
        error: 'Connection not found',
      };
    }

    try {
      this.sendMessage(connectionInfo, message);
      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to send message';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Broadcast message to all renderer processes
   */
  private broadcastToRenderers(
    event: string,
    connectionKey: string,
    message: GitSyncMessage,
  ) {
    const allWindows = BrowserWindow.getAllWindows();
    allWindows.forEach((window) => {
      if (window.webContents && !window.webContents.isDestroyed()) {
        window.webContents.send(event, connectionKey, message);
      }
    });
  }

  /**
   * Broadcast connection lifecycle events to all renderer processes
   * This ensures all windows (including diagnostic panel) stay in sync
   */
  private broadcastConnectionEvent(
    eventType:
      | 'connection-added'
      | 'connection-removed'
      | 'connection-status-changed',
    connectionId: string,
  ) {
    const allWindows = BrowserWindow.getAllWindows();
    const eventName = `git-sync:${eventType}`;

    allWindows.forEach((window) => {
      if (window.webContents && !window.webContents.isDestroyed()) {
        window.webContents.send(eventName, connectionId);
      }
    });
  }

  /**
   * Disconnect all connections
   */
  disconnectAll() {
    console.log('[GitSyncWebSocketManager] Disconnecting all connections');
    const connectionIds = Array.from(this.connections.keys());
    connectionIds.forEach((id) => {
      this.disconnect(id);
    });
  }

  /**
   * Disconnect all connections owned by a specific window
   * Called when a window is closed to clean up its connections
   */
  disconnectForWindow(windowId: number): void {
    console.log(
      `[GitSyncWebSocketManager] Disconnecting all connections for window ${windowId}`,
    );

    const connectionsToDisconnect: string[] = [];

    // Find all connections owned by this window
    for (const [connectionId, conn] of this.connections.entries()) {
      if (conn.windowId === windowId) {
        connectionsToDisconnect.push(connectionId);
      }
    }

    // Disconnect them
    console.log(
      `[GitSyncWebSocketManager] Found ${connectionsToDisconnect.length} connections to disconnect`,
    );
    connectionsToDisconnect.forEach((id) => {
      this.disconnect(id);
    });
  }
}

// Export singleton instance
export const gitSyncWebSocketManager = GitSyncWebSocketManager.getInstance();
