import { ipcRenderer } from 'electron';

export const orbitAPI = {
  /**
   * Open GitHub OAuth authentication page
   */
  openAuth: async (): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('orbit:openAuth');
  },

  /**
   * Exchange OAuth code for access token
   */
  authenticate: async (code: string): Promise<{
    success: boolean;
    user?: {
      githubHandle: string;
      email?: string;
      status: 'waitlisted' | 'approved' | 'denied';
      metadata?: any;
    };
    token?: string;
    error?: string;
  }> => {
    return ipcRenderer.invoke('orbit:authenticate', code);
  },

  /**
   * Check user status with token
   */
  checkStatus: async (token: string): Promise<{
    status: string;
    githubHandle?: string;
    email?: string;
    metadata?: any;
  }> => {
    return ipcRenderer.invoke('orbit:checkStatus', token);
  },

  /**
   * Join a signaling room for collaboration
   */
  joinRoom: async (token: string, repoUrl: string): Promise<{
    success: boolean;
    peerId?: string;
    githubHandle?: string;
    peers?: Array<{ peerId: string; githubHandle: string }>;
    error?: string;
  }> => {
    return ipcRenderer.invoke('orbit:joinRoom', token, repoUrl);
  },

  /**
   * Poll for new signals and peer updates
   */
  pollSignals: async (peerId: string, repoUrl: string): Promise<{
    success: boolean;
    signals?: Array<{ from: string; to?: string; type: string; data: any }>;
    peers?: Array<{ peerId: string; githubHandle: string }>;
    error?: string;
  }> => {
    return ipcRenderer.invoke('orbit:pollSignals', peerId, repoUrl);
  },

  /**
   * Send a signal to another peer
   */
  sendSignal: async (from: string, to: string, type: string, data: any): Promise<{
    success: boolean;
    error?: string;
  }> => {
    return ipcRenderer.invoke('orbit:sendSignal', from, to, type, data);
  },

  /**
   * Leave a signaling room
   */
  leaveRoom: async (peerId: string, repoUrl: string): Promise<{
    success: boolean;
    error?: string;
  }> => {
    return ipcRenderer.invoke('orbit:leaveRoom', peerId, repoUrl);
  },
};