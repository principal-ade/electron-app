/**
 * RepositoryMonitoringManager - the Electron main-process face of the shared
 * repository monitoring daemon. Wraps {@link RepoMonitorClient} ("connect if
 * present, spawn if not") and exposes the same request API, lifecycle events
 * and renderer broadcasts the in-process worker transport used to offer, so
 * host code is unchanged when the monitor moves out of the app's process tree.
 *
 * The daemon is shared with other apps on the machine (Studio, CLIs). `stop()`
 * therefore only disconnects; `restartDaemon()` replaces the process for every
 * client. There is no fallback transport: when the daemon cannot be reached,
 * `start()` throws and requests reject.
 */

import { app, BrowserWindow } from 'electron';
import { EventEmitter } from 'events';
import * as fsPromises from 'fs/promises';
import { createLogger, configureMainLogging, getLogFilePath } from './logger';
import {
  RepoMonitorClient,
  type RepoMonitorClientState,
} from '@principal-ai/repository-monitoring-server/client';
import {
  toRepoMonitorOwner,
  type RepoMonitorDiagnostics,
} from '@principal-ai/repository-monitoring-server/client';
import {
  isDaemonOutdated,
  PACKAGE_VERSION,
} from '@principal-ai/repository-monitoring-server/client';

import {
  MonitoringInternalEvent,
  type DaemonHello,
  type DaemonStatus,
  type MainToServerMessage,
  type ExtendedQualityMetrics,
  type PackageSummary,
  type DependencyResolutionResult,
  type GitStatusMetadata,
  type GitStatusWithFiles,
  type GitRemoteInfo,
  type MessageResponseMap,
} from '@principal-ai/repository-monitoring-server';
import type { FileTree } from '@principal-ai/repository-abstraction';
import type { PackageLayer } from '@principal-ai/codebase-composition';
import type {
  MonitoringStatus,
  ResourceSnapshot,
  RepositoryInfo,
  RepositoryCacheSnapshot,
  LifecyclePhase,
  LifecycleEvent,
  LifecycleErrorInfo,
  ServerStatus,
  ServerDiagnostics,
  DaemonDiagnostics,
  LogTailRequest,
  LogTailResponse,
  LogPaths,
  FileWatcherImpl,
} from '@principal-ai/repository-monitoring-server';

// Configure main process logging
configureMainLogging();

// Create scoped logger
const logger = createLogger('RepositoryMonitoring:Manager');

/**
 * Configuration for RepositoryMonitoringManager
 */
export interface RepositoryMonitoringManagerConfig {
  autoStart: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  /** Label recorded in the daemon's hello when this process spawns it. Default 'desktop'. */
  spawnedBy: string;
  /** Node executable used to spawn the daemon. Default `REPO_MONITOR_NODE` or `node` on PATH. */
  nodeBinary?: string;
  /** Daemon bundle to run. Default: the one shipped with this package. */
  daemonEntryPath?: string;
  /** Extra environment for a daemon this process spawns (e.g. NODE_PATH for native watchers). */
  daemonEnv?: Record<string, string>;
  /** Home directory the daemon paths derive from. Default: `os.homedir()`. */
  homeDir?: string;
  /** Override the socket path. */
  socketPath?: string;
  /** OTLP endpoint URL for tracing; applied to a daemon this process spawns. */
  otlpEndpoint?: string;
  /**
   * Which filesystem watcher the daemon should use. Only takes effect on a
   * daemon this process spawns (or on `restartDaemon()`); a daemon another
   * app started keeps its own setting.
   */
  watcherImpl?: FileWatcherImpl;
}

const DEFAULT_CONFIG: RepositoryMonitoringManagerConfig = {
  autoStart: true,
  logLevel: 'info',
  spawnedBy: 'desktop',
  watcherImpl: 'parcel',
};

const LIFECYCLE_HISTORY_LIMIT = 100;
const DEFAULT_LOG_TAIL_LINES = 500;

/** Wire events the daemon pushes that the manager re-emits and broadcasts. */
const FORWARDED_EVENTS: readonly string[] = Object.values(
  MonitoringInternalEvent,
);

