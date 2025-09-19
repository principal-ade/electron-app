/**
 * AgentSessionEventProcessorV2 - New implementation using agent-monitoring pipeline
 *
 * This is a parallel implementation that uses the new AgentEventPipeline
 * while maintaining compatibility with existing storage and IPC interfaces.
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import { BrowserWindow } from 'electron';

import {
  SupportedAgent,
  NormalizedAgentSessionEvent,
  isToolEvent,
  isStopEvent,
  RepositoryInfo,
  PathNormalizationAdapter,
  SystemInfo,
  UniversalAgentSessionEvent,
  RepoNormalizedUniversalAgentSessionEvent,
  AgentEventPipeline,
  PipelineMetrics,
} from '@principal-ai/agent-monitoring';

import { EventMigrationHelper } from '../agent-monitoring-pipeline/EventMigrationHelper';
import { EventQueue } from './EventQueue';
import { AgentSessionAPIEvents } from '../../shared/main-process-api-interfaces/AgentSessionAPI';

import { StaticNamespaces } from '../storage-providers/types';
import { ProcessedSessionData } from '../storage-providers/typed-namespaces';
import { getTypedStorageManager } from '../storage-providers';
import { repositoryCache } from '../stores/RepositoryCache';

// Import centralized event processor for session state updates
import {
  sessionEventProcessor,
  SessionState,
} from '../../shared/event-processing/SessionEventProcessor';

// Import observability integration
import {
  getObservabilityIntegration,
  ObservabilityIntegration,
} from '../observability/ObservabilityIntegration';

/**
 * Node.js implementation of PathNormalizationAdapter
 */
class NodePathNormalizationAdapter implements PathNormalizationAdapter {
  constructor(
    private homeDir: string,
    private findRepositoryRoot: (
      absolutePath: string,
    ) => Promise<RepositoryInfo | null>,
  ) {}

  async getRawRepositoryInfo(
    absolutePath: string,
  ): Promise<RepositoryInfo | null> {
    const repoInfo = await this.findRepositoryRoot(absolutePath);
    // The repoInfo already contains headCommit from GitInfo if available
    return repoInfo;
  }

