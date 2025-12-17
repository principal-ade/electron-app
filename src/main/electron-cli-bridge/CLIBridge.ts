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
    await this.spawnWorker('universal', 'universal-worker.cjs');

    this.initialized = true;
    this.log('info', 'CLIBridge initialized successfully');
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
        // In development, __dirname will be in dist/main after TypeScript compilation
        // The worker .cjs file is in src/main/electron-cli-bridge/workers
        const srcWorkerPath = path.join(
          app.getAppPath(),
          'src',
          'main',
          'electron-cli-bridge',
          'workers',
          scriptName,
        );

        // Also check if it's in the dist folder (for compiled development builds)
        const distWorkerPath = path.join(
          __dirname,
          'src',
          'main',
          'electron-cli-bridge',
          'workers',
          scriptName,
        );

        if (fs.existsSync(srcWorkerPath)) {
          workerPath = srcWorkerPath;
        } else if (fs.existsSync(distWorkerPath)) {
          workerPath = distWorkerPath;
        } else {
          throw new Error(
            `Worker script not found in development. Tried:\n` +
              `  - ${srcWorkerPath}\n` +
              `  - ${distWorkerPath}`,
          );
        }
        this.log('info', `Development mode: found worker at ${workerPath}`);
      }

      // Verify the worker file exists
      if (!fs.existsSync(workerPath)) {
        throw new Error(
          `Worker script not found at: ${workerPath}\n` +
            `isPackaged: ${app.isPackaged}\n` +
            `__dirname: ${__dirname}\n` +
            `app.getAppPath(): ${app.getAppPath()}`,
        );
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
        this.log('info', `Worker ${name} spawned successfully`);
      });

      worker.on('message', (msg: any) => {
        // In Electron's utilityProcess, messages come directly
        // not wrapped in an event object
        this.handleWorkerMessage(name, msg);
      });

      // Handle stdout/stderr for debugging
      let stderrBuffer = '';
      if (worker.stdout) {
        worker.stdout.on('data', (data: Buffer) => {
          const output = data.toString();
          this.log('debug', `[${name} stdout] ${output}`);
          // Check for console.log messages from worker
          // Removed: worker output logging
        });
      }

      if (worker.stderr) {
        worker.stderr.on('data', (data: Buffer) => {
          const output = data.toString();
          stderrBuffer += output;
          this.log('error', `[${name} stderr] ${output}`);
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
      const timeout = setTimeout(() => {
        reject(new Error(`Worker ${name} failed to start within timeout`));
      }, 5000);

      const handler = (workerName: string, msg: any) => {
        if (workerName === name && msg.type === 'ready') {
          clearTimeout(timeout);
          this.removeListener('worker-message', handler);
          resolve();
        }
      };

      this.on('worker-message', handler);
    });
  }

  /**
   * Handle messages from workers
   */
  private handleWorkerMessage(workerName: string, msg: any): void {
    this.log('debug', `Message from ${workerName}: ${JSON.stringify(msg)}`);
    this.emit('worker-message', workerName, msg);

    // Handle ready messages
    if (msg && msg.type === 'ready') {
      this.log('info', `Worker ${workerName} is ready`);
      return;
    }

    // Route to pending call
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

      case 'complete':
        const duration =
          response.duration || Date.now() - pendingCall.startTime;
        const result: ExecuteResult = {
          success: response.exitCode === 0,
          stdout: response.data || '',
          stderr: response.stderr || '',
          exitCode: response.exitCode || 0,
          duration,
        };
        pendingCall.resolve(result);
        this.pendingCalls.delete(response.id);
        break;

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
    this.workers.delete(name);

    // Reject all pending calls for this worker
    for (const [id, call] of this.pendingCalls.entries()) {
      call.reject(new Error(`Worker ${name} exited unexpectedly`));
      this.pendingCalls.delete(id);
    }

    // Attempt to restart the worker if bridge is still initialized
    if (this.initialized) {
      this.log('info', `Attempting to restart worker ${name}`);
      setTimeout(() => {
        if (name === 'universal') {
          this.spawnWorker('universal', 'universal-worker.js').catch(
            (error) => {
              this.log('error', `Failed to restart worker ${name}: ${error}`);
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
