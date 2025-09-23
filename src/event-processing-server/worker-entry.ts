/**
 * Worker entry point for event processing server
 * This file runs in an Electron utility process and communicates with the main process
 */

import { HttpEventServer } from './HttpEventServer';

console.log('[EventProcessingWorker] Script loaded, HttpEventServer:', typeof HttpEventServer);

// Track if we've sent the ready signal
let readySent = false;

// Message handler for communication with main process
function handleMessage(message: any): void {
  if (!message) return;

  console.log('[EventProcessingWorker] Received message from main:', message.type);

  // Handle responses from main process (storage, repository info, etc.)
  if (server) {
    server.handleMainResponse(message);
  }
}

// Function to send messages to main process
function sendToMain(message: any): void {
  console.log('[EventProcessingWorker] Attempting to send message to main:', message.type);
  try {
    // In Electron utility process, we use parentPort for IPC
    if ((process as any).parentPort) {
      console.log('[EventProcessingWorker] Using parentPort.postMessage');
      (process as any).parentPort.postMessage(message);
      console.log('[EventProcessingWorker] Message sent via parentPort');
    } else if (process.send) {
      // Fallback to process.send if available
      console.log('[EventProcessingWorker] Using process.send');
      process.send(message);
      console.log('[EventProcessingWorker] Message sent via process.send');
    } else {
      console.error('[EventProcessingWorker] No IPC mechanism available');
    }
  } catch (error) {
    console.error('[EventProcessingWorker] Failed to send message to main:', error);
  }
}

// Initialize the HTTP server
let server: HttpEventServer;

async function initialize(): Promise<void> {
  try {
    console.log('[EventProcessingWorker] Initializing HTTP event processing server...');
    console.log('[EventProcessingWorker] HttpEventServer available:', typeof HttpEventServer);

    server = new HttpEventServer(sendToMain, {
      logLevel: process.env.DEBUG_EVENT_SERVER === 'true' ? 'debug' : 'info',
      enableObservability: process.env.DISABLE_OBSERVABILITY !== 'true',
      maxConcurrentEvents: parseInt(process.env.MAX_CONCURRENT_EVENTS || '10'),
      requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '30000'),
      statsReportingIntervalMs: parseInt(process.env.STATS_REPORTING_INTERVAL_MS || '60000')
    });

    // Start the HTTP server
    await server.start();

    console.log('[EventProcessingWorker] HTTP server started successfully');

    // Send ready signal to main process with port info
    if (!readySent) {
      const stats = server.getStats();
      sendToMain({
        type: 'ready',
        timestamp: Date.now(),
        port: stats.port
      });
      readySent = true;
      console.log('[EventProcessingWorker] Ready signal sent to main process, listening on port', stats.port);
    }

  } catch (error) {
    console.error('[EventProcessingWorker] Failed to initialize server:', error);
    process.exit(1);
  }
}

// Start initialization
initialize();

// Set up message handling for utility process
if ((process as any).parentPort) {
  // Utility process uses parentPort for IPC
  (process as any).parentPort.on('message', (e: any) => {
    handleMessage(e.data);
  });
} else {
  // Fallback to process.on for other contexts
  process.on('message', handleMessage);
}

// Handle process termination gracefully
process.on('SIGTERM', () => {
  console.log('[EventProcessingWorker] Received SIGTERM, shutting down...');
  if (server) {
    server.stop().then(() => {
      process.exit(0);
    }).catch((error) => {
      console.error('[EventProcessingWorker] Error during shutdown:', error);
      process.exit(1);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  console.log('[EventProcessingWorker] Received SIGINT, shutting down...');
  if (server) {
    server.stop().then(() => {
      process.exit(0);
    }).catch((error) => {
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
    context: { stack: error.stack }
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[EventProcessingWorker] Unhandled promise rejection:', reason);
  sendToMain({
    type: 'SERVER_ERROR',
    id: 'unhandled-rejection',
    timestamp: Date.now(),
    error: reason instanceof Error ? reason.message : String(reason),
    context: { stack: reason instanceof Error ? reason.stack : undefined }
  });
});

console.log('[EventProcessingWorker] Worker entry point initialized');