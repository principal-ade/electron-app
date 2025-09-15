import { ipcRenderer } from 'electron';
export const orbitAPI = {
    /**
     * Open GitHub OAuth authentication page
     */
    openAuth: async () => {
        return ipcRenderer.invoke('orbit:openAuth');
    },
    /**
     * Exchange OAuth code for access token
     */
    authenticate: async (code) => {
        return ipcRenderer.invoke('orbit:authenticate', code);
    },
    /**
     * Check user status with token
     */
    checkStatus: async (token) => {
        return ipcRenderer.invoke('orbit:checkStatus', token);
    },
    /**
     * Join a signaling room for collaboration
     */
    joinRoom: async (token, repoUrl) => {
        return ipcRenderer.invoke('orbit:joinRoom', token, repoUrl);
    },
    /**
     * Poll for new signals and peer updates
     */
    pollSignals: async (peerId, repoUrl) => {
        return ipcRenderer.invoke('orbit:pollSignals', peerId, repoUrl);
    },
    /**
     * Send a signal to another peer
     */
    sendSignal: async (from, to, type, data) => {
        return ipcRenderer.invoke('orbit:sendSignal', from, to, type, data);
    },
    /**
     * Leave a signaling room
     */
    leaveRoom: async (peerId, repoUrl) => {
        return ipcRenderer.invoke('orbit:leaveRoom', peerId, repoUrl);
    },
};
