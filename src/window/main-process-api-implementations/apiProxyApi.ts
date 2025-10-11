/**
 * API Proxy - Renderer side implementation
 * Provides methods to call backend APIs through main process to avoid CORS
 */

import { ipcRenderer } from 'electron';

import type {
  ApiProxyAPI,
  JSONValue,
} from '../../shared/main-process-api-interfaces/ApiProxyAPI';

export const apiProxyApi: ApiProxyAPI = {
  /**
   * Check authentication status with token
   */
  checkStatus: async (token) => {
    return ipcRenderer.invoke('api:checkStatus', token);
  },

  /**
   * Generic API call proxy
   */
  call: async <T = unknown>(options: {
    endpoint: string;
    method?: string;
    headers?: Record<string, string>;
    body?: JSONValue;
  }) => {
    return ipcRenderer.invoke('api:call', options) as Promise<{
      success: boolean;
      status?: number;
      data?: T;
      error?: string;
    }>;
  },
};
