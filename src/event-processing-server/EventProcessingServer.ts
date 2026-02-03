/**
 * EventProcessingServer - Long-running server for processing agent session events
 * Runs in a utility process and communicates with main process via IPC
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import * as path from 'path';
import { machineIdSync } from 'node-machine-id';
import simpleGit, { SimpleGit } from 'simple-git';
import {
  RepositoryInfo,
  PathNormalizationAdapter,
  SystemInfo,
  AgentEventPipeline,
  PipelineMetrics,
  RepoNormalizedUniversalAgentSessionEvent,
} from '@principal-ai/agent-monitoring';

import {
  EventProcessingServerConfig,
  DEFAULT_CONFIG,
  PendingRequest,
  ServerStats,
  ProcessEventMessage,
  StorageResponseMessage,
  PingMessage,
  GetStatsMessage,
  createWindowBroadcastMessage,
  createProcessingCompleteMessage,
  MainToServerMessage,
  ServerToMainMessage,
  isProcessEventMessage,
} from './types';

// Import centralized event processor for session state updates

// Import observability integration types (will be implemented later)
// import { ObservabilityIntegration } from '../main/observability/ObservabilityIntegration';

/**
 * Simple LRU-style cache for git repository information
 * Caches by git root to avoid repeated lookups for files in the same repo
 */
class GitRepoCache {
  // Map from git root path to repository info
  private repoCache = new Map<string, RepositoryInfo>();
  // Map from directory path to git root (or null if not in a repo)
  private dirToRootCache = new Map<string, string | null>();

  /**
   * Get repository info for an absolute path
   * Uses caching to avoid repeated git lookups
   */
  async getRepoInfo(absolutePath: string): Promise<RepositoryInfo | null> {
    const dir = path.dirname(absolutePath);

    // Check if we already know the git root for this directory
    const directCacheHit = this.dirToRootCache.get(dir);
    if (directCacheHit !== undefined) {
      if (directCacheHit === null) return null;
      return this.repoCache.get(directCacheHit) || null;
    }

    // Walk up to check if any parent is already cached
    let checkDir = dir;
    while (checkDir !== path.dirname(checkDir)) {
      const parentCacheHit = this.dirToRootCache.get(checkDir);
      if (parentCacheHit !== undefined) {
        // Cache the original dir pointing to same root
        this.dirToRootCache.set(dir, parentCacheHit);
        if (parentCacheHit === null) return null;
        return this.repoCache.get(parentCacheHit) || null;
      }
      checkDir = path.dirname(checkDir);
    }

    // Cache miss - do the git lookup
    try {
      const info = await this.lookupGitInfo(dir);
      if (info) {
        this.repoCache.set(info.root, info);
        this.dirToRootCache.set(dir, info.root);
      } else {
        this.dirToRootCache.set(dir, null);
      }
      return info;
    } catch (error) {
      console.error('[GitRepoCache] Error looking up git info:', error);
      this.dirToRootCache.set(dir, null);
      return null;
    }
  }

  /**
   * Perform actual git lookup for a directory
   */
  private async lookupGitInfo(dir: string): Promise<RepositoryInfo | null> {
    try {
      const git: SimpleGit = simpleGit(dir);

      const isRepo = await git.checkIsRepo();
      if (!isRepo) return null;

      const root = (await git.revparse(['--show-toplevel'])).trim();
      const remotes = await git.getRemotes(true);
      const originRemote = remotes.find(
        (r: { name: string }) => r.name === 'origin',
      );

      let owner: string | undefined;
      let repo: string | undefined;
      const remoteUrl = originRemote?.refs?.fetch;

      // Parse owner/repo from remote URL
      if (remoteUrl) {
        const parsed = this.parseGitRemoteUrl(remoteUrl);
        owner = parsed.owner;
        repo = parsed.repo;
      }

      return {
        root,
        remoteUrl,
        owner,
        repo,
      };
    } catch (_error) {
      // Not a git repo or git not available
      return null;
    }
  }

