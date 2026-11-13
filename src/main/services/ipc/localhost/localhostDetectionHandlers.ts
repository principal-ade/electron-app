import { ipcMain } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  LocalhostDetectionEvents,
  DetectServersOptions,
  ServerScanResult,
} from '../../../../shared/main-process-api-interfaces/LocalhostDetectionAPI';
import { applicationWindows } from '../../../window/modernWindowManager';
import { getProcessRegistry } from '../../../processes/ProcessRegistry';
import {
  COMMON_DEV_PORTS,
  checkPort,
  detectRunningServers as scanPorts,
} from '../../../processes/detectServers';

const execAsync = promisify(exec);

// Active watchers map: watchId -> intervalId
const activeWatchers = new Map<string, NodeJS.Timeout>();

/**
 * Detect running servers, enriched with registry display-name overrides.
 * The raw port/process scan lives in `processes/detectServers` so the
 * Principal MCP bridge can reuse it without going through IPC.
 */
async function detectRunningServers(
  options?: DetectServersOptions,
): Promise<ServerScanResult> {
  const result = await scanPorts(options);
  const registry = getProcessRegistry();
  for (const server of result.servers) {
    server.displayName = registry.getDetectedLabel(
      `detected:${server.pid ?? server.port}`,
    );
  }
  return result;
}

/**
 * Broadcast server updates to all windows
 */
function broadcastServerUpdate(result: ServerScanResult) {
  const windows = Array.from(applicationWindows.values());
  for (const { window } of windows) {
    if (window && !window.isDestroyed()) {
      window.webContents.send(LocalhostDetectionEvents.SERVERS_UPDATED, result);
    }
  }
}

/**
 * Generate a unique watch ID
 */
function generateWatchId(): string {
  return `watch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function registerLocalhostDetectionHandlers() {
  // Detect running servers
  ipcMain.handle(
    LocalhostDetectionEvents.DETECT_RUNNING_SERVERS,
    async (_, options?: DetectServersOptions): Promise<ServerScanResult> => {
      return detectRunningServers(options);
    },
  );

  // Check single port
  ipcMain.handle(
    LocalhostDetectionEvents.CHECK_PORT,
    async (_, port: number, timeout?: number): Promise<boolean> => {
      return checkPort(port, timeout);
    },
  );

  // Get common ports list
  ipcMain.handle(
    LocalhostDetectionEvents.GET_COMMON_PORTS,
    async (): Promise<number[]> => {
      return [...COMMON_DEV_PORTS];
    },
  );

  // Start watching for server changes
  ipcMain.handle(
    LocalhostDetectionEvents.START_WATCHING,
    async (
      _,
      ports?: number[],
      intervalMs: number = 5000,
    ): Promise<{ watchId: string }> => {
      const watchId = generateWatchId();
      const portsToWatch = ports ?? COMMON_DEV_PORTS;

      // Run initial scan
      const initialResult = await detectRunningServers({ ports: portsToWatch });
      broadcastServerUpdate(initialResult);

      // Set up interval for periodic scanning
      const intervalId = setInterval(async () => {
        try {
          const result = await detectRunningServers({ ports: portsToWatch });
          broadcastServerUpdate(result);
        } catch (error) {
          console.error('[LocalhostDetection] Error during watch scan:', error);
        }
      }, intervalMs);

      activeWatchers.set(watchId, intervalId);

      return { watchId };
    },
  );

  // Stop watching
  ipcMain.handle(
    LocalhostDetectionEvents.STOP_WATCHING,
    async (_, watchId: string): Promise<void> => {
      const intervalId = activeWatchers.get(watchId);
      if (intervalId) {
        clearInterval(intervalId);
        activeWatchers.delete(watchId);
      }
    },
  );

  // Kill server by PID
  ipcMain.handle(
    LocalhostDetectionEvents.KILL_SERVER,
    async (_, pid: number): Promise<{ success: boolean; error?: string }> => {
      try {
        // Use kill command to terminate the process
        await execAsync(`kill ${pid}`);
        console.log(`[LocalhostDetection] Killed server with PID ${pid}`);
        return { success: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.error(
          `[LocalhostDetection] Failed to kill server with PID ${pid}:`,
          errorMessage,
        );
        return { success: false, error: errorMessage };
      }
    },
  );

  console.log('[LocalhostDetection] Handlers registered');
}

/**
 * Cleanup all active watchers (call on app quit)
 */
export function cleanupLocalhostWatchers() {
  for (const [watchId, intervalId] of activeWatchers) {
    clearInterval(intervalId);
    activeWatchers.delete(watchId);
  }
}