  getSystemInfo(): SystemInfo {
    const path = require('path');
    return {
      homeDir: this.homeDir,
      pathSeparator: path.sep,
      platform: process.platform as any,
    };
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
 * V2 Event Processor using the new pipeline
 */
export class AgentSessionEventProcessorV2 extends EventEmitter {
  private pipeline: AgentEventPipeline;
  private eventQueue: EventQueue;
  private processedEventCount = 0;
  private errorCount = 0;
  private observability: ObservabilityIntegration | null = null;

  constructor() {
    super();

    // Initialize event queue for serialized session writes
    this.eventQueue = new EventQueue();

    // Initialize observability integration
    this.initializeObservability();

    // Create the path normalization adapter
    const adapter = new NodePathNormalizationAdapter(
      os.homedir(),
      async (absolutePath: string): Promise<RepositoryInfo | null> => {
        try {
          const repoInfo =
            await repositoryCache.getRepositoryForPath(absolutePath);
          if (repoInfo?.gitInfo.root) {
            return {
              root: repoInfo.gitInfo.root,
              remoteUrl: repoInfo.gitInfo.remoteUrl,
              owner: repoInfo.gitInfo.owner,
              repo: repoInfo.gitInfo.repo,
              branch: repoInfo.gitInfo.branch,
              headCommit: repoInfo.gitInfo.headCommit,
            };
          }
        } catch (error) {
          console.error('[EventProcessorV2] Error finding repository:', error);
        }
        return null;
      },
    );

    // Create metrics for monitoring
    const metrics: PipelineMetrics = {
      onEventProcessed: (event, durationMs, agent) => {
        this.processedEventCount++;
        if (durationMs > 100) {
          console.warn(
            `[EventProcessorV2] Slow processing: ${durationMs}ms for ${agent} event`,
          );
        }
      },
      onError: (error, context) => {
        this.errorCount++;
        console.error(
          '[EventProcessorV2] Pipeline error:',
          error.message,
          context,
        );
      },
    };

    // Initialize the pipeline
    this.pipeline = new AgentEventPipeline(adapter, {
      logErrors: true,
      metrics,
    });

    console.log('[EventProcessorV2] Initialized with new pipeline');
  }

  /**
   * Initialize observability integration
   */
  private async initializeObservability(): Promise<void> {
    try {
      this.observability = getObservabilityIntegration({
        environment: (process.env.NODE_ENV as any) || 'development',
        debug: process.env.DEBUG_OBSERVABILITY === 'true',
        batchSize: 50,
        flushInterval: 15000, // 15 seconds
      });

      await this.observability.initialize();

      // Only set up listeners and log if actually initialized
      if (this.observability.getStats().isInitialized) {
        // Listen for observability errors
        this.observability.on('error', (error) => {
          console.error('[EventProcessorV2] Observability error:', error);
        });

        console.log('[EventProcessorV2] Observability integration initialized');
      } else {
        console.log(
          '[EventProcessorV2] Observability integration disabled (no database URL)',
        );
        // Clear the reference since it's not usable
        this.observability = null;
      }
    } catch (error) {
      console.error(
        '[EventProcessorV2] Failed to initialize observability:',
        error,
      );
      // Don't fail the entire processor if observability fails
      this.observability = null;
    }
  }

  /**
   * Process a raw event from a hook using the new pipeline
   */
  async processRawEvent(
    provider: SupportedAgent,
    rawData: unknown,
  ): Promise<NormalizedAgentSessionEvent> {
    try {
      // Validate raw data
      if (!rawData || typeof rawData !== 'object') {
        throw new Error('Invalid raw data: expected object');
      }

      // Step 1: Process through new pipeline
      const repoNormalizedEvent = await this.pipeline.processRawEvent(
        provider,
        rawData,
      );

      // Step 2: Convert to old format for compatibility
      // This already includes normalizedWorkingDirectory from the pipeline
      const normalizedEvent =
        EventMigrationHelper.fromRepoNormalizedFormat(repoNormalizedEvent);

      // Step 3: Log important events
      this.logEvent(normalizedEvent);

      // Step 4: Store the event (using existing storage format)
      await this.storeNormalizedEvent(normalizedEvent);

      // Step 5: Forward to observability SDK
      if (this.observability) {
        // Use the RepoNormalized event directly for better data quality
        this.observability
          .processRepoEvent(repoNormalizedEvent)
          .catch((error) => {
            console.error(
              '[EventProcessorV2] Failed to send event to observability:',
              error,
            );
          });
      }

      // Step 6: Emit for real-time listeners
      this.emit('event-processed', normalizedEvent);

      return normalizedEvent;
    } catch (error) {
      console.error('[EventProcessorV2] Error processing event:', error);
      throw error;
    }
  }

  /**
   * Log important events (same as V1)
   */
  private logEvent(event: NormalizedAgentSessionEvent): void {
    // Log conversation lifecycle events (check against string values since enum might have different values)
    if (event.eventType && event.eventType.toString().includes('start')) {
      console.log(
        `[EventProcessorV2] Session started: ${event.sessionId} in ${event.workingDirectory}`,
      );
    } else if (event.eventType && event.eventType.toString().includes('stop')) {
      console.log(`[EventProcessorV2] Session stopped: ${event.sessionId}`);
    }

    // Log tool usage
    if (isToolEvent(event) && event.toolName) {
      const fileCount = event.files?.length || 0;
      if (fileCount > 0) {
        console.log(
          `[EventProcessorV2] Tool ${event.toolName} accessed ${fileCount} file(s)`,
        );
      }
    }
  }

  /**
   * Store normalized event in AGENT_SESSIONS namespace
   * Uses EventQueue to serialize writes per session and prevent race conditions
   * (Identical to V1 implementation for compatibility)
   */
  private async storeNormalizedEvent(
    event: NormalizedAgentSessionEvent,
  ): Promise<void> {
    // Validate session ID
    if (
      !event.sessionId ||
      typeof event.sessionId !== 'string' ||
      event.sessionId.trim() === ''
    ) {
      console.error(
        '[EventProcessorV2] Invalid session ID, skipping event:',
        event.sessionId,
      );
      return;
    }

    // Normalize session ID (trim whitespace) for consistent storage key
    const normalizedSessionId = event.sessionId.trim();

    // Queue the storage operation for this session to prevent concurrent writes
    return this.eventQueue.enqueue(normalizedSessionId, async () => {
      try {
        const typedStore = await getTypedStorageManager();

        const sessionKey = normalizedSessionId;

        // Get or create session data
        const existingResult = await typedStore.get(
          sessionKey,
          StaticNamespaces.AGENT_SESSIONS,
        );

        let sessionData: ProcessedSessionData;

        if (existingResult.success && existingResult.data) {
          // Update existing session
          sessionData = existingResult.data;
          sessionData.events.push(event);
          sessionData.lastUpdateTime = event.timestamp;
        } else {
          // Create new session with normalized session ID
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

          // Emit SESSION_CREATED event to notify UI
          this.emitSessionCreatedEvent(
            normalizedSessionId,
            event.workingDirectory,
          );
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
        const processingResult = sessionEventProcessor.processEvent(
          event,
          currentState,
        );

        // Update session data with processing results
        if (processingResult.session) {
          sessionData.totalEvents =
            processingResult.session.eventCount || sessionData.totalEvents;
          sessionData.counters = {
            fileAccesses:
              processingResult.session.fileAccessCount ||
              sessionData.counters?.fileAccesses ||
              0,
            fileWrites:
              processingResult.session.fileWriteCount ||
              sessionData.counters?.fileWrites ||
              0,
            toolCalls:
              processingResult.session.toolCallCount ||
              sessionData.counters?.toolCalls ||
              0,
            webAccesses:
              processingResult.session.webAccessCount ||
              sessionData.counters?.webAccesses ||
              0,
          };
          sessionData.fileAccesses =
            processingResult.session.fileAccesses || sessionData.fileAccesses;
          sessionData.fileWrites =
            processingResult.session.fileWrites || sessionData.fileWrites;
          sessionData.filesRead =
            processingResult.session.filesRead || sessionData.filesRead;
          sessionData.filesWritten =
            processingResult.session.filesWritten || sessionData.filesWritten;

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
          // Note: endTime property may not exist in ProcessedSessionData
          console.log(
            `[EventProcessorV2] Session ended: ${normalizedSessionId}`,
          );
        }

        // Store updated session data
        const storeResult = await typedStore.set(
          sessionKey,
          sessionData,
          StaticNamespaces.AGENT_SESSIONS,
        );

        if (!storeResult.success) {
          throw new Error(`Failed to store session data: ${storeResult.error}`);
        }

        // Emit SESSION_UPDATED event
        this.emitSessionUpdatedEvent(
          normalizedSessionId,
          event.workingDirectory,
        );
      } catch (error) {
        console.error('[EventProcessorV2] Error storing event:', error);
        throw error;
      }
    });
  }

  /**
   * Emit session created event to notify UI
   */
  private emitSessionCreatedEvent(
    sessionId: string,
    workingDirectory: string,
  ): void {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
      window.webContents.send(AgentSessionAPIEvents.SESSION_CREATED, {
        sessionId,
        directory: workingDirectory,
      });
    });
  }

  /**
   * Emit session updated event to notify UI
   */
  private emitSessionUpdatedEvent(
    sessionId: string,
    workingDirectory: string,
  ): void {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
      window.webContents.send(AgentSessionAPIEvents.SESSION_UPDATED, {
        sessionId,
        directory: workingDirectory,
      });
    });
  }

  /**
   * Test-only method: Process event through pipeline without storing or emitting
   * Used for parallel testing to validate the pipeline works
   */
  async processRawEventTestOnly(
    provider: SupportedAgent,
    rawData: unknown,
  ): Promise<NormalizedAgentSessionEvent> {
    try {
      // Validate raw data
      if (!rawData || typeof rawData !== 'object') {
        throw new Error('Invalid raw data: expected object');
      }

      // Step 1: Process through new pipeline
      const repoNormalizedEvent = await this.pipeline.processRawEvent(
        provider,
        rawData,
      );

      // Step 2: Convert to old format for compatibility
      const normalizedEvent =
        EventMigrationHelper.fromRepoNormalizedFormat(repoNormalizedEvent);

      // That's it! Don't store, don't emit, just return for testing
      return normalizedEvent;
    } catch (error) {
      // Re-throw with context
      throw new Error(`V2 test processing failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get statistics about processed events
   */
  getStats() {
    return {
      processedEvents: this.processedEventCount,
      errors: this.errorCount,
      pipelineInfo: this.pipeline.getInfo(),
      observability: this.observability?.getStats(),
    };
  }

  /**
   * Shutdown the event processor and observability
   */
  async shutdown(): Promise<void> {
    try {
      // Shutdown observability integration
      if (this.observability) {
        await this.observability.shutdown();
        console.log('[EventProcessorV2] Observability shutdown complete');
      }

      // Cleanup other resources if needed
      this.removeAllListeners();
      console.log('[EventProcessorV2] Shutdown complete');
    } catch (error) {
      console.error('[EventProcessorV2] Error during shutdown:', error);
    }
  }
}
