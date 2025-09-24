/**
 * EventProcessingServer - Long-running server for processing agent session events
 * Runs in a utility process and communicates with main process via IPC
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import { machineIdSync } from 'node-machine-id';
import {
  isToolEvent,
  isStopEvent,
  RepositoryInfo,
  PathNormalizationAdapter,
  SystemInfo,
  AgentEventPipeline,
  PipelineMetrics,
} from '@principal-ai/agent-monitoring';
import { NormalizedAgentSessionEvent } from '../shared/types/legacy-event.types';

import { EventMigrationHelper } from '../main/agent-monitoring-pipeline/EventMigrationHelper';
import { EventQueue } from '../main/agent-session-events/EventQueue';

import {
  EventProcessingServerConfig,
  DEFAULT_CONFIG,
  PendingRequest,
  ServerStats,
  ProcessEventMessage,
  StorageRequestMessage,
  RepositoryInfoRequestMessage,
  WindowBroadcastMessage,
  ProcessingCompleteMessage,
  ServerStatsMessage,
  ServerErrorMessage,
  createStorageRequestMessage,
  createRepositoryInfoRequestMessage,
  createWindowBroadcastMessage,
  createProcessingCompleteMessage,
  MainToServerMessage,
  ServerToMainMessage,
  isProcessEventMessage,
} from './types';

// Import centralized event processor for session state updates
import {
  sessionEventProcessor,
  SessionState,
} from '../shared/event-processing/SessionEventProcessor';

// Import observability integration types (will be implemented later)
// import { ObservabilityIntegration } from '../main/observability/ObservabilityIntegration';

/**
 * Server-side implementation of PathNormalizationAdapter
 * Makes requests to main process for repository information
 */
class ServerPathNormalizationAdapter implements PathNormalizationAdapter {
  constructor(
    private homeDir: string,
    private requestRepositoryInfo: (absolutePath: string) => Promise<RepositoryInfo | null>
  ) {}

  async getRawRepositoryInfo(absolutePath: string): Promise<RepositoryInfo | null> {
    return this.requestRepositoryInfo(absolutePath);
  }

  getSystemInfo(): SystemInfo {
    const path = require('path');
    return {
      homeDir: this.homeDir,
      pathSeparator: path.sep,
      platform: process.platform as any,
      machineId: this.getMachineId(),
      hostname: os.hostname(),
    };
  }

  private getMachineId(): string {
    try {
      return machineIdSync();
    } catch (error) {
      console.error('Failed to get machine ID:', error);
      // Fallback to a generated ID based on hostname and platform
      const crypto = require('crypto');
      const hostname = os.hostname();
      const platform = process.platform;
      return crypto.createHash('sha256').update(`${hostname}-${platform}`).digest('hex');
    }
  }

  resolvePath(relativePath: string, workingDirectory: string): string {
    const path = require('path');
    return path.resolve(workingDirectory, relativePath);
  }

  isAbsolutePath(filePath: string): boolean {
    const path = require('path');
    return path.isAbsolute(filePath);
  }

  getRelativePath(fromPath: string, toPath: string): string {
    const path = require('path');
    return path.relative(fromPath, toPath);
  }

  isAvailable(): boolean {
    return true;
  }
}

/**
 * Main Event Processing Server class
 */
export class EventProcessingServer extends EventEmitter {
  private config: EventProcessingServerConfig;
  private pipeline: AgentEventPipeline;
  private eventQueue: EventQueue;
  private sendToMain: (message: ServerToMainMessage) => void;

  // Statistics tracking
  private startTime: number;
  private processedEventCount = 0;
  private errorCount = 0;
  private totalProcessingTime = 0;
  private lastProcessedEvent?: number;

  // Request management
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestCounter = 0;

  constructor(
    sendToMain: (message: ServerToMainMessage) => void,
    config: Partial<EventProcessingServerConfig> = {}
  ) {
    super();

    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sendToMain = sendToMain;
    this.startTime = Date.now();

    // Initialize event queue for serialized session writes
    this.eventQueue = new EventQueue();

    this.log('info', 'EventProcessingServer initializing...');
    this.setupPipeline();
    this.startStatsReporting();

    this.log('info', 'EventProcessingServer initialized successfully');
  }

