/**
 * EventServerManager - Manages the event processing utility process from main
 * Handles storage requests and window broadcasts from the server
 */

import {
  app,
  utilityProcess,
  UtilityProcess,
  BrowserWindow,
  MessageChannelMain,
  ipcMain,
} from 'electron';
import { EventEmitter } from 'events';
import * as path from 'path';
import { getTracer } from '../telemetry';
import { SpanStatusCode } from '@opentelemetry/api';

import {
  ServerToMainMessage,
  MainToServerMessage,
  WindowBroadcastMessage,
  isWindowBroadcastMessage,
  isGetTracesRequestMessage,
  isGetRegistrationsRequestMessage,
  GetTracesRequestMessage,
  GetRegistrationsRequestMessage,
} from '../../event-processing-server/types';
import { OtelCollectorService } from '../services/OtelCollectorService';
import { AgentSessionSDKAPIEvents } from '../../shared/main-process-api-interfaces/AgentSessionSDKAPI';

/**
 * Configuration for EventServerManager
 */
export interface EventServerManagerConfig {
  autoStart: boolean;
  restartOnCrash: boolean;
  maxRestartAttempts: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

const DEFAULT_CONFIG: EventServerManagerConfig = {
  autoStart: true,
  restartOnCrash: true,
  maxRestartAttempts: 3,
  logLevel: 'info',
};

/**
 * Manages the event processing server utility process
 */
export class EventServerManager extends EventEmitter {
  private config: EventServerManagerConfig;
  private worker: UtilityProcess | null = null;
  private isRunning = false;
  private serverPort: number | null = null;
  private restartAttempts = 0;
  private shutdownRequested = false;

  // Track which windows are registered for which repos (for cleanup on window close)
  // Ports are transferred and not stored here - just tracking the relationship
  private registeredWindows: Map<string, Set<number>> = new Map();

  constructor(config: Partial<EventServerManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Set up IPC handlers for port registration
    this.setupPortRegistrationHandlers();

    if (this.config.autoStart) {
      this.start().catch((error) => {
        this.log('error', `Failed to auto-start event server: ${error}`);
      });
    }
  }

  /**
   * Set up IPC handlers for MessagePort registration
   */
  private setupPortRegistrationHandlers(): void {
    // Handle registration request from renderer
    ipcMain.handle(
      AgentSessionSDKAPIEvents.REGISTER_EVENT_PORT,
      async (event, repository: string) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) {
          this.log('error', 'Could not determine window for port registration');
          return false;
        }

        return this.registerPortForWindow(window.id, repository, event.sender);
      },
    );

    // Handle unregistration request from renderer
    ipcMain.handle(
      AgentSessionSDKAPIEvents.UNREGISTER_EVENT_PORT,
      async (event, repository: string) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) {
          return;
        }

