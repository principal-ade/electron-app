/**
 * RepositoryMonitoringManager - Manages the repository monitoring utility process from main
 * Handles communication between main process and the repository monitoring worker
 */

import { app, utilityProcess, UtilityProcess, BrowserWindow } from 'electron';
import { EventEmitter } from 'events';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

import type {
  MainToServerMessage,
  ServerToMainMessage,
  ExtendedQualityMetrics,
  PackageSummary,
  PackageWithMetrics,
  DependencyResolutionResult,
} from '../../repository-monitoring-server/types';
import type { FileTree } from '@principal-ai/repository-abstraction';
import type { PackageLayer } from '@principal-ai/codebase-composition';
import type {
  MonitoringStatus,
  ResourceSnapshot,
  RepositoryInfo,
  RepositoryCacheSnapshot,
} from '../../shared/main-process-api-interfaces/RepositoryMonitoringAPI';

/**
 * Configuration for RepositoryMonitoringManager
 */
export interface RepositoryMonitoringManagerConfig {
  autoStart: boolean;
  restartOnCrash: boolean;
  maxRestartAttempts: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

const DEFAULT_CONFIG: RepositoryMonitoringManagerConfig = {
  autoStart: true,
  restartOnCrash: true,
  maxRestartAttempts: 3,
  logLevel: 'info',
};

/**
 * Response promise resolver
 */
interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Manages the repository monitoring server utility process
 */
export class RepositoryMonitoringManager extends EventEmitter {
  private config: RepositoryMonitoringManagerConfig;
  private worker: UtilityProcess | null = null;
  private isRunning = false;
  private isReady = false;
  private restartAttempts = 0;
  private shutdownRequested = false;
  private pendingRequests = new Map<string, PendingRequest>();
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;
  private resourceHistory: ResourceSnapshot[] = [];
  private lastCpuUsage = process.cpuUsage();
  private lastCpuCheck = Date.now();
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<RepositoryMonitoringManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (this.config.autoStart) {
      this.start().catch((error) => {
        this.log('error', `Failed to auto-start repository monitoring server: ${error}`);
      });
    }
  }

  /**
   * Start the repository monitoring server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.log('debug', 'Repository monitoring server already running');
      return this.readyPromise || Promise.resolve();
    }

    // Create ready promise
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });

    // Ensure app is ready
    if (!app.isReady()) {
      await app.whenReady();
    }

    try {
      this.log('info', 'Starting repository monitoring server...');
      this.shutdownRequested = false;

      await this.spawnWorker();
      this.isRunning = true;
      this.restartAttempts = 0;

      // Wait for ready signal
      return this.readyPromise;
    } catch (error) {
      this.log('error', `Failed to start repository monitoring server: ${error}`);
      throw error;
    }
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    this.shutdownRequested = true;
    this.stopMetricsCollection(); // Stop collecting metrics when stopping
    if (this.worker) {
      this.log('info', 'Stopping repository monitoring server...');
      this.worker.kill();
      this.worker = null;
    }
    this.isRunning = false;
    this.isReady = false;
  }

  /**
   * Spawn the worker process
   */
  private async spawnWorker(): Promise<void> {
    const fs = require('fs');
    let workerPath: string;

    if (!app.isPackaged) {
      // Development: use the webpack-compiled bundle
      // The bundle is created by webpack and placed in .erb/dll
      workerPath = path.join(__dirname, 'repository-monitoring-worker.bundle.dev.js');

      // __dirname in dev is .erb/dll, so the file should be right there
      this.log('debug', `Looking for development worker at: ${workerPath}`);
    } else {
      // Production: use the webpack-compiled bundle from dist
      workerPath = path.join(__dirname, 'repository-monitoring-worker.js');

      this.log('debug', `Looking for production worker at: ${workerPath}`);
    }

    // Verify the worker file exists
    if (!fs.existsSync(workerPath)) {
      const errorMsg = `Worker bundle not found at: ${workerPath}\n` +
        'The repository-monitoring-worker bundle has not been compiled by webpack.\n' +
        'Please ensure webpack is configured with the repository-monitoring-worker entry point and has compiled successfully.';
      this.log('error', errorMsg);
      throw new Error(errorMsg);
    }

    this.log('info', `Found worker bundle at: ${workerPath}`);
    this.log('debug', `Spawning worker from: ${workerPath}`);

    this.worker = utilityProcess.fork(workerPath, [], {
      serviceName: 'repository-monitoring-server',
      stdio: 'pipe',
    });

    // Set up IPC handlers
    this.worker.on('message', (msg: any) => this.handleWorkerMessage(msg));

    // Handle worker exit
    this.worker.on('exit', (code: number) => {
      this.handleWorkerExit(code);
    });

    // Handle worker spawn events
    this.worker.on('spawn', () => {
      this.log('info', 'Repository monitoring worker spawned successfully');
    });

    // Pipe stdout/stderr for debugging
    if (this.worker.stdout) {
      this.worker.stdout.on('data', (data: Buffer) => {
        const message = data.toString().trim();
        if (message) {
          this.log('info', `[Worker stdout] ${message}`);
        }
      });
    }

    if (this.worker.stderr) {
      this.worker.stderr.on('data', (data: Buffer) => {
        const message = data.toString().trim();
        if (message) {
          this.log('warn', `[Worker stderr] ${message}`);
        }
      });
    }
  }

