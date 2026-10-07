/**
 * OrbitWebSocketManager - Manages WebSocket connections for P2P collaboration signaling
 *
 * This service runs in the main process and handles WebRTC signaling
 * via Control Tower Core's BaseClient. It replaces the HTTP polling
 * approach used by the old OrbitService.
 *
 * Pattern follows GitSyncWebSocketManager for consistency.
 */

import { BrowserWindow } from 'electron';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import { deviceIdService } from './DeviceIdService';
import { APP_BRANDING } from '../../shared/config/appBranding';
import { requireHostedFeature } from './FeatureAvailabilityService';

// Import Control Tower Core components
import {
  BaseClient,
  ClientBuilder,
  WebSocketClientTransportAdapter,
  type IAuthAdapter,
  type TokenPayload,
  type Event,
  type RoomState,
  type RoomUser,
} from '@principal-ai/control-tower-core';

// Import Orbit types
import type {
  OrbitPeer,
  OrbitSignal,
} from '../../shared/main-process-api-interfaces/OrbitAPI';

/**
 * IPC Event names for Orbit signaling
 */
export const OrbitEvent = {
  // Renderer → Main
  CONNECT: 'orbit:connect',
  DISCONNECT: 'orbit:disconnect',
  SEND_SIGNAL: 'orbit:sendSignal',
  GET_PEERS: 'orbit:getPeers',
  // Main → Renderer
  SIGNAL_RECEIVED: 'orbit:signal-received',
  PEER_JOINED: 'orbit:peer-joined',
  PEER_LEFT: 'orbit:peer-left',
  CONNECTED: 'orbit:connected',
  DISCONNECTED: 'orbit:disconnected',
  ERROR: 'orbit:error',
} as const;

/**
 * Simple JWT Auth Adapter for Control Tower Core
 */
class JWTAuthAdapter implements IAuthAdapter {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  getCurrentToken(): string {
    return this.token;
  }

  async validateToken(token: string): Promise<TokenPayload> {
    const payload = jwt.decode(token) as TokenPayload;
    if (!payload) {
      throw new Error('Invalid token');
    }
    return payload;
  }

  isAuthRequired(): boolean {
    return true;
  }
}

/**
 * Connection info for a single Orbit collaboration session
 */
interface OrbitConnectionInfo {
  connectionId: string;
  repoUrl: string;
  roomId: string;
  windowId: number;
  client: BaseClient;
  peerId: string;
  githubHandle: string;
  token: string;
  connected: boolean;
  authenticated: boolean;
  peers: Map<string, OrbitPeer>;
}

interface OrbitTokenResponse {
  access_token: string;
  peer_id: string;
  github_handle: string;
  expires_in?: number;
}

interface ErrorResponse {
  error?: string;
}

/**
 * Singleton service that manages WebSocket connections for Orbit P2P signaling
 */
export class OrbitWebSocketManager {
  private static instance: OrbitWebSocketManager;
  private connections: Map<string, OrbitConnectionInfo> = new Map();
  private serverUrl: string;
  private authServerUrl: string;

  // Server URLs - same as GitSync for unified infrastructure
  private readonly DEFAULT_DEV_SERVER = 'ws://localhost:3001';
  private readonly DEFAULT_DEV_AUTH = 'http://localhost:3000';
  private readonly DEFAULT_PROD_SERVER =
    'wss://repository-traffic-controller-production.rj36caac972nm.us-east-1.cs.amazonlightsail.com';
  private readonly DEFAULT_PROD_AUTH = APP_BRANDING.AUTH_SERVER_URL.PRODUCTION;

  private constructor() {
    this.serverUrl =
      process.env.GIT_SYNC_SERVER_URL || this.DEFAULT_PROD_SERVER;
    this.authServerUrl = process.env.AUTH_SERVER_URL || this.DEFAULT_PROD_AUTH;

    console.log(
      '[OrbitWebSocketManager] Initialized with server:',
      this.serverUrl,
    );
  }

  static getInstance(): OrbitWebSocketManager {
    if (!OrbitWebSocketManager.instance) {
      OrbitWebSocketManager.instance = new OrbitWebSocketManager();
    }
    return OrbitWebSocketManager.instance;
  }