        this.unregisterPortForWindow(window.id, repository);
      },
    );
  }

  /**
   * Register a MessagePort for a window to receive events for a repository
   */
  private registerPortForWindow(
    windowId: number,
    repository: string,
    webContents: Electron.WebContents,
  ): boolean {
    const tracer = getTracer('principal-ade-main');
    const span = tracer.startSpan('event.port.registration');

    try {
      if (!this.worker) {
        this.log('error', 'Cannot register port: worker not running');
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Worker not running' });
        return false;
      }

      // Clean up any existing registration for this window+repo
      this.unregisterPortForWindow(windowId, repository);

      // Create MessageChannel
      const { port1, port2 } = new MessageChannelMain();

      // Track the registration
      let windowSet = this.registeredWindows.get(repository);
      if (!windowSet) {
        windowSet = new Set();
        this.registeredWindows.set(repository, windowSet);
      }
      windowSet.add(windowId);

      // Transfer port1 to the utility process
      this.worker.postMessage(
        {
          type: 'REGISTER_PORT',
          id: `register-${windowId}-${repository}-${Date.now()}`,
          timestamp: Date.now(),
          windowId,
          repository,
        },
        [port1],
      );

      // Transfer port2 to the renderer
      webContents.postMessage(
        AgentSessionSDKAPIEvents.EVENT_PORT_READY,
        { repository },
        [port2],
      );

      // Event: MessagePort registered for window to receive events
      span.addEvent('event.port.registered', {
        'window.id': windowId,
        'repository': repository,
      });

      span.setStatus({ code: SpanStatusCode.OK });
      this.log(
        'debug',
        `Registered event port for window ${windowId} -> ${repository}`,
      );

      return true;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : String(error) });
      this.log('error', `Failed to register port: ${error}`);
      return false;
    } finally {
      span.end();
    }
  }

  /**
   * Unregister a MessagePort for a window
   */
  private unregisterPortForWindow(windowId: number, repository: string): void {
    const repoWindows = this.registeredWindows.get(repository);
    if (!repoWindows || !repoWindows.has(windowId)) return;

    repoWindows.delete(windowId);

    // Notify utility process to clean up its port
    if (this.worker) {
      this.worker.postMessage({
        type: 'UNREGISTER_PORT',
        id: `unregister-${windowId}-${repository}-${Date.now()}`,
        timestamp: Date.now(),
        windowId,
        repository,
      });
    }

    this.log(
      'info',
      `Unregistered event port for window ${windowId} -> repository ${repository}`,
    );

    // Clean up empty sets
    if (repoWindows.size === 0) {
      this.registeredWindows.delete(repository);
    }
  }

  /**
   * Clean up all ports for a window (called when window closes)
   */
  cleanupWindowPorts(windowId: number): void {
    for (const [repository, windows] of this.registeredWindows) {
      if (windows.has(windowId)) {
        this.unregisterPortForWindow(windowId, repository);
      }
    }
  }

  /**
   * Start the event processing server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.log('debug', 'Event server already running');
      return;
    }

    // Ensure app is ready
    if (!app.isReady()) {
      await app.whenReady();
    }

    const tracer = getTracer('principal-ade-main');
    const span = tracer.startSpan('event.server.startup');

    try {
      this.log('info', 'Starting event processing server...');
      this.shutdownRequested = false;

      await this.spawnWorker();
      this.isRunning = true;
      this.restartAttempts = 0;

      // Event: EventServerManager started and spawned utility process
      span.addEvent('event.server.manager_started', {
        'server.port': this.serverPort || 0,
        'auto.start': this.config.autoStart,
      });

      span.setStatus({ code: SpanStatusCode.OK });
      this.log(
        'info',
        `Event processing server started on port ${this.serverPort}`,
      );
      this.emit('started', this.serverPort);
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : String(error) });
      this.log('error', `Failed to start event server: ${error}`);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Spawn the utility process worker
   */
  private async spawnWorker(): Promise<void> {
    const fs = require('fs');
    let workerPath: string;

    if (!app.isPackaged) {
      // Development: use the webpack-compiled bundle
      // The bundle is created by webpack and placed in .erb/dll
      workerPath = path.join(__dirname, 'event-worker.bundle.dev.js');

      // __dirname in dev is .erb/dll, so the file should be right there
      this.log('debug', `Looking for development worker at: ${workerPath}`);
    } else {
      // Production: use the webpack-compiled bundle from dist
      workerPath = path.join(__dirname, 'event-worker.js');

      this.log('debug', `Looking for production worker at: ${workerPath}`);
    }

    // Verify the worker file exists
    if (!fs.existsSync(workerPath)) {
      const errorMsg =
        `Worker bundle not found at: ${workerPath}\n` +
        'The event-worker bundle has not been compiled by webpack.\n' +
        'Please ensure webpack is configured with the event-worker entry point and has compiled successfully.';
      this.log('error', errorMsg);
      throw new Error(errorMsg);
    }

    this.log('info', `Found worker bundle at: ${workerPath}`);

    this.log('info', `Spawning event server worker from: ${workerPath}`);

    // Spawn the utility process
    this.log('info', `About to fork utility process with path: ${workerPath}`);

    this.worker = utilityProcess.fork(workerPath, [], {
      serviceName: 'event-processing-server',
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'development',
      },
    });

    this.log('info', 'Utility process fork() called');

    // Set up event handlers
    this.worker.on('spawn', () => {
      this.log('info', 'Event server worker spawned successfully');
    });

    this.worker.on('message', (msg: ServerToMainMessage) => {
      this.handleWorkerMessage(msg);
    });

    // Handle stdout/stderr for debugging
    if (this.worker.stdout) {
      this.worker.stdout.on('data', (data: Buffer) => {
        const output = data.toString().trim();
        if (output) {
          this.log('info', `[Server stdout] ${output}`);
        }
      });
    } else {
      this.log('warn', 'Worker stdout is not available');
    }

    if (this.worker.stderr) {
      this.worker.stderr.on('data', (data: Buffer) => {
        const output = data.toString().trim();
        if (output) {
          this.log('error', `[Server stderr] ${output}`);
        }
      });
    } else {
      this.log('warn', 'Worker stderr is not available');
    }

    // Handle worker exit
    this.worker.on('exit', (code: number) => {
      this.handleWorkerExit(code);
    });

    // Wait for ready signal
    await this.waitForWorkerReady();
  }

  /**
   * Wait for worker to send ready signal
   */
  private waitForWorkerReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Event server failed to start within timeout'));
      }, 10000);

      const handler = (msg: ServerToMainMessage) => {
        if (msg.type === 'ready') {
          clearTimeout(timeout);
          this.serverPort = msg.port || 3043;
          this.removeListener('worker-message', handler);
          resolve();
        }
      };

      this.on('worker-message', handler);
    });
  }

  /**
   * Handle messages from the worker
   */
  private async handleWorkerMessage(msg: ServerToMainMessage): Promise<void> {
    this.emit('worker-message', msg);

    try {
      if (msg.type === 'ready') {
        this.log('info', 'Event server is ready');
        return;
      }

      if (isWindowBroadcastMessage(msg)) {
        this.handleWindowBroadcast(msg);
      } else if (isGetTracesRequestMessage(msg)) {
        this.handleGetTracesRequest(msg);
      } else if (isGetRegistrationsRequestMessage(msg)) {
        this.handleGetRegistrationsRequest(msg);
      } else if (msg.type === 'SERVER_ERROR') {
        this.log('error', `Server error: ${msg.error}`);
        this.emit('server-error', new Error(msg.error));
      } else if (msg.type === 'SERVER_STATS') {
        this.emit('server-stats', msg.stats);
      }
    } catch (error) {
      this.log('error', `Error handling worker message: ${error}`);
    }
  }

  /**
   * Handle window broadcast requests from server
   */
  private handleWindowBroadcast(msg: WindowBroadcastMessage): void {
    const tracer = getTracer('principal-ade-main');
    const span = tracer.startSpan('event.window.broadcast');

    try {
      const windows = BrowserWindow.getAllWindows();
      windows.forEach((window) => {
        window.webContents.send(msg.channel, msg.data);
      });

      // Event: Window received session update broadcast
      span.addEvent('event.window.session_updated', {
        'session.id': (msg.data as { sessionId?: string })?.sessionId || '',
        'directory': (msg.data as { directory?: string })?.directory || '',
        'windows.count': windows.length,
      });

      span.setStatus({ code: SpanStatusCode.OK });
      this.log(
        'debug',
        `Broadcasted ${msg.channel} to ${windows.length} windows`,
      );
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : String(error) });
      this.log('error', `Window broadcast failed: ${error}`);
    } finally {
      span.end();
    }
  }

  /**
   * Handle GET_TRACES_REQUEST from the utility process
   */
  private handleGetTracesRequest(msg: GetTracesRequestMessage): void {
    const tracer = getTracer('principal-ade-main');
    const span = tracer.startSpan('otel.traces.http_request');

    try {
      const service = OtelCollectorService.getInstance();
      const allTraces = service.getTraces(msg.limit);

      let traces = allTraces;

      // If specific traceId requested, filter
      if (msg.traceId) {
        traces = allTraces.filter((t) => t.traceId === msg.traceId);
      }

      span.addEvent('otel.traces.fetched', {
        'traces.count': traces.length,
        'traces.limit': msg.limit || 50,
        'trace.id_filter': msg.traceId || '',
      });

      span.setStatus({ code: SpanStatusCode.OK });

      this.sendToWorker({
        type: 'GET_TRACES_RESPONSE',
        id: msg.id,
        timestamp: Date.now(),
        success: true,
        traces,
      });
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });

      this.sendToWorker({
        type: 'GET_TRACES_RESPONSE',
        id: msg.id,
        timestamp: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      span.end();
    }
  }

  /**
   * Handle GET_REGISTRATIONS_REQUEST from the utility process
   */
  private handleGetRegistrationsRequest(msg: GetRegistrationsRequestMessage): void {
    const tracer = getTracer('principal-ade-main');
    const span = tracer.startSpan('otel.registrations.http_request');

    try {
      const service = OtelCollectorService.getInstance();
      const registrations = service.getRegistrations();
      const services = service.getRegisteredServices();

      span.addEvent('otel.registrations.fetched', {
        'registrations.count': registrations.length,
        'services.count': services.length,
      });

      span.setStatus({ code: SpanStatusCode.OK });

      this.sendToWorker({
        type: 'GET_REGISTRATIONS_RESPONSE',
        id: msg.id,
        timestamp: Date.now(),
        success: true,
        registrations,
        services,
      });
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });

      this.sendToWorker({
        type: 'GET_REGISTRATIONS_RESPONSE',
        id: msg.id,
        timestamp: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      span.end();
    }
  }

  /**
   * Send message to worker
   */
  private sendToWorker(message: MainToServerMessage): void {
    if (!this.worker) {
      this.log('error', 'Cannot send message: worker not running');
      return;
    }

    try {
      this.worker.postMessage(message);
    } catch (error) {
      this.log('error', `Failed to send message to worker: ${error}`);
    }
  }

  /**
   * Handle worker exit
   */
  private handleWorkerExit(code: number): void {
    this.log('warn', `Event server worker exited with code ${code}`);

    this.isRunning = false;
    this.worker = null;
    this.serverPort = null;

    this.emit('stopped', code);

    // Attempt restart if configured and not shutting down
    if (
      this.config.restartOnCrash &&
      !this.shutdownRequested &&
      this.restartAttempts < this.config.maxRestartAttempts
    ) {
      this.restartAttempts++;
      this.log(
        'info',
        `Attempting to restart event server (attempt ${this.restartAttempts})`,
      );

      setTimeout(() => {
        this.start().catch((error) => {
          this.log('error', `Failed to restart event server: ${error}`);
        });
      }, 1000 * this.restartAttempts); // Exponential backoff
    }
  }

  /**
   * Stop the event processing server
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.worker) {
      this.log('debug', 'Event server not running');
      return;
    }

    this.log('info', 'Stopping event processing server...');
    this.shutdownRequested = true;

    // Send shutdown signal
    this.sendToWorker({
      type: 'SHUTDOWN',
      id: 'shutdown',
      timestamp: Date.now(),
    });

    // Give it time to shut down gracefully
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Force kill if still running
    if (this.worker) {
      this.worker.kill();
      this.worker = null;
    }

    this.isRunning = false;
    this.serverPort = null;

    this.log('info', 'Event processing server stopped');
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.serverPort,
      restartAttempts: this.restartAttempts,
    };
  }

  /**
   * Request server statistics
   */
  requestStats(): void {
    if (!this.isRunning) {
      this.log('warn', 'Cannot request stats: server not running');
      return;
    }

    this.sendToWorker({
      type: 'GET_STATS',
      id: 'stats-request',
      timestamp: Date.now(),
    });
  }

  /**
   * Logging utility
   */
  private log(level: string, message: string): void {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    if (messageLevelIndex >= currentLevelIndex) {
      const timestamp = new Date().toISOString();
      console.log(
        `[${timestamp}] [EventServerManager] [${level.toUpperCase()}] ${message}`,
      );
    }
  }
}

// Create and export a singleton instance
let eventServerManager: EventServerManager | null = null;

export function getEventServerManager(): EventServerManager {
  if (!eventServerManager) {
    eventServerManager = new EventServerManager({
      autoStart: false, // Don't start automatically - let initialization.ts control it
      restartOnCrash: true,
      maxRestartAttempts: 3,
      logLevel: process.env.DEBUG_EVENT_SERVER === 'true' ? 'debug' : 'info',
    });
  }
  return eventServerManager;
}

export async function startEventServer(): Promise<void> {
  const manager = getEventServerManager();
  await manager.start();
}

export async function stopEventServer(): Promise<void> {
  if (eventServerManager) {
    await eventServerManager.stop();
  }
}
