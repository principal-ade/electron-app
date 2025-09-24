/**
 * HttpEventServer - HTTP server that runs in the utility process
 * Receives events directly from external agents via HTTP
 */

import express = require('express');
import { Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import { EventEmitter } from 'events';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { machineIdSync } from 'node-machine-id';
import {
  getAgentInfo,
  SUPPORTED_AGENTS,
  type SupportedAgent,
  type ClaudeHookInput,
  type OpenCodeHookInput,
  type ClineHookInput,
  AgentEventPipeline,
  PipelineMetrics,
  RepositoryInfo,
  PathNormalizationAdapter,
  SystemInfo,
} from '@principal-ai/agent-monitoring';

const execAsync = promisify(exec);

import { EventQueue } from '../main/agent-session-events/EventQueue';

import {
  EventProcessingServerConfig,
  ServerToMainMessage,
  createStorageRequestMessage,
  createWindowBroadcastMessage,
  MainToServerMessage,
} from './types';

// Union type for all possible hook inputs
type AgentHookInput = ClaudeHookInput | OpenCodeHookInput | ClineHookInput;

/**
 * Server-side implementation of PathNormalizationAdapter
 */
class ServerPathNormalizationAdapter implements PathNormalizationAdapter {
  private repositoryCache: Map<string, { info: RepositoryInfo | null; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(
    private homeDir: string
  ) {}

  async getRawRepositoryInfo(absolutePath: string): Promise<RepositoryInfo | null> {
    // Check cache first
    const cached = this.repositoryCache.get(absolutePath);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.info;
    }

    try {
      // Find git root
      const gitRoot = await this.findGitRoot(absolutePath);
      if (!gitRoot) {
        this.repositoryCache.set(absolutePath, { info: null, timestamp: Date.now() });
        return null;
      }

      // Get git info in parallel
      const [remoteUrl, branch, headCommit] = await Promise.all([
        this.getGitRemoteUrl(gitRoot),
        this.getGitBranch(gitRoot),
        this.getGitHeadCommit(gitRoot)
      ]);

      if (!remoteUrl) {
        this.repositoryCache.set(absolutePath, { info: null, timestamp: Date.now() });
        return null;
      }

      // Parse owner and repo from remote URL
      const { owner, repo } = this.parseGitRemoteUrl(remoteUrl);

      const info: RepositoryInfo = {
        root: gitRoot,
        remoteUrl,
        owner,
        repo,
        branch: branch || 'main',
        headCommit
      };

      // Cache the result
      this.repositoryCache.set(absolutePath, { info, timestamp: Date.now() });
      return info;
    } catch (error) {
      console.error('[ServerPathNormalizationAdapter] Error getting repository info:', error);
      this.repositoryCache.set(absolutePath, { info: null, timestamp: Date.now() });
      return null;
    }
  }

  private async findGitRoot(startPath: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync('git rev-parse --show-toplevel', { cwd: startPath });
      return stdout.trim();
    } catch {
      return null;
    }
  }

  private async getGitRemoteUrl(gitRoot: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync('git config --get remote.origin.url', { cwd: gitRoot });
      return stdout.trim();
    } catch {
      return null;
    }
  }

  private async getGitBranch(gitRoot: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: gitRoot });
      return stdout.trim();
    } catch {
      return null;
    }
  }

  private async getGitHeadCommit(gitRoot: string): Promise<string | undefined> {
    try {
      const { stdout } = await execAsync('git rev-parse HEAD', { cwd: gitRoot });
      return stdout.trim();
    } catch {
      return undefined;
    }
  }

  private parseGitRemoteUrl(remoteUrl: string): { owner: string; repo: string } {
    // Handle various git URL formats
    // SSH: git@github.com:owner/repo.git
    // HTTPS: https://github.com/owner/repo.git
    // GH CLI: gh:owner/repo

    let owner = '';
    let repo = '';

    if (remoteUrl.includes('github.com')) {
      const match = remoteUrl.match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
      if (match) {
        owner = match[1];
        repo = match[2];
      }
    } else if (remoteUrl.startsWith('gh:')) {
      const parts = remoteUrl.substring(3).split('/');
      if (parts.length === 2) {
        owner = parts[0];
        repo = parts[1];
      }
    } else {
      // Generic git URL parsing
      const match = remoteUrl.match(/([^/:]+)\/([^/]+?)(\.git)?$/);
      if (match) {
        owner = match[1];
        repo = match[2];
      }
    }

    return { owner, repo };
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
 * HTTP Event Server that runs in utility process
 */
export class HttpEventServer extends EventEmitter {
  private app: express.Application;
  private server: Server | null = null;
  private port: number = 3043; // Port that claude-hook expects
  private maxPortRetries: number = 10;

  private pipeline: AgentEventPipeline;
  private eventQueue: EventQueue;
  private sendToMain: (message: ServerToMainMessage) => void;
  private config: EventProcessingServerConfig;

  // Statistics
  private startTime: number;
  private processedEventCount = 0;
  private errorCount = 0;
  private totalProcessingTime = 0;
  private lastProcessedEvent?: number;

  // Request management for main process communication
  private pendingRequests: Map<string, any> = new Map();
  private requestCounter = 0;

  constructor(
    sendToMain: (message: ServerToMainMessage) => void,
    config: Partial<EventProcessingServerConfig> = {}
  ) {
    super();

    this.sendToMain = sendToMain;
    this.config = { ...config };
    this.startTime = Date.now();

    // Initialize Express app
    this.app = express();

    // Initialize event queue for serialized processing
    this.eventQueue = new EventQueue();

    // Setup pipeline
    this.setupPipeline();

    // Setup HTTP server
    this.setupMiddleware();
    this.setupRoutes();

    this.log('info', 'HttpEventServer initialized');
  }

  /**
   * Set up the event processing pipeline
   */
  private setupPipeline(): void {
    // Create the path normalization adapter - simplified, no IPC needed
    const adapter = new ServerPathNormalizationAdapter(os.homedir());

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
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // CORS headers for local development
    this.app.use((_req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

      if (_req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Request logging middleware
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      this.log('debug', `${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup HTTP routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        timestamp: Date.now(),
        message: 'Event Processing Server is running',
        processedEvents: this.processedEventCount,
        errors: this.errorCount,
        uptime: Date.now() - this.startTime,
      });
    });

    // Setup routes for each supported agent
    SUPPORTED_AGENTS.forEach((agent) => {
      const agentInfo = getAgentInfo(agent);
      // hookPath includes the full path like "hooks/claude-hook.cjs", we just want the base name
      const routePath = agent === 'claude' ? 'claude-hook' :
                        agent === 'cline' ? 'cline-hook' :
                        agent === 'opencode' ? 'opencode-hook' :
                        agent; // fallback to agent name
      this.log('info', `Setting up route for ${agent} at /${routePath}`);

      // POST endpoint for agent events
      this.app.post(`/${routePath}`, async (req: Request, res: Response) => {
        const startTime = Date.now();

        try {
          this.log('info', `Received ${agent} event at /${routePath}`);
          this.log('debug', `Event body: ${JSON.stringify(req.body).substring(0, 200)}`);

          // Process the event
          await this.processAgentEvent(agent, req.body);

          const duration = Date.now() - startTime;
          this.log('info', `Processed ${agent} event in ${duration}ms`);

          // Return success response
          res.status(200).json({
            success: true,
            provider: agent,
            duration,
            message: 'Event processed successfully',
          });

        } catch (error) {
          this.errorCount++;
          this.log('error', `Error processing ${agent} event: ${error}`);

          res.status(500).json({
            success: false,
            provider: agent,
            error: (error as Error).message,
          });
        }
      });

      // GET endpoint for agent info
      this.app.get(`/${routePath}`, (_req: Request, res: Response) => {
        res.json({
          provider: agent,
          status: 'ready',
          processedEvents: this.processedEventCount,
        });
      });
    });

    // Fallback route
    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not found',
        message: 'Unknown endpoint',
      });
    });
  }

  /**
   * Process an agent event through the pipeline
   */
  private async processAgentEvent(provider: SupportedAgent, rawData: unknown): Promise<void> {
    this.log('info', `[processAgentEvent] Starting to process ${provider} event`);

    try {
      // Validate raw data
      if (!rawData || typeof rawData !== 'object') {
        this.log('error', `Invalid raw data from ${provider}: expected object, got ${typeof rawData}`);
        throw new Error('Invalid raw data: expected object');
      }

      this.log('info', `[processAgentEvent] Raw data validated, processing through pipeline...`);

      // Step 1: Process through pipeline
      this.log('info', `[processAgentEvent] Calling pipeline.processRawEvent...`);
      const repoNormalizedEvent = await this.pipeline.processRawEvent(provider, rawData);
      this.log('info', `[processAgentEvent] Pipeline processing complete`);

      // Step 2: Send the repo-normalized event to main for SDK and storage
      // Main process will handle observability SDK and storage
      this.log('info', `Sending processed event to main - session: ${repoNormalizedEvent.sessionId}`);
      this.sendToMain({
        type: 'PROCESSED_EVENT',
        id: `event-${Date.now()}`,
        timestamp: Date.now(),
        event: repoNormalizedEvent,
        provider: provider
      });

      this.log('info', `Event sent to main for session ${repoNormalizedEvent.sessionId}`);

    } catch (error) {
      this.log('error', `Event processing failed: ${error}`);
      throw error;
    }
  }

  /**
   * Store normalized event via main process
   */
  private async storeNormalizedEvent(event: any): Promise<void> {
    // Validate session ID
    if (!event.sessionId || typeof event.sessionId !== 'string' || event.sessionId.trim() === '') {
      this.log('error', `Invalid session ID, skipping event: ${event.sessionId}`);
      return;
    }

    const normalizedSessionId = event.sessionId.trim();

    // Queue the storage operation for this session
    return this.eventQueue.enqueue(normalizedSessionId, async () => {
      try {
        const sessionKey = normalizedSessionId;

        // Get existing session data from main process
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

          // Notify about new session
          this.sendToMain(createWindowBroadcastMessage('SESSION_CREATED', {
            sessionId: normalizedSessionId,
            directory: event.workingDirectory,
          }));
        }

        // Process event through centralized processor
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

        // Process event
        const processingResult = sessionEventProcessor.processEvent(event, currentState);

        // Update session data with processing results
        if (processingResult.session) {
          sessionData.totalEvents = processingResult.session.eventCount || sessionData.totalEvents;
          sessionData.counters = {
            fileAccesses: processingResult.session.fileAccessCount || 0,
            fileWrites: processingResult.session.fileWriteCount || 0,
            toolCalls: processingResult.session.toolCallCount || 0,
            webAccesses: processingResult.session.webAccessCount || 0,
          };
          sessionData.fileAccesses = processingResult.session.fileAccesses || sessionData.fileAccesses;
          sessionData.fileWrites = processingResult.session.fileWrites || sessionData.fileWrites;
          sessionData.filesRead = processingResult.session.filesRead || sessionData.filesRead;
          sessionData.filesWritten = processingResult.session.filesWritten || sessionData.filesWritten;
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
   * Log important events
   */
  private logEvent(event: any): void {
    if (event.eventType && event.eventType.toString().includes('start')) {
      this.log('info', `Session started: ${event.sessionId} in ${event.workingDirectory}`);
    } else if (event.eventType && event.eventType.toString().includes('stop')) {
      this.log('info', `Session stopped: ${event.sessionId}`);
    }
  }

  /**
   * Request repository info from main process
   */
  private requestRepositoryInfo(absolutePath: string): Promise<RepositoryInfo | null> {
    return this.makeRequest('REPOSITORY_INFO_REQUEST', { absolutePath });
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
   * Generic request handler with timeout
   */
  private makeRequest(type: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.generateRequestId();

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${type}`));
      }, 30000);

      // Store pending request
      this.pendingRequests.set(id, {
        resolve,
        reject,
        timeoutHandle
      });

      // Send request to main process
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
   * Handle response from main process
   */
  handleMainResponse(message: MainToServerMessage): void {
    const pending = this.pendingRequests.get(message.id);
    if (!pending) {
      return;
    }

    // Clear timeout
    if (pending.timeoutHandle) {
      clearTimeout(pending.timeoutHandle);
    }
    this.pendingRequests.delete(message.id);

    // Handle response based on type
    if (message.type === 'STORAGE_RESPONSE') {
      if ((message as any).success) {
        pending.resolve((message as any).data);
      } else {
        pending.reject(new Error((message as any).error || 'Storage operation failed'));
      }
    } else if (message.type === 'REPOSITORY_INFO_RESPONSE') {
      pending.resolve((message as any).repositoryInfo);
    }
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const tryPort = (port: number, retries: number) => {
        this.server = this.app.listen(port, () => {
          this.port = port;
          this.log('info', `HTTP server listening on port ${port}`);
          resolve();
        });

        this.server.on('error', (err: any) => {
          if (err.code === 'EADDRINUSE' && retries > 0) {
            this.log('warn', `Port ${port} in use, trying ${port + 1}`);
            tryPort(port + 1, retries - 1);
          } else {
            reject(err);
          }
        });
      };

      tryPort(this.port, this.maxPortRetries);
    });
  }

  /**
   * Stop the HTTP server
   */
  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          this.log('info', 'HTTP server stopped');
          resolve();
        });
      });
    }
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      port: this.port,
      processedEvents: this.processedEventCount,
      errors: this.errorCount,
      uptime: Date.now() - this.startTime,
      averageProcessingTime: this.processedEventCount > 0 ? this.totalProcessingTime / this.processedEventCount : 0,
      lastProcessedEvent: this.lastProcessedEvent,
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
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    console.log(`[${timestamp}] [HttpEventServer] [${level.toUpperCase()}] ${message}${contextStr}`);
  }
}