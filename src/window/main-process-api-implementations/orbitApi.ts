import { ipcRenderer } from 'electron';

import type {
  OrbitAPI,
  OrbitAuthResponse,
  OrbitStatusResponse,
  OrbitConnectConfig,
  OrbitConnectResult,
  OrbitSendSignalRequest,
  OrbitPeer,
  OrbitSignal,
} from '../../shared/main-process-api-interfaces/OrbitAPI';

/**
 * IPC Event names for Orbit signaling
 */
export const OrbitEvent = {
  // Renderer → Main (invoke)
  OPEN_AUTH: 'orbit:openAuth',
  AUTHENTICATE: 'orbit:authenticate',
  CHECK_STATUS: 'orbit:checkStatus',
  CONNECT: 'orbit:connect',
  DISCONNECT: 'orbit:disconnect',
  SEND_SIGNAL: 'orbit:sendSignal',
  GET_PEERS: 'orbit:getPeers',
  // Main → Renderer (on)
  SIGNAL_RECEIVED: 'orbit:signal-received',
  PEER_JOINED: 'orbit:peer-joined',
  PEER_LEFT: 'orbit:peer-left',
  CONNECTED: 'orbit:connected',
  DISCONNECTED: 'orbit:disconnected',
  ERROR: 'orbit:error',
} as const;

export const orbitAPI: OrbitAPI = {
  /**
   * Open authentication page (WorkOS with GitHub provider)
   */
  openAuth: async (): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke(OrbitEvent.OPEN_AUTH);
  },

  /**
   * Exchange OAuth code for access token
   */
  authenticate: async (code: string): Promise<OrbitAuthResponse> => {
    return ipcRenderer.invoke(OrbitEvent.AUTHENTICATE, code);
  },

  /**
   * Check user status with token
   */
  checkStatus: async (token: string): Promise<OrbitStatusResponse> => {
    return ipcRenderer.invoke(OrbitEvent.CHECK_STATUS, token);
  },

  /**
   * Connect to signaling server for a repository (WebSocket-based)
   */
  connect: async (config: OrbitConnectConfig): Promise<OrbitConnectResult> => {
    return ipcRenderer.invoke(OrbitEvent.CONNECT, config);
  },

  /**
   * Disconnect from signaling server
   */
  disconnect: async (
    connectionId: string,
  ): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke(OrbitEvent.DISCONNECT, connectionId);
  },

  /**
   * Send a WebRTC signal to a peer
   */
  sendSignal: async (
    request: OrbitSendSignalRequest,
  ): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke(OrbitEvent.SEND_SIGNAL, request);
  },

  /**
   * Get current peers in the room
   */
  getPeers: async (connectionId: string): Promise<OrbitPeer[]> => {
    return ipcRenderer.invoke(OrbitEvent.GET_PEERS, connectionId);
  },

  /**
   * Subscribe to signal received events
   */
  onSignalReceived: (callback: (signal: OrbitSignal) => void): (() => void) => {
    const handler = (_event: unknown, signal: OrbitSignal) => callback(signal);
    ipcRenderer.on(OrbitEvent.SIGNAL_RECEIVED, handler);
    return () => ipcRenderer.removeListener(OrbitEvent.SIGNAL_RECEIVED, handler);
  },

  /**
   * Subscribe to peer joined events
   */
  onPeerJoined: (callback: (peer: OrbitPeer) => void): (() => void) => {
    const handler = (_event: unknown, peer: OrbitPeer) => callback(peer);
    ipcRenderer.on(OrbitEvent.PEER_JOINED, handler);
    return () => ipcRenderer.removeListener(OrbitEvent.PEER_JOINED, handler);
  },

  /**
   * Subscribe to peer left events
   */
  onPeerLeft: (callback: (data: { peerId: string }) => void): (() => void) => {
    const handler = (_event: unknown, data: { peerId: string }) => callback(data);
    ipcRenderer.on(OrbitEvent.PEER_LEFT, handler);
    return () => ipcRenderer.removeListener(OrbitEvent.PEER_LEFT, handler);
  },

  /**
   * Subscribe to connected events
   */
  onConnected: (
    callback: (data: { connectionId: string; peerId: string; githubHandle: string }) => void,
  ): (() => void) => {
    const handler = (
      _event: unknown,
      data: { connectionId: string; peerId: string; githubHandle: string },
    ) => callback(data);
    ipcRenderer.on(OrbitEvent.CONNECTED, handler);
    return () => ipcRenderer.removeListener(OrbitEvent.CONNECTED, handler);
  },

  /**
   * Subscribe to disconnected events
   */
  onDisconnected: (
    callback: (data: { connectionId: string }) => void,
  ): (() => void) => {
    const handler = (_event: unknown, data: { connectionId: string }) => callback(data);
    ipcRenderer.on(OrbitEvent.DISCONNECTED, handler);
    return () => ipcRenderer.removeListener(OrbitEvent.DISCONNECTED, handler);
  },

  /**
   * Subscribe to error events
   */
  onError: (
    callback: (data: { connectionId: string; error: string }) => void,
  ): (() => void) => {
    const handler = (
      _event: unknown,
      data: { connectionId: string; error: string },
    ) => callback(data);
    ipcRenderer.on(OrbitEvent.ERROR, handler);
    return () => ipcRenderer.removeListener(OrbitEvent.ERROR, handler);
  },
};
