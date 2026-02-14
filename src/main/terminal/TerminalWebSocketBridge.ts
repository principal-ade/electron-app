/**
 * Terminal WebSocket Bridge
 *
 * Bridges terminal sessions to browser clients via Control Tower WebSocket server.
 * Handles:
 * - Session discovery and listing
 * - Remote client attachment/detachment
 * - PTY data streaming to remote clients
 * - Ownership management for remote clients
 * - Authorization and permission checking
 */

import { TerminalSessionManager } from './TerminalSessionManager';
import { TerminalOwnershipManager } from './TerminalOwnershipManager';
import type {
  TerminalOwner,
  TerminalSession,
} from './types';
import type {
  TerminalEvent,
  TerminalSessionInfo,
  TerminalAttachPayload,
  TerminalClaimOwnershipPayload,
  TerminalReleaseOwnershipPayload,
  TerminalWritePayload,
  TerminalResizePayload,
} from '../../shared/terminal-events';
import { ownerToWireFormat } from '../../shared/terminal-events';

// Import Control Tower Core components
import {
  BaseClient,
  ClientBuilder,
  WebSocketClientTransportAdapter,
  type IAuthAdapter,
  type TokenPayload,
  type Event,
} from '@principal-ai/control-tower-core';
import jwt from 'jsonwebtoken';

/**
 * Simple JWT Auth Adapter for terminal tokens
 */
class TerminalJWTAuthAdapter implements IAuthAdapter {
  constructor(private token: string) {}

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

interface TerminalConnection {
  connectionId: string;
  client: BaseClient;
  roomId: string; // Format: "terminals:user:{userId}"
  hasJoinedRoom: boolean;
  userId: string;
  githubHandle: string;
}

interface DataBuffer {
  data: string;
  sequence: number;
  timestamp: number;
}

export class TerminalWebSocketBridge {
  // Active user connection (single connection per user)
  private userConnection: TerminalConnection | null = null;

  // Track which sessions have remote attachments: sessionId -> Set<clientId>
  private remoteAttachments = new Map<string, Set<string>>();

  // Data buffers for remote clients: sessionId:clientId -> DataBuffer[]
  private dataBuffers = new Map<string, DataBuffer[]>();

  // Sequence counters for data ordering: sessionId -> sequence
  private dataSequences = new Map<string, number>();

  // WebSocket server URL
  private wsServerUrl: string;

  constructor(
    private sessionManager: TerminalSessionManager,
    private ownershipManager: TerminalOwnershipManager,
    wsServerUrl?: string,
  ) {
    // Default to production server, can be overridden
    this.wsServerUrl =
      wsServerUrl ||
      process.env.CONTROL_TOWER_WS_URL ||
      'wss://repository-traffic-controller-production.rj36caac972nm.us-east-1.cs.amazonlightsail.com/ws';

    console.log(
      `[TerminalWebSocketBridge] Initialized with server: ${this.wsServerUrl}`,
    );

    // Register data listener to intercept PTY output
    this.sessionManager.addDataListener(
      'websocket-bridge',
      this.handlePTYData.bind(this),
    );
  }

  /**
   * Handle PTY data from monitoring port
   */
  private handlePTYData(sessionId: string, data: string): void {
    // Stream to remote clients if any are attached
    this.streamDataToRemoteClients(sessionId, data);
  }

  // =============================================================================
  // Connection Management
  // =============================================================================

