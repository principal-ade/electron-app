/**
 * daemonSpawner
 *
 * Utilities for spawning and managing the PTY daemon process.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import { spawn } from 'child_process';
import { app } from 'electron';
import {
  SOCKET_PATH,
  PID_FILE,
  DAEMON_DIR,
  DAEMON_START_TIMEOUT_MS,
  DAEMON_START_POLL_INTERVAL_MS,
} from '../../shared/pty-daemon/constants';

/**
 * Get the path to the daemon bundle.
 */
export function getDaemonPath(): string {
  // In production, it's next to the main bundle
  // In development, it's in dist/main
  const basePath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar', 'dist', 'main')
    : path.join(__dirname);

  return path.join(basePath, 'pty-daemon.cjs');
}

/**
 * Check if the daemon socket exists and is responsive.
 */
export async function isDaemonRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    // First check if socket file exists (Unix)
    if (process.platform !== 'win32') {
      try {
        fs.accessSync(SOCKET_PATH);
      } catch {
        resolve(false);
        return;
      }
    }

    // Try to connect and ping
    const socket = net.createConnection(SOCKET_PATH);
    let responded = false;

    const timeout = setTimeout(() => {
      if (!responded) {
        socket.destroy();
        resolve(false);
      }
    }, 2000);

    socket.on('connect', () => {
      // Send ping
      socket.write('{"type":"ping"}\n');
    });

    socket.on('data', (data) => {
      const str = data.toString();
      if (str.includes('"type":"pong"')) {
        responded = true;
        clearTimeout(timeout);
        socket.destroy();
        resolve(true);
      }
    });

    socket.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

/**
 * Get the PID of the running daemon, if any.
 */
export async function getDaemonPid(): Promise<number | null> {
  try {
    const pidStr = await fs.promises.readFile(PID_FILE, 'utf-8');
    const pid = parseInt(pidStr.trim(), 10);

    if (isNaN(pid)) {
      return null;
    }

    // Check if process is actually running
    try {
      process.kill(pid, 0); // Signal 0 just checks if process exists
      return pid;
    } catch {
      // Process doesn't exist, clean up stale PID file
      await fs.promises.unlink(PID_FILE).catch(() => {});
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Spawn the daemon process.
 */
export async function spawnDaemon(): Promise<void> {
  const daemonPath = getDaemonPath();

  // Check if daemon file exists
  try {
    await fs.promises.access(daemonPath);
  } catch {
    throw new Error(`Daemon bundle not found at ${daemonPath}`);
  }

  // Ensure daemon directory exists
  await fs.promises.mkdir(DAEMON_DIR, { recursive: true, mode: 0o700 }).catch(() => {});

  // Clean up stale socket file
  if (process.platform !== 'win32') {
    await fs.promises.unlink(SOCKET_PATH).catch(() => {});
  }

  // Spawn daemon as detached process
  const child = spawn(process.execPath, [daemonPath], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'production',
    },
  });

  // Unref to allow parent to exit independently
  child.unref();

  console.log(`[daemonSpawner] Spawned daemon (PID: ${child.pid})`);
}

/**
 * Wait for the daemon socket to become available.
 */
export async function waitForSocket(timeoutMs: number = DAEMON_START_TIMEOUT_MS): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const running = await isDaemonRunning();
    if (running) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, DAEMON_START_POLL_INTERVAL_MS));
  }

  throw new Error('Timeout waiting for daemon to start');
}

/**
 * Ensure daemon is running, spawning if necessary.
 */
export async function ensureDaemonRunning(): Promise<void> {
  // Check if already running
  if (await isDaemonRunning()) {
    console.log('[daemonSpawner] Daemon already running');
    return;
  }

  // Check for stale PID
  const existingPid = await getDaemonPid();
  if (existingPid) {
    console.log(`[daemonSpawner] Found stale daemon (PID: ${existingPid}), it may have crashed`);
  }

  // Spawn daemon
  console.log('[daemonSpawner] Starting daemon...');
  await spawnDaemon();

  // Wait for socket
  await waitForSocket();
  console.log('[daemonSpawner] Daemon is ready');
}

/**
 * Stop the daemon gracefully.
 */
export async function stopDaemon(): Promise<void> {
  const pid = await getDaemonPid();

  if (!pid) {
    console.log('[daemonSpawner] No daemon running');
    return;
  }

  try {
    // Send SIGTERM for graceful shutdown
    process.kill(pid, 'SIGTERM');
    console.log(`[daemonSpawner] Sent SIGTERM to daemon (PID: ${pid})`);

    // Wait for process to exit
    const startTime = Date.now();
    while (Date.now() - startTime < 5000) {
      try {
        process.kill(pid, 0);
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch {
        // Process exited
        console.log('[daemonSpawner] Daemon stopped');
        return;
      }
    }

    // Force kill if still running
    console.log('[daemonSpawner] Daemon did not exit gracefully, force killing...');
    process.kill(pid, 'SIGKILL');
  } catch (err) {
    console.warn('[daemonSpawner] Failed to stop daemon:', err);
  }
}
