/**
 * Observability API implementation for the preload script
 */

import { ipcRenderer } from 'electron';

export interface ObservabilityConfig {
  tursoUrl?: string;
  tursoAuthToken?: string;
  environment?: 'development' | 'staging' | 'production';
  enabled?: boolean;
}

export interface ObservabilityStatus {
  isInitialized: boolean;
  eventCount: number;
  errorCount: number;
  errorRate: number;
  enabled: boolean;
  hasConfig: boolean;
}

export interface ConnectionTestResult {
  success: boolean;
  error?: string;
}

export const observabilityAPI = {
  /**
   * Get current observability configuration
   */
  getConfig: async (): Promise<{ success: boolean; config?: ObservabilityConfig; error?: string }> => {
    return ipcRenderer.invoke('observability:getConfig');
  },

  /**
   * Save observability configuration
   */
  saveConfig: async (config: ObservabilityConfig): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('observability:saveConfig', config);
  },

  /**
   * Test connection with provided configuration
   */
  testConnection: async (config: ObservabilityConfig): Promise<ConnectionTestResult> => {
    return ipcRenderer.invoke('observability:testConnection', config);
  },

  /**
   * Get observability status and statistics
   */
  getStatus: async (): Promise<{ success: boolean; status?: ObservabilityStatus; error?: string }> => {
    return ipcRenderer.invoke('observability:getStatus');
  },
};