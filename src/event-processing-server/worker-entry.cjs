/**
 * Worker entry point for event processing server
 * This file runs in a Electron utility process and communicates with the main process
 */

const { HttpEventServer } = require('./HttpEventServer.js');

// Track if we've sent the ready signal
let readySent = false;

// Message handler for communication with main process
function handleMessage(message) {
  if (!message) return;

  console.log('[EventProcessingWorker] Received message from main:', message.type);

  // Handle responses from main process (storage, repository info, etc.)
  if (server) {
    server.handleMainResponse(message);
  }
}

// Function to send messages to main process
function sendToMain(message) {
  try {
    process.send(message);
  } catch (error) {
    console.error('[EventProcessingWorker] Failed to send message to main:', error);
  }
}

// Initialize the HTTP server
let server;

async function initialize() {
  try {
    console.log('[EventProcessingWorker] Initializing HTTP event processing server...');

    server = new HttpEventServer(sendToMain, {
      logLevel: process.env.DEBUG_EVENT_SERVER === 'true' ? 'debug' : 'info',
      maxConcurrentEvents: parseInt(process.env.MAX_CONCURRENT_EVENTS) || 10,
      requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS) || 30000,
      statsReportingIntervalMs: parseInt(process.env.STATS_REPORTING_INTERVAL_MS) || 60000
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

// Set up message handling
process.on('message', handleMessage);

// Handle process termination gracefully
process.on('SIGTERM', () => {
  console.log('[EventProcessingWorker] Received SIGTERM, shutting down...');
  if (server) {
    server.handleMessage({
      type: 'SHUTDOWN',
      id: 'shutdown-signal',
      timestamp: Date.now()
    }).catch(console.error);
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  console.log('[EventProcessingWorker] Received SIGINT, shutting down...');
  if (server) {
    server.handleMessage({
      type: 'SHUTDOWN',
      id: 'shutdown-signal',
      timestamp: Date.now()
    }).catch(console.error);
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