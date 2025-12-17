import { ipcMain } from 'electron';
import { createConnection, Socket } from 'net';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  LocalhostDetectionEvents,
  DetectServersOptions,
  ServerScanResult,
  RunningServer,
} from '../../../../shared/main-process-api-interfaces/LocalhostDetectionAPI';
import { applicationWindows } from '../../../window/modernWindowManager';

const execAsync = promisify(exec);

// Common development server ports
const COMMON_DEV_PORTS = [
  3000, // React, Next.js, Create React App
  3001, // Alternative React port
  3333, // AdonisJS
  4000, // Phoenix, GraphQL
  4200, // Angular CLI
  4321, // Astro
  5000, // Flask, ASP.NET
  5001, // ASP.NET HTTPS
  5173, // Vite
  5174, // Vite alternative
  5432, // PostgreSQL (not HTTP but useful to detect)
  6006, // Storybook
  8000, // Django, PHP
  8080, // Common HTTP alternative
  8081, // Metro bundler (React Native)
  8888, // Jupyter
  9000, // SonarQube, PHP-FPM
  9229, // Node.js debug
];

// Active watchers map: watchId -> intervalId
const activeWatchers = new Map<string, NodeJS.Timeout>();

/**
 * Check if a port is open/listening
 */
async function checkPort(
  port: number,
  timeout: number = 500,
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket: Socket = createConnection({ port, host: 'localhost' });

    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeout);

    socket.on('connect', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * Detect running servers on specified ports
 */
async function detectRunningServers(
  options?: DetectServersOptions,
): Promise<ServerScanResult> {
  const startTime = Date.now();
  const ports = options?.ports ?? COMMON_DEV_PORTS;
  const timeout = options?.timeout ?? 500;
  const servers: RunningServer[] = [];

  // Check all ports in parallel for speed
  const portCheckResults = await Promise.all(
    ports.map(async (port) => {
      const isOpen = await checkPort(port, timeout);
      return { port, isOpen };
    }),
  );

  // Get open ports
  const openPorts = portCheckResults.filter((r) => r.isOpen).map((r) => r.port);

  // Get process info for all open ports in parallel
  const processInfoResults = await Promise.all(
    openPorts.map(async (port) => {
      const processInfo = await getProcessInfoForPort(port);
      return { port, processInfo };
    }),
  );

  // Build server entries with process info
  for (const { port, processInfo } of processInfoResults) {
    // Generate a label from the cwd (project name) or fallback to port
    let label = `localhost:${port}`;
    if (processInfo?.cwd) {
      const projectName = processInfo.cwd.split('/').pop();
      if (projectName) {
        label = projectName;
      }
    }

    servers.push({
      port,
      protocol: 'http',
      responsive: true,
      label,
      serviceType: guessServiceType(port),
      pid: processInfo?.pid,
      cwd: processInfo?.cwd,
      command: processInfo?.command,
    });
  }

  return {
    servers,
    scannedPorts: ports,
    scanDuration: Date.now() - startTime,
  };
}

/**
 * Guess the service type based on the port number
 */
function guessServiceType(port: number): string | undefined {
  const portServiceMap: Record<number, string> = {
    3000: 'react/next',
    3001: 'react',
    4200: 'angular',
    4321: 'astro',
    5173: 'vite',
    5174: 'vite',
    6006: 'storybook',
    8000: 'django/php',
    8080: 'http-server',
    8081: 'metro',
    8888: 'jupyter',
  };
  return portServiceMap[port];
}

interface ProcessInfo {
  pid: number;
  command: string;
  cwd?: string;
}

/**
 * Get process info for a port using lsof (macOS/Linux)
 */
async function getProcessInfoForPort(
  port: number,
): Promise<ProcessInfo | null> {
  try {
    // Find the PID listening on this port
    const { stdout: lsofOutput } = await execAsync(
      `lsof -i :${port} -P -n -sTCP:LISTEN 2>/dev/null | tail -1`,
    );

    if (!lsofOutput.trim()) {
      return null;
    }

    // Parse lsof output: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
    const parts = lsofOutput.trim().split(/\s+/);
    if (parts.length < 2) {
      return null;
    }

    const command = parts[0];
    const pid = parseInt(parts[1], 10);

    if (isNaN(pid)) {
      return null;
    }

    // Get the working directory for this PID
    let cwd: string | undefined;
    try {
      const { stdout: cwdOutput } = await execAsync(
        `lsof -a -d cwd -p ${pid} -Fn 2>/dev/null | grep ^n | head -1`,
      );
      if (cwdOutput.trim()) {
        // Output is like "n/path/to/dir", remove the 'n' prefix
        cwd = cwdOutput.trim().substring(1);
      }
    } catch {
      // cwd lookup failed, continue without it
    }

    return { pid, command, cwd };
  } catch {
    return null;
  }
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
