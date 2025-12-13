import type {
  DetectServersOptions,
  ServerScanResult,
  RunningServer,
} from '../../shared/main-process-api-interfaces/LocalhostDetectionAPI';

/**
 * Service for detecting and monitoring running localhost servers.
 * Used by localhost-panels to display available development servers.
 */
export const LocalhostDetectionService = {
  /**
   * Detect all running servers on specified or common ports
   */
  detectRunningServers: async (
    options?: DetectServersOptions,
  ): Promise<ServerScanResult> => {
    return window.mainProcess.localhostDetection.detectRunningServers(options);
  },

  /**
   * Check if a specific port is in use
   */
  checkPort: async (port: number, timeout?: number): Promise<boolean> => {
    return window.mainProcess.localhostDetection.checkPort(port, timeout);
  },

  /**
   * Get list of common development ports
   */
  getCommonPorts: async (): Promise<number[]> => {
    return window.mainProcess.localhostDetection.getCommonPorts();
  },

  /**
   * Start watching for server changes on specified ports
   */
  startWatching: async (
    ports?: number[],
    intervalMs?: number,
  ): Promise<{ watchId: string }> => {
    return window.mainProcess.localhostDetection.startWatching(
      ports,
      intervalMs,
    );
  },

  /**
   * Stop watching for server changes
   */
  stopWatching: async (watchId: string): Promise<void> => {
    return window.mainProcess.localhostDetection.stopWatching(watchId);
  },

  /**
   * Subscribe to server update events
   */
  onServersUpdated: (
    callback: (result: ServerScanResult) => void,
  ): (() => void) => {
    return window.mainProcess.localhostDetection.onServersUpdated(callback);
  },
};

// Re-export types for convenience
export type { DetectServersOptions, ServerScanResult, RunningServer };
