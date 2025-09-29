import { ipcRenderer } from 'electron';

import type {
  OrbitAPI,
  OrbitAuthResponse,
  OrbitStatusResponse,
  OrbitJoinResponse,
  OrbitPollResponse,
  OrbitSignal,
} from '../../shared/main-process-api-interfaces/OrbitAPI';

export const orbitAPI: OrbitAPI = {
  /**
   * Open GitHub OAuth authentication page
   */
  openAuth: async (): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('orbit:openAuth');
  },

  /**
   * Exchange OAuth code for access token
   */
  authenticate: async (code: string): Promise<OrbitAuthResponse> => {
    return ipcRenderer.invoke('orbit:authenticate', code);
  },

  /**
   * Check user status with token
   */
  checkStatus: async (token: string): Promise<OrbitStatusResponse> => {
    return ipcRenderer.invoke('orbit:checkStatus', token);
  },

  /**
   * Join a signaling room for collaboration
   */
  joinRoom: async (token: string, repoUrl: string): Promise<OrbitJoinResponse> => {
    return ipcRenderer.invoke('orbit:joinRoom', token, repoUrl);
  },

  /**
   * Poll for new signals and peer updates
   */
  pollSignals: async (
    peerId: string,
    repoUrl: string,
  ): Promise<OrbitPollResponse> => {
    return ipcRenderer.invoke('orbit:pollSignals', peerId, repoUrl);
  },

  /**
   * Send a signal to another peer
   */
  sendSignal: async (
    from: string,
    to: string,
    type: string,
    data: OrbitSignal['data'],
  ): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('orbit:sendSignal', from, to, type, data);
  },

  /**
   * Leave a signaling room
   */
  leaveRoom: async (
    peerId: string,
    repoUrl: string,
  ): Promise<{
    success: boolean;
    error?: string;
  }> => {
    return ipcRenderer.invoke('orbit:leaveRoom', peerId, repoUrl);
  },
};
