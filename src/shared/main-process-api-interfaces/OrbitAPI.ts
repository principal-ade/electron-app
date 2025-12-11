/**
 * Orbit P2P Collaboration API
 * Handles authentication and user management for P2P collaboration
 * Note: Uses WorkOS authentication with GitHub as the identity provider
 */

export interface OrbitUser {
  githubHandle: string;
  email?: string;
  status: 'waitlisted' | 'approved' | 'denied';
  metadata?: {
    avatarUrl?: string;
    name?: string;
    company?: string;
    location?: string;
  };
}

export interface OrbitAuthResponse {
  success: boolean;
  user?: OrbitUser;
  token?: string;
  error?: string;
}

export interface OrbitStatusResponse {
  status: string;
  githubHandle?: string;
  email?: string;
  metadata?: Record<string, unknown>;
}

export interface OrbitPeer {
  peerId: string;
  githubHandle: string;
}

export interface OrbitSignal {
  from: string;
  to?: string;
  type: string;
  data: unknown; // Signal data can be any WebRTC signal type
}

/**
 * WebSocket-based connection config
 */
export interface OrbitConnectConfig {
  repoUrl: string;
  token: string;
}

/**
 * WebSocket-based connection result
 */
export interface OrbitConnectResult {
  success: boolean;
  connectionId?: string;
  peerId?: string;
  githubHandle?: string;
  peers?: OrbitPeer[];
  error?: string;
}

/**
 * Send signal request
 */
export interface OrbitSendSignalRequest {
  connectionId: string;
  targetPeerId: string;
  signalType: string;
  signalData: unknown;
}

export interface OrbitAPI {
  /**
   * Open authentication page (WorkOS with GitHub provider)
   */
  openAuth(): Promise<{ success: boolean; error?: string }>;

  /**
   * Exchange OAuth code for access token
   */
  authenticate(code: string): Promise<OrbitAuthResponse>;

  /**
   * Check user status with token
   */
  checkStatus(token: string): Promise<OrbitStatusResponse>;

  /**
   * Connect to signaling server for a repository (WebSocket-based)
   */
  connect(config: OrbitConnectConfig): Promise<OrbitConnectResult>;

  /**
   * Disconnect from signaling server
   */
  disconnect(connectionId: string): Promise<{ success: boolean; error?: string }>;

  /**
   * Send a WebRTC signal to a peer
   */
  sendSignal(request: OrbitSendSignalRequest): Promise<{ success: boolean; error?: string }>;

  /**
   * Get current peers in the room
   */
  getPeers(connectionId: string): Promise<OrbitPeer[]>;

  /**
   * Subscribe to signal received events
   */
  onSignalReceived(
    callback: (signal: OrbitSignal) => void,
  ): () => void;

  /**
   * Subscribe to peer joined events
   */
  onPeerJoined(
    callback: (peer: OrbitPeer) => void,
  ): () => void;

  /**
   * Subscribe to peer left events
   */
  onPeerLeft(
    callback: (data: { peerId: string }) => void,
  ): () => void;

  /**
   * Subscribe to connected events
   */
  onConnected(
    callback: (data: { connectionId: string; peerId: string; githubHandle: string }) => void,
  ): () => void;

  /**
   * Subscribe to disconnected events
   */
  onDisconnected(
    callback: (data: { connectionId: string }) => void,
  ): () => void;

  /**
   * Subscribe to error events
   */
  onError(
    callback: (data: { connectionId: string; error: string }) => void,
  ): () => void;
}
