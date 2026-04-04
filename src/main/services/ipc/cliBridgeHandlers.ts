/**
 * IPC Handlers for CLI Bridge Diagnostics
 */

import { ipcMain } from 'electron';
import { electronCLI } from '../../electron-cli-bridge';
import { CLIBridgeEvents } from '../../../shared/main-process-api-interfaces/CLIBridgeAPI';

export function registerCLIBridgeHandlers(): void {
  // Get status
  ipcMain.handle(CLIBridgeEvents.GET_STATUS, () => {
    try {
      return electronCLI.getStatus();
    } catch (err) {
      console.error('[IPC] Failed to get CLI Bridge status:', err);
      return {
        initialized: false,
        workers: [],
        pendingCalls: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  // Initialize CLIBridge
  ipcMain.handle(CLIBridgeEvents.INITIALIZE, async () => {
    try {
      await electronCLI.initialize();
      return { success: true };
    } catch (err) {
      console.error('[IPC] Failed to initialize CLI Bridge:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  // Test worker - works even if init timed out
  ipcMain.handle(CLIBridgeEvents.TEST_WORKER, async () => {
    try {
      return await electronCLI.testWorker();
    } catch (err) {
      console.error('[IPC] Failed to test worker:', err);
      return {
        success: false,
        duration: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  // Restart worker
  ipcMain.handle(CLIBridgeEvents.RESTART_WORKER, async () => {
    try {
      return await electronCLI.restartWorker('universal');
    } catch (err) {
      console.error('[IPC] Failed to restart worker:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  console.info('[IPC] CLI Bridge handlers registered');
}
