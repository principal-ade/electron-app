import { createConnection, Socket } from 'net';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  DetectServersOptions,
  RunningServer,
  ServerScanResult,
} from '../../shared/main-process-api-interfaces/LocalhostDetectionAPI';

const execAsync = promisify(exec);

/** Common development server ports scanned by default. */
export const COMMON_DEV_PORTS = [
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

/** Check if a port is open/listening. */
export async function checkPort(port: number, timeout = 500): Promise<boolean> {
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

/** Guess the service type based on the port number. */
export function guessServiceType(port: number): string | undefined {
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

export interface ProcessInfo {
  pid: number;
  command: string;
  cwd?: string;
}

/** Get process info for a port using lsof (macOS/Linux). */
export async function getProcessInfoForPort(
  port: number,
): Promise<ProcessInfo | null> {
  try {
    const { stdout: lsofOutput } = await execAsync(
      `lsof -i :${port} -P -n -sTCP:LISTEN 2>/dev/null | tail -1`,
    );

    if (!lsofOutput.trim()) {
      return null;
    }

    const parts = lsofOutput.trim().split(/\s+/);
    if (parts.length < 2) {
      return null;
    }

    const command = parts[0];
    const pid = parseInt(parts[1], 10);

    if (Number.isNaN(pid)) {
      return null;
    }

    let cwd: string | undefined;
    try {
      const { stdout: cwdOutput } = await execAsync(
        `lsof -a -d cwd -p ${pid} -Fn 2>/dev/null | grep ^n | head -1`,
      );
      if (cwdOutput.trim()) {
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
 * Scan localhost ports for running servers. Returns raw servers without
 * display-name enrichment — callers add `displayName` from the process
 * registry when they need UI parity.
 */
export async function detectRunningServers(
  options?: DetectServersOptions,
): Promise<ServerScanResult> {
  const startTime = Date.now();
  const ports = options?.ports ?? COMMON_DEV_PORTS;
  const timeout = options?.timeout ?? 500;
  const servers: RunningServer[] = [];

  const portCheckResults = await Promise.all(
    ports.map(async (port) => {
      const isOpen = await checkPort(port, timeout);
      return { port, isOpen };
    }),
  );

  const openPorts = portCheckResults.filter((r) => r.isOpen).map((r) => r.port);

  const processInfoResults = await Promise.all(
    openPorts.map(async (port) => {
      const processInfo = await getProcessInfoForPort(port);
      return { port, processInfo };
    }),
  );

  for (const { port, processInfo } of processInfoResults) {
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
