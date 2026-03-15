/**
 * PTY Daemon Entry Point
 *
 * Standalone Node.js process that manages PTY sessions.
 * Communicates with Electron app via Unix domain socket.
 *
 * Usage:
 *   node pty-daemon.js [--socket-path <path>] [--log-level <level>]
 */

import * as fs from 'fs';
import { DaemonSessionManager } from './DaemonSessionManager';
import { SocketServer } from './SocketServer';
import { Logger } from './Logger';
import {
  SOCKET_PATH,
  PID_FILE,
  DAEMON_DIR,
  IDLE_TIMEOUT_MS,
  LogLevel,
  DEFAULT_LOG_LEVEL,
} from '../shared/pty-daemon/constants';
import {
  daemonTelemetry,
  addPhaseEvent,
  addIdleEvent,
  addErrorEvent,
} from './telemetry';

// Parse command line arguments
function parseArgs(): { socketPath: string; logLevel: LogLevel } {
  const args = process.argv.slice(2);
  let socketPath = SOCKET_PATH;
  let logLevel: LogLevel = DEFAULT_LOG_LEVEL;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--socket-path' && args[i + 1]) {
      socketPath = args[i + 1];
      i++;
    } else if (args[i] === '--log-level' && args[i + 1]) {
      const level = args[i + 1] as LogLevel;
      if (['debug', 'info', 'warn', 'error'].includes(level)) {
        logLevel = level;
      }
      i++;
    }
  }

  return { socketPath, logLevel };
}

async function main(): Promise<void> {
  const { socketPath, logLevel } = parseArgs();
  const logger = new Logger(logLevel);

  logger.info('Starting PTY daemon...');
  logger.info(`Socket path: ${socketPath}`);
  logger.info(`Log level: ${logLevel}`);
  logger.info(`PID: ${process.pid}`);

  // Initialize telemetry and start the startup workflow span
  await daemonTelemetry.initialize();
  daemonTelemetry.startStartupWorkflow();

  // Add starting event
  addPhaseEvent('starting', 'daemon process initializing');

  // Ensure daemon directory exists
  try {
    await fs.promises.mkdir(DAEMON_DIR, { recursive: true, mode: 0o700 });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
      logger.error('Failed to create daemon directory:', err);
      process.exit(1);
    }
  }

  // Write PID file
  try {
    await fs.promises.writeFile(PID_FILE, String(process.pid), { mode: 0o600 });
    logger.debug(`Wrote PID file: ${PID_FILE}`);
  } catch (err) {
    logger.warn('Failed to write PID file:', err);
  }

  // Initialize components
  const daemonStartedAt = new Date();
  const sessionManager = new DaemonSessionManager();
  const server = new SocketServer(sessionManager, logger, socketPath, daemonStartedAt);

  // Idle shutdown timer
  let idleTimer: NodeJS.Timeout | null = null;
  let idleStartTime: number | null = null;

  function resetIdleTimer(): void {
    if (idleTimer) {
      clearTimeout(idleTimer);
      // Add cancelled event if we were idle
      if (idleStartTime !== null) {
        const idleDuration = Date.now() - idleStartTime;
        addIdleEvent(
          idleDuration,
          sessionManager.getSessionCount(),
          server.getClientCount(),
          'cancelled',
        );
        idleStartTime = null;
      }
    }

    // Only start idle timer if no sessions and no clients
    if (sessionManager.getSessionCount() === 0 && server.getClientCount() === 0) {
      logger.debug('Starting idle shutdown timer...');
      idleStartTime = Date.now();

      // Add checking event
      addIdleEvent(
        0,
        sessionManager.getSessionCount(),
        server.getClientCount(),
        'checking',
      );

      idleTimer = setTimeout(() => {
        // Add timeout event
        addIdleEvent(
          idleStartTime ? Date.now() - idleStartTime : IDLE_TIMEOUT_MS,
          sessionManager.getSessionCount(),
          server.getClientCount(),
          'timeout',
        );

        logger.info('Idle timeout reached, shutting down...');
        shutdown();
      }, IDLE_TIMEOUT_MS);
    }
  }

  // Track activity to manage idle timer
  sessionManager.on('sessionCreated', () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  });

  sessionManager.on('sessionDestroyed', () => {
    resetIdleTimer();
  });

  server.on('clientConnected', () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  });

  server.on('clientDisconnected', () => {
    resetIdleTimer();
  });

  // Graceful shutdown
  let isShuttingDown = false;

  async function shutdown(): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info('Shutting down...');

    // Add shutdown event
    addPhaseEvent('shutdown', 'graceful shutdown requested');

    // Clear idle timer
    if (idleTimer) {
      clearTimeout(idleTimer);
    }

    // Shutdown session manager (kills all PTYs)
    sessionManager.shutdown();

    // Stop socket server
    await server.stop();

    // Remove PID file
    try {
      await fs.promises.unlink(PID_FILE);
    } catch {
      // Ignore
    }

    // Flush telemetry before exit (this ends the workflow span)
    await daemonTelemetry.shutdown();

    logger.info('Shutdown complete');
    process.exit(0);
  }

  // Handle signals
  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM');
    shutdown();
  });

  process.on('SIGINT', () => {
    logger.info('Received SIGINT');
    shutdown();
  });

  process.on('SIGHUP', () => {
    logger.info('Received SIGHUP, ignoring');
  });

  // Handle uncaught errors
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception:', err);

    // Add error event
    addErrorEvent(
      'daemon.uncaughtException',
      err.message,
      'UNCAUGHT_EXCEPTION',
      undefined,
      false,
    );

    shutdown();
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection:', reason);

    // Add error event
    addErrorEvent(
      'daemon.unhandledRejection',
      reason instanceof Error ? reason.message : String(reason),
      'UNHANDLED_REJECTION',
      undefined,
      true, // Usually recoverable
    );
  });

  // Start server
  try {
    await server.start();
    logger.info('PTY daemon ready');

    // Add ready event and end the startup workflow
    addPhaseEvent('ready', 'daemon accepting connections');
    daemonTelemetry.endStartupWorkflow();

    // Start idle timer (will shut down if no activity)
    resetIdleTimer();
  } catch (err) {
    logger.error('Failed to start server:', err);

    // Add error event
    addErrorEvent(
      'daemon.startup',
      err instanceof Error ? err.message : String(err),
      'STARTUP_FAILED',
      undefined,
      false,
    );

    await daemonTelemetry.shutdown();
    process.exit(1);
  }
}

// Run
main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
