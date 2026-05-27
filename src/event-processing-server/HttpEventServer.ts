/**
 * HttpEventServer - HTTP server that runs in the utility process
 * Receives events directly from external agents via HTTP
 */

import express, { Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import { EventEmitter } from 'events';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { machineIdSync } from 'node-machine-id';
import {
  SUPPORTED_AGENTS,
  type SupportedAgent,
  AgentEventPipeline,
  PipelineMetrics,
  RepositoryInfo,
  PathNormalizationAdapter,
  SystemInfo,
} from '@principal-ai/agent-monitoring';
import { getTracer } from './telemetry';
import { SpanStatusCode } from '@opentelemetry/api';

const execAsync = promisify(exec);

import {
  DEFAULT_CONFIG,
  EventProcessingServerConfig,
  MainToServerMessage,
  PendingRequest,
  ServerToMainMessage,
  StorageResponseMessage,
  GetTracesResponseMessage,
  GetRegistrationsResponseMessage,
  PortRegistration,
  isGetTracesResponseMessage,
  isGetRegistrationsResponseMessage,
  createWindowBroadcastMessage,
} from './types';
import {
  HOOK_DEBUG_CHANNEL,
  type HookDebugEvent,
} from '../shared/ipc-events/HookDebugEvents';

/**
 * Server-side implementation of PathNormalizationAdapter
 */
class ServerPathNormalizationAdapter implements PathNormalizationAdapter {
  // Cache by git root, not by working directory - all subdirs share one cache entry
  private repositoryCache: Map<
    string,
    { info: RepositoryInfo | null; timestamp: number }
  > = new Map();
  // Map working directory to git root for fast lookups
  private gitRootCache: Map<string, string | null> = new Map();
  private cacheTimeout = 10 * 60 * 1000; // 10 minutes

  constructor(private homeDir: string) {}

  async getRawRepositoryInfo(
    absolutePath: string,
  ): Promise<RepositoryInfo | null> {
    try {
      // Step 1: Find git root (check cache first)
      let gitRoot = this.gitRootCache.get(absolutePath);
      if (gitRoot === undefined) {
        gitRoot = await this.findGitRoot(absolutePath);
        this.gitRootCache.set(absolutePath, gitRoot);
      }

      if (!gitRoot) {
        return null;
      }

      // Step 2: Check repository cache by git root
      const cached = this.repositoryCache.get(gitRoot);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.info;
      }

      // Step 3: Fetch git info (cache miss)
      const [remoteUrl, branch, headCommit] = await Promise.all([
        this.getGitRemoteUrl(gitRoot),
        this.getGitBranch(gitRoot),
        this.getGitHeadCommit(gitRoot),
      ]);

      if (!remoteUrl) {
        this.repositoryCache.set(gitRoot, {
          info: null,
          timestamp: Date.now(),
        });
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
        headCommit,
      };

      // Cache by git root
      this.repositoryCache.set(gitRoot, { info, timestamp: Date.now() });
      return info;
    } catch (error) {
      console.error(
        '[ServerPathNormalizationAdapter] Error getting repository info:',
        error,
      );
      return null;
    }
  }

  private async findGitRoot(startPath: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync('git rev-parse --show-toplevel', {
        cwd: startPath,
      });
      return stdout.trim();
    } catch {
      return null;
    }
  }

  private async getGitRemoteUrl(gitRoot: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync('git config --get remote.origin.url', {
        cwd: gitRoot,
      });
      return stdout.trim();
    } catch {
      return null;
    }
  }

  private async getGitBranch(gitRoot: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: gitRoot,
      });
      return stdout.trim();
    } catch {
      return null;
    }
  }

  private async getGitHeadCommit(gitRoot: string): Promise<string | undefined> {
    try {
      const { stdout } = await execAsync('git rev-parse HEAD', {
        cwd: gitRoot,
      });
      return stdout.trim();
    } catch {
      return undefined;
    }
  }

  private parseGitRemoteUrl(remoteUrl: string): {
    owner: string;
    repo: string;
  } {
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
 * HTTP Event Server that runs in utility process
 */
export class HttpEventServer extends EventEmitter {
  private app: express.Application;
  private server: Server | null = null;
  // Use different ports for dev (3045) and production (3043)
  private port: number = process.env.NODE_ENV === 'production' ? 3043 : 3045;
  private maxPortRetries: number = 10;

  private pipeline!: AgentEventPipeline;
  private sendToMain: (message: ServerToMainMessage) => void;
  private config: EventProcessingServerConfig;

  // Statistics
  private startTime: number;
  private processedEventCount = 0;
  private errorCount = 0;
  private totalProcessingTime = 0;
  private lastProcessedEvent?: number;

  // Request management for main process communication
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestCounter = 0;

  constructor(
    sendToMain: (message: ServerToMainMessage) => void,
    config: Partial<EventProcessingServerConfig> = {},
  ) {
    super();

    this.sendToMain = sendToMain;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startTime = Date.now();

    // Initialize Express app
    this.app = express();

    // Initialize event queue for serialized processing
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
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // CORS headers for local development
    this.app.use((_req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS',
      );
      res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization',
      );

      if (_req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Request logging middleware - disabled for performance
    // Enable via DEBUG_EVENT_SERVER=true if needed
    if (this.config.logLevel === 'debug') {
      this.app.use((req: Request, _res: Response, next: NextFunction) => {
        this.log('debug', `${req.method} ${req.path}`);
        next();
      });
    }
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

    // OTEL trace endpoints
    this.setupOtelTraceRoutes();

    // Event name mapping for each agent (explicit for static analysis)
    const eventNames: Record<SupportedAgent, string> = {
      claude: 'event.http.claude_received',
      cline: 'event.http.cline_received',
      opencode: 'event.http.opencode_received',
      droid: 'event.http.droid_received',
    };

    // Setup routes for each supported agent
    SUPPORTED_AGENTS.forEach((agent) => {
      // hookPath includes the full path like "hooks/claude-hook.cjs", we just want the base name
      const routePath =
        agent === 'claude'
          ? 'claude-hook'
          : agent === 'cline'
            ? 'cline-hook'
            : agent === 'opencode'
              ? 'opencode-hook'
              : agent === 'droid'
                ? 'droid-hook'
                : agent; // fallback to agent name

      // POST endpoint for agent events
      this.app.post(`/${routePath}`, async (req: Request, res: Response) => {
        const startTime = Date.now();
        const tracer = getTracer('principal-ade-event-processor');
        const span = tracer.startSpan(`event.http.${agent}_request`);

        try {
          // Process the event
          await this.processAgentEvent(agent, req.body);

          const duration = Date.now() - startTime;

          // Event: Agent event received via HTTP POST
          span.addEvent(eventNames[agent], {
            'provider': agent,
            'duration_ms': duration,
          });

          span.setStatus({ code: SpanStatusCode.OK });

          // Return success response
          res.status(200).json({
            success: true,
            provider: agent,
            duration,
            message: 'Event processed successfully',
          });
        } catch (error) {
          this.errorCount++;
          span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
          this.log('error', `Error processing ${agent} event: ${error}`);

          res.status(500).json({
            success: false,
            provider: agent,
            error: (error as Error).message,
          });
        } finally {
          span.end();
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
   * Setup OTEL trace retrieval routes
   */
  private setupOtelTraceRoutes(): void {
    // GET /otel/traces - List recent traces
    this.app.get('/otel/traces', async (req: Request, res: Response) => {
      const tracer = getTracer('principal-ade-event-processor');
      const span = tracer.startSpan('otel.traces.list_request');

      try {
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

        const traces = await this.getTracesFromMain(limit);

        span.addEvent('otel.traces.list_fetched', {
          'traces.count': traces.length,
          'traces.limit': limit || 50,
        });

        span.setStatus({ code: SpanStatusCode.OK });

        res.json({
          success: true,
          traces,
          count: traces.length,
          timestamp: Date.now(),
        });
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
        this.log('error', `Failed to get traces: ${error}`);

        res.status(500).json({
          success: false,
          error: (error as Error).message,
          traces: [],
        });
      } finally {
        span.end();
      }
    });

    // GET /otel/traces/:traceId - Get specific trace
    this.app.get('/otel/traces/:traceId', async (req: Request, res: Response) => {
      const tracer = getTracer('principal-ade-event-processor');
      const span = tracer.startSpan('otel.traces.get_request');

      try {
        const traceId = req.params.traceId as string;

        span.setAttribute('trace.id', traceId);

        const traces = await this.getTracesFromMain(undefined, traceId);

        if (traces.length === 0) {
          span.setStatus({ code: SpanStatusCode.OK });
          res.status(404).json({
            success: false,
            error: `Trace not found: ${traceId}`,
          });
          return;
        }

        span.addEvent('otel.traces.get_fetched', {
          'trace.id': traceId,
        });

        span.setStatus({ code: SpanStatusCode.OK });

        res.json({
          success: true,
          trace: traces[0],
          timestamp: Date.now(),
        });
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
        this.log('error', `Failed to get trace: ${error}`);

        res.status(500).json({
          success: false,
          error: (error as Error).message,
        });
      } finally {
        span.end();
      }
    });

    // GET /otel/registrations - Get active port registrations
    this.app.get('/otel/registrations', async (_req: Request, res: Response) => {
      const tracer = getTracer('principal-ade-event-processor');
      const span = tracer.startSpan('otel.registrations.list_request');

      try {
        const result = await this.getRegistrationsFromMain();

        span.addEvent('otel.registrations.list_fetched', {
          'registrations.count': result.registrations.length,
          'services.count': result.services.length,
        });

        span.setStatus({ code: SpanStatusCode.OK });

        res.json({
          success: true,
          registrations: result.registrations,
          services: result.services,
          timestamp: Date.now(),
        });
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
        this.log('error', `Failed to get registrations: ${error}`);

        res.status(500).json({
          success: false,
          error: (error as Error).message,
          registrations: [],
          services: [],
        });
      } finally {
        span.end();
      }
    });
  }

  /**
   * Request traces from main process
   */
  private async getTracesFromMain(
    limit?: number,
    traceId?: string,
  ): Promise<Array<{ traceId: string; data: unknown }>> {
    return this.makeRequest<Array<{ traceId: string; data: unknown }>>(
      'GET_TRACES_REQUEST',
      { limit, traceId },
    );
  }

  /**
   * Request registrations from main process
   */
  private async getRegistrationsFromMain(): Promise<{
    registrations: PortRegistration[];
    services: string[];
  }> {
    return this.makeRequest<{ registrations: PortRegistration[]; services: string[] }>(
      'GET_REGISTRATIONS_REQUEST',
      {},
    );
  }

  /**
   * Match `/api/topics/<id>` anywhere in a Bash command string. Topic ids
   * are url-safe slugs (UUIDs, nanoids, kebab-case) so the character class
   * stays conservative.
   */
  private static readonly TOPIC_URL_RE = /\/api\/topics\/([A-Za-z0-9_-]+)\b/;

  /**
   * If a PreToolUse/PostToolUse Bash event carries a curl that hits
   * `/api/topics/:id`, emit a LINK_SESSION_TO_TOPIC message so main can
   * persist the {sessionId → topicId} junction.
   *
   * Pipeline-normalized `sessionId` is preferred; falls back to the raw
   * `session_id` field on the hook payload.
   */
  private maybeLinkSessionToTopic(
    rawData: unknown,
    normalizedSessionId: string | undefined,
  ): void {
    if (!rawData || typeof rawData !== 'object') return;
    const raw = rawData as Record<string, unknown>;
    if (raw.tool_name !== 'Bash') return;

    const toolInput = raw.tool_input;
    if (!toolInput || typeof toolInput !== 'object') return;
    const command = (toolInput as Record<string, unknown>).command;
    if (typeof command !== 'string') return;

    const match = command.match(HttpEventServer.TOPIC_URL_RE);
    if (!match) return;
    const topicId = match[1];

    const rawSessionId = typeof raw.session_id === 'string' ? raw.session_id : undefined;
    const sessionId = normalizedSessionId || rawSessionId;
    if (!sessionId) return;

    this.sendToMain({
      type: 'LINK_SESSION_TO_TOPIC',
      id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      sessionId,
      topicId,
    });
  }

  /**
   * If a normalized event is a Claude `session-start`, fire-and-forget a
   * BIND_AGENT_SESSION message so main can stamp the `session_id` onto a
   * live terminal in the same git root.
   *
   * Reads everything off the normalized event — `sessionId`,
   * `repository.root`, and `data.source` (`"startup" | "resume" | "clear"`).
   * The normalized union drops Claude's raw `"compact"` source; we treat
   * any source outside the known three as a no-op.
   */
  private maybeBindAgentSession(repoNormalizedEvent: unknown): void {
    if (!repoNormalizedEvent || typeof repoNormalizedEvent !== 'object') return;
    const evt = repoNormalizedEvent as {
      eventType?: unknown;
      sessionId?: unknown;
      workingDirectory?: unknown;
      repository?: { root?: unknown };
      data?: { source?: unknown };
    };

    const eventType = evt.eventType?.toString() ?? '';
    if (!eventType.includes('session-start')) return;

    const sessionId = typeof evt.sessionId === 'string' ? evt.sessionId : '';
    const workingDirectory =
      typeof evt.workingDirectory === 'string' ? evt.workingDirectory : '';
    const repoRoot =
      typeof evt.repository?.root === 'string' ? evt.repository.root : '';
    // Need at least one usable join key; `workingDirectory` is the fallback
    // when the agent ran outside any git repo and `repoRoot` is empty.
    if (!sessionId || !workingDirectory) return;

    const rawSource = evt.data?.source;
    if (rawSource !== 'startup' && rawSource !== 'resume' && rawSource !== 'clear') {
      return;
    }

    this.sendToMain({
      type: 'BIND_AGENT_SESSION',
      id: `bind-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      agentSessionId: sessionId,
      repoPath: repoRoot,
      workingDirectory,
      source: rawSource,
    });
  }

  /**
   * Process an agent event through the pipeline
   */
  private async processAgentEvent(
    provider: SupportedAgent,
    rawData: unknown,
  ): Promise<void> {
    const tracer = getTracer('principal-ade-event-processor');
    const span = tracer.startSpan('event.pipeline.processing');
    const startTime = Date.now();

    try {
      // Validate raw data
      if (!rawData || typeof rawData !== 'object') {
        throw new Error('Invalid raw data: expected object');
      }

      // Fan out a copy to renderer windows for the hook-debug panel. Fire
      // before the pipeline runs so the panel reflects what arrived, not
      // what the pipeline accepted.
      try {
        const debugEvent: HookDebugEvent = {
          provider,
          receivedAt: Date.now(),
          raw: rawData,
        };
        this.sendToMain(
          createWindowBroadcastMessage(HOOK_DEBUG_CHANNEL, debugEvent),
        );
      } catch (err) {
        this.log('warn', `Hook debug broadcast failed: ${err}`);
      }

      // Process through pipeline
      const repoNormalizedEvent = await this.pipeline.processRawEvent(
        provider,
        rawData,
      );

      const duration = Date.now() - startTime;

      // Event: Event processed through AgentEventPipeline
      span.addEvent('event.pipeline.event_processed', {
        'provider': provider,
        'session.id': repoNormalizedEvent.sessionId || '',
        'event.type': repoNormalizedEvent.eventType?.toString() || '',
        'duration_ms': duration,
      });

      // Sidecar: if the agent ran a Bash curl that fetches GET /api/topics/<id>,
      // treat that as the link signal and tell main to record {sessionId → topicId}.
      // Fail-soft — never throw out of this block; the main pipeline must continue.
      try {
        this.maybeLinkSessionToTopic(rawData, repoNormalizedEvent.sessionId);
      } catch (err) {
        this.log('warn', `Topic link sidecar failed: ${err}`);
      }

      // Sidecar: on Claude `session-start`, bind the `session_id` onto a live
      // terminal in the same git root. Fail-soft for the same reason.
      try {
        this.maybeBindAgentSession(repoNormalizedEvent);
      } catch (err) {
        this.log('warn', `Agent session bind sidecar failed: ${err}`);
      }

      // Event: Repository info resolved for event path (if applicable)
      if (repoNormalizedEvent.repository) {
        span.addEvent('event.adapter.repo_resolved', {
          'repo.root': repoNormalizedEvent.repository.root || '',
          'repo.owner': repoNormalizedEvent.repository.owner || '',
          'repo.name': repoNormalizedEvent.repository.repo || '',
          'cache.hit': false, // We don't track cache hits at this level
        });
      }

      // Send directly to registered renderer ports (for real-time UI updates)
      const repository = repoNormalizedEvent.repository?.root;
      if (repository) {
        const sendEventToPorts = (
          global as unknown as {
            sendEventToPorts?: (repo: string, event: unknown) => void;
          }
        ).sendEventToPorts;
        if (sendEventToPorts) {
          sendEventToPorts(repository, repoNormalizedEvent);
        }
      }

      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      this.log('error', `Event processing failed: ${error}`);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Generic request handler with timeout
   */
  private makeRequest<T>(
    type: string,
    data: Record<string, unknown>,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
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
        resolve: (value) => {
          resolve(value as T);
        },
        reject: (error: Error) => {
          reject(error);
        },
        timeoutHandle,
      });

      // Send request to main process
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
   * Handle response from main process
   */
  handleMainResponse(message: MainToServerMessage): void {
    const pending = this.pendingRequests.get(message.id);
    if (!pending) {
      this.log('warn', `Received response for unknown request: ${message.id}`);
      return;
    }

    // Clear timeout
    if (pending.timeoutHandle) {
      clearTimeout(pending.timeoutHandle);
    }
    this.pendingRequests.delete(message.id);

    // Handle response based on type
    if (message.type === 'STORAGE_RESPONSE') {
      const storageMessage = message as StorageResponseMessage;
      if (storageMessage.success) {
        pending.resolve(storageMessage.data ?? null);
      } else {
        pending.reject(
          new Error(storageMessage.error || 'Storage operation failed'),
        );
      }
    } else if (isGetTracesResponseMessage(message)) {
      const tracesMessage = message as GetTracesResponseMessage;
      if (tracesMessage.success) {
        pending.resolve(tracesMessage.traces ?? []);
      } else {
        pending.reject(
          new Error(tracesMessage.error || 'Failed to get traces'),
        );
      }
    } else if (isGetRegistrationsResponseMessage(message)) {
      const regMessage = message as GetRegistrationsResponseMessage;
      if (regMessage.success) {
        pending.resolve({
          registrations: regMessage.registrations ?? [],
          services: regMessage.services ?? [],
        });
      } else {
        pending.reject(
          new Error(regMessage.error || 'Failed to get registrations'),
        );
      }
    } else {
      pending.reject(new Error(`Unhandled response type: ${message.type}`));
    }
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    const tracer = getTracer('principal-ade-event-processor');
    const span = tracer.startSpan('event.server.startup');

    return new Promise((resolve, reject) => {
      const tryPort = (port: number, retries: number) => {
        this.server = this.app.listen(port, () => {
          this.port = port;

          // Event: HTTP server started listening for agent events
          span.addEvent('event.server.http_started', {
            'server.port': port,
            'endpoints.count': SUPPORTED_AGENTS.length,
          });

          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
          this.log('info', `HTTP server listening on port ${port}`);
          resolve();
        });

        this.server.on('error', (err: NodeJS.ErrnoException) => {
          if (err && err.code === 'EADDRINUSE' && retries > 0) {
            this.log('warn', `Port ${port} in use, trying ${port + 1}`);
            tryPort(port + 1, retries - 1);
          } else {
            span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
            span.end();
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
      const server = this.server;
      return new Promise((resolve) => {
        server.close(() => {
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
      averageProcessingTime:
        this.processedEventCount > 0
          ? this.totalProcessingTime / this.processedEventCount
          : 0,
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
   * Logging utility - only logs errors and warnings in production
   */
  private log(
    level: string,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    // Only log errors and warnings unless debug is enabled
    if (level !== 'error' && level !== 'warn' && this.config.logLevel !== 'debug') {
      return;
    }
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    console.info(
      `[${timestamp}] [HttpEventServer] [${level.toUpperCase()}] ${message}${contextStr}`,
    );
  }
}