/**
 * Manages this process's connection to the repository monitoring daemon.
 */
export class RepositoryMonitoringManager extends EventEmitter {
  private config: RepositoryMonitoringManagerConfig;
  private readonly client: RepoMonitorClient;
  private isConnected = false;
  private reconnectAttempts = 0;
  private disconnectRequested = false;
  private resourceHistory: ResourceSnapshot[] = [];
  /** Last cumulative CPU reading from the daemon, for turning it into a rate. */
  private lastCpuSample: { pid: number; cpuMs: number; at: number } | null =
    null;

  // Lifecycle telemetry
  private currentPhase: LifecyclePhase = 'idle';
  private phaseEnteredAt: number = Date.now();
  private startedAt: number | null = null;
  private lastConnectedAt: number | null = null;
  private hello: DaemonHello | null = null;
  private lastError: LifecycleErrorInfo | null = null;
  private lastDisconnect: { at: number; reason: string } | null = null;
  private lifecycleHistory: LifecycleEvent[] = [];
  /** Active watcher impl reported by the daemon on connect. */
  private activeWatcherImpl: FileWatcherImpl | null = null;
  /** If the daemon fell back from Parcel to Chokidar, the captured reason. */
  private watcherImplFallbackReason: string | null = null;

  constructor(config: Partial<RepositoryMonitoringManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.client = new RepoMonitorClient({
      spawnedBy: this.config.spawnedBy,
      homeDir: this.config.homeDir,
      socketPath: this.config.socketPath,
      nodeBinary: this.config.nodeBinary,
      daemonEntryPath: this.config.daemonEntryPath,
      daemonEnv: this.daemonEnv(),
      log: (level, message) => {
        this.log(level, `client: ${message}`);
      },
    });
    this.bindClient();

    if (this.config.autoStart) {
      this.start().catch((error: unknown) => {
        this.log(
          'error',
          `Failed to auto-start repository monitoring: ${String(error)}`,
        );
      });
    }
  }

  /** Environment for a daemon this process spawns; recomputed so config changes apply on restart. */
  private daemonEnv(): Record<string, string> {
    return {
      ...(this.config.watcherImpl
        ? { GIT_WATCHER_IMPL: this.config.watcherImpl }
        : {}),
      ...(this.config.otlpEndpoint
        ? { OTEL_EXPORTER_OTLP_ENDPOINT: this.config.otlpEndpoint }
        : {}),
      ...this.config.daemonEnv,
    };
  }

  private bindClient(): void {
    this.client.on('connected', (hello: DaemonHello) => {
      this.hello = hello;
      this.isConnected = true;
      this.lastConnectedAt = Date.now();
      this.reconnectAttempts = 0;
      const status = this.client.connectionInfo();
      this.activeWatcherImpl = status?.watcherImpl ?? null;
      this.watcherImplFallbackReason = status?.watcherFallbackReason ?? null;
      this.log(
        'info',
        `Connected to repository monitor daemon pid ${String(hello.pid)} v${hello.version} ` +
          `(spawnedBy=${hello.spawnedBy}, watcherImpl=${this.activeWatcherImpl ?? 'unknown'}${
            this.watcherImplFallbackReason
              ? `, fallback="${this.watcherImplFallbackReason}"`
              : ''
          })`,
      );
      this.transitionTo('connected', {
        daemonPid: hello.pid,
        note: `spawnedBy=${hello.spawnedBy}, watcher=${this.activeWatcherImpl ?? 'unknown'}`,
      });
      this.emit('ready');
    });

    this.client.on('disconnected', ({ reason }: { reason: string }) => {
      const pid = this.hello?.pid;
      this.isConnected = false;
      this.hello = null;
      this.activeWatcherImpl = null;
      this.watcherImplFallbackReason = null;
      this.lastDisconnect = { at: Date.now(), reason };
      if (this.disconnectRequested) {
        this.transitionTo('disconnected', { daemonPid: pid, note: reason });
      } else {
        this.transitionTo('reconnecting', {
          daemonPid: pid,
          note: `connection lost: ${reason}`,
        });
      }
      this.emit('disconnected', { reason });
    });

    this.client.on('state', (state: RepoMonitorClientState) => {
      if (state === 'reconnecting' && !this.disconnectRequested) {
        this.reconnectAttempts += 1;
        this.transitionTo('reconnecting', {
          attempt: this.reconnectAttempts,
          note: 'retrying with backoff',
        });
      }
    });

    this.client.on('daemon-error', (error: Error) => {
      this.log('error', `Daemon error: ${error.message}`);
      this.lastError = RepositoryMonitoringManager.toErrorInfo(error);
      this.emit('error', error);
    });

    for (const name of FORWARDED_EVENTS) {
      this.client.on(name, (data: unknown) => {
        this.emit(name, data);
        this.broadcastToWindows(name, data);
      });
    }
  }

