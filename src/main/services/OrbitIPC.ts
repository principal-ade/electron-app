/**
 * OrbitIPC - IPC handlers for Orbit P2P collaboration signaling
 *
 * Provides IPC endpoints for WebRTC signaling operations that renderers can call.
 * Uses OrbitWebSocketManager for WebSocket-based signaling via Control Tower.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { orbitWebSocketManager, OrbitEvent } from './OrbitWebSocketManager';
import type {
  OrbitPeer,
  OrbitConnectResult,
} from '../../shared/main-process-api-interfaces/OrbitAPI';

/**
 * Connect request from renderer
 */
interface OrbitConnectRequest {
  repoUrl: string;
  token: string;
}

/**
 * Send signal request from renderer
 */
interface OrbitSendSignalRequest {
  connectionId: string;
  targetPeerId: string;
  signalType: string; // 'offer' | 'answer' | 'ice_candidate'
  signalData: unknown;
}

class OrbitIPC {
  constructor() {
    this.setupHandlers();
    console.log('[OrbitIPC] Initialized');
  }

  private setupHandlers() {
    // Handler for orbit:connect
    ipcMain.handle(
      OrbitEvent.CONNECT,
      async (
        event,
        config: OrbitConnectRequest,
      ): Promise<OrbitConnectResult> => {
        console.log('[OrbitIPC] Connect requested for repo:', config.repoUrl);

        const window = BrowserWindow.fromWebContents(event.sender);
        const windowId = window?.id ?? -1;

        const result = await orbitWebSocketManager.connect(config, windowId);

        return {
          success: result.success,
          connectionId: result.connectionId,
          peerId: result.peerId,
          githubHandle: result.githubHandle,
          peers: result.peers,
          error: result.error,
        };
      },
    );

    // Handler for orbit:disconnect
    ipcMain.handle(
      OrbitEvent.DISCONNECT,
      async (
        event,
        connectionId: string,
      ): Promise<{ success: boolean; error?: string }> => {
        console.log('[OrbitIPC] Disconnect requested for:', connectionId);

        const result = await orbitWebSocketManager.disconnect(connectionId);
        return {
          success: result.success,
          error: result.message,
        };
      },
    );

    // Handler for orbit:sendSignal
    ipcMain.handle(
      OrbitEvent.SEND_SIGNAL,
      async (
        event,
        request: OrbitSendSignalRequest,
      ): Promise<{ success: boolean; error?: string }> => {
        console.log(
          '[OrbitIPC] Send signal:',
          request.signalType,
          '→',
          request.targetPeerId,
        );

        return await orbitWebSocketManager.sendSignal(
          request.connectionId,
          request.targetPeerId,
          request.signalType,
          request.signalData,
        );
      },
    );

    // Handler for orbit:getPeers
    ipcMain.handle(
      OrbitEvent.GET_PEERS,
      async (event, connectionId: string): Promise<OrbitPeer[]> => {
        console.log('[OrbitIPC] Get peers for:', connectionId);

        return orbitWebSocketManager.getPeers(connectionId);
      },
    );

    // Handler for getting all connections (for debugging/status)
    ipcMain.handle('orbit:getAllConnections', async () => {
      return orbitWebSocketManager.getAllConnections();
    });
  }
}

// Create and export singleton instance
export const orbitIPC = new OrbitIPC();
