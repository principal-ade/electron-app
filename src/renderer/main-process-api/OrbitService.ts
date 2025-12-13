/**
 * Service layer for Orbit P2P Collaboration functionality
 * ALL window.mainProcess.orbit calls MUST be encapsulated here
 *
 * This service handles authentication and WebSocket-based signaling
 * for P2P collaboration via Control Tower.
 */

import type {
  OrbitAuthResponse,
  OrbitStatusResponse,
  OrbitConnectConfig,
  OrbitConnectResult,
  OrbitSendSignalRequest,
  OrbitPeer,
  OrbitSignal,
} from '../../shared/main-process-api-interfaces/OrbitAPI';

export class OrbitService {
  /**
   * Open authentication page (WorkOS with GitHub provider)
   */
  static async openAuth(): Promise<{ success: boolean; error?: string }> {
    try {
      return await window.mainProcess.orbit.openAuth();
    } catch (error) {
      console.error('[OrbitService] Failed to open auth:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to open authentication',
      };
    }
  }

  /**
   * Exchange OAuth code for access token
   */
  static async authenticate(code: string): Promise<OrbitAuthResponse> {
    try {
      return await window.mainProcess.orbit.authenticate(code);
    } catch (error) {
      console.error('[OrbitService] Failed to authenticate:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  /**
   * Check user status with token
   */
  static async checkStatus(token: string): Promise<OrbitStatusResponse> {
    try {
      return await window.mainProcess.orbit.checkStatus(token);
    } catch (error) {
      console.error('[OrbitService] Failed to check status:', error);
      return {
        status: 'error',
        metadata: {
          error:
            error instanceof Error ? error.message : 'Failed to check status',
        },
      };
    }
  }

  /**
   * Connect to signaling server for a repository (WebSocket-based)
   */
  static async connect(
    config: OrbitConnectConfig,
  ): Promise<OrbitConnectResult> {
    try {
      return await window.mainProcess.orbit.connect(config);
    } catch (error) {
      console.error('[OrbitService] Failed to connect:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect',
      };
    }
  }

  /**
   * Disconnect from signaling server
   */
  static async disconnect(
    connectionId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      return await window.mainProcess.orbit.disconnect(connectionId);
    } catch (error) {
      console.error('[OrbitService] Failed to disconnect:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disconnect',
      };
    }
  }

  /**
   * Send a WebRTC signal to a peer
   */
  static async sendSignal(
    request: OrbitSendSignalRequest,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      return await window.mainProcess.orbit.sendSignal(request);
    } catch (error) {
      console.error('[OrbitService] Failed to send signal:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send signal',
      };
    }
  }

  /**
   * Get current peers in the room
   */
  static async getPeers(connectionId: string): Promise<OrbitPeer[]> {
    try {
      return await window.mainProcess.orbit.getPeers(connectionId);
    } catch (error) {
      console.error('[OrbitService] Failed to get peers:', error);
      return [];
    }
  }

  /**
   * Subscribe to signal received events
   */
  static onSignalReceived(callback: (signal: OrbitSignal) => void): () => void {
    return window.mainProcess.orbit.onSignalReceived(callback);
  }

  /**
   * Subscribe to peer joined events
   */
  static onPeerJoined(callback: (peer: OrbitPeer) => void): () => void {
    return window.mainProcess.orbit.onPeerJoined(callback);
  }

  /**
   * Subscribe to peer left events
   */
  static onPeerLeft(callback: (data: { peerId: string }) => void): () => void {
    return window.mainProcess.orbit.onPeerLeft(callback);
  }

  /**
   * Subscribe to connected events
   */
  static onConnected(
    callback: (data: {
      connectionId: string;
      peerId: string;
      githubHandle: string;
    }) => void,
  ): () => void {
    return window.mainProcess.orbit.onConnected(callback);
  }

  /**
   * Subscribe to disconnected events
   */
  static onDisconnected(
    callback: (data: { connectionId: string }) => void,
  ): () => void {
    return window.mainProcess.orbit.onDisconnected(callback);
  }

  /**
   * Subscribe to error events
   */
  static onError(
    callback: (data: { connectionId: string; error: string }) => void,
  ): () => void {
    return window.mainProcess.orbit.onError(callback);
  }
}