  /**
   * Record a lifecycle transition. Updates internal phase state, pushes a
   * {@link LifecycleEvent} onto the history ring buffer, and emits a
   * granular `'lifecycle'` event.
   */
  private transitionTo(
    phase: LifecyclePhase,
    extra: Omit<LifecycleEvent, 'ts' | 'phase' | 'durationInPrevPhaseMs'> = {},
  ): LifecycleEvent {
    const now = Date.now();
    const durationInPrevPhaseMs = now - this.phaseEnteredAt;
    const event: LifecycleEvent = {
      ts: now,
      phase,
      durationInPrevPhaseMs,
      ...extra,
    };

    this.currentPhase = phase;
    this.phaseEnteredAt = now;

    if (extra.error) {
      this.lastError = extra.error;
    }

    this.lifecycleHistory.push(event);
    if (this.lifecycleHistory.length > LIFECYCLE_HISTORY_LIMIT) {
      this.lifecycleHistory.splice(
        0,
        this.lifecycleHistory.length - LIFECYCLE_HISTORY_LIMIT,
      );
    }

    this.emit('lifecycle', event);
    return event;
  }

  private static toErrorInfo(err: unknown): LifecycleErrorInfo {
    if (err instanceof Error) {
      return { message: err.message, name: err.name, stack: err.stack };
    }
    return { message: String(err) };
  }

  /**
   * Connect to the daemon, spawning one when none answers. Throws when the
   * daemon cannot be reached; there is no in-process fallback.
   */
  async start(): Promise<void> {
    if (this.isConnected) {
      this.log('debug', 'Repository monitoring daemon already connected');
      return;
    }

    this.disconnectRequested = false;
    this.startedAt ??= Date.now();
    this.transitionTo('connecting', {
      note: 'probing socket; spawning if nothing answers',
    });

    if (!app.isReady()) {
      await app.whenReady();
    }

    try {
      this.log('info', 'Connecting to repository monitoring daemon...');
      await this.client.connect();
    } catch (error: unknown) {
      this.log(
        'error',
        `Failed to reach repository monitoring daemon: ${String(error)}`,
      );
      this.transitionTo('unreachable', {
        error: RepositoryMonitoringManager.toErrorInfo(error),
        note: 'could not connect to or spawn the daemon',
      });
      throw error;
    }
  }

  /**
   * Disconnect from the daemon. The daemon keeps running for other clients
   * and exits on its own once idle.
   */
  stop(): void {
    this.disconnectRequested = true;
    if (this.isConnected) {
      this.log('info', 'Disconnecting from repository monitoring daemon...');
      this.transitionTo('disconnecting', {
        daemonPid: this.hello?.pid,
        note: 'stop() invoked',
      });
    }
    void this.client.close();
    this.isConnected = false;
  }