  /**
   * Connect to user's terminal discovery room
   * This allows discovering all terminal sessions across all repositories for this user
   */
  async connectToUserRoom(
    token: string,
    userId: string,
    githubHandle: string,
  ): Promise<{ success: boolean; connectionId?: string; error?: string }> {
    const connectionId = `terminal-user-${userId}-${Date.now()}`;
    const roomId = `terminals:user:${userId}`;

    console.log(
      `[TerminalWebSocketBridge] Connecting to user discovery room ${roomId} for user ${githubHandle}`,
    );

    try {
      // TODO: Exchange GitHub token for terminal-specific token
      // For now, use the provided token directly
      const terminalToken = await this.getTerminalToken(token);

      // Create Control Tower client
      const authAdapter = new TerminalJWTAuthAdapter(terminalToken);
      const transport = new WebSocketClientTransportAdapter();

      const client = new ClientBuilder()
        .withTransport(transport)
        .withAuth(authAdapter)
        .build();

      // Set up event handlers
      this.setupClientEventHandlers(client, connectionId);

      // Connect to server
      await client.connect(this.wsServerUrl);

      // Wait for room join to complete
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Room join timeout'));
        }, 10000);

        // Listen for room_joined event
        client.once('room_joined', () => {
          clearTimeout(timeout);
          resolve();
        });

        // Listen for errors
        client.once('error', (err: unknown) => {
          clearTimeout(timeout);
          const errorMessage =
            err && typeof err === 'object' && 'error' in err && err.error && typeof err.error === 'object' && 'message' in err.error
              ? String(err.error.message)
              : 'Failed to join room';
          reject(new Error(errorMessage));
        });

