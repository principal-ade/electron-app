/**
 * Preload API implementation for CLI Bridge Diagnostics
 */

import { ipcRenderer } from 'electron';
import type {
  CLIBridgeAPI,
  CLIBridgeStatus,
  CLIBridgeTestResult,
  CLIBridgeResponse,
} from '../../shared/main-process-api-interfaces/CLIBridgeAPI';
import { CLIBridgeEvents } from '../../shared/main-process-api-interfaces/CLIBridgeAPI';

export const cliBridgeApi: CLIBridgeAPI = {
  /**
   * Get CLI Bridge status
   */
  async getStatus(): Promise<CLIBridgeStatus> {
    return await ipcRenderer.invoke(CLIBridgeEvents.GET_STATUS);
  },

  /**
   * Test the worker
   */
  async testWorker(): Promise<CLIBridgeTestResult> {
    return await ipcRenderer.invoke(CLIBridgeEvents.TEST_WORKER);
  },

  /**
   * Restart the worker
   */
  async restartWorker(): Promise<CLIBridgeResponse> {
    return await ipcRenderer.invoke(CLIBridgeEvents.RESTART_WORKER);
  },

  /**
   * Initialize CLI Bridge
   */
  async initialize(): Promise<CLIBridgeResponse> {
    return await ipcRenderer.invoke(CLIBridgeEvents.INITIALIZE);
  },
};
