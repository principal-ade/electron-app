/**
 * GitSyncWebSocketManager - Manages WebSocket connections to the traffic controller
 *
 * This service runs in the main process and handles all WebSocket connections
 * to the git-sync traffic controller using Control Tower Core's BaseClient.
 *
 * Refactored to use @principal-ai/control-tower-core for:
 * - Automatic reconnection with exponential backoff
 * - Built-in ping/pong heartbeat
 * - Type-safe event handling
 * - Automatic authentication flow
 */

import { BrowserWindow } from 'electron';
import { GitSyncEvent } from '../../window/main-process-api-implementations/gitSyncApi';
import type {
  GitSyncConfig,
  GitSyncStatus,
} from '../../shared/main-process-api-interfaces/GitSyncAPI';
import fetch from 'node-fetch';
import { deviceIdService } from './DeviceIdService';
import jwt from 'jsonwebtoken';

// Import Control Tower Core components
import {
  BaseClient,
  ClientBuilder,
  WebSocketClientTransportAdapter,
  type IAuthAdapter,
  type AuthResult,
  type TokenPayload,
  type Credentials,
  type Event,
  type RoomState,
  type RoomUser,
} from '@principal-ai/control-tower-core';

/**
 * Simple JWT Auth Adapter for Control Tower Core
 */
class JWTAuthAdapter implements IAuthAdapter {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async authenticate(_credentials: Credentials): Promise<AuthResult> {
    // For JWT auth, we don't actually use credentials parameter
    // The token is already provided in the constructor
    return {
      success: true,
      token: this.token,
    };
  }

  getCurrentToken(): string {
    return this.token;
  }

  async validateToken(token: string): Promise<TokenPayload> {
    // Decode JWT without verification (server will verify)
    const payload = jwt.decode(token) as TokenPayload;
    if (!payload) {
      throw new Error('Invalid token');
    }
    return payload;
  }

  isAuthRequired(): boolean {
    return true;
  }

  getSupportedCredentialTypes() {
    return ['jwt' as const];
  }
}

