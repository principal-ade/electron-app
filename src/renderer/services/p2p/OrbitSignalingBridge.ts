/**
 * OrbitSignalingBridge - WebSocket-based signaling client for WebRTC
 *
 * Replaces SignalingClientHTTP by using OrbitService to communicate with
 * OrbitWebSocketManager in the main process. This eliminates HTTP polling
 * in favor of real-time WebSocket signaling via Control Tower.
 *
 * Implements the same interface as SignalingClientHTTP for easy migration.
 */

import { OrbitService } from '../../main-process-api/OrbitService';
import type { OrbitPeer, OrbitSignal } from '../../../shared/main-process-api-interfaces/OrbitAPI';

export interface SignalingCallbacks {
  onConnected: (peerId: string, githubHandle: string) => void;
  onPeerJoined: (peerId: string, githubHandle: string) => void;
  onPeerLeft: (peerId: string) => void;
  onSignal: (from: string, signal: unknown) => void;
  onError: (error: string) => void;
  onDisconnected: () => void;
}

/**
 * OrbitSignalingBridge - WebSocket-based signaling for WebRTC
 *
 * This class provides the same interface as SignalingClientHTTP but uses
 * WebSocket signaling via the main process instead of HTTP polling.
 */
export class OrbitSignalingBridge {
  private callbacks: SignalingCallbacks | null = null;
  private connectionId: string | null = null;
  private peerId: string | null = null;
  private isConnectedFlag: boolean = false;
  private eventCleanupFns: Array<() => void> = [];

  /**
   * Set callbacks for signaling events
   */
  setCallbacks(callbacks: SignalingCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Connect to signaling server for a repository
   */
  async connect(token: string, repoUrl: string): Promise<void> {
    try {
      // Subscribe to events BEFORE connecting
      this.subscribeToEvents();

      // Connect via OrbitService
      const result = await OrbitService.connect({ repoUrl, token });

      if (!result.success) {
        throw new Error(result.error || 'Failed to connect');
      }

      this.connectionId = result.connectionId || null;
      this.peerId = result.peerId || null;
      this.isConnectedFlag = true;

      // Notify connected
      if (result.peerId && result.githubHandle) {
        this.callbacks?.onConnected(result.peerId, result.githubHandle);
      }

      // Notify of existing peers
      if (result.peers) {
        for (const peer of result.peers) {
          this.callbacks?.onPeerJoined(peer.peerId, peer.githubHandle);
        }
      }
    } catch (error) {
      console.error('[OrbitSignalingBridge] Connection error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      this.callbacks?.onError(errorMessage);
      this.callbacks?.onDisconnected();
      this.cleanup();
    }
  }

  /**
   * Subscribe to events from OrbitService
   */
  private subscribeToEvents(): void {
    // Clean up any existing subscriptions
    this.unsubscribeFromEvents();

    // Signal received
    const unsubSignal = OrbitService.onSignalReceived((signal: OrbitSignal) => {
      this.callbacks?.onSignal(signal.from, signal.data);
    });
    this.eventCleanupFns.push(unsubSignal);

    // Peer joined
    const unsubPeerJoined = OrbitService.onPeerJoined((peer: OrbitPeer) => {
      this.callbacks?.onPeerJoined(peer.peerId, peer.githubHandle);
    });
    this.eventCleanupFns.push(unsubPeerJoined);

    // Peer left
    const unsubPeerLeft = OrbitService.onPeerLeft((data: { peerId: string }) => {
      this.callbacks?.onPeerLeft(data.peerId);
    });
    this.eventCleanupFns.push(unsubPeerLeft);

    // Disconnected
    const unsubDisconnected = OrbitService.onDisconnected(() => {
      this.isConnectedFlag = false;
      this.callbacks?.onDisconnected();
    });
    this.eventCleanupFns.push(unsubDisconnected);

    // Error
    const unsubError = OrbitService.onError((data: { error: string }) => {
      this.callbacks?.onError(data.error);
    });
    this.eventCleanupFns.push(unsubError);
  }

  /**
   * Unsubscribe from all events
   */
  private unsubscribeFromEvents(): void {
    for (const cleanup of this.eventCleanupFns) {
      cleanup();
    }
    this.eventCleanupFns = [];
  }

  /**
   * Send a WebRTC signal to another peer
   */
  async sendSignal(to: string, signal: unknown): Promise<void> {
    if (!this.isConnectedFlag || !this.connectionId) {
      console.warn('[OrbitSignalingBridge] Cannot send signal: not connected');
      return;
    }

    // Determine signal type from the signal object
    const signalObj = signal as { type?: string; candidate?: unknown };
    let signalType = 'signal';

    if (signalObj.type === 'offer') {
      signalType = 'offer';
    } else if (signalObj.type === 'answer') {
      signalType = 'answer';
    } else if (signalObj.candidate !== undefined) {
      signalType = 'ice_candidate';
    }

    const result = await OrbitService.sendSignal({
      connectionId: this.connectionId,
      targetPeerId: to,
      signalType,
      signalData: signal,
    });

    if (!result.success) {
      console.error('[OrbitSignalingBridge] Send signal failed:', result.error);
    }
  }

  /**
   * Disconnect from signaling server
   */
  async disconnect(): Promise<void> {
    this.isConnectedFlag = false;

    // Unsubscribe from events
    this.unsubscribeFromEvents();

    // Disconnect via OrbitService
    if (this.connectionId) {
      await OrbitService.disconnect(this.connectionId);
    }

    this.cleanup();
    this.callbacks?.onDisconnected();
  }

  /**
   * Clean up internal state
   */
  private cleanup(): void {
    this.connectionId = null;
    this.peerId = null;
    this.isConnectedFlag = false;
  }

  /**
   * Check if currently connected
   */
  isActive(): boolean {
    return this.isConnectedFlag;
  }

  /**
   * Get current peer ID
   */
  getPeerId(): string | null {
    return this.peerId;
  }

  /**
   * Get current connection ID
   */
  getConnectionId(): string | null {
    return this.connectionId;
  }

  /**
   * Get list of current peers
   */
  async getPeers(): Promise<OrbitPeer[]> {
    if (!this.connectionId) {
      return [];
    }
    return OrbitService.getPeers(this.connectionId);
  }
}

// Export a factory function for creating instances
export function createSignalingBridge(): OrbitSignalingBridge {
  return new OrbitSignalingBridge();
}

// Also export as SignalingClient for drop-in replacement
export { OrbitSignalingBridge as SignalingClient };