  /**
   * Handle messages from the worker process
   */
  private handleWorkerMessage(msg: ServerToMainMessage): void {
    this.log('debug', `Received message from worker: ${msg.type}`);

    switch (msg.type) {
      case 'ready':
        this.isReady = true;
        this.log('info', 'Repository monitoring server is ready');
        this.startMetricsCollection(); // Start collecting metrics when ready
        this.emit('ready');
        if (this.readyResolve) {
          this.readyResolve();
          this.readyResolve = null;
        }
        break;

      case 'response':
        if (msg.id && this.pendingRequests.has(msg.id)) {
          const pending = this.pendingRequests.get(msg.id)!;
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(msg.id);
          pending.resolve(msg.result);
        }
        break;

      case 'error':
        if (msg.id && this.pendingRequests.has(msg.id)) {
          const pending = this.pendingRequests.get(msg.id)!;
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(msg.id);
          pending.reject(new Error(msg.error || 'Unknown error'));
        } else {
          this.log('error', `Worker error: ${msg.error}`);
          this.emit('error', new Error(msg.error || 'Unknown error'));
        }
        break;

      case 'event':
        if (msg.event) {
          this.emit(msg.event.name, msg.event.data);
          // Forward specific events to renderer windows
          this.broadcastToWindows(msg.event.name, msg.event.data);
        }
        break;

      default:
        this.log('warn', `Unknown message type from worker: ${(msg as any).type}`);
    }
  }

  /**
   * Handle worker process exit
   */
  private handleWorkerExit(code: number): void {
    this.log('info', `Repository monitoring worker exited with code ${code}`);
    this.isRunning = false;
    this.isReady = false;
    this.worker = null;

    // Clear all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Worker process exited'));
    }
    this.pendingRequests.clear();

    // Attempt restart if not shutting down
    if (!this.shutdownRequested && this.config.restartOnCrash) {
      if (this.restartAttempts < this.config.maxRestartAttempts) {
        this.restartAttempts++;
        this.log('info', `Attempting to restart worker (attempt ${this.restartAttempts}/${this.config.maxRestartAttempts})`);

        setTimeout(() => {
          this.start().catch((error) => {
            this.log('error', `Failed to restart worker: ${error}`);
          });
        }, 1000 * this.restartAttempts); // Exponential backoff
      } else {
        this.log('error', 'Max restart attempts reached. Worker will not be restarted.');
        this.emit('fatal-error', new Error('Worker process failed to restart'));
      }
    }

