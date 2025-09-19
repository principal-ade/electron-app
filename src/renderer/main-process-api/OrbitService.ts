/**
 * Service layer for Orbit P2P Collaboration functionality
 * ALL window.mainProcess.orbit calls MUST be encapsulated here
 *
 * This service handles GitHub OAuth and user management for P2P collaboration,
 * including WebRTC signaling for real-time collaboration features.
 */

import type {
  OrbitUser,
  OrbitAuthResponse,
  OrbitStatusResponse,
  OrbitPeer,
  OrbitJoinResponse,
  OrbitSignal,
  OrbitPollResponse,
} from '../../shared/main-process-api-interfaces/OrbitAPI';

export class OrbitService {
  /**
   * Open GitHub OAuth authentication page
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
   * Join a signaling room for collaboration
   */
  static async joinRoom(
    token: string,
    repoUrl: string,
  ): Promise<OrbitJoinResponse> {
    try {
      return await window.mainProcess.orbit.joinRoom(token, repoUrl);
    } catch (error) {
      console.error('[OrbitService] Failed to join room:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to join room',
      };
    }
  }

  /**
   * Poll for new signals and peer updates
   */
  static async pollSignals(
    peerId: string,
    repoUrl: string,
  ): Promise<OrbitPollResponse> {
    try {
      return await window.mainProcess.orbit.pollSignals(peerId, repoUrl);
    } catch (error) {
      console.error('[OrbitService] Failed to poll signals:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to poll signals',
      };
    }
  }

  /**
   * Send a signal to another peer
   */
  static async sendSignal(
    from: string,
    to: string,
    type: string,
    data: unknown,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      return await window.mainProcess.orbit.sendSignal(from, to, type, data);
    } catch (error) {
      console.error('[OrbitService] Failed to send signal:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send signal',
      };
    }
  }

  /**
   * Leave a signaling room
   */
  static async leaveRoom(
    peerId: string,
    repoUrl: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      return await window.mainProcess.orbit.leaveRoom(peerId, repoUrl);
    } catch (error) {
      console.error('[OrbitService] Failed to leave room:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to leave room',
      };
    }
  }
}
