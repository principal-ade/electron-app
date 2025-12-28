/**
 * Worker entry point for event processing server
 * This file runs in an Electron utility process and communicates with the main process
 */

import { HttpEventServer } from './HttpEventServer';
import type {
  MainToServerMessage,
  ServerToMainMessage,
  RegisterPortMessage,
  UnregisterPortMessage,
} from './types';

interface ReadyMessage {
  type: 'ready';
  timestamp: number;
  port: number;
}

type OutgoingMessage = ServerToMainMessage | ReadyMessage;

// MessagePort type for utility process (from Electron's MessagePortMain)
type MessagePortLike = {
  postMessage: (message: unknown) => void;
  on: (event: 'message', handler: (event: { data: unknown }) => void) => void;
  start: () => void;
  close: () => void;
};

// Debug logging controlled by environment variable
const DEBUG = process.env.DEBUG_EVENT_SERVER === 'true';

function debugLog(...args: unknown[]): void {
  if (DEBUG) {
    console.info('[EventProcessingWorker]', ...args);
  }
}

// Track if we've sent the ready signal
let readySent = false;

// Track registered ports: Map<repository, Map<windowId, MessagePort>>
const registeredPorts: Map<string, Map<number, MessagePortLike>> = new Map();

function extractMessage(raw: unknown): unknown {
  if (raw && typeof raw === 'object' && 'data' in raw) {
    return (raw as { data: unknown }).data;
  }
  return raw;
}

function extractPorts(raw: unknown): MessagePortLike[] {
  if (raw && typeof raw === 'object' && 'ports' in raw) {
    return (raw as { ports: MessagePortLike[] }).ports || [];
  }
  return [];
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

function isRegisterPortMessage(
  message: MainToServerMessage,
): message is RegisterPortMessage {
  return message.type === 'REGISTER_PORT';
}

function isUnregisterPortMessage(
  message: MainToServerMessage,
): message is UnregisterPortMessage {
  return message.type === 'UNREGISTER_PORT';
}

/**
 * Register a MessagePort for a window+repository
 */
function registerPort(
  windowId: number,
  repository: string,
  port: MessagePortLike,
): void {
  if (!registeredPorts.has(repository)) {
    registeredPorts.set(repository, new Map());
  }
  registeredPorts.get(repository)!.set(windowId, port);

  // Start the port to enable message receiving (if needed later)
  port.start();

  debugLog(`Registered port for window ${windowId} -> repo ${repository}`);
}

/**
 * Unregister a MessagePort for a window+repository
 */
function unregisterPort(windowId: number, repository: string): void {
  const repoPorts = registeredPorts.get(repository);
  if (!repoPorts) return;

  const port = repoPorts.get(windowId);
  if (port) {
    try {
      port.close();
    } catch (e) {
      // Port may already be closed
    }
    repoPorts.delete(windowId);
    debugLog(`Unregistered port for window ${windowId} -> repo ${repository}`);
  }

  if (repoPorts.size === 0) {
    registeredPorts.delete(repository);
  }
}

/**
 * Send an event to all ports registered for a repository
 */
function sendEventToPorts(repository: string, event: unknown): void {
  const repoPorts = registeredPorts.get(repository);
  if (!repoPorts || repoPorts.size === 0) {
    return;
  }

  for (const [windowId, port] of repoPorts) {
    try {
      port.postMessage({ type: 'AGENT_EVENT', event });
    } catch (error) {
      console.error(
        `[EventProcessingWorker] Failed to send event to window ${windowId}:`,
        error,
      );
      // Remove broken port
      repoPorts.delete(windowId);
    }
  }
}

// Export for HttpEventServer to use
(
  global as unknown as { sendEventToPorts: typeof sendEventToPorts }
).sendEventToPorts = sendEventToPorts;

// Message handler for communication with main process
function handleMessage(rawMessage: unknown): void {
  const message = extractMessage(rawMessage);
  const ports = extractPorts(rawMessage);

  if (!isMainToServerMessage(message)) {
    return;
  }

  // Handle port registration/unregistration
  if (isRegisterPortMessage(message) && ports.length > 0) {
    registerPort(message.windowId, message.repository, ports[0]);
    return;
  }

  if (isUnregisterPortMessage(message)) {
    unregisterPort(message.windowId, message.repository);
    return;
  }

  if (server) {
    server.handleMainResponse(message);
  }
}

// Function to send messages to main process
function sendToMain(message: OutgoingMessage): void {
  try {
    // Electron utility processes use process.parentPort
    if (process.parentPort) {
      process.parentPort.postMessage(message);
    } else if (process.send) {
      // Fallback to process.send for child processes
      process.send(message);
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

    // Send ready signal to main process with port info
    if (!readySent) {
      const stats = server.getStats();
      sendToMain({
        type: 'ready',
        timestamp: Date.now(),
        port: stats.port,
      });
      readySent = true;
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
  if (server) {
    server
      .stop()
      .then(() => {
        process.exit(0);
      })
      .catch(() => {
        process.exit(1);
      });
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  if (server) {
    server
      .stop()
      .then(() => {
        process.exit(0);
      })
      .catch(() => {
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