  /**
   * Parse owner and repo from a git remote URL
   */
  private parseGitRemoteUrl(url: string): { owner?: string; repo?: string } {
    // Handle SSH format: git@github.com:owner/repo.git
    const sshMatch = url.match(/git@[^:]+:([^/]+)\/(.+?)(?:\.git)?$/);
    if (sshMatch) {
      return { owner: sshMatch[1], repo: sshMatch[2] };
    }

    // Handle HTTPS format: https://github.com/owner/repo.git
    const httpsMatch = url.match(/https?:\/\/[^/]+\/([^/]+)\/(.+?)(?:\.git)?$/);
    if (httpsMatch) {
      return { owner: httpsMatch[1], repo: httpsMatch[2] };
    }

    return {};
  }

  /**
   * Clear the cache (useful for testing or if repos change)
   */
  clear(): void {
    this.repoCache.clear();
    this.dirToRootCache.clear();
  }

  /**
   * Get cache stats for debugging
   */
  getStats(): { repoCacheSize: number; dirCacheSize: number } {
    return {
      repoCacheSize: this.repoCache.size,
      dirCacheSize: this.dirToRootCache.size,
    };
  }
}

/**
 * Server-side implementation of PathNormalizationAdapter
 * Uses local GitRepoCache instead of IPC to main process
 */
class ServerPathNormalizationAdapter implements PathNormalizationAdapter {
  constructor(
    private homeDir: string,
    private gitRepoCache: GitRepoCache,
  ) {}

  async getRawRepositoryInfo(
    absolutePath: string,
  ): Promise<RepositoryInfo | null> {
    return this.gitRepoCache.getRepoInfo(absolutePath);
  }