  /**
   * Set environment (dev or prod)
   */
  setEnvironment(environment: 'development' | 'production'): void {
    if (environment === 'production') {
      this.serverUrl = this.DEFAULT_PROD_SERVER;
      this.authServerUrl = this.DEFAULT_PROD_AUTH;
    } else {
      this.serverUrl = this.DEFAULT_DEV_SERVER;
      this.authServerUrl = this.DEFAULT_DEV_AUTH;
    }
    console.log(`[OrbitWebSocketManager] Environment set to ${environment}`);
  }

  /**
   * Connect to Control Tower for P2P signaling in a specific repository
   */
  async connect(
    config: { repoUrl: string; token: string },
    windowId: number,
  ): Promise<{
    success: boolean;
    connectionId?: string;
    peerId?: string;
    githubHandle?: string;
    peers?: OrbitPeer[];
    error?: string;
  }> {
    await requireHostedFeature('presenceAndCollaboration');
    // Create room ID from repo URL (e.g., "orbit:owner/repo")
    const roomId = `orbit:${this.normalizeRepoUrl(config.repoUrl)}`;
    const connectionId = `${roomId}:${windowId}`;

    // Check if already connected
    const existing = this.connections.get(connectionId);
    if (existing && existing.client.getConnectionState() === 'connected') {
      console.log('[OrbitWebSocketManager] Already connected:', connectionId);
      return {
        success: true,
        connectionId,
        peerId: existing.peerId,
        githubHandle: existing.githubHandle,
        peers: Array.from(existing.peers.values()),
      };
    }

    try {
      if (!config.token) {
        return { success: false, error: 'GitHub token is required' };
      }

      // Get orbit token from auth server
      const orbitToken = await this.getOrbitToken(config.token, config.repoUrl);

      // Create WebSocket URL
      const wsUrl = `${this.serverUrl}/ws`;
      console.log('[OrbitWebSocketManager] Connecting to:', wsUrl);

      // Create Control Tower Core client
      const authAdapter = new JWTAuthAdapter(orbitToken.access_token);
      const transport = new WebSocketClientTransportAdapter();

      const client = new ClientBuilder()
        .withTransport(transport)
        .withAuth(authAdapter)
        .withReconnection({
          enabled: true,
          maxAttempts: Infinity,
          initialDelay: 3000,
          maxDelay: 30000,
          backoffFactor: 1.5,
        })
        .build();

      // Set up connection info
      const connectionInfo: OrbitConnectionInfo = {
        connectionId,
        repoUrl: config.repoUrl,
        roomId,
        windowId,
        client,
        peerId: orbitToken.peer_id,
        githubHandle: orbitToken.github_handle,
        token: config.token,
        connected: false,
        authenticated: false,
        peers: new Map(),
      };

      // Store connection BEFORE connecting
      this.connections.set(connectionId, connectionInfo);

      // Set up event handlers
      this.setupEventHandlers(connectionInfo);

      // Connect
      await client.connect(wsUrl);

      console.log('[OrbitWebSocketManager] Connected:', connectionId);

      return {
        success: true,
        connectionId,
        peerId: orbitToken.peer_id,
        githubHandle: orbitToken.github_handle,
        peers: [],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to connect';
      console.error('[OrbitWebSocketManager] Failed to connect:', error);

      this.connections.delete(connectionId);

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Set up event handlers for the Control Tower client
   */
  private setupEventHandlers(connectionInfo: OrbitConnectionInfo): void {
    const { client, connectionId, roomId, windowId } = connectionInfo;

    // Connected
    client.on('connected', async () => {
      console.log('[OrbitWebSocketManager] Client connected:', connectionId);
      connectionInfo.connected = true;

      // Send authenticate message
      try {
        const authAdapter = client['auth'] as {
          getCurrentToken?: () => string;
        };
        const token = authAdapter?.getCurrentToken?.();
        if (token) {
          const transport = client['transport'] as {
            send: (msg: unknown) => Promise<void>;
          };
          await transport.send({
            type: 'authenticate',
            payload: { token },
            timestamp: Date.now(),
          });
          connectionInfo.authenticated = true;

          // Join the orbit collaboration room
          await client.joinRoom(roomId);
          console.log('[OrbitWebSocketManager] Joined room:', roomId);
        }
      } catch (error) {
        console.error('[OrbitWebSocketManager] Auth/join failed:', error);
      }

      // Notify renderer
      this.sendToWindow(windowId, OrbitEvent.CONNECTED, {
        connectionId,
        peerId: connectionInfo.peerId,
        githubHandle: connectionInfo.githubHandle,
      });
    });

    // Disconnected
    client.on('disconnected', () => {
      console.log('[OrbitWebSocketManager] Client disconnected:', connectionId);
      connectionInfo.connected = false;
      connectionInfo.authenticated = false;

      this.sendToWindow(windowId, OrbitEvent.DISCONNECTED, { connectionId });
    });

    // Error
    client.on('error', (data: { error: Error }) => {
      console.error('[OrbitWebSocketManager] Client error:', data.error);
      this.sendToWindow(windowId, OrbitEvent.ERROR, {
        connectionId,
        error: data.error.message,
      });
    });

    // Room joined - get initial peer list
    client.on('room_joined', (data: { roomId: string; state: RoomState }) => {
      console.log('[OrbitWebSocketManager] Room joined:', data.roomId);

      if (data.roomId === roomId && data.state?.users) {
        // Convert room users to OrbitPeers
        for (const [userId, user] of data.state.users) {
          if (userId !== connectionInfo.peerId) {
            const peer: OrbitPeer = {
              peerId: userId,
              githubHandle: user.username || userId,
            };
            connectionInfo.peers.set(userId, peer);

            // Notify renderer of existing peer
            this.sendToWindow(windowId, OrbitEvent.PEER_JOINED, peer);
          }
        }
      }
    });

    // Presence updated - peer joined/left
    client.on('presence_updated', (data: { users: RoomUser[] }) => {
      const currentPeerIds = new Set(connectionInfo.peers.keys());
      const newPeerIds = new Set<string>();

      for (const user of data.users) {
        if (user.id !== connectionInfo.peerId) {
          newPeerIds.add(user.id);

          if (!currentPeerIds.has(user.id)) {
            // New peer joined
            const peer: OrbitPeer = {
              peerId: user.id,
              githubHandle: user.username || user.id,
            };
            connectionInfo.peers.set(user.id, peer);
            this.sendToWindow(windowId, OrbitEvent.PEER_JOINED, peer);
          }
        }
      }

      // Check for peers that left
      for (const peerId of currentPeerIds) {
        if (!newPeerIds.has(peerId)) {
          connectionInfo.peers.delete(peerId);
          this.sendToWindow(windowId, OrbitEvent.PEER_LEFT, { peerId });
        }
      }
    });

    // Event received - WebRTC signaling messages
    client.on('event_received', (data: { event: Event }) => {
      const event = data.event;
      const eventType = event.type as string;

      // Handle WebRTC signaling events
      if (
        eventType === 'webrtc:offer' ||
        eventType === 'webrtc:answer' ||
        eventType === 'webrtc:ice_candidate'
      ) {
        const eventData = event.data as { targetPeerId?: string; userId?: string };
        const targetPeerId = eventData?.targetPeerId;

        // Only process signals meant for us
        if (targetPeerId && targetPeerId !== connectionInfo.peerId) {
          return;
        }

        const signal: OrbitSignal = {
          from: eventData.userId || 'unknown',
          to: connectionInfo.peerId,
          type: eventType.replace('webrtc:', ''), // 'offer', 'answer', 'ice_candidate'
          data: event.data,
        };

        this.sendToWindow(windowId, OrbitEvent.SIGNAL_RECEIVED, signal);
      }
    });
  }

  /**
   * Send a WebRTC signal to a specific peer
   */
  async sendSignal(
    connectionId: string,
    targetPeerId: string,
    signalType: string,
    signalData: unknown,
  ): Promise<{ success: boolean; error?: string }> {
    const connectionInfo = this.connections.get(connectionId);

    if (!connectionInfo) {
      return { success: false, error: 'Connection not found' };
    }

    if (!connectionInfo.authenticated) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Create signaling event
      const event = {
        id: `webrtc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        type: `webrtc:${signalType}`, // webrtc:offer, webrtc:answer, webrtc:ice_candidate
        timestamp: Date.now(),
        userId: connectionInfo.peerId,
        roomId: connectionInfo.roomId,
        data: {
          ...(signalData as Record<string, unknown>),
          targetPeerId,
        },
        metadata: {
          userId: connectionInfo.peerId,
          timestamp: Date.now(),
          roomId: connectionInfo.roomId,
        },
      } as unknown as Event;

      await connectionInfo.client.broadcast(event);

      console.log(
        '[OrbitWebSocketManager] Signal sent:',
        signalType,
        '→',
        targetPeerId,
      );
      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to send signal';
      console.error('[OrbitWebSocketManager] Failed to send signal:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get current peers in the room
   */
  getPeers(connectionId: string): OrbitPeer[] {
    const connectionInfo = this.connections.get(connectionId);
    if (!connectionInfo) {
      return [];
    }
    return Array.from(connectionInfo.peers.values());
  }

  /**
   * Disconnect from a collaboration session
   */
  async disconnect(
    connectionId: string,
  ): Promise<{ success: boolean; message?: string }> {
    const connectionInfo = this.connections.get(connectionId);

    if (!connectionInfo) {
      return { success: false, message: 'Connection not found' };
    }

    // Remove from map first to prevent auto-reconnect
    this.connections.delete(connectionId);

    // Disconnect client
    if (connectionInfo.client) {
      await connectionInfo.client.disconnect();
    }

    console.log('[OrbitWebSocketManager] Disconnected:', connectionId);

    return { success: true, message: 'Disconnected' };
  }

  /**
   * Disconnect all connections owned by a specific window
   */
  disconnectForWindow(windowId: number): void {
    console.log(
      `[OrbitWebSocketManager] Disconnecting connections for window ${windowId}`,
    );

    const toDisconnect: string[] = [];

    for (const [connectionId, conn] of this.connections.entries()) {
      if (conn.windowId === windowId) {
        toDisconnect.push(connectionId);
      }
    }

    console.log(
      `[OrbitWebSocketManager] Found ${toDisconnect.length} connections to disconnect`,
    );

    for (const id of toDisconnect) {
      this.disconnect(id);
    }
  }

  disconnectAll(): void {
    for (const connectionId of this.connections.keys()) {
      void this.disconnect(connectionId);
    }
  }

  /**
   * Get all active connections
   */
  getAllConnections(): Array<{
    connectionId: string;
    repoUrl: string;
    peerId: string;
    githubHandle: string;
    connected: boolean;
    peerCount: number;
  }> {
    const connections: Array<{
      connectionId: string;
      repoUrl: string;
      peerId: string;
      githubHandle: string;
      connected: boolean;
      peerCount: number;
    }> = [];

    for (const [connectionId, conn] of this.connections.entries()) {
      connections.push({
        connectionId,
        repoUrl: conn.repoUrl,
        peerId: conn.peerId,
        githubHandle: conn.githubHandle,
        connected: conn.connected,
        peerCount: conn.peers.size,
      });
    }

    return connections;
  }

  /**
   * Get orbit token from auth server
   */
  private async getOrbitToken(
    githubToken: string,
    repoUrl: string,
  ): Promise<OrbitTokenResponse> {
    try {
      const agentId = await deviceIdService.getDeviceId();

      const response = await fetch(
        `${this.authServerUrl}/api/auth/cli/orbit-token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            github_token: githubToken,
            repo_url: repoUrl,
            device_id: agentId,
          }),
        },
      );

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({}))) as ErrorResponse;
        throw new Error(
          errorData.error || `Failed to get orbit token: ${response.status}`,
        );
      }

      const data = (await response.json()) as OrbitTokenResponse;
      return data;
    } catch (error) {
      console.error(
        '[OrbitWebSocketManager] Failed to get orbit token:',
        error,
      );
      throw error;
    }
  }

  /**
   * Normalize repo URL to consistent format (owner/repo)
   */
  private normalizeRepoUrl(repoUrl: string): string {
    // Handle various formats:
    // - https://github.com/owner/repo
    // - git@github.com:owner/repo.git
    // - owner/repo
    let normalized = repoUrl
      .replace(/^https?:\/\/github\.com\//, '')
      .replace(/^git@github\.com:/, '')
      .replace(/\.git$/, '');

    return normalized;
  }

  /**
   * Send message to a specific window
   */
  private sendToWindow(windowId: number, event: string, data: unknown): void {
    const windows = BrowserWindow.getAllWindows();
    const targetWindow = windows.find((w) => w.id === windowId);

    if (targetWindow && !targetWindow.webContents.isDestroyed()) {
      targetWindow.webContents.send(event, data);
    }
  }

  /**
   * Broadcast to all windows
   */
  private broadcastToAllWindows(event: string, data: unknown): void {
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      if (!window.webContents.isDestroyed()) {
        window.webContents.send(event, data);
      }
    }
  }
}

// Export singleton instance
export const orbitWebSocketManager = OrbitWebSocketManager.getInstance();
