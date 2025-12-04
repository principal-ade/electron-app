/**
 * Localhost Detection API
 *
 * Provides functionality for detecting and monitoring running localhost services.
 * Used by localhost-panels to display available development servers.
 */

export interface RunningServer {
  port: number;
  label?: string;
  protocol: 'http' | 'https';
  path?: string;
  /** Whether the server responded to a connection attempt */
  responsive: boolean;
  /** Optional detected service type (e.g., 'vite', 'next', 'express') */
  serviceType?: string;
  /** Process ID of the server */
  pid?: number;
  /** Working directory where the process was started (project root) */
  cwd?: string;
  /** Command that started the process (e.g., 'node', 'npm') */
  command?: string;
}

export interface DetectServersOptions {
  /** Specific ports to check. If not provided, scans common dev ports */
  ports?: number[];
  /** Include HTTP protocol check */
  includeHttp?: boolean;
  /** Include HTTPS protocol check */
  includeHttps?: boolean;
  /** Timeout in milliseconds for each port check */
  timeout?: number;
}

export interface ServerScanResult {
  servers: RunningServer[];
  scannedPorts: number[];
  scanDuration: number;
}

export enum LocalhostDetectionEvents {
  DETECT_RUNNING_SERVERS = 'localhost:detect-running-servers',
  CHECK_PORT = 'localhost:check-port',
  GET_COMMON_PORTS = 'localhost:get-common-ports',
  SERVERS_UPDATED = 'localhost:servers-updated',
  START_WATCHING = 'localhost:start-watching',
  STOP_WATCHING = 'localhost:stop-watching',
}

export interface LocalhostDetectionAPI {
  /**
   * Detect all running servers on specified or common ports
   */
  detectRunningServers: (
    options?: DetectServersOptions,
  ) => Promise<ServerScanResult>;

  /**
   * Check if a specific port is in use
   */
  checkPort: (port: number, timeout?: number) => Promise<boolean>;

  /**
   * Get list of common development ports
   */
  getCommonPorts: () => Promise<number[]>;

  /**
   * Start watching for server changes on specified ports
   * Returns an unsubscribe function
   */
  startWatching: (
    ports?: number[],
    intervalMs?: number,
  ) => Promise<{ watchId: string }>;

  /**
   * Stop watching for server changes
   */
  stopWatching: (watchId: string) => Promise<void>;

  /**
   * Subscribe to server update events
   */
  onServersUpdated: (
    callback: (result: ServerScanResult) => void,
  ) => () => void;
}
