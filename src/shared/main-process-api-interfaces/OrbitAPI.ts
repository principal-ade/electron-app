/**
 * Orbit P2P Collaboration API
 * Handles GitHub OAuth and user management for P2P collaboration
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

export interface OrbitJoinResponse {
  success: boolean;
  peerId?: string;
  githubHandle?: string;
  peers?: OrbitPeer[];
  error?: string;
}

export interface OrbitSignal {
  from: string;
  to?: string;
  type: string;
  data: unknown; // Signal data can be any WebRTC signal type
}

export interface OrbitPollResponse {
  success: boolean;
  signals?: OrbitSignal[];
  peers?: OrbitPeer[];
  error?: string;
}

export interface OrbitAPI {
  /**
   * Open GitHub OAuth authentication page
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
   * Join a signaling room for collaboration
   */
  joinRoom(token: string, repoUrl: string): Promise<OrbitJoinResponse>;

  /**
   * Poll for new signals and peer updates
   */
  pollSignals(peerId: string, repoUrl: string): Promise<OrbitPollResponse>;

  /**
   * Send a signal to another peer
   */
  sendSignal(from: string, to: string, type: string, data: unknown): Promise<{ success: boolean; error?: string }>;

  /**
   * Leave a signaling room
   */
  leaveRoom(peerId: string, repoUrl: string): Promise<{ success: boolean; error?: string }>;
}