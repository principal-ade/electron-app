/**
 * Worker entry point for event processing server
 * This file runs in an Electron utility process and communicates with the main process
 */

import { HttpEventServer } from './HttpEventServer';
import type { MainToServerMessage, ServerToMainMessage } from './types';

interface ReadyMessage {
  type: 'ready';
  timestamp: number;
  port: number;
}

type OutgoingMessage = ServerToMainMessage | ReadyMessage;

console.info(
  '[EventProcessingWorker] Script loaded, HttpEventServer:',
  typeof HttpEventServer,
);

// Track if we've sent the ready signal
let readySent = false;

function extractMessage(raw: unknown): unknown {
  if (raw && typeof raw === 'object' && 'data' in raw) {
    return (raw as { data: unknown }).data;
  }
  return raw;
}

function isMainToServerMessage(
  message: unknown,
): message is MainToServerMessage {
  return Boolean(
    message &&
      typeof message === 'object' &&
      'type' in message &&
      typeof (message as { type: unknown }).type === 'string',
  );
}

// Message handler for communication with main process
function handleMessage(rawMessage: unknown): void {
  const message = extractMessage(rawMessage);
  if (!isMainToServerMessage(message)) {
    console.warn(
      '[EventProcessingWorker] Ignoring message with unexpected shape:',
      rawMessage,
    );
    return;
  }

  console.info(
    '[EventProcessingWorker] Received message from main:',
    message.type,
  );

  if (server) {
    server.handleMainResponse(message);
  }
}

// Function to send messages to main process
function sendToMain(message: OutgoingMessage): void {
  console.info(
    '[EventProcessingWorker] Attempting to send message to main:',
    message.type,
  );
  try {
    // Electron utility processes use process.parentPort
    if (process.parentPort) {
      console.info(
        '[EventProcessingWorker] Using process.parentPort.postMessage',
      );
      process.parentPort.postMessage(message);
      console.info(
        '[EventProcessingWorker] Message sent via process.parentPort',
      );
    } else if (process.send) {
      // Fallback to process.send for child processes
      console.info('[EventProcessingWorker] Using process.send');
      process.send(message);
      console.info('[EventProcessingWorker] Message sent via process.send');
    } else {
      console.error('[EventProcessingWorker] No IPC mechanism available');
    }
  } catch (error) {
    console.error(
      '[EventProcessingWorker] Failed to send message to main:',
      error,
    );
  }
}

// Initialize the HTTP server
let server: HttpEventServer;

async function initialize(): Promise<void> {
  try {
    console.info(
      '[EventProcessingWorker] Initializing HTTP event processing server...',
    );
    console.info(
      '[EventProcessingWorker] HttpEventServer available:',
      typeof HttpEventServer,
    );

    server = new HttpEventServer(sendToMain, {
      logLevel: process.env.DEBUG_EVENT_SERVER === 'true' ? 'debug' : 'info',
      enableObservability: process.env.DISABLE_OBSERVABILITY !== 'true',
      maxConcurrentEvents: parseInt(process.env.MAX_CONCURRENT_EVENTS || '10'),
      requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '30000'),
      statsReportingIntervalMs: parseInt(
        process.env.STATS_REPORTING_INTERVAL_MS || '60000',
      ),
    });

    // Start the HTTP server
    await server.start();

    console.info('[EventProcessingWorker] HTTP server started successfully');

    // Send ready signal to main process with port info
    if (!readySent) {
      const stats = server.getStats();
      sendToMain({
        type: 'ready',
        timestamp: Date.now(),
        port: stats.port,
      });
      readySent = true;
      console.info(
        '[EventProcessingWorker] Ready signal sent to main process, listening on port',
        stats.port,
      );
    }
  } catch (error) {
    console.error(
      '[EventProcessingWorker] Failed to initialize server:',
      error,
    );
    process.exit(1);
  }
}

// Start initialization
initialize();

// Set up message handling for Electron utility process
if (process.parentPort) {
  process.parentPort.on('message', (message) => {
    handleMessage(message);
  });
} else {
  // Fallback to process.on for child processes
  process.on('message', handleMessage);
}

// Handle process termination gracefully
process.on('SIGTERM', () => {
  console.info('[EventProcessingWorker] Received SIGTERM, shutting down...');
  if (server) {
    server
      .stop()
      .then(() => {
        process.exit(0);
      })
      .catch((error) => {
        console.error('[EventProcessingWorker] Error during shutdown:', error);
        process.exit(1);
      });
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  console.info('[EventProcessingWorker] Received SIGINT, shutting down...');
  if (server) {
    server
      .stop()
      .then(() => {
        process.exit(0);
      })
      .catch((error) => {
        console.error('[EventProcessingWorker] Error during shutdown:', error);
        process.exit(1);
      });
  } else {
    process.exit(0);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[EventProcessingWorker] Uncaught exception:', error);
  sendToMain({
    type: 'SERVER_ERROR',
    id: 'uncaught-exception',
    timestamp: Date.now(),
    error: error.message,
    context: { stack: error.stack },
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, _promise) => {
  console.error('[EventProcessingWorker] Unhandled promise rejection:', reason);
  sendToMain({
    type: 'SERVER_ERROR',
    id: 'unhandled-rejection',
    timestamp: Date.now(),
    error: reason instanceof Error ? reason.message : String(reason),
    context: { stack: reason instanceof Error ? reason.stack : undefined },
  });
});

console.info('[EventProcessingWorker] Worker entry point initialized');