    this.emit('stopped', code);
  }

  /**
   * Send a request to the worker and wait for response
   */
  private async sendRequest(message: Omit<MainToServerMessage, 'id'>): Promise<any> {
    if (!this.isReady) {
      await this.waitForReady();
    }

    const id = uuidv4();
    const fullMessage: MainToServerMessage = { ...message, id };

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${message.type}`));
      }, 30000); // 30 second timeout

      // Store pending request
      this.pendingRequests.set(id, { resolve, reject, timeout });

      // Send message to worker
      if (this.worker) {
        this.worker.postMessage(fullMessage);
      } else {
        this.pendingRequests.delete(id);
        clearTimeout(timeout);
        reject(new Error('Worker not available'));
      }
    });
  }

  /**
   * Wait for the worker to be ready
   */
  private async waitForReady(timeout = 10000): Promise<void> {
    if (this.isReady) return;

    if (!this.isRunning) {
      await this.start();
      return;
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timeout waiting for worker to be ready'));
      }, timeout);

      const checkReady = () => {
        if (this.isReady) {
          clearTimeout(timer);
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };

      checkReady();
    });
  }

  /**
   * Broadcast events to all renderer windows
   */
  private broadcastToWindows(eventName: string, data: any): void {
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      window.webContents.send(`repository-monitoring:${eventName}`, data);
    }
  }

  /**
   * Log messages based on level
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevelIndex = levels.indexOf(this.config.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    if (messageLevelIndex >= configLevelIndex) {
      const prefix = '[RepositoryMonitoringManager]';
      switch (level) {
        case 'debug':
          console.debug(prefix, message);
          break;
        case 'info':
          console.log(prefix, message);
          break;
        case 'warn':
          console.warn(prefix, message);
          break;
        case 'error':
          console.error(prefix, message);
          break;
      }
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
  async getPackages(path: string): Promise<{ packages: PackageLayer[]; summary: PackageSummary } | null> {
    return this.sendRequest({ type: 'getPackages', path });
  }

  /**
   * Get the repository cache snapshot composed by the worker-side registry
   */
  async getRepositoryCacheSnapshot(path: string): Promise<RepositoryCacheSnapshot> {
    return this.sendRequest({ type: 'getRepositoryCacheSnapshot', path });
  }

  /**
   * Refresh repository data
   */
  async refreshRepository(path: string): Promise<void> {
    await this.sendRequest({ type: 'refresh', path });
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
  async getGitStatus(repoPath: string): Promise<any> {
    return this.sendRequest({
      type: 'getGitStatus',
      path: repoPath,
    });
  }

  /**
   * Get git status with file lists for a repository
   */
  async getGitStatusWithFiles(repoPath: string): Promise<any> {
    return this.sendRequest({
      type: 'getGitStatusWithFiles',
      path: repoPath,
    });
  }

  /**
   * Enable git watching for a repository
   */
  async enableGitWatching(repoPath: string): Promise<void> {
    await this.sendRequest({
      type: 'enableGitWatching',
      path: repoPath,
    });
  }

  /**
   * Disable git watching for a repository
   */
  async disableGitWatching(repoPath: string): Promise<void> {
    await this.sendRequest({
      type: 'disableGitWatching',
      path: repoPath,
    });
  }

  /**
   * Get git remote info for a repository
   */
  async getGitRemoteInfo(repoPath: string): Promise<any> {
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
   * Get monitoring status including resource usage
   */
  async getMonitoringStatus(): Promise<MonitoringStatus> {
    // Get detailed repository information from the worker
    let repositories: RepositoryInfo[] = [];
    try {
      if (this.isReady && this.worker) {
        const response = await this.sendRequest({ type: 'getRepositoryDetails' });
        repositories = response || [];
      }
    } catch (error) {
      this.log('warn', `Failed to get repository details: ${error}`);
      repositories = [];
    }

    // Collect current metrics if worker is running
    let currentMemory = 0;
    let currentCpu = 0;

    if (this.worker) {
      // Get memory usage from worker process
      // Note: Electron doesn't expose utility process memory directly,
      // so we'll request it from the worker
      try {
        const metrics = await this.sendRequest({ type: 'getResourceMetrics' });
        currentMemory = metrics.memory || 0;
        currentCpu = metrics.cpu || 0;
      } catch (error) {
        // Fallback to main process metrics if worker doesn't respond
        const memory = process.memoryUsage();
        currentMemory = memory.rss;

        const cpuUsage = process.cpuUsage();
        const elapsedMs = Date.now() - this.lastCpuCheck;
        const elapsedUser = cpuUsage.user - this.lastCpuUsage.user;
        const elapsedSystem = cpuUsage.system - this.lastCpuUsage.system;
        currentCpu = Math.min(100, Math.max(0, ((elapsedUser + elapsedSystem) / 1000 / elapsedMs) * 100));

        this.lastCpuUsage = cpuUsage;
        this.lastCpuCheck = Date.now();
      }
    }

    // Add current snapshot to history
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
    };
  }

  /**
   * Start collecting resource metrics periodically
   */
  private startMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Collect metrics every 2 seconds
    this.metricsInterval = setInterval(() => {
      if (this.isReady && this.worker) {
        this.getMonitoringStatus().catch((error) => {
          this.log('debug', `Failed to collect metrics: ${error}`);
        });
      }
    }, 2000);
  }

  /**
   * Stop collecting resource metrics
   */
  private stopMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  /**
   * Get server status
   */
  getStatus(): { running: boolean; ready: boolean; restartAttempts: number } {
    return {
      running: this.isRunning,
      ready: this.isReady,
      restartAttempts: this.restartAttempts,
    };
  }

  /**
   * Resolve dependency information using the repository monitoring server
   */
  async resolveDependency(dependencyId: string, repositoryRoot?: string): Promise<DependencyResolutionResult> {
    return this.sendRequest({ 
      type: 'resolveDependency', 
      dependencyRequest: { dependencyId, repositoryRoot } 
    });
  }
}