/**
 * Observability API implementation for the preload script
 */

import { ipcRenderer } from 'electron';
import { ObservabilityEvent } from '../../shared/ipc-events/ObservabilityEvents';

export interface ObservabilityConfig {
  tursoUrl?: string;
  tursoAuthToken?: string;
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
  getConfig: async (): Promise<{
    success: boolean;
    config?: ObservabilityConfig;
    error?: string;
  }> => {
    return ipcRenderer.invoke(ObservabilityEvent.GET_CONFIG);
  },

  /**
   * Save observability configuration
   */
  saveConfig: async (
    config: ObservabilityConfig,
  ): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke(ObservabilityEvent.SAVE_CONFIG, config);
  },

  /**
   * Test connection with provided configuration
   */
  testConnection: async (
    config: ObservabilityConfig,
  ): Promise<ConnectionTestResult> => {
    return ipcRenderer.invoke(ObservabilityEvent.TEST_CONNECTION, config);
  },

  /**
   * Get observability status and statistics
   */
  getStatus: async (): Promise<{
    success: boolean;
    status?: ObservabilityStatus;
    error?: string;
  }> => {
    return ipcRenderer.invoke(ObservabilityEvent.GET_STATUS);
  },

  /**
   * Resolve a database path to its absolute path
   */
  resolvePath: async (
    dbPath: string,
  ): Promise<{ success: boolean; resolvedPath?: string; error?: string }> => {
    return ipcRenderer.invoke(ObservabilityEvent.RESOLVE_PATH, dbPath);
  },

  /**
   * Get the current database file path
   */
  getDbPath: async (): Promise<{ success: boolean; dbPath?: string; error?: string }> => {
    return ipcRenderer.invoke(ObservabilityEvent.GET_DB_PATH);
  },

  /**
   * Open the database file location in Finder/Explorer
   */
  openDbInFinder: async (): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke(ObservabilityEvent.OPEN_DB_IN_FINDER);
  },
};
