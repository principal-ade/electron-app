/**
 * CLIBridge - Core orchestrator for electron-cli-bridge
 * Manages utilityProcess workers and routes commands
 */

import { app, utilityProcess, UtilityProcess } from 'electron';
import { EventEmitter } from 'events';
import * as path from 'path';
import {
  CLIBridgeOptions,
  ExecuteOptions,
  ExecuteResult,
  PendingCall,
  WorkerCommand,
  WorkerResponse,
  WorkerCommandType,
} from './types';
import { terminalEnvironment } from '../terminalEnvironment';

export class CLIBridge extends EventEmitter {
  private workers: Map<string, UtilityProcess> = new Map();
  private pendingCalls: Map<string, PendingCall> = new Map();
  private workerStartTimes: Map<string, number> = new Map();
  private initialized = false;
  private options: CLIBridgeOptions;
  private callCounter = 0;

  constructor(options: CLIBridgeOptions = {}) {
    super();
    this.options = {
      maxWorkers: options.maxWorkers || 3,
      workerTimeout: options.workerTimeout || 60000,
      logLevel: options.logLevel || 'info',
    };
  }

  /**
   * Initialize the bridge and spawn workers
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.log('debug', 'CLIBridge already initialized');
      return;
    }

    // Ensure app is ready
    if (!app.isReady()) {
      await app.whenReady();
    }

    // Spawn the universal worker
    try {
      await this.spawnWorker('universal', 'universal-worker.cjs');
      this.initialized = true;
      this.log('info', 'CLIBridge initialized successfully');
    } catch (error) {
      this.log('error', `Worker spawn failed: ${error}`);

      // WORKAROUND: If spawn times out but worker is running, test if it's responsive
      this.log('info', 'Attempting automatic recovery via testWorker()...');
      try {
        const testResult = await this.testWorker();
        if (testResult.success) {
          this.log('info', 'Worker is responsive despite timeout! Marking as initialized.');
          this.initialized = true;
          return;
        } else {
          this.log('error', `Worker test failed: ${testResult.error}`);
        }
      } catch (testError) {
        this.log('error', `Worker test threw error: ${testError}`);
      }

      // Re-throw original error if recovery failed
      throw error;
    }
  }

  /**
   * Spawn a worker process
   */
  private async spawnWorker(name: string, scriptName: string): Promise<void> {
    try {
      const fs = require('fs');
      let workerPath: string;

      // Determine the correct path based on whether we're in production or development
      if (app.isPackaged) {
        // Production: app is packaged, worker should be in dist/main/workers
        workerPath = path.join(__dirname, 'workers', scriptName);
        this.log(
          'info',
          `Production mode: looking for worker at ${workerPath}`,
        );
      } else {
        // Development: running from source
        // ALWAYS prefer the source file to avoid stale compiled versions
        const srcWorkerPath = path.join(
          app.getAppPath(),
          'src',
          'main',
          'electron-cli-bridge',
          'workers',
          scriptName,
        );

        // Fallback to dist folder (for compiled development builds)
        const distWorkerPath = path.join(
          __dirname,
          'src',
          'main',
          'electron-cli-bridge',
          'workers',
          scriptName,
        );

        // Check source first, then dist
        const pathsToTry = [srcWorkerPath, distWorkerPath];
        let foundPath: string | null = null;

        for (const tryPath of pathsToTry) {
          if (fs.existsSync(tryPath)) {
            foundPath = tryPath;
            this.log('info', `Development mode: found worker at ${tryPath}`);

            // Log file stats to help debug stale file issues
            try {
              const stats = fs.statSync(tryPath);
              this.log('info', `  Size: ${stats.size} bytes, Modified: ${stats.mtime.toISOString()}`);
            } catch (_e) {
              // Ignore stat errors
            }
            break;
          } else {
            this.log('debug', `Worker not found at ${tryPath}, trying next location...`);
          }
        }

        if (!foundPath) {
          throw new Error(
            `Worker script not found in development. Tried:\n` +
              pathsToTry.map(p => `  - ${p}`).join('\n'),
          );
        }

        workerPath = foundPath;
      }

      // Final verification (should always pass since we checked in the loop above)
      if (!fs.existsSync(workerPath)) {
        const errorMessage =
          `Worker script not found at: ${workerPath}\n` +
          `isPackaged: ${app.isPackaged}\n` +
          `__dirname: ${__dirname}\n` +
          `app.getAppPath(): ${app.getAppPath()}`;
        this.log('error', errorMessage);
        throw new Error(errorMessage);
      }

      this.log('info', `Spawning ${name} worker from: ${workerPath}`);

      // Get the full user PATH from terminal environment to ensure
      // all user-installed tools (npm, git, etc.) are available
      const userPath = await terminalEnvironment.getUserPath();

      // Pass SSH-related environment variables to the worker for Git SSH operations
      const workerEnv = {
        ...process.env,
        // Use full user PATH to find npm, git, and other tools
        PATH: userPath,
        // Ensure SSH agent socket is passed
        SSH_AUTH_SOCK: process.env.SSH_AUTH_SOCK,
        // Ensure HOME is set for SSH key lookup
        HOME: process.env.HOME,
      };

      const worker = utilityProcess.fork(workerPath, [], {
        serviceName: `cli-bridge-${name}`,
        stdio: 'pipe',
        env: workerEnv,
      });

      // Set up event handlers
      worker.on('spawn', () => {
        this.log('info', `Worker ${name} spawned (pid: ${worker.pid})`);
      });

      worker.on('message', (msg: WorkerResponse | { type: 'ready' }) => {
        // In Electron's utilityProcess, messages come directly
        // not wrapped in an event object
        this.handleWorkerMessage(name, msg);
      });

      // Handle stderr for debugging. Worker stdout is intentionally not
      // forwarded — git blame --line-porcelain sweeps can dump megabytes of
      // metadata that drown the terminal; the real result comes back via IPC.
      let stderrBuffer = '';

      if (worker.stderr) {
        worker.stderr.on('data', (data: Buffer) => {
          const output = data.toString().trim();
          if (output) {
            stderrBuffer += output;
            this.log('error', `[${name} stderr] ${output}`);
          }
        });
      }

      // Handle exit with error reporting
      worker.on('exit', (code: number) => {
        if (code !== 0 && stderrBuffer) {
          this.log(
            'error',
            `Worker ${name} failed with stderr:\n${stderrBuffer}`,
          );
        }
        this.handleWorkerExit(name, code);
      });

      this.workers.set(name, worker);
      this.workerStartTimes.set(name, Date.now());

      // Wait for ready signal
      await this.waitForWorkerReady(name);
    } catch (error) {
      this.log('error', `Failed to spawn ${name} worker: ${error}`);
      throw error;
    }
  }

