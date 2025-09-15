/**
 * API Proxy - Renderer side implementation
 * Provides methods to call backend APIs through main process to avoid CORS
 */
import { ipcRenderer } from 'electron';
export const apiProxyApi = {
    /**
     * Check authentication status with token
     */
    checkStatus: async (token) => {
        return ipcRenderer.invoke('api:checkStatus', token);
    },
    /**
     * Generic API call proxy
     */
    call: async (options) => {
        return ipcRenderer.invoke('api:call', options);
    }
};
