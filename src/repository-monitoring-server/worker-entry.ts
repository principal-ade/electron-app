/**
 * Worker entry point for repository monitoring server
 * This file runs in an Electron utility process and communicates with the main process
 * Updated to use shared repository-core modules and fixed message handling
 */

import { RepositoryMonitoringServer } from './RepositoryMonitoringServer';
import type { MainToServerMessage, ServerToMainMessage } from './types';

console.log('[RepositoryMonitoring] Worker script loaded');

// Track if we've sent the ready signal
let readySent = false;

// The server instance
let server: RepositoryMonitoringServer;

/**
 * Initialize the repository monitoring server
 */
async function initialize(): Promise<void> {
  console.log('[RepositoryMonitoring] Initializing worker process...');

  try {
    // Create the server instance
    server = new RepositoryMonitoringServer();

    // Send ready signal to main process
    if (!readySent) {
      sendToMain({ type: 'ready' });
      readySent = true;
      console.log('[RepositoryMonitoring] Worker ready signal sent');
    }
  } catch (error) {
    console.error('[RepositoryMonitoring] Failed to initialize:', error);
    sendToMain({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown initialization error',
    });
  }
}

/**
 * Handle messages from the main process
 */
async function handleMessage(rawMessage: any): Promise<void> {
  // Electron utility process wraps messages in a data property
  const message: MainToServerMessage = rawMessage.data || rawMessage;

  if (!message || !message.type) {
    console.warn('[RepositoryMonitoring] Received invalid message:', rawMessage);
    return;
  }

  console.log('[RepositoryMonitoring] Received message:', message.type, message.id);

  // Ensure server is initialized
  if (!server) {
    console.error('[RepositoryMonitoring] Server not initialized');
    sendToMain({
      type: 'error',
      id: message.id,
      error: 'Server not initialized',
    });
    return;
  }

  try {
    let result: any;

    switch (message.type) {
      case 'getFileTree':
        if (!message.path) throw new Error('Path required for getFileTree');
        result = await server.getFileTree(message.path);
        break;

      case 'getMetrics':
        if (!message.path) throw new Error('Path required for getMetrics');
        // TODO: Implement in Phase 2
        result = {
          tests: 0,
          deadCode: 0,
          linting: 0,
          formatting: 0,
          types: 0,
          documentation: 0,
        };
        break;

      case 'getPackages':
        if (!message.path) throw new Error('Path required for getPackages');
        result = await server.getPackages(message.path);
        break;

      case 'refresh':
        if (!message.path) throw new Error('Path required for refresh');
        await server.refreshRepository(message.path);
        result = { success: true };
        break;

      case 'register':
        if (!message.path) throw new Error('Path required for register');
        await server.registerRepository(message.path);
        result = { success: true };
        break;

      case 'unregister':
        if (!message.path) throw new Error('Path required for unregister');
        await server.unregisterRepository(message.path);
        result = { success: true };
        break;

      case 'getRegisteredPaths':
        // Return all registered repository paths
        result = Array.from(server['repositories'].keys());
        break;

      case 'getRepositoryDetails':
        // Return detailed repository information
        const details: Array<{ path: string; gitWatchingEnabled: boolean; fsMonitorEnabled: boolean; watchingMode: 'minimal' | 'fallback' | 'none' }> = [];
        for (const [path, state] of server['repositories'].entries()) {
          details.push({
            path,
            gitWatchingEnabled: state.gitWatchingEnabled || false,
            fsMonitorEnabled: state.fsMonitorEnabled || false,
            watchingMode: state.watchingMode || 'none'
          });
        }
        result = details;
        break;

      case 'getResourceMetrics':
        // Return current process metrics
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        result = {
          memory: memUsage.rss, // Resident Set Size
          cpu: 0, // CPU calculation would need previous sample
        };
        break;

      case 'getGitStatus':
        if (!message.path) throw new Error('Path required for getGitStatus');
        result = await server.getGitStatus(message.path);
        break;

      case 'getGitStatusWithFiles':
        if (!message.path) throw new Error('Path required for getGitStatusWithFiles');
        result = await server.getGitStatusWithFiles(message.path);
        break;

      case 'enableGitWatching':
        if (!message.path) throw new Error('Path required for enableGitWatching');
        await server.enableGitWatching(message.path);
        result = { success: true };
        break;

      case 'disableGitWatching':
        if (!message.path) throw new Error('Path required for disableGitWatching');
        await server.disableGitWatching(message.path);
        result = { success: true };
        break;

      default:
        throw new Error(`Unknown message type: ${(message as any).type}`);
    }

    // Send successful response
    sendToMain({
      type: 'response',
      id: message.id,
      result,
    });
  } catch (error) {
    console.error('[RepositoryMonitoring] Error handling message:', error);
    sendToMain({
      type: 'error',
      id: message.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Send a message to the main process
 */
function sendToMain(message: ServerToMainMessage): void {
  console.log('[RepositoryMonitoring] Sending message to main:', message.type);

  try {
    // In Electron utility process, we use parentPort for IPC
    if ((process as any).parentPort) {
      console.log('[RepositoryMonitoring] Using parentPort.postMessage');
      (process as any).parentPort.postMessage(message);
    } else if (process.send) {
      // Fallback to process.send if available
      console.log('[RepositoryMonitoring] Using process.send');
      process.send(message);
    } else {
      console.error('[RepositoryMonitoring] No IPC mechanism available');
    }
  } catch (error) {
    console.error('[RepositoryMonitoring] Failed to send message to main:', error);
  }
}

/**
 * Handle process shutdown
 */
function handleShutdown(): void {
  console.log('[RepositoryMonitoring] Worker shutting down...');
  sendToMain({ type: 'event', event: { name: 'shutdown', data: {} } });
  process.exit(0);
}

// Set up IPC listeners
if ((process as any).parentPort) {
  console.log('[RepositoryMonitoring] Setting up parentPort listener');
  (process as any).parentPort.on('message', handleMessage);
} else {
  console.log('[RepositoryMonitoring] Setting up process message listener');
  process.on('message', handleMessage);
}

// Handle shutdown signals
process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[RepositoryMonitoring] Uncaught exception:', error);
  sendToMain({
    type: 'error',
    error: `Uncaught exception: ${error.message}`,
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[RepositoryMonitoring] Unhandled rejection at:', promise, 'reason:', reason);
  sendToMain({
    type: 'error',
    error: `Unhandled rejection: ${reason}`,
  });
});

// Initialize the server
console.log('[RepositoryMonitoring] Starting initialization...');
initialize().catch((error) => {
  console.error('[RepositoryMonitoring] Fatal initialization error:', error);
  process.exit(1);
});