        // Send join room request
        client.joinRoom(roomId).catch((err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      // Store connection info
      this.userConnection = {
        connectionId,
        client,
        roomId,
        hasJoinedRoom: true,
        userId,
        githubHandle,
      };

      console.log(
        `[TerminalWebSocketBridge] Successfully connected to user discovery room ${roomId}`,
      );

      // Broadcast current session list to room (all sessions for this user)
      await this.broadcastSessionList();

      return { success: true, connectionId };
    } catch (error) {
      console.error(
        `[TerminalWebSocketBridge] Failed to connect to user discovery room ${roomId}:`,
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Disconnect from user discovery room
   */
  async disconnectFromUserRoom(): Promise<void> {
    if (!this.userConnection) {
      return;
    }

    console.log(
      `[TerminalWebSocketBridge] Disconnecting from room ${this.userConnection.roomId}`,
    );

    try {
      await this.userConnection.client.disconnect();
    } catch (error) {
      console.error(
        `[TerminalWebSocketBridge] Error disconnecting:`,
        error,
      );
    }

    this.userConnection = null;
  }

  /**
   * Get terminal-specific JWT token
   * TODO: Implement actual token exchange with auth server
   */
  private async getTerminalToken(githubToken: string): Promise<string> {
    // TODO: Exchange with auth server endpoint /api/auth/cli/terminal-token
    // For now, return the GitHub token directly
    console.warn(
      '[TerminalWebSocketBridge] Using GitHub token directly - implement token exchange',
    );
    return githubToken;
  }

  // =============================================================================
  // Event Handlers
  // =============================================================================

  /**
   * Set up event handlers for a client connection
   */
  private setupClientEventHandlers(
    client: BaseClient,
    connectionId: string,
  ): void {
    // Handle terminal events from remote clients
    client.on('event_received', (data: { event: Event }) => {
      const event = data.event;
      // Check if this is a terminal event (type guard)
      if (typeof event.type === 'string' && event.type.startsWith('terminal:')) {
        this.handleTerminalEvent(connectionId, event as unknown as TerminalEvent);
      }
    });

    // Handle client disconnection
    client.on('disconnected', () => {
      console.log(
        `[TerminalWebSocketBridge] Client disconnected: ${connectionId}`,
      );
      this.userConnection = null;
    });

    // Handle errors
    client.on('error', (error) => {
      console.error(
        `[TerminalWebSocketBridge] Client error for ${connectionId}:`,
        error,
      );
    });
  }

  /**
   * Handle terminal events from remote clients
   */
  private async handleTerminalEvent(
    connectionId: string,
    event: TerminalEvent,
  ): Promise<void> {
    console.log(
      `[TerminalWebSocketBridge] Received event ${event.type} for session ${event.metadata?.sessionId}`,
    );

    try {
      switch (event.type) {
        case 'terminal:session_list':
          // Respond to session list request by broadcasting current sessions
          console.log(`[TerminalWebSocketBridge] Handling session list request`);
          await this.broadcastSessionList();
          break;
        case 'terminal:attach':
          await this.handleAttach(connectionId, event);
          break;
        case 'terminal:detach':
          await this.handleDetach(connectionId, event);
          break;
        case 'terminal:claim_ownership':
          await this.handleClaimOwnership(connectionId, event);
          break;
        case 'terminal:release_ownership':
          await this.handleReleaseOwnership(connectionId, event);
          break;
        case 'terminal:write':
          await this.handleWrite(connectionId, event);
          break;
        case 'terminal:resize':
          await this.handleResize(connectionId, event);
          break;
        default:
          console.warn(
            `[TerminalWebSocketBridge] Unhandled event type: ${event.type}`,
          );
      }
    } catch (error) {
      console.error(
        `[TerminalWebSocketBridge] Error handling event ${event.type}:`,
        error,
      );
      await this.sendErrorToClient(
        connectionId,
        event.metadata?.sessionId || '',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  // =============================================================================
  // Terminal Operations
  // =============================================================================

  /**
   * Handle remote client attachment to session
   */
  private async handleAttach(
    connectionId: string,
    event: TerminalEvent,
  ): Promise<void> {
    const payload = event.data as TerminalAttachPayload;
    const { sessionId, asOwner } = payload;

    if (!this.userConnection) {
      console.error(
        `[TerminalWebSocketBridge] No user connection available`,
      );
      return;
    }

    console.log(
      `[TerminalWebSocketBridge] Client ${connectionId} (${this.userConnection.githubHandle}) attaching to session ${sessionId} (asOwner: ${asOwner})`,
    );

    // 1. Check if session exists
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      await this.sendErrorToClient(
        connectionId,
        sessionId,
        'Session not found',
      );
      return;
    }

    // 2. Check authorization (same GitHub user)
    // TODO: Use TerminalAuthorizationService for this check
    // For now, simplified check
    // const authorized = await this.checkAuthorization(connection, session);
    // if (!authorized) {
    //   await this.sendErrorToClient(
    //     connectionId,
    //     sessionId,
    //     'Not authorized to access this session',
    //   );
    //   return;
    // }

    // 3. Add to remote attachments
    const isFirstAttachment = !this.remoteAttachments.has(sessionId);
    let attachments = this.remoteAttachments.get(sessionId);
    if (!attachments) {
      attachments = new Set();
      this.remoteAttachments.set(sessionId, attachments);
    }
    attachments.add(event.userId);

    // If this is the first remote attachment, create monitoring port for data streaming
    if (isFirstAttachment) {
      const monitoringCreated = this.sessionManager.createMonitoringPort(sessionId);
      if (!monitoringCreated) {
        console.warn(
          `[TerminalWebSocketBridge] Failed to create monitoring port for session ${sessionId}`,
        );
      }
    }

    console.log(
      `[TerminalWebSocketBridge] Client ${event.userId} attached to session ${sessionId}`,
    );

    // 4. If asOwner, claim ownership
    if (asOwner) {
      const owner: TerminalOwner = {
        type: 'remote',
        id: event.userId,
        userId: this.userConnection.userId,
        githubHandle: this.userConnection.githubHandle,
        claimedAt: Date.now(),
      };

      // Register remote client if not already registered
      if (!this.ownershipManager.getRemoteClients().has(event.userId)) {
        this.ownershipManager.registerRemoteClient({
          clientId: event.userId,
          connectionId: connectionId,
          githubHandle: this.userConnection.githubHandle,
          userId: this.userConnection.userId,
          attachedAt: Date.now(),
        });
      }

      const result = this.ownershipManager.claimOwnershipGeneric(
        sessionId,
        owner,
        false,
      );

      if (result.success && result.owner) {
        console.log(
          `[TerminalWebSocketBridge] Client ${event.userId} claimed ownership of session ${sessionId}`,
        );

        // Broadcast ownership change
        await this.broadcastOwnershipChange(
          sessionId,
          result.owner,
          result.previousOwner || null,
        );
      } else {
        console.warn(
          `[TerminalWebSocketBridge] Failed to claim ownership: ${result.reason}`,
        );
        await this.sendErrorToClient(
          connectionId,
          sessionId,
          result.reason || 'Failed to claim ownership',
        );
      }
    }

    // 5. Start streaming data to client
    // Data streaming will be handled by RemoteTerminalStreamer
    console.log(
      `[TerminalWebSocketBridge] Attachment complete for session ${sessionId}`,
    );
  }

  /**
   * Handle remote client detachment from session
   */
  private async handleDetach(
    connectionId: string,
    event: TerminalEvent,
  ): Promise<void> {
    const payload = event.data as { sessionId: string };
    const { sessionId } = payload;

    console.log(
      `[TerminalWebSocketBridge] Client ${event.userId} detaching from session ${sessionId}`,
    );

    // Remove from remote attachments
    const attachments = this.remoteAttachments.get(sessionId);
    if (attachments) {
      attachments.delete(event.userId);
      if (attachments.size === 0) {
        this.remoteAttachments.delete(sessionId);
      }
    }

    // Release ownership if this client owns the session
    const owner = this.ownershipManager.getOwner(sessionId);
    if (owner && owner.type === 'remote' && owner.id === event.userId) {
      const result = this.ownershipManager.releaseOwnershipGeneric(
        sessionId,
        event.userId,
        'remote',
      );

      if (result.success) {
        console.log(
          `[TerminalWebSocketBridge] Client ${event.userId} released ownership of session ${sessionId}`,
        );
        await this.broadcastOwnershipChange(sessionId, null, result.previousOwner || null);
      }
    }

    console.log(
      `[TerminalWebSocketBridge] Client ${event.userId} detached from session ${sessionId}`,
    );
  }

  /**
   * Handle ownership claim from remote client
   */
  private async handleClaimOwnership(
    connectionId: string,
    event: TerminalEvent,
  ): Promise<void> {
    const payload = event.data as TerminalClaimOwnershipPayload;
    const { sessionId, force } = payload;

    if (!this.userConnection) {
      return;
    }

    console.log(
      `[TerminalWebSocketBridge] Client ${event.userId} claiming ownership of session ${sessionId} (force: ${force})`,
    );

    const owner: TerminalOwner = {
      type: 'remote',
      id: event.userId,
      userId: this.userConnection.userId,
      githubHandle: this.userConnection.githubHandle,
      claimedAt: Date.now(),
    };

    // Register remote client if not already registered
    if (!this.ownershipManager.getRemoteClients().has(event.userId)) {
      this.ownershipManager.registerRemoteClient({
        clientId: event.userId,
        connectionId: connectionId,
        githubHandle: this.userConnection.githubHandle,
        userId: this.userConnection.userId,
        attachedAt: Date.now(),
      });
    }

    const result = this.ownershipManager.claimOwnershipGeneric(
      sessionId,
      owner,
      force || false,
    );

    if (result.success && result.owner) {
      console.log(
        `[TerminalWebSocketBridge] Client ${event.userId} claimed ownership of session ${sessionId}`,
      );
      await this.broadcastOwnershipChange(
        sessionId,
        result.owner,
        result.previousOwner || null,
      );
    } else {
      console.warn(
        `[TerminalWebSocketBridge] Failed to claim ownership: ${result.reason}`,
      );
      await this.sendErrorToClient(
        connectionId,
        sessionId,
        result.reason || 'Failed to claim ownership',
      );
    }
  }

  /**
   * Handle ownership release from remote client
   */
  private async handleReleaseOwnership(
    connectionId: string,
    event: TerminalEvent,
  ): Promise<void> {
    const payload = event.data as TerminalReleaseOwnershipPayload;
    const { sessionId } = payload;

    console.log(
      `[TerminalWebSocketBridge] Client ${event.userId} releasing ownership of session ${sessionId}`,
    );

    const result = this.ownershipManager.releaseOwnershipGeneric(
      sessionId,
      event.userId,
      'remote',
    );

    if (result.success) {
      console.log(
        `[TerminalWebSocketBridge] Client ${event.userId} released ownership of session ${sessionId}`,
      );
      await this.broadcastOwnershipChange(
        sessionId,
        null,
        result.previousOwner || null,
      );
    } else {
      await this.sendErrorToClient(
        connectionId,
        sessionId,
        result.reason || 'Failed to release ownership',
      );
    }
  }

  /**
   * Handle write operation from remote client
   */
  private async handleWrite(
    connectionId: string,
    event: TerminalEvent,
  ): Promise<void> {
    const payload = event.data as TerminalWritePayload;
    const { sessionId, data } = payload;

    console.log(
      `[TerminalWebSocketBridge] Write to session ${sessionId}: ${data.length} bytes`,
    );

    // Check ownership before writing
    const isOwner = this.ownershipManager.isOwnerGeneric(
      sessionId,
      event.userId,
      'remote',
    );

    if (!isOwner) {
      console.warn(
        `[TerminalWebSocketBridge] Client ${event.userId} attempted to write without ownership`,
      );
      await this.sendErrorToClient(
        connectionId,
        sessionId,
        'Not the owner - cannot write to terminal',
      );
      return;
    }

    // Write to PTY via sessionManager
    try {
      this.sessionManager.writeToSession(sessionId, data);
      console.log(
        `[TerminalWebSocketBridge] Wrote ${data.length} bytes to session ${sessionId}`,
      );
    } catch (error) {
      console.error(
        `[TerminalWebSocketBridge] Error writing to session ${sessionId}:`,
        error,
      );
      await this.sendErrorToClient(
        connectionId,
        sessionId,
        error instanceof Error ? error.message : 'Failed to write to terminal',
      );
    }
  }

  /**
   * Handle resize operation from remote client
   */
  private async handleResize(
    connectionId: string,
    event: TerminalEvent,
  ): Promise<void> {
    const payload = event.data as TerminalResizePayload;
    const { sessionId, cols, rows } = payload;

    console.log(
      `[TerminalWebSocketBridge] Resize session ${sessionId}: ${cols}x${rows}`,
    );

    // Check ownership before resizing
    const isOwner = this.ownershipManager.isOwnerGeneric(
      sessionId,
      event.userId,
      'remote',
    );

    if (!isOwner) {
      console.warn(
        `[TerminalWebSocketBridge] Client ${event.userId} attempted to resize without ownership`,
      );
      await this.sendErrorToClient(
        connectionId,
        sessionId,
        'Not the owner - cannot resize terminal',
      );
      return;
    }

    // Resize PTY via sessionManager
    try {
      this.sessionManager.resizeSession(sessionId, cols, rows, false);
      console.log(
        `[TerminalWebSocketBridge] Resized session ${sessionId} to ${cols}x${rows}`,
      );
    } catch (error) {
      console.error(
        `[TerminalWebSocketBridge] Error resizing session ${sessionId}:`,
        error,
      );
      await this.sendErrorToClient(
        connectionId,
        sessionId,
        error instanceof Error ? error.message : 'Failed to resize terminal',
      );
    }
  }

  // =============================================================================
  // Session Broadcasting
  // =============================================================================

  /**
   * Broadcast session list to user discovery room
   * Includes ALL terminal sessions for this user across all repositories
   */
  async broadcastSessionList(): Promise<void> {
    if (!this.userConnection) {
      return;
    }

    // Get all sessions and convert to wire format
    const sessions = this.sessionManager.getAllSessions();
    const sessionList: TerminalSessionInfo[] = [];

    for (const [sessionId, session] of sessions.entries()) {
      const sessionInfo = this.toSessionInfo(
        session,
        sessionId,
        this.userConnection.userId,
      );
      sessionList.push(sessionInfo);
    }

    const event: TerminalEvent = {
      id: `session-list-${Date.now()}`,
      type: 'terminal:session_list',
      timestamp: Date.now(),
      userId: this.userConnection.userId,
      roomId: this.userConnection.roomId,
      data: { sessions: sessionList },
      metadata: {},
    };

    await this.userConnection.client.broadcast(event as unknown as Event);
    console.log(
      `[TerminalWebSocketBridge] Broadcasted ${sessionList.length} sessions to user discovery room ${this.userConnection.roomId}`,
    );
  }

  /**
   * Convert TerminalSession to wire format
   */
  private toSessionInfo(
    session: TerminalSession,
    sessionId: string,
    requestingUserId: string,
  ): TerminalSessionInfo {
    return {
      sessionId: sessionId,
      repoPath: session.repoPath || session.directory,
      repoId: session.repoId || 'unknown',
      directory: session.directory,
      context: session.context,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      owner: ownerToWireFormat(session.owner),
      attached: false, // TODO: Check if requesting user is attached
      isOwner:
        session.owner !== null &&
        session.owner.userId === requestingUserId,
    };
  }

  /**
   * Broadcast ownership change to all clients in user discovery room
   */
  private async broadcastOwnershipChange(
    sessionId: string,
    newOwner: TerminalOwner | null,
    previousOwner: TerminalOwner | null,
  ): Promise<void> {
    if (!this.userConnection) {
      console.warn(
        `[TerminalWebSocketBridge] Cannot broadcast ownership change - no user connection`,
      );
      return;
    }

    const session = this.sessionManager.getSession(sessionId);
    const repoId = session?.repoId || 'unknown';

    const event: TerminalEvent = {
      id: `ownership-changed-${Date.now()}`,
      type: 'terminal:ownership_changed',
      timestamp: Date.now(),
      userId: this.userConnection.userId,
      roomId: this.userConnection.roomId,
      data: {
        sessionId,
        newOwner: ownerToWireFormat(newOwner),
        previousOwner: ownerToWireFormat(previousOwner),
      },
      metadata: {
        sessionId,
        repoId,
      },
    };

    await this.userConnection.client.broadcast(event as unknown as Event);
    console.log(
      `[TerminalWebSocketBridge] Broadcasted ownership change for session ${sessionId}`,
    );
  }

  /**
   * Send error to remote client
   */
  private async sendErrorToClient(
    connectionId: string,
    sessionId: string,
    error: string,
  ): Promise<void> {
    if (!this.userConnection) {
      return;
    }

    const session = this.sessionManager.getSession(sessionId);
    const repoId = session?.repoId || 'unknown';

    const event: TerminalEvent = {
      id: `error-${Date.now()}`,
      type: 'terminal:error',
      timestamp: Date.now(),
      userId: this.userConnection.userId,
      roomId: this.userConnection.roomId,
      data: {
        sessionId,
        error,
      },
      metadata: {
        sessionId,
        repoId,
      },
    };

    await this.userConnection.client.broadcast(event as unknown as Event);
  }

  // =============================================================================
  // Session Lifecycle Hooks (called by TerminalSessionManager)
  // =============================================================================

  /**
   * Called when a new session is created
   */
  async onSessionCreated(sessionId: string): Promise<void> {
    console.log(
      `[TerminalWebSocketBridge] Session created: ${sessionId}`,
    );

    if (!this.userConnection) {
      return; // No browser clients connected yet
    }

    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      return;
    }

    const sessionInfo = this.toSessionInfo(session, sessionId, this.userConnection.userId);

    const event: TerminalEvent = {
      id: `session-created-${Date.now()}`,
      type: 'terminal:session_created',
      timestamp: Date.now(),
      userId: this.userConnection.userId,
      roomId: this.userConnection.roomId,
      data: {
        session: sessionInfo,
      },
      metadata: {
        sessionId,
        repoId: session.repoId || 'unknown',
      },
    };

    await this.userConnection.client.broadcast(event as unknown as Event);
    console.log(
      `[TerminalWebSocketBridge] Broadcasted session_created for ${sessionId}`,
    );
  }

  /**
   * Called when a session is destroyed
   */
  async onSessionDestroyed(sessionId: string): Promise<void> {
    console.log(
      `[TerminalWebSocketBridge] Session destroyed: ${sessionId}`,
    );

    // Clean up remote attachments
    this.remoteAttachments.delete(sessionId);
    this.dataSequences.delete(sessionId);

    if (!this.userConnection) {
      return; // No browser clients connected
    }

    const event: TerminalEvent = {
      id: `session-destroyed-${Date.now()}`,
      type: 'terminal:session_destroyed',
      timestamp: Date.now(),
      userId: this.userConnection.userId,
      roomId: this.userConnection.roomId,
      data: {
        sessionId,
      },
      metadata: {
        sessionId,
      },
    };

    try {
      await this.userConnection.client.broadcast(event as unknown as Event);
      console.log(
        `[TerminalWebSocketBridge] Broadcasted session_destroyed for ${sessionId}`,
      );
    } catch (error) {
      console.error(
        `[TerminalWebSocketBridge] Error broadcasting session_destroyed:`,
        error,
      );
    }
  }

  /**
   * Stream PTY data to remote clients attached to a session
   */
  async streamDataToRemoteClients(
    sessionId: string,
    data: string,
  ): Promise<void> {
    const attachments = this.remoteAttachments.get(sessionId);
    if (!attachments || attachments.size === 0) {
      return; // No remote clients attached
    }

    if (!this.userConnection) {
      return; // No user connection
    }

    const session = this.sessionManager.getSession(sessionId);

    // Get next sequence number
    const sequence = this.getNextSequence(sessionId);

    // Base64 encode the data for wire safety
    const encodedData = Buffer.from(data).toString('base64');

    // Broadcast data to all clients in the user discovery room
    const event: TerminalEvent = {
      id: `data-${sessionId}-${sequence}`,
      type: 'terminal:data',
      timestamp: Date.now(),
      userId: this.userConnection.userId,
      roomId: this.userConnection.roomId,
      data: {
        sessionId,
        data: encodedData,
        sequence,
      },
      metadata: {
        sessionId,
        repoId: session?.repoId || 'unknown',
      },
    };

    try {
      await this.userConnection.client.broadcast(event as unknown as Event);

      // Log only periodically to avoid spam
      if (sequence % 100 === 0) {
        console.log(
          `[TerminalWebSocketBridge] Streamed ${data.length} bytes (seq ${sequence}) to ${attachments.size} remote clients for session ${sessionId}`,
        );
      }
    } catch (error) {
      console.error(
        `[TerminalWebSocketBridge] Error streaming data for session ${sessionId}:`,
        error,
      );
    }
  }

  // =============================================================================
  // Utilities
  // =============================================================================

  /**
   * Get next sequence number for a session
   */
  private getNextSequence(sessionId: string): number {
    const current = this.dataSequences.get(sessionId) || 0;
    const next = current + 1;
    this.dataSequences.set(sessionId, next);
    return next;
  }

  /**
   * Check if user connection is active
   */
  isConnected(): boolean {
    return this.userConnection !== null;
  }

  /**
   * Get active user connection
   */
  getUserConnection(): TerminalConnection | null {
    return this.userConnection;
  }
}