  getSystemInfo(): SystemInfo {
    const path = require('path');
    return {
      homeDir: this.homeDir,
      pathSeparator: path.sep,
      platform: process.platform,
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
      return crypto
        .createHash('sha256')
        .update(`${hostname}-${platform}`)
        .digest('hex');
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
  private sendToMain: (message: ServerToMainMessage) => void;

  // Statistics tracking
  private startTime: number;
  private processedEventCount = 0;
  private errorCount = 0;
  private totalProcessingTime = 0;
  private lastProcessedEvent?: number;
  private pipeline!: AgentEventPipeline;

  // Git repository cache for fast lookups
  private gitRepoCache: GitRepoCache;

  // Request management
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestCounter = 0;

  constructor(
    sendToMain: (message: ServerToMainMessage) => void,
    config: Partial<EventProcessingServerConfig> = {},
  ) {
    super();

    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sendToMain = sendToMain;
    this.startTime = Date.now();

    // Initialize git repo cache for fast lookups
    this.gitRepoCache = new GitRepoCache();

    // Initialize event queue for serialized session writes
    this.log('info', 'EventProcessingServer initializing...');
    this.setupPipeline();
    this.startStatsReporting();

    this.log('info', 'EventProcessingServer initialized successfully');
  }

  /**
   * Set up the event processing pipeline
   */
  private setupPipeline(): void {
    // Create the path normalization adapter with local git cache
    const adapter = new ServerPathNormalizationAdapter(
      os.homedir(),
      this.gitRepoCache,
    );

    // Create metrics for monitoring
    const metrics: PipelineMetrics = {
      onEventProcessed: (event, durationMs, agent) => {
        this.processedEventCount++;
        this.totalProcessingTime += durationMs;
        this.lastProcessedEvent = Date.now();

        if (durationMs > 100) {
          this.log(
            'warn',
            `Slow processing: ${durationMs}ms for ${agent} event`,
          );
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
            this.log('warn', 'Unknown message type received');
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
  private async handleProcessEvent(
    message: ProcessEventMessage,
  ): Promise<void> {
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
        message.rawData,
      );

      // Step 2: Log important events
      this.logEvent(repoNormalizedEvent);

      // Step 3: Emit window updates (via main process)
      await this.emitSessionEvents(repoNormalizedEvent);

      // Step 4: Send completion message
      const duration = Date.now() - startTime;
      this.sendToMain(
        createProcessingCompleteMessage(message.id, true, repoNormalizedEvent),
      );

      this.log('info', `Event processed successfully in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log(
        'error',
        `Event processing failed after ${duration}ms: ${error}`,
      );

      this.sendToMain(
        createProcessingCompleteMessage(
          message.id,
          false,
          undefined,
          (error as Error).message,
        ),
      );
    }
  }

  /**
   * Generic request handler with timeout and promise management
   */
  private makeRequest(
    type: string,
    data: Record<string, unknown>,
  ): Promise<unknown> {
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
        timeoutHandle,
      });

      // Send request
      const message = {
        type,
        id,
        timestamp: Date.now(),
        ...data,
      } as ServerToMainMessage;

      this.sendToMain(message);
    });
  }

  /**
   * Handle storage response from main process
   */
  private handleStorageResponse(message: StorageResponseMessage): void {
    const pending = this.pendingRequests.get(message.id);
    if (!pending) {
      this.log(
        'warn',
        `Received storage response for unknown request: ${message.id}`,
      );
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
   * Log important events (same as V2)
   */
  private logEvent(event: RepoNormalizedUniversalAgentSessionEvent): void {
    // Log conversation lifecycle events
    if (event.eventType && event.eventType.toString().includes('start')) {
      this.log(
        'info',
        `Session started: ${event.sessionId} in ${event.workingDirectory}`,
      );
    } else if (event.eventType && event.eventType.toString().includes('stop')) {
      this.log('info', `Session stopped: ${event.sessionId}`);
    }

    // Log tool usage
    if (event.toolName) {
      const fileCount = event.files?.length || 0;
      if (fileCount > 0) {
        this.log(
          'info',
          `Tool ${event.toolName} accessed ${fileCount} file(s)`,
        );
      }
    }
  }

  /**
   * Emit session events via main process
   */
  private async emitSessionEvents(
    event: RepoNormalizedUniversalAgentSessionEvent,
  ): Promise<void> {
    const normalizedSessionId = event.sessionId.trim();

    // Send window broadcast messages
    this.sendToMain(
      createWindowBroadcastMessage('SESSION_UPDATED', {
        sessionId: normalizedSessionId,
        directory: event.workingDirectory,
      }),
    );
  }

  /**
   * Handle shutdown request
   */
  private async handleShutdown(): Promise<void> {
    this.log('info', 'Shutdown requested');

    // Cancel all pending requests
    for (const pending of this.pendingRequests.values()) {
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
  private handlePing(message: PingMessage): void {
    this.sendToMain({
      type: 'SERVER_STATS',
      id: message.id,
      timestamp: Date.now(),
      stats: this.getStats(),
    });
  }

  /**
   * Handle get stats request
   */
  private handleGetStats(message: GetStatsMessage): void {
    this.sendToMain({
      type: 'SERVER_STATS',
      id: message.id,
      timestamp: Date.now(),
      stats: this.getStats(),
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
      context: { stack: error.stack },
    });
  }

  /**
   * Start periodic stats reporting
   */
  private startStatsReporting(): void {
    const interval =
      this.config.statsReportingIntervalMs ??
      DEFAULT_CONFIG.statsReportingIntervalMs;

    if (interval > 0) {
      setInterval(() => {
        this.sendToMain({
          type: 'SERVER_STATS',
          id: this.generateRequestId(),
          timestamp: Date.now(),
          stats: this.getStats(),
        });
      }, interval);
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
      averageProcessingTime:
        this.processedEventCount > 0
          ? this.totalProcessingTime / this.processedEventCount
          : 0,
      lastProcessedEvent: this.lastProcessedEvent,
      gitCache: this.gitRepoCache.getStats(),
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
  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: unknown,
  ): void {
    const levels: Array<'debug' | 'info' | 'warn' | 'error'> = [
      'debug',
      'info',
      'warn',
      'error',
    ];
    const configuredLevel = this.config.logLevel ?? 'info';
    const currentLevelIndex = levels.indexOf(configuredLevel);
    const messageLevelIndex = levels.indexOf(level);

    if (messageLevelIndex >= currentLevelIndex) {
      const timestamp = new Date().toISOString();
      const contextStr = context ? ` ${JSON.stringify(context)}` : '';
      const formattedMessage = `[${timestamp}] [EventProcessingServer] [${level.toUpperCase()}] ${message}${contextStr}`;
      if (level === 'error') {
        console.error(formattedMessage);
      } else if (level === 'warn') {
        console.warn(formattedMessage);
      } else {
        console.info(formattedMessage);
      }
    }
  }
}