  /**
   * Ask the daemon to exit and spawn a fresh one with this process's current
   * configuration (watcher impl, OTLP). Other clients reconnect automatically.
   */
  async restartDaemon(): Promise<void> {
    this.disconnectRequested = false;
    this.transitionTo('connecting', {
      daemonPid: this.hello?.pid,
      note: 'restartDaemon(): replacing the daemon',
    });
    this.client.setDaemonEnv(this.daemonEnv());
    try {
      await this.client.restartDaemon();
    } catch (error: unknown) {
      this.transitionTo('unreachable', {
        error: RepositoryMonitoringManager.toErrorInfo(error),
        note: 'restartDaemon() failed',
      });
      throw error;
    }
  }

  /**
   * Send a request to the daemon and wait for its typed response.
   */
  private async sendRequest<T extends keyof MessageResponseMap>(
    message: Omit<MainToServerMessage, 'id'> & { type: T },
  ): Promise<MessageResponseMap[T]> {
    if (!this.isConnected) {
      await this.start();
    }
    return this.client.request(message);
  }

  /**
   * Broadcast events to all renderer windows
   */
  private broadcastToWindows(eventName: string, data: unknown): void {
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      window.webContents.send(`repository-monitoring:${eventName}`, data);
    }
  }

  /**
   * Log messages based on level
   */
  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
  ): void {
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevelIndex = levels.indexOf(this.config.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    if (messageLevelIndex >= configLevelIndex) {
      logger[level](message);
    }
  }

  // Public API Methods

  /**
   * Get FileTree for a repository
   */
  async getFileTree(path: string): Promise<FileTree | null> {
    return this.sendRequest({ type: 'getFileTree', path });
  }

  /**
   * Get quality metrics for a repository
   */
  async getQualityMetrics(path: string): Promise<ExtendedQualityMetrics> {
    const result = await this.sendRequest({ type: 'getMetrics', path });
    return {
      ...result,
      timestamp: new Date(),
      repositoryPath: path,
    };
  }

  /**
   * Get packages information for a repository
   */
  async getPackages(
    path: string,
  ): Promise<{ packages: PackageLayer[]; summary: PackageSummary } | null> {
    return this.sendRequest({ type: 'getPackages', path });
  }

  /**
   * Get the repository cache snapshot composed by the daemon-side registry
   */
  async getRepositoryCacheSnapshot(
    path: string,
  ): Promise<RepositoryCacheSnapshot> {
    return this.sendRequest({ type: 'getRepositoryCacheSnapshot', path });
  }

  /**
   * Refresh repository data
   */
  async refreshRepository(path: string): Promise<void> {
    await this.sendRequest({ type: 'refresh', path });
  }

  /** Refresh Git status without rebuilding file trees or packages. */
  async refreshGitStatus(path: string): Promise<GitStatusWithFiles> {
    return this.sendRequest({ type: 'refreshGitStatus', path });
  }

  /**
   * Run quality enrichment for a repository (on-demand only)
   * This rebuilds the packages slice with quality lenses enabled
   */
  async runQualityEnrichment(path: string): Promise<void> {
    await this.sendRequest({ type: 'runQualityEnrichment', path });
  }

  /**
   * Register a repository for monitoring
   */
  async registerRepository(path: string): Promise<void> {
    await this.sendRequest({ type: 'register', path });
  }

  /**
   * Unregister a repository
   */
  async unregisterRepository(path: string): Promise<void> {
    await this.sendRequest({ type: 'unregister', path });
  }

  /**
   * Get git status for a repository
   */
  async getGitStatus(repoPath: string): Promise<GitStatusMetadata | null> {
    return this.sendRequest({
      type: 'getGitStatus',
      path: repoPath,
    });
  }

  /**
   * Get git status with file lists for a repository
   */
  async getGitStatusWithFiles(
    repoPath: string,
  ): Promise<GitStatusWithFiles | null> {
    return this.sendRequest({
      type: 'getGitStatusWithFiles',
      path: repoPath,
    });
  }

  /**
   * Acquire a watch reference for a repository.
   * Starts watching if this is the first reference.
   * @param repoPath - Path to the repository
   * @param referenceId - Unique identifier for this watch reference (e.g., workspace ID)
   */
  async acquireWatch(repoPath: string, referenceId: string): Promise<void> {
    await this.sendRequest({
      type: 'acquireWatch',
      path: repoPath,
      referenceId,
    });
  }

  /**
   * Release a watch reference for a repository.
   * Stops watching if this was the last reference.
   * @param repoPath - Path to the repository
   * @param referenceId - Unique identifier for the watch reference to release
   */
  async releaseWatch(repoPath: string, referenceId: string): Promise<void> {
    await this.sendRequest({
      type: 'releaseWatch',
      path: repoPath,
      referenceId,
    });
  }

  /**
   * Get git remote info for a repository
   */
  async getGitRemoteInfo(repoPath: string): Promise<GitRemoteInfo | null> {
    return this.sendRequest({
      type: 'getGitRemoteInfo',
      path: repoPath,
    });
  }

  /**
   * Invalidate git remote cache for a repository
   */
  async invalidateGitRemoteCache(repoPath: string): Promise<void> {
    await this.sendRequest({
      type: 'invalidateGitRemoteCache',
      path: repoPath,
    });
  }

  /**
   * The daemon reports cumulative CPU time (ms); turn it into the share of
   * one core used since the previous poll. The first reading for a daemon
   * (or after a restart) falls back to its lifetime average.
   */
  private cpuPercent(daemon: DaemonStatus): number {
    const { cpuMs } = daemon;
    const now = Date.now();
    const previous = this.lastCpuSample;
    this.lastCpuSample = { pid: daemon.pid, cpuMs, at: now };

    let usedMs: number;
    let elapsedMs: number;
    if (previous?.pid === daemon.pid && cpuMs >= previous.cpuMs) {
      usedMs = cpuMs - previous.cpuMs;
      elapsedMs = now - previous.at;
    } else {
      usedMs = cpuMs;
      elapsedMs = now - daemon.startedAt;
    }
    if (elapsedMs <= 0) return 0;
    return Math.round((usedMs / elapsedMs) * 1000) / 10;
  }

  /**
   * Get monitoring status including the daemon's resource usage
   */
  async getMonitoringStatus(): Promise<MonitoringStatus> {
    let repositories: RepositoryInfo[] = [];
    let daemon: MonitoringStatus['daemon'] = null;
    let currentMemory = 0;
    let currentCpu = 0;

    if (this.isConnected) {
      try {
        repositories = await this.sendRequest({ type: 'getRepositoryDetails' });
      } catch (error: unknown) {
        this.log('warn', `Failed to get repository details: ${String(error)}`);
      }
      try {
        daemon = await this.sendRequest({ type: 'getDaemonStatus' });
        currentMemory = daemon.memoryBytes;
        currentCpu = this.cpuPercent(daemon);
      } catch (error: unknown) {
        this.log('warn', `Failed to get daemon metrics: ${String(error)}`);
      }
    }

    if (currentMemory > 0 || currentCpu > 0) {
      this.resourceHistory.push({
        timestamp: Date.now(),
        memory: currentMemory,
        cpu: currentCpu,
      });

      // Keep only last 30 snapshots
      if (this.resourceHistory.length > 30) {
        this.resourceHistory.shift();
      }
    }

    return {
      repositories,
      currentMemory,
      currentCpu,
      history: [...this.resourceHistory],
      daemon,
    };
  }

  /**
   * Coarse connection status.
   */
  getStatus(): ServerStatus {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /**
   * Daemon-wide snapshot for a diagnostics UI: process status plus every
   * registered repository with the freshness of its cache slices.
   */
  async getDaemonDiagnostics(): Promise<RepoMonitorDiagnostics> {
    return this.client.status();
  }

  /** Hello of the daemon this process is connected to, when connected. */
  getDaemonInfo(): DaemonDiagnostics | null {
    const hello = this.hello;
    if (!hello) return null;
    return {
      socketPath: this.client.socketPath,
      pid: hello.pid,
      version: hello.version,
      bundledVersion: PACKAGE_VERSION,
      updateAvailable: isDaemonOutdated(hello.version),
      protocolVersion: hello.protocolVersion,
      nodeVersion: hello.nodeVersion ?? null,
      startedAt: hello.startedAt,
      spawnedBy: hello.spawnedBy,
      owner: toRepoMonitorOwner(hello.spawnedBy),
      logPath: this.client.paths.logPath,
    };
  }

  /**
   * Snapshot of this process's connection to the daemon: phase, daemon pid,
   * reconnect attempts, last error, last disconnect, recent lifecycle history.
   */
  getDiagnostics(): ServerDiagnostics {
    return {
      phase: this.currentPhase,
      connected: this.isConnected,
      daemonPid: this.hello?.pid ?? null,
      startedAt: this.startedAt,
      lastConnectedAt: this.lastConnectedAt,
      phaseEnteredAt: this.phaseEnteredAt,
      reconnectAttempts: this.reconnectAttempts,
      disconnectRequested: this.disconnectRequested,
      lastError: this.lastError,
      lastDisconnect: this.lastDisconnect,
      watcherImpl: this.activeWatcherImpl,
      requestedWatcherImpl: this.config.watcherImpl ?? 'parcel',
      watcherImplFallbackReason: this.watcherImplFallbackReason,
      lifecycleHistory: [...this.lifecycleHistory],
      daemon: this.getDaemonInfo(),
    };
  }

  /**
   * Update the requested watcher impl. Returns true if the request changed
   * the requested impl; callers should then `restartDaemon()` for the new
   * adapter to take effect (which affects every client of the daemon).
   */
  setWatcherImpl(impl: FileWatcherImpl): boolean {
    if (this.config.watcherImpl === impl) return false;
    this.config.watcherImpl = impl;
    this.log(
      'info',
      `Watcher impl changed to '${impl}' (daemon restart required)`,
    );
    return true;
  }

  /**
   * Read the tail of the main-process log and the daemon log. Either side
   * returns its own read error in-band so the UI can render a partial result.
   */
  async getLogTail(request: LogTailRequest = {}): Promise<LogTailResponse> {
    const mainLines = request.mainLines ?? DEFAULT_LOG_TAIL_LINES;
    const daemonLines = request.daemonLines ?? DEFAULT_LOG_TAIL_LINES;
    const mainLogPath = this.getMainLogPath();
    const daemonLogPath = this.getDaemonLogPath();

    const readSafe = async (
      logPath: string,
      maxLines: number,
    ): Promise<{ path: string; content: string; error?: string }> => {
      try {
        const content = await this.readLogFile(logPath, maxLines);
        return { path: logPath, content };
      } catch (err) {
        return {
          path: logPath,
          content: '',
          error: err instanceof Error ? err.message : String(err),
        };
      }
    };

    const [mainLog, daemonLog] = await Promise.all([
      readSafe(mainLogPath, mainLines),
      readSafe(daemonLogPath, daemonLines),
    ]);

    return { mainLog, daemonLog };
  }

  /**
   * Resolve dependency information using the repository monitoring server
   */
  async resolveDependency(
    dependencyId: string,
    repositoryRoot?: string,
  ): Promise<DependencyResolutionResult> {
    return this.sendRequest({
      type: 'resolveDependency',
      dependencyRequest: { dependencyId, repositoryRoot },
    });
  }

  /**
   * Get the path to the main process log file
   */
  getMainLogPath(): string {
    return getLogFilePath();
  }

  /**
   * Get the path to the daemon log file (stdout/stderr of the shared daemon).
   */
  getDaemonLogPath(): string {
    return this.client.paths.logPath;
  }

  /**
   * Read log file contents
   */
  async readLogFile(logPath: string, maxLines = 1000): Promise<string> {
    try {
      const content = await fsPromises.readFile(logPath, 'utf8');
      const lines = content.split('\n');
      // Return last N lines
      return lines.slice(-maxLines).join('\n');
    } catch (error) {
      this.log('error', `Failed to read log file: ${String(error)}`);
      throw error;
    }
  }

  /**
   * Get both log file paths
   */
  getLogPaths(): LogPaths {
    return {
      mainLog: this.getMainLogPath(),
      daemonLog: this.getDaemonLogPath(),
    };
  }
}