interface ConnectionInfo {
  connectionId: string;
  repoId: string;
  repoPath: string;
  branch: string;
  windowId: number; // Track which window owns this connection
  client: BaseClient; // Using Control Tower Core's BaseClient
  status: GitSyncStatus;
  token: string; // GitHub token for re-authentication
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

interface RoomTokenResponse {
  access_token: string;
  permissions?: {
    canJoin?: boolean;
    canEdit?: boolean;
    canAdmin?: boolean;
  };
  expires_in?: number;
}

interface ErrorResponse {
  error?: string;
}

export interface GitSyncMessage {
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
 * Type guard to check if a value is a GitSyncMessage
 */
function isGitSyncMessage(
  value: GitSyncMessage | Record<string, unknown> | undefined,
): value is GitSyncMessage {
  return (
    value !== undefined &&
    typeof value === 'object' &&
    'type' in value &&
    typeof value.type === 'string'
  );
}

/**
 * Singleton service that manages WebSocket connections to the traffic controller
 * Refactored to use Control Tower Core's BaseClient for connection management
 */
export class GitSyncWebSocketManager {
  private static instance: GitSyncWebSocketManager;
  private connections: Map<string, ConnectionInfo> = new Map();
  private serverUrl: string;
  private authServerUrl: string;
  private presenceRoomJoinInProgress: boolean = false;
  private presenceRoomState: { users: Map<string, RoomUser> | Record<string, unknown> } | null = null;

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
   * Now uses Control Tower Core's BaseClient for connection management
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
    if (existing && existing.client.getConnectionState() === 'connected') {
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

      // Create WebSocket URL
      const wsUrl = `${this.serverUrl}/ws`;
      console.log('[GitSyncWebSocketManager] Connecting to:', wsUrl);

      // Create JWT auth adapter
      const authAdapter = new JWTAuthAdapter(roomToken.access_token);

      // Create Control Tower Core client using ClientBuilder
      const transport = new WebSocketClientTransportAdapter();

      const client = new ClientBuilder()
        .withTransport(transport)
        .withAuth(authAdapter)
        .withReconnection({
          enabled: true,
          maxAttempts: Infinity, // Keep trying indefinitely
          initialDelay: 5000,
          maxDelay: 30000,
          backoffFactor: 1.5,
        })
        .build();

      // Set up connection info
      const connectionInfo: ConnectionInfo = {
        connectionId,
        repoId: config.repoId,
        repoPath: config.repoPath,
        branch: config.branch,
        windowId,
        client,
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

      // Store connection IMMEDIATELY
      this.connections.set(connectionId, connectionInfo);

      // Set up event handlers using Control Tower Core's event system
      this.setupClientEventHandlers(connectionInfo, config);

      // Connect the client - auth adapter will provide token automatically
      await client.connect(wsUrl);

      console.log('[GitSyncWebSocketManager] Connected:', connectionId);

      return {
        success: true,
        connectionId,
        message: 'Connected to traffic controller',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to connect';
      console.error('[GitSyncWebSocketManager] Failed to connect:', error);

      // Clean up on error
      this.connections.delete(connectionId);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Set up event handlers for Control Tower Core client
   */
  private setupClientEventHandlers(
    connectionInfo: ConnectionInfo,
    _config: GitSyncConfig,
  ): void {
    const { client, connectionId } = connectionInfo;

    // Connection opened
    client.on('connected', () => {
      console.log('[GitSyncWebSocketManager] Client connected:', connectionId);
      connectionInfo.status.connected = true;

      // Broadcast connection-added event to all renderers
      this.broadcastConnectionEvent('connection-added', connectionId);
    });

    // Disconnected
    client.on('disconnected', () => {
      console.log('[GitSyncWebSocketManager] Client disconnected:', connectionId);
      connectionInfo.status.connected = false;
      connectionInfo.status.authenticated = false;

      // Broadcast disconnect event to renderers
      this.broadcastToRenderers(GitSyncEvent.ON_MESSAGE, connectionId, {
        type: 'disconnected',
      });
    });

    // Error
    client.on('error', (data: { error: Error }) => {
      console.error('[GitSyncWebSocketManager] Client error:', data.error);
      this.broadcastToRenderers(
        GitSyncEvent.ON_MESSAGE,
        connectionId,
        { type: 'error', error: data.error.message },
      );
    });

    // Reconnecting
    client.on('reconnecting', () => {
      console.log('[GitSyncWebSocketManager] Client reconnecting:', connectionId);
      this.broadcastToRenderers(
        GitSyncEvent.ON_MESSAGE,
        connectionId,
        { type: 'reconnecting' },
      );
    });

    // Listen for raw messages via the transport layer's message handler
    // Control Tower Core may emit events differently; we'll need to adapt based on actual behavior
    // For now, we'll rely on the specific event types like room_joined, event_received, etc.
  }

  /**
   * Type guard for GitSyncMessage
   */
  private isGitSyncMessage(value: unknown): value is GitSyncMessage {
    return isGitSyncMessage(value as GitSyncMessage);
  }

  /**
   * Get room token from the landing-page auth server
   */
  private async getRoomToken(config: GitSyncConfig): Promise<RoomTokenInfo> {
    try {
      console.log(
        '[GitSyncWebSocketManager] Requesting room token from auth server',
      );

      // Get stable device ID (persisted across restarts)
      const agentId = await deviceIdService.getDeviceId();

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
        const errorData = (await response
          .json()
          .catch(() => ({}))) as ErrorResponse;
        throw new Error(
          errorData.error || `Failed to get room token: ${response.status}`,
        );
      }

      const data = (await response.json()) as RoomTokenResponse;

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
   * Get presence token from the landing-page auth server
   * Used for presence-only connections (no specific repository)
   */
  private async getPresenceToken(githubToken: string): Promise<RoomTokenInfo> {
    try {
      // Get stable device ID (persisted across restarts)
      const agentId = await deviceIdService.getDeviceId();

      // Use the configured auth server URL
      const authServerUrl = this.authServerUrl;

      // Call landing-page's presence-token endpoint
      const response = await fetch(`${authServerUrl}/api/auth/cli/presence-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          github_token: githubToken,
          device_id: agentId,
        }),
      });

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({}))) as ErrorResponse;
        throw new Error(
          errorData.error || `Failed to get presence token: ${response.status}`,
        );
      }

      const data = (await response.json()) as RoomTokenResponse;

      return {
        access_token: data.access_token,
        permissions: {
          canRead: data.permissions?.canJoin || false,
          canWrite: data.permissions?.canEdit || false,
          canAdmin: data.permissions?.canAdmin,
        },
        repository: '__presence_only__',
        branch: 'main',
        expiresIn: data.expires_in || 7200,
      };
    } catch (error) {
      console.error(
        '[GitSyncWebSocketManager] Failed to get presence token:',
        error,
      );
      throw error;
    }
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

    // Remove from connections map FIRST to prevent auto-reconnect
    this.connections.delete(connectionId);

    // Disconnect the Control Tower Core client
    if (connectionInfo.client) {
      await connectionInfo.client.disconnect();
    }

    console.log('[GitSyncWebSocketManager] Disconnected:', connectionId);

    // Broadcast connection-removed event
    this.broadcastConnectionEvent('connection-removed', connectionId);

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
      // Send message using Control Tower Core's broadcast method
      // Note: GitSyncMessage is our custom type, but we cast it to Event for Control Tower Core
      // The underlying transport will handle the actual message format
      await connectionInfo.client.broadcast(message as unknown as Event);
      console.log(
        '[GitSyncWebSocketManager] Sent message:',
        message.type,
      );
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
   * Broadcast presence events to all renderer processes
   */
  private broadcastPresenceEvent(message: GitSyncMessage) {
    const allWindows = BrowserWindow.getAllWindows();
    const eventName = 'presence:event';

    allWindows.forEach((window) => {
      if (window.webContents && !window.webContents.isDestroyed()) {
        window.webContents.send(eventName, message);
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

  /**
   * Connect to Git-Sync for presence tracking only (no specific repository)
   * This creates a lightweight connection just to track online users
   */
  async connectToPresence(
    token: string,
    windowId: number,
  ): Promise<{
    success: boolean;
    connectionId?: string;
    message?: string;
    error?: string;
  }> {
    const connectionId = '__presence_only__';

    // Check if already connected
    const existing = this.connections.get(connectionId);
    if (existing && existing.client.getConnectionState() === 'connected') {
      console.log('[GitSyncWebSocketManager] Already connected to presence');

      // Make sure we're subscribed to the global presence room
      await this.subscribeToPresence();

      return {
        success: true,
        connectionId,
        message: 'Already connected to presence',
      };
    }

    try {
      // Validate token
      if (!token) {
        return {
          success: false,
          error: 'GitHub token is required',
        };
      }

      // Get presence token from OAuth server (uses separate endpoint)
      const presenceToken = await this.getPresenceToken(token);

      // Create WebSocket URL
      const wsUrl = `${this.serverUrl}/ws`;

      // Create JWT auth adapter
      const authAdapter = new JWTAuthAdapter(presenceToken.access_token);

      // Create Control Tower Core client with logging
      const transport = new WebSocketClientTransportAdapter();

      const client = new ClientBuilder()
        .withTransport(transport)
        .withAuth(authAdapter)
        .withReconnection({
          enabled: true,
          maxAttempts: Infinity,
          initialDelay: 5000,
          maxDelay: 30000,
          backoffFactor: 1.5,
        })
        .build();

      // Set up connection info
      const connectionInfo: ConnectionInfo = {
        connectionId,
        repoId: '__presence_only__',
        repoPath: '',
        branch: 'main',
        windowId,
        client,
        token, // Store GitHub token for re-authentication
        status: {
          connected: false,
          authenticated: false,
          repoId: '__presence_only__',
          branch: 'main',
          activeLocks: [],
          queuedLocks: 0,
          peers: [],
        },
      };

      // Store connection IMMEDIATELY
      this.connections.set(connectionId, connectionInfo);

      // Set up event handlers
      this.setupPresenceEventHandlers(connectionInfo);

      // Connect the client - auth adapter will provide token automatically
      await client.connect(wsUrl);

      return {
        success: true,
        connectionId,
        message: 'Connected to presence tracking',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect';
      console.error('[GitSyncWebSocketManager] Failed to connect to presence:', error);

      // Clean up on error
      this.connections.delete(connectionId);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Set up event handlers for presence-only connection
   */
  private setupPresenceEventHandlers(connectionInfo: ConnectionInfo): void {
    const { client, connectionId } = connectionInfo;

    // Connection opened
    client.on('connected', () => {
      connectionInfo.status.connected = true;
      connectionInfo.status.authenticated = true; // Auth is handled by Control Tower Core
      this.broadcastConnectionEvent('connection-added', connectionId);

      // Auto-subscribe to presence after successful connection
      setTimeout(async () => {
        await this.subscribeToPresence();
      }, 100);
    });

    // Disconnected
    client.on('disconnected', () => {
      console.log('[GitSyncWebSocketManager] Presence client disconnected');
      connectionInfo.status.connected = false;
      connectionInfo.status.authenticated = false;

      this.broadcastToRenderers(GitSyncEvent.ON_MESSAGE, connectionId, {
        type: 'disconnected',
      });
    });

    // Error
    client.on('error', (data: { error: Error }) => {
      console.error('[GitSyncWebSocketManager] Presence client error:', data.error);
    });

    // Room joined - emitted when successfully joined a room
    client.on('room_joined', (data: { roomId: string; state: RoomState }) => {
      console.log('[GitSyncWebSocketManager] 📡 Event emitted: room_joined', data);

      // Store presence room state if this is the global presence room
      if (data.roomId === '__global_presence__' && data.state?.users) {
        this.presenceRoomState = { users: data.state.users as Map<string, RoomUser> | Record<string, unknown> };
        const userCount = data.state.users instanceof Map ? data.state.users.size : Object.keys(data.state.users).length;
        console.log('[GitSyncWebSocketManager] ✓ Stored presence room state with', userCount, 'users');
        console.log('[GitSyncWebSocketManager] Users type:', data.state.users instanceof Map ? 'Map' : 'Object');
      }

      console.log('[GitSyncWebSocketManager] ✓ room_joined event:', data.roomId);
    });

    // Presence updated - emitted when users join/leave or update their presence
    client.on('presence_updated', (data: { users: RoomUser[] }) => {
      console.log('[GitSyncWebSocketManager] 📡 presence_updated event received');

      // Update stored room state - convert array to Map
      const usersMap = new Map<string, RoomUser>();
      for (const user of data.users) {
        usersMap.set(user.id, user);
      }
      this.presenceRoomState = { users: usersMap };

      console.log('[GitSyncWebSocketManager] ✓ Updated presence room state with', usersMap.size, 'users');

      // Broadcast to renderers
      this.broadcastToRenderers(GitSyncEvent.ON_MESSAGE, connectionId, {
        type: 'presence_updated',
        users: data.users,
      });
    });

  }

  /**
   * Disconnect from presence-only connection
   */
  async disconnectFromPresence(): Promise<{
    success: boolean;
    message?: string;
  }> {
    return this.disconnect('__presence_only__');
  }

  /**
   * Subscribe to global presence events
   * Uses any existing connection to join the __global_presence__ room
   */
  async subscribeToPresence(): Promise<boolean> {
    try {
      // Find any connected client
      const connections = Array.from(this.connections.values());
      const activeConnection = connections.find(
        (conn) => conn.client.getConnectionState() === 'connected' && conn.status.authenticated,
      );

      if (!activeConnection) {
        console.warn('[GitSyncWebSocketManager] No active connection for presence subscription');
        return false;
      }

      // Check if already in the presence room
      const currentRoom = activeConnection.client.getCurrentRoomId();
      if (currentRoom === '__global_presence__') {
        return true;
      }

      // Check if join is already in progress
      if (this.presenceRoomJoinInProgress) {
        return true;
      }

      // Join the global presence room using Control Tower Core's joinRoom method
      this.presenceRoomJoinInProgress = true;

      try {
        // Wait for the room_joined event to confirm successful join
        // IMPORTANT: Set up the promise and event listener BEFORE calling joinRoom()
        const joinPromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.error('[GitSyncWebSocketManager] Room join timeout - no room_joined event received');
            reject(new Error('Room join timeout'));
          }, 5000);

          const onRoomJoined = (data: { roomId: string; state: unknown }) => {
            if (data.roomId === '__global_presence__') {
              clearTimeout(timeout);
              activeConnection.client.off('room_joined', onRoomJoined);
              resolve();
            }
          };

          activeConnection.client.on('room_joined', onRoomJoined);
        });

        await activeConnection.client.joinRoom('__global_presence__');
        await joinPromise;
        return true;
      } finally {
        this.presenceRoomJoinInProgress = false;
      }
    } catch (error) {
      console.error('[GitSyncWebSocketManager] Failed to subscribe to presence:', error);
      return false;
    }
  }

  /**
   * Fetch presence data from the stored room state
   */
  async fetchPresenceData(): Promise<{
    success: boolean;
    data?: {
      users: unknown[];
      stats: { totalOnline: number; totalRepositories: number; activeCollaborations: number };
    };
    error?: string;
  }> {
    try {
      // Check if we have stored presence room state
      if (!this.presenceRoomState) {
        console.warn('[GitSyncWebSocketManager] No presence room state available');
        return {
          success: true,
          data: {
            users: [],
            stats: { totalOnline: 0, totalRepositories: 0, activeCollaborations: 0 },
          },
        };
      }

      // Convert users to array - handle both Map and plain object
      let usersArray: unknown[];
      const isMap = this.presenceRoomState.users instanceof Map;
      console.log('[GitSyncWebSocketManager] presenceRoomState.users type:', isMap ? 'Map' : 'Object');

      if (isMap) {
        usersArray = Array.from((this.presenceRoomState.users as Map<string, RoomUser>).values());
      } else {
        // If it's a plain object, use Object.values
        usersArray = Object.values(this.presenceRoomState.users as Record<string, unknown>);
      }

      // Transform RoomUser objects to UserPresence format expected by the UI
      const transformedUsers = usersArray.map((user: unknown) => {
        const u = user as Record<string, unknown>;
        return {
          userId: (u.id as string) || (u.userId as string),
          status: (u.status as string) || 'online',
          openRepositories: (u.openRepositories as unknown[]) || [],
          activeRepository: u.activeRepository as string | undefined,
          lastSeen: (u.lastActivity as number) || (u.lastSeen as number) || Date.now(),
          devices: (u.devices as unknown[]) || [],
          statusMessage: u.statusMessage as string | undefined,
          // Preserve any additional metadata
          ...(u.metadata as Record<string, unknown> | undefined),
        };
      });

      const totalOnline = transformedUsers.length;

      console.log('[GitSyncWebSocketManager] Fetched presence data:', totalOnline, 'users');

      return {
        success: true,
        data: {
          users: transformedUsers,
          stats: { totalOnline, totalRepositories: 0, activeCollaborations: 0 },
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch presence data';
      console.error('[GitSyncWebSocketManager] Failed to fetch presence:', error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Fetch users in a specific repository
   */
  async fetchRepositoryPresence(
    owner: string,
    repo: string,
  ): Promise<{
    success: boolean;
    data?: { repoId: string; users: unknown[]; totalUsers: number };
    error?: string;
  }> {
    try {
      // Convert WebSocket URL to HTTP URL for REST API calls
      const httpUrl = this.serverUrl.replace('wss://', 'https://').replace('ws://', 'http://');
      const response = await fetch(`${httpUrl}/api/presence/repos/${owner}/${repo}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch repository presence: ${response.status}`);
      }

      const data = await response.json() as { repoId: string; users: unknown[]; totalUsers: number };
      return {
        success: true,
        data,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch repository presence';
      console.error('[GitSyncWebSocketManager] Failed to fetch repository presence:', error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Fetch presence for a specific user
   */
  async fetchUserPresence(
    userId: string,
  ): Promise<{
    success: boolean;
    data?: unknown;
    error?: string;
  }> {
    try {
      // Convert WebSocket URL to HTTP URL for REST API calls
      const httpUrl = this.serverUrl.replace('wss://', 'https://').replace('ws://', 'http://');
      const response = await fetch(`${httpUrl}/api/presence/user/${userId}`);

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            error: 'User not found',
          };
        }
        throw new Error(`Failed to fetch user presence: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch user presence';
      console.error('[GitSyncWebSocketManager] Failed to fetch user presence:', error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Report that a repository has been opened
   */
  async reportRepositoryOpened(
    owner: string,
    repo: string,
    branch: string,
    localPath?: string,
    token?: string,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const httpUrl = this.serverUrl.replace('wss://', 'https://').replace('ws://', 'http://');

      // Get auth token - use provided token or get from active connection
      let authToken = token;
      if (!authToken) {
        const activeConnection = Array.from(this.connections.values()).find(
          (conn) => conn.client.getConnectionState() === 'connected' && conn.status.authenticated,
        );
        authToken = activeConnection?.token;
      }

      if (!authToken) {
        return {
          success: false,
          message: 'No authentication token available',
        };
      }

      const response = await fetch(`${httpUrl}/api/presence/repo/open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          owner,
          repo,
          branch,
          localPath,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to report repository opened: ${response.status}`);
      }

      console.log('[GitSyncWebSocketManager] Reported repository opened:', { owner, repo, branch });
      return { success: true, message: 'Repository opened reported' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to report repository opened';
      console.error('[GitSyncWebSocketManager] Failed to report repository opened:', error);
      return { success: false, message: errorMessage };
    }
  }

  /**
   * Report that a repository has been closed
   */
  async reportRepositoryClosed(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const httpUrl = this.serverUrl.replace('wss://', 'https://').replace('ws://', 'http://');

      // Get auth token - use provided token or get from active connection
      let authToken = token;
      if (!authToken) {
        const activeConnection = Array.from(this.connections.values()).find(
          (conn) => conn.client.getConnectionState() === 'connected' && conn.status.authenticated,
        );
        authToken = activeConnection?.token;
      }

      if (!authToken) {
        return {
          success: false,
          message: 'No authentication token available',
        };
      }

      const response = await fetch(`${httpUrl}/api/presence/repo/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          owner,
          repo,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to report repository closed: ${response.status}`);
      }

      console.log('[GitSyncWebSocketManager] Reported repository closed:', { owner, repo });
      return { success: true, message: 'Repository closed reported' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to report repository closed';
      console.error('[GitSyncWebSocketManager] Failed to report repository closed:', error);
      return { success: false, message: errorMessage };
    }
  }

  /**
   * Report that a repository is now the active/focused one
   */
  async reportActiveRepository(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const httpUrl = this.serverUrl.replace('wss://', 'https://').replace('ws://', 'http://');

      // Get auth token - use provided token or get from active connection
      let authToken = token;
      if (!authToken) {
        const activeConnection = Array.from(this.connections.values()).find(
          (conn) => conn.client.getConnectionState() === 'connected' && conn.status.authenticated,
        );
        authToken = activeConnection?.token;
      }

      if (!authToken) {
        return {
          success: false,
          message: 'No authentication token available',
        };
      }

      const response = await fetch(`${httpUrl}/api/presence/repo/focus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          owner,
          repo,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to report active repository: ${response.status}`);
      }

      console.log('[GitSyncWebSocketManager] Reported active repository:', { owner, repo });
      return { success: true, message: 'Active repository reported' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to report active repository';
      console.error('[GitSyncWebSocketManager] Failed to report active repository:', error);
      return { success: false, message: errorMessage };
    }
  }

  /**
   * Update user status
   */
  async updatePresenceStatus(
    status: 'online' | 'away',
    statusMessage?: string,
    token?: string,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const httpUrl = this.serverUrl.replace('wss://', 'https://').replace('ws://', 'http://');

      // Get auth token - use provided token or get from active connection
      let authToken = token;
      if (!authToken) {
        const activeConnection = Array.from(this.connections.values()).find(
          (conn) => conn.client.getConnectionState() === 'connected' && conn.status.authenticated,
        );
        authToken = activeConnection?.token;
      }

      if (!authToken) {
        return {
          success: false,
          message: 'No authentication token available',
        };
      }

      const response = await fetch(`${httpUrl}/api/presence/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          status,
          message: statusMessage,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update presence status: ${response.status}`);
      }

      console.log('[GitSyncWebSocketManager] Updated presence status:', { status, statusMessage });
      return { success: true, message: 'Status updated' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update presence status';
      console.error('[GitSyncWebSocketManager] Failed to update presence status:', error);
      return { success: false, message: errorMessage };
    }
  }

  /**
   * Set user visibility (visible/invisible mode)
   */
  async setPresenceVisibility(
    visible: boolean,
    userId: string,
    token?: string,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const httpUrl = this.serverUrl.replace('wss://', 'https://').replace('ws://', 'http://');

      // Get auth token - use provided token or get from active connection
      let authToken = token;
      if (!authToken) {
        const activeConnection = Array.from(this.connections.values()).find(
          (conn) => conn.client.getConnectionState() === 'connected' && conn.status.authenticated,
        );
        authToken = activeConnection?.token;
      }

      if (!authToken) {
        return {
          success: false,
          message: 'No authentication token available',
        };
      }

      const response = await fetch(`${httpUrl}/api/presence/visibility`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          userId,
          visible,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to set presence visibility: ${response.status}`);
      }

      console.log('[GitSyncWebSocketManager] Set presence visibility:', { userId, visible });
      return { success: true, message: `Visibility set to ${visible ? 'visible' : 'invisible'}` };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to set presence visibility';
      console.error('[GitSyncWebSocketManager] Failed to set presence visibility:', error);
      return { success: false, message: errorMessage };
    }
  }

  /**
   * Send a heartbeat to keep presence alive
   */
  async sendPresenceHeartbeat(token?: string): Promise<{ success: boolean; message?: string }> {
    try {
      const httpUrl = this.serverUrl.replace('wss://', 'https://').replace('ws://', 'http://');

      // Get auth token - use provided token or get from active connection
      let authToken = token;
      if (!authToken) {
        const activeConnection = Array.from(this.connections.values()).find(
          (conn) => conn.client.getConnectionState() === 'connected' && conn.status.authenticated,
        );
        authToken = activeConnection?.token;
      }

      if (!authToken) {
        return {
          success: false,
          message: 'No authentication token available',
        };
      }

      const response = await fetch(`${httpUrl}/api/presence/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`Failed to send presence heartbeat: ${response.status}`);
      }

      return { success: true, message: 'Heartbeat sent' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send presence heartbeat';
      console.error('[GitSyncWebSocketManager] Failed to send presence heartbeat:', error);
      return { success: false, message: errorMessage };
    }
  }
}

// Export singleton instance
export const gitSyncWebSocketManager = GitSyncWebSocketManager.getInstance();
