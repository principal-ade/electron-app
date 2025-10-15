/**
 * EventServerManager - Manages the event processing utility process from main
 * Handles storage requests and window broadcasts from the server
 */

import { app, utilityProcess, UtilityProcess, BrowserWindow } from 'electron';
import { EventEmitter } from 'events';
import * as path from 'path';

import { repositoryCache } from '../stores/RepositoryCache';

import {
  ServerToMainMessage,
  MainToServerMessage,
  ProcessedEventMessage,
  RepositoryInfoRequestMessage,
  WindowBroadcastMessage,
  isRepositoryInfoRequestMessage,
  isWindowBroadcastMessage,
  isProcessedEventMessage,
} from '../../event-processing-server/types';
import { AgentSessionSDKAPIEvents } from '../../shared/main-process-api-interfaces/AgentSessionSDKAPI';
import {
  getObservabilityIntegration,
  ObservabilityIntegration,
} from '../observability/ObservabilityIntegration';
import type { RepoNormalizedUniversalAgentSessionEvent } from '@principal-ai/agent-monitoring';

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
  private observability: ObservabilityIntegration | null = null;
  private observabilityInitialized = false;

  constructor(config: Partial<EventServerManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Set up observability integration
    this.setupObservability();

    if (this.config.autoStart) {
      this.start().catch((error) => {
        this.log('error', `Failed to auto-start event server: ${error}`);
      });
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

    try {
      this.log('info', 'Starting event processing server...');
      this.shutdownRequested = false;

      await this.spawnWorker();
      this.isRunning = true;
      this.restartAttempts = 0;

      this.log(
        'info',
        `Event processing server started on port ${this.serverPort}`,
      );
      this.emit('started', this.serverPort);
    } catch (error) {
      this.log('error', `Failed to start event server: ${error}`);
      throw error;
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
    this.log('info', `Received message from server: ${msg.type}`);
    this.emit('worker-message', msg);

    try {
      if (msg.type === 'ready') {
        this.log('info', 'Event server is ready');
        return;
      }

      if (isProcessedEventMessage(msg)) {
        await this.handleProcessedEvent(msg);
      } else if (isRepositoryInfoRequestMessage(msg)) {
        await this.handleRepositoryInfoRequest(msg);
      } else if (isWindowBroadcastMessage(msg)) {
        this.handleWindowBroadcast(msg);
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
   * Set up observability integration
   */
  private setupObservability(): void {
    // Get singleton instance but don't initialize yet
    this.observability = getObservabilityIntegration({
      debug: process.env.DEBUG_OBSERVABILITY === 'true',
    });

    // Listen for observability errors
    this.observability.on('error', (error) => {
      this.log('error', `Observability error: ${error}`);
    });

    // Listen for initialization events
    this.observability.on('initialized', () => {
      this.observabilityInitialized = true;
      this.log(
        'info',
        'Observability integration is now active and forwarding events',
      );
    });

    // Listen for shutdown events
    this.observability.on('shutdown', () => {
      this.observabilityInitialized = false;
      this.log('info', 'Observability integration has been shut down');
    });

    // Try to initialize if already configured
    this.tryInitializeObservability();
  }

  /**
   * Try to initialize observability if configured
   */
  private async tryInitializeObservability(): Promise<void> {
    try {
      // Check if already initialized
      if (this.observabilityInitialized) {
        return;
      }

      // Try to initialize (will only succeed if configured)
      await this.observability?.initialize();

      // Check if it actually initialized
      const stats = this.observability?.getStats();
      if (stats?.isInitialized) {
        this.observabilityInitialized = true;
        this.log('info', 'Observability integration initialized and ready');
      } else {
        this.log(
          'debug',
          'Observability not configured yet - waiting for configuration',
        );
      }
    } catch (error) {
      this.log('debug', `Observability not ready: ${error}`);
      // This is expected if not configured yet
    }
  }

  /**
   * Handle processed events from server
   */
  private async handleProcessedEvent(
    msg: ProcessedEventMessage,
  ): Promise<void> {
    // The event-processing-server sends RepoNormalizedUniversalAgentSessionEvent
    // but ProcessedEventMessage.event is typed as unknown for flexibility
    const repoNormalizedEvent = msg.event as RepoNormalizedUniversalAgentSessionEvent;

    // Validate session ID
    if (
      !repoNormalizedEvent.sessionId ||
      typeof repoNormalizedEvent.sessionId !== 'string' ||
      repoNormalizedEvent.sessionId.trim() === ''
    ) {
      this.log(
        'error',
        `Invalid session ID, skipping event: ${repoNormalizedEvent.sessionId}`,
      );
      return;
    }

    const normalizedSessionId = repoNormalizedEvent.sessionId.trim();

    // Step 1: Forward to observability SDK if initialized
    if (this.observabilityInitialized && this.observability) {
      this.observability
        .processRepoEvent(repoNormalizedEvent)
        .catch((error) => {
          this.log('error', `Failed to send event to observability: ${error}`);
        });
    }

    // Step 2: Emit event for SDK handlers and UI
    // The SDK handlers will maintain their own in-memory cache
    this.emit('processed-event', repoNormalizedEvent);

    // Step 3: Broadcast to windows for real-time updates
    const windows = BrowserWindow.getAllWindows();

    this.log('info', `=========== BROADCASTING EVENT TO WINDOWS ===========`);
    this.log('info', `Number of windows: ${windows.length}`);
    this.log('info', `Event type: ${repoNormalizedEvent.eventType}`);
    this.log('info', `Session ID: ${normalizedSessionId}`);
    this.log('info', `Tool name: ${repoNormalizedEvent.toolName}`);
    this.log('info', `Repository info: ${JSON.stringify(repoNormalizedEvent.repository)}`);

    // Determine if this is a new session (first event for this session)
    const isNewSession = repoNormalizedEvent.eventType === 'session-start';

    const eventName = isNewSession
      ? AgentSessionSDKAPIEvents.SESSION_CREATED
      : AgentSessionSDKAPIEvents.SESSION_UPDATED;

    this.log('info', `Sending event: ${eventName}`);
    this.log('info', `Also sending: ${AgentSessionSDKAPIEvents.PROCESSED_EVENT}`);

    windows.forEach((window, index) => {
      this.log('info', `Sending to window ${index + 1}/${windows.length}`);

      window.webContents.send(eventName, {
        sessionId: normalizedSessionId,
        repository:
          repoNormalizedEvent.repository?.root ||
          repoNormalizedEvent.workingDirectory,
      });

      // Also send the raw SDK event for components that need it
      window.webContents.send(
        AgentSessionSDKAPIEvents.PROCESSED_EVENT,
        repoNormalizedEvent,
      );

      this.log('info', `Successfully sent to window ${index + 1}`);
    });

    this.log(
      'info',
      `Processed and broadcast event for session: ${normalizedSessionId}`,
    );
    this.log('info', `=====================================================`);
  }

  /**
   * Handle repository info requests from server
   */
  private async handleRepositoryInfoRequest(
    msg: RepositoryInfoRequestMessage,
  ): Promise<void> {
    try {
      const repoInfo = await repositoryCache.getRepositoryForPath(
        msg.absolutePath,
      );

      let repositoryInfo = null;
      if (repoInfo?.gitInfo.root) {
        repositoryInfo = {
          root: repoInfo.gitInfo.root,
          remoteUrl: repoInfo.gitInfo.remoteUrl,
          owner: repoInfo.gitInfo.owner,
          repo: repoInfo.gitInfo.repo,
          branch: repoInfo.gitInfo.branch,
          headCommit: repoInfo.gitInfo.headCommit,
        };
      }

      this.sendToWorker({
        type: 'REPOSITORY_INFO_RESPONSE',
        id: msg.id,
        timestamp: Date.now(),
        repositoryInfo,
      });
    } catch (error) {
      this.sendToWorker({
        type: 'REPOSITORY_INFO_RESPONSE',
        id: msg.id,
        timestamp: Date.now(),
        repositoryInfo: null,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Handle window broadcast requests from server
   */
  private handleWindowBroadcast(msg: WindowBroadcastMessage): void {
    try {
      const windows = BrowserWindow.getAllWindows();
      windows.forEach((window) => {
        window.webContents.send(msg.channel, msg.data);
      });

      this.log(
        'debug',
        `Broadcasted ${msg.channel} to ${windows.length} windows`,
      );
    } catch (error) {
      this.log('error', `Window broadcast failed: ${error}`);
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