  /**
   * Wait for worker to send ready signal
   */
  private waitForWorkerReady(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          this.removeListener('worker-message', messageHandler);
          this.removeListener('worker-exit', exitHandler);
        }
      };

      // Safety net timeout - only for truly hung processes (30s)
      const timeout = setTimeout(() => {
        if (!settled) {
          cleanup();
          this.log('error', `Worker ${name} failed to send ready signal within 30 seconds`);
          this.log('error', `  Worker PID: ${this.workers.get(name)?.pid || 'unknown'}`);
          this.log('error', `  Worker process exists: ${this.workers.has(name)}`);
          this.log('error', `  WORKAROUND: You can use testWorker() to verify if the worker is actually responsive`);
          reject(new Error(`Worker ${name} failed to start within timeout (30s safety limit)`));
        }
      }, 30000);

      // Listen for ready message
      const messageHandler = (workerName: string, msg: WorkerResponse | { type: 'ready' }) => {
        if (workerName === name && msg.type === 'ready') {
          cleanup();
          this.log('info', `Worker ${name} ready signal received`);
          resolve();
        }
      };

      // Listen for worker crash/exit during startup
      const exitHandler = (workerName: string, code: number) => {
        if (workerName === name && !settled) {
          cleanup();
          this.log('error', `Worker ${name} exited with code ${code} during startup`);
          reject(new Error(`Worker ${name} crashed during startup (exit code: ${code})`));
        }
      };

      this.on('worker-message', messageHandler);
      this.on('worker-exit', exitHandler);
    });
  }

  /**
   * Handle messages from workers
   */
  private handleWorkerMessage(workerName: string, msg: WorkerResponse | { type: 'ready' }): void {
    this.log('debug', `Message from ${workerName}: ${JSON.stringify(msg)}`);
    this.emit('worker-message', workerName, msg);

    // Handle ready messages
    if (msg && msg.type === 'ready') {
      this.log('info', `Worker ${workerName} is ready`);
      return;
    }

    // Route to pending call (msg is now guaranteed to be WorkerResponse)
    const response = msg as WorkerResponse;
    const pendingCall = this.pendingCalls.get(response.id);

    if (!pendingCall) {
      this.log('warn', `Received response for unknown call: ${response.id}`);
      return;
    }

    switch (response.type) {
      case 'stdout':
        if (pendingCall.onStdout && response.data) {
          pendingCall.onStdout(response.data);
        }
        break;

      case 'stderr':
        if (pendingCall.onStderr && response.data) {
          pendingCall.onStderr(response.data);
        }
        break;

      case 'complete': {
        const duration =
          response.duration || Date.now() - pendingCall.startTime;
        const result: ExecuteResult = {
          success: response.exitCode === 0,
          stdout: response.data || '',
          stderr: response.stderr || '',
          exitCode: response.exitCode || 0,
          duration,
          failureReason: response.failureReason,
          signal: response.signal,
        };
        pendingCall.resolve(result);
        this.pendingCalls.delete(response.id);
        break;
      }

      case 'error':
        pendingCall.reject(new Error(response.error || 'Unknown error'));
        this.pendingCalls.delete(response.id);
        break;

      default:
        this.log('warn', `Unknown response type: ${response.type}`);
    }
  }

  /**
   * Handle worker exit
   */
  private handleWorkerExit(name: string, code: number): void {
    this.log('warn', `Worker ${name} exited with code ${code}`);
    this.log('warn', `  Pending calls being rejected: ${this.pendingCalls.size}`);
    this.emit('worker-exit', name, code);
    this.workers.delete(name);
    this.workerStartTimes.delete(name);

    // Reject all pending calls for this worker
    const pendingCount = this.pendingCalls.size;
    for (const [id, call] of this.pendingCalls.entries()) {
      call.reject(new Error(`Worker ${name} exited unexpectedly (exit code: ${code})`));
      this.pendingCalls.delete(id);
    }
    if (pendingCount > 0) {
      this.log('warn', `Rejected ${pendingCount} pending calls due to worker exit`);
    }

    // Attempt to restart the worker if bridge is still initialized
    if (this.initialized) {
      this.log('info', `Attempting to restart worker ${name}`);
      setTimeout(() => {
        if (name === 'universal') {
          this.spawnWorker('universal', 'universal-worker.cjs').catch(
            (error) => {
              this.log('error', `Failed to restart worker ${name}: ${error}`);
              // If restart fails, mark as uninitialized so next command will try again
              this.initialized = false;
            },
          );
        }
      }, 1000);
    }
  }

  /**
   * Execute a command
   */
  async execute(
    command: string,
    args: string[] = [],
    options: ExecuteOptions = {},
  ): Promise<ExecuteResult> {
    if (!this.initialized) {
      throw new Error('CLIBridge not initialized. Call initialize() first.');
    }

    const worker = this.selectWorker(command);
    if (!worker) {
      throw new Error('No worker available for command execution');
    }

    // Check if worker process is actually running
    if (!worker.pid) {
      this.log('error', 'Worker process is not running (no PID)');
      this.log('error', 'Marking bridge as uninitialized to trigger re-initialization');
      this.initialized = false;
      throw new Error('Worker process is not running. Try restarting the worker.');
    }

    const id = this.generateCallId();

    return new Promise((resolve, reject) => {
      // Store pending call
      this.pendingCalls.set(id, {
        resolve,
        reject,
        options,
        startTime: Date.now(),
      });

      // Send command to worker
      const workerCommand: WorkerCommand = {
        id,
        type: 'execute' as WorkerCommandType,
        command,
        args,
        options,
      };

      worker.postMessage(workerCommand);
      this.log(
        'debug',
        `Sent command ${id} to worker: ${command} ${args.join(' ')}`,
      );

      // Set timeout if specified
      if (options.timeout) {
        setTimeout(() => {
          if (this.pendingCalls.has(id)) {
            this.pendingCalls.delete(id);
            reject(new Error(`Command timeout: ${command}`));
          }
        }, options.timeout);
      }
    });
  }

  /**
   * Select appropriate worker for command
   */
  private selectWorker(_command: string): UtilityProcess | undefined {
    // For now, always use universal worker
    // Later we can add routing logic for specialized workers
    return this.workers.get('universal');
  }

  /**
   * Generate unique call ID
   */
  private generateCallId(): string {
    return `${Date.now()}-${++this.callCounter}`;
  }

  /**
   * Shutdown the bridge and all workers
   */
  async shutdown(): Promise<void> {
    this.initialized = false;

    // Kill all workers
    for (const [name, worker] of this.workers.entries()) {
      this.log('info', `Shutting down worker ${name}`);
      worker.kill();
    }

    this.workers.clear();

    // Reject all pending calls
    for (const [_id, call] of this.pendingCalls.entries()) {
      call.reject(new Error('CLIBridge shutting down'));
    }
    this.pendingCalls.clear();

    this.log('info', 'CLIBridge shutdown complete');
  }

  /**
   * Get status of CLIBridge and its workers
   */
  getStatus(): {
    initialized: boolean;
    workers: Array<{
      name: string;
      pid: number | null;
      isRunning: boolean;
      startedAt: number | null;
    }>;
    pendingCalls: number;
  } {
    const workers: Array<{
      name: string;
      pid: number | null;
      isRunning: boolean;
      startedAt: number | null;
    }> = [];

    for (const [name, worker] of this.workers.entries()) {
      workers.push({
        name,
        pid: worker.pid ?? null,
        isRunning: worker.pid !== undefined && worker.pid !== null,
        startedAt: this.workerStartTimes.get(name) ?? null,
      });
    }

    return {
      initialized: this.initialized,
      workers,
      pendingCalls: this.pendingCalls.size,
    };
  }

  /**
   * Restart the universal worker
   */
  async restartWorker(name: string = 'universal'): Promise<{ success: boolean; error?: string }> {
    try {
      this.log('info', `Restarting worker: ${name}`);

      // Kill the existing worker if it exists
      const existingWorker = this.workers.get(name);
      if (existingWorker) {
        existingWorker.kill();
        this.workers.delete(name);
        this.workerStartTimes.delete(name);
      }

      // Spawn a new worker
      await this.spawnWorker(name, `${name}-worker.cjs`);

      this.log('info', `Worker ${name} restarted successfully`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log('error', `Failed to restart worker ${name}: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Test the worker by executing a simple command
   * Works even if initialization timed out, as long as worker is running
   */
  async testWorker(): Promise<{
    success: boolean;
    duration: number;
    output?: string;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      // Check if we have a running worker
      const worker = this.workers.get('universal');
      if (!worker || worker.pid === undefined) {
        return {
          success: false,
          duration: Date.now() - startTime,
          error: 'No worker process running',
        };
      }

      // Bypass the initialized check - send command directly to worker
      const id = this.generateCallId();

      const result = await new Promise<ExecuteResult>((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.pendingCalls.delete(id);
          reject(new Error('Test command timed out after 5 seconds'));
        }, 5000);

        this.pendingCalls.set(id, {
          resolve: (result: ExecuteResult) => {
            clearTimeout(timeout);
            resolve(result);
          },
          reject: (error: Error) => {
            clearTimeout(timeout);
            reject(error);
          },
          options: {},
          startTime: Date.now(),
        });

        // Send test command to worker
        worker.postMessage({
          id,
          type: 'execute' as const,
          command: 'echo',
          args: ['CLIBridge test'],
          options: { timeout: 5000 },
        });
      });

      const duration = Date.now() - startTime;

      // If test succeeds, mark as initialized since worker is clearly functional
      if (result.success) {
        this.initialized = true;
      }

      return {
        success: result.success,
        duration,
        output: result.stdout?.trim(),
        error: result.stderr,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Logging utility
   */
  private log(level: string, message: string): void {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.options.logLevel || 'info');
    const messageLevelIndex = levels.indexOf(level);

    if (messageLevelIndex >= currentLevelIndex) {
      const timestamp = new Date().toISOString();
      console.log(
        `[${timestamp}] [CLIBridge] [${level.toUpperCase()}] ${message}`,
      );
    }
  }
}