  /**
   * Set up the event processing pipeline
   */
  private setupPipeline(): void {
    // Create the path normalization adapter that communicates with main process
    const adapter = new ServerPathNormalizationAdapter(
      os.homedir(),
      async (absolutePath: string): Promise<RepositoryInfo | null> => {
        return this.requestRepositoryInfo(absolutePath);
      }
    );

    // Create metrics for monitoring
    const metrics: PipelineMetrics = {
      onEventProcessed: (event, durationMs, agent) => {
        this.processedEventCount++;
        this.totalProcessingTime += durationMs;
        this.lastProcessedEvent = Date.now();

        if (durationMs > 100) {
          this.log('warn', `Slow processing: ${durationMs}ms for ${agent} event`);
        }
      },
      onError: (error, context) => {
        this.errorCount++;
        this.log('error', `Pipeline error: ${error.message}`, context);
      },
    };

    // Initialize the pipeline
    this.pipeline = new AgentEventPipeline(adapter, {
      logErrors: true,
      metrics,
    });

    this.log('info', 'Event processing pipeline initialized');
  }

  /**
   * Handle incoming messages from main process
   */
  async handleMessage(message: MainToServerMessage): Promise<void> {
    try {
      this.log('debug', `Received message: ${message.type}`);

      if (isProcessEventMessage(message)) {
        await this.handleProcessEvent(message);
      } else {
        switch (message.type) {
          case 'STORAGE_RESPONSE':
            this.handleStorageResponse(message);
            break;
          case 'REPOSITORY_INFO_RESPONSE':
            this.handleRepositoryInfoResponse(message);
            break;
          case 'SHUTDOWN':
            await this.handleShutdown();
            break;
          case 'PING':
            this.handlePing(message);
            break;
          case 'GET_STATS':
            this.handleGetStats(message);
            break;
          default:
            this.log('warn', `Unknown message type: ${(message as any).type}`);
        }
      }
    } catch (error) {
      this.log('error', `Error handling message: ${error}`);
      this.sendErrorMessage(message.id, error as Error);
    }
  }

  /**
   * Process an event through the pipeline
   */
  private async handleProcessEvent(message: ProcessEventMessage): Promise<void> {
    const startTime = Date.now();

    try {
      this.log('debug', `Processing event from ${message.provider}`);

      // Validate raw data
      if (!message.rawData || typeof message.rawData !== 'object') {
        throw new Error('Invalid raw data: expected object');
      }

      // Step 1: Process through pipeline
      const repoNormalizedEvent = await this.pipeline.processRawEvent(
        message.provider,
        message.rawData
      );

      // Step 2: Convert to old format for compatibility
      const normalizedEvent = EventMigrationHelper.fromRepoNormalizedFormat(repoNormalizedEvent);

      // Step 3: Log important events
      this.logEvent(normalizedEvent);

      // Step 4: Store the event (via main process)
      await this.storeNormalizedEvent(normalizedEvent);

      // Step 5: Emit window updates (via main process)
      await this.emitSessionEvents(normalizedEvent);

      // Step 6: Send completion message
      const duration = Date.now() - startTime;
      this.sendToMain(createProcessingCompleteMessage(
        message.id,
        true,
        normalizedEvent
      ));

      this.log('info', `Event processed successfully in ${duration}ms`);

    } catch (error) {
      const duration = Date.now() - startTime;
      this.log('error', `Event processing failed after ${duration}ms: ${error}`);

      this.sendToMain(createProcessingCompleteMessage(
        message.id,
        false,
        undefined,
        (error as Error).message
      ));
    }
  }

  /**
   * Request repository information from main process
   */
  private requestRepositoryInfo(absolutePath: string): Promise<RepositoryInfo | null> {
    return this.makeRequest('REPOSITORY_INFO_REQUEST', {
      absolutePath
    });
  }

  /**
   * Request storage operation from main process
   */
  private requestStorage(operation: 'GET' | 'SET', key: string, namespace: string, data?: any): Promise<any> {
    return this.makeRequest('STORAGE_REQUEST', {
      operation,
      key,
      namespace,
      data
    });
  }

  /**
   * Generic request handler with timeout and promise management
   */
  private makeRequest(type: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.generateRequestId();

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${type}`));
      }, this.config.requestTimeoutMs);

      // Store pending request
      this.pendingRequests.set(id, {
        id,
        timestamp: Date.now(),
        resolve,
        reject,
        timeoutHandle
      });

      // Send request
      const message = {
        type,
        id,
        timestamp: Date.now(),
        ...data
      } as ServerToMainMessage;

      this.sendToMain(message);
    });
  }

  /**
   * Handle storage response from main process
   */
  private handleStorageResponse(message: any): void {
    const pending = this.pendingRequests.get(message.id);
    if (!pending) {
      this.log('warn', `Received storage response for unknown request: ${message.id}`);
      return;
    }

    // Clear timeout
    if (pending.timeoutHandle) {
      clearTimeout(pending.timeoutHandle);
    }
    this.pendingRequests.delete(message.id);

    // Resolve or reject
    if (message.success) {
      pending.resolve(message.data);
    } else {
      pending.reject(new Error(message.error || 'Storage operation failed'));
    }
  }

  /**
   * Handle repository info response from main process
   */
  private handleRepositoryInfoResponse(message: any): void {
    const pending = this.pendingRequests.get(message.id);
    if (!pending) {
      this.log('warn', `Received repository info response for unknown request: ${message.id}`);
      return;
    }

    // Clear timeout
    if (pending.timeoutHandle) {
      clearTimeout(pending.timeoutHandle);
    }
    this.pendingRequests.delete(message.id);

    // Resolve with repository info or null
    if (message.error) {
      this.log('warn', `Repository info request failed: ${message.error}`);
      pending.resolve(null);
    } else {
      pending.resolve(message.repositoryInfo);
    }
  }

  /**
   * Log important events (same as V2)
   */
  private logEvent(event: NormalizedAgentSessionEvent): void {
    // Log conversation lifecycle events
    if (event.eventType && event.eventType.toString().includes('start')) {
      this.log('info', `Session started: ${event.sessionId} in ${event.workingDirectory}`);
    } else if (event.eventType && event.eventType.toString().includes('stop')) {
      this.log('info', `Session stopped: ${event.sessionId}`);
    }

    // Log tool usage
    if (isToolEvent(event) && event.toolName) {
      const fileCount = event.files?.length || 0;
      if (fileCount > 0) {
        this.log('info', `Tool ${event.toolName} accessed ${fileCount} file(s)`);
      }
    }
  }

  /**
   * Store normalized event via main process storage API
   */
  private async storeNormalizedEvent(event: NormalizedAgentSessionEvent): Promise<void> {
    // Validate session ID
    if (!event.sessionId || typeof event.sessionId !== 'string' || event.sessionId.trim() === '') {
      this.log('error', `Invalid session ID, skipping event: ${event.sessionId}`);
      return;
    }

    const normalizedSessionId = event.sessionId.trim();

    // Queue the storage operation for this session to prevent concurrent writes
    return this.eventQueue.enqueue(normalizedSessionId, async () => {
      try {
        const sessionKey = normalizedSessionId;

        // Get existing session data
        const existingData = await this.requestStorage('GET', sessionKey, 'AGENT_SESSIONS');

        let sessionData: any;

        if (existingData) {
          // Update existing session
          sessionData = existingData;
          sessionData.events.push(event);
          sessionData.lastUpdateTime = event.timestamp;
        } else {
          // Create new session
          sessionData = {
            sessionId: normalizedSessionId,
            provider: event.provider,
            workingDirectory: event.workingDirectory,
            startTime: event.timestamp,
            lastUpdateTime: event.timestamp,
            events: [event],
            totalEvents: 0,
            repositoriesAccessed: [],
            counters: {
              fileAccesses: 0,
              fileWrites: 0,
              toolCalls: 0,
              webAccesses: 0,
            },
            fileAccesses: {},
            fileWrites: {},
            filesRead: [],
            filesWritten: [],
            metadata: {},
          };
        }

        // Use centralized event processor for consistent processing
        const currentState: SessionState = {
          sessionId: sessionData.sessionId,
          workingDirectory: sessionData.workingDirectory,
          firstAccess: sessionData.startTime || Date.now(),
          lastActivity: sessionData.lastUpdateTime || Date.now(),
          eventCount: sessionData.totalEvents || 0,
          isActive: true,
          fileAccessCount: sessionData.counters?.fileAccesses || 0,
          fileWriteCount: sessionData.counters?.fileWrites || 0,
          fileAccesses: sessionData.fileAccesses || {},
          fileWrites: sessionData.fileWrites || {},
          filesRead: sessionData.filesRead || [],
          filesWritten: sessionData.filesWritten || [],
          toolCallCount: sessionData.counters?.toolCalls || 0,
          webAccessCount: sessionData.counters?.webAccesses || 0,
        };

        // Process event through centralized processor
        const processingResult = sessionEventProcessor.processEvent(event, currentState);

        // Update session data with processing results
        if (processingResult.session) {
          sessionData.totalEvents = processingResult.session.eventCount || sessionData.totalEvents;
          sessionData.counters = {
            fileAccesses: processingResult.session.fileAccessCount || sessionData.counters?.fileAccesses || 0,
            fileWrites: processingResult.session.fileWriteCount || sessionData.counters?.fileWrites || 0,
            toolCalls: processingResult.session.toolCallCount || sessionData.counters?.toolCalls || 0,
            webAccesses: processingResult.session.webAccessCount || sessionData.counters?.webAccesses || 0,
          };
          sessionData.fileAccesses = processingResult.session.fileAccesses || sessionData.fileAccesses;
          sessionData.fileWrites = processingResult.session.fileWrites || sessionData.fileWrites;
          sessionData.filesRead = processingResult.session.filesRead || sessionData.filesRead;
          sessionData.filesWritten = processingResult.session.filesWritten || sessionData.filesWritten;

          // Handle todos if present in metadata
          if (processingResult.session.metadata?.lastTodos) {
            sessionData.metadata = {
              ...sessionData.metadata,
              lastTodos: processingResult.session.metadata.lastTodos,
            };
          }
        }

        // Handle stop events
        if (isStopEvent(event)) {
          this.log('info', `Session ended: ${normalizedSessionId}`);
        }

        // Store updated session data
        await this.requestStorage('SET', sessionKey, 'AGENT_SESSIONS', sessionData);

      } catch (error) {
        this.log('error', `Error storing event: ${error}`);
        throw error;
      }
    });
  }

  /**
   * Emit session events via main process
   */
  private async emitSessionEvents(event: NormalizedAgentSessionEvent): Promise<void> {
    const normalizedSessionId = event.sessionId.trim();

    // Send window broadcast messages
    this.sendToMain(createWindowBroadcastMessage('SESSION_UPDATED', {
      sessionId: normalizedSessionId,
      directory: event.workingDirectory,
    }));
  }

  /**
   * Handle shutdown request
   */
  private async handleShutdown(): Promise<void> {
    this.log('info', 'Shutdown requested');

    // Cancel all pending requests
    for (const [id, pending] of this.pendingRequests.entries()) {
      if (pending.timeoutHandle) {
        clearTimeout(pending.timeoutHandle);
      }
      pending.reject(new Error('Server shutting down'));
    }
    this.pendingRequests.clear();

    // Cleanup other resources
    this.removeAllListeners();

    this.log('info', 'EventProcessingServer shutdown complete');
    process.exit(0);
  }

  /**
   * Handle ping request
   */
  private handlePing(message: any): void {
    this.sendToMain({
      type: 'SERVER_STATS',
      id: message.id,
      timestamp: Date.now(),
      stats: this.getStats()
    });
  }

  /**
   * Handle get stats request
   */
  private handleGetStats(message: any): void {
    this.sendToMain({
      type: 'SERVER_STATS',
      id: message.id,
      timestamp: Date.now(),
      stats: this.getStats()
    });
  }

  /**
   * Send error message to main process
   */
  private sendErrorMessage(requestId: string, error: Error): void {
    this.sendToMain({
      type: 'SERVER_ERROR',
      id: requestId,
      timestamp: Date.now(),
      error: error.message,
      context: { stack: error.stack }
    });
  }

  /**
   * Start periodic stats reporting
   */
  private startStatsReporting(): void {
    if (this.config.statsReportingIntervalMs > 0) {
      setInterval(() => {
        this.sendToMain({
          type: 'SERVER_STATS',
          id: this.generateRequestId(),
          timestamp: Date.now(),
          stats: this.getStats()
        });
      }, this.config.statsReportingIntervalMs);
    }
  }

  /**
   * Get server statistics
   */
  private getStats(): ServerStats {
    return {
      processedEvents: this.processedEventCount,
      errors: this.errorCount,
      uptime: Date.now() - this.startTime,
      memoryUsage: process.memoryUsage(),
      pendingRequests: this.pendingRequests.size,
      averageProcessingTime: this.processedEventCount > 0 ? this.totalProcessingTime / this.processedEventCount : 0,
      lastProcessedEvent: this.lastProcessedEvent
    };
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${Date.now()}-${++this.requestCounter}`;
  }

  /**
   * Logging utility
   */
  private log(level: string, message: string, context?: any): void {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    if (messageLevelIndex >= currentLevelIndex) {
      const timestamp = new Date().toISOString();
      const contextStr = context ? ` ${JSON.stringify(context)}` : '';
      console.log(`[${timestamp}] [EventProcessingServer] [${level.toUpperCase()}] ${message}${contextStr}`);
    }
  }
}