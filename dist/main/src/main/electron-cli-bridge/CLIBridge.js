/**
 * CLIBridge - Core orchestrator for electron-cli-bridge
 * Manages utilityProcess workers and routes commands
 */
import { app, utilityProcess } from 'electron';
import { EventEmitter } from 'events';
import * as path from 'path';
export class CLIBridge extends EventEmitter {
    workers = new Map();
    pendingCalls = new Map();
    initialized = false;
    options;
    callCounter = 0;
    constructor(options = {}) {
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
    async initialize() {
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
    async spawnWorker(name, scriptName) {
        try {
            // Resolve worker path - always use absolute path from project root
            // Workers are plain JS files that don't need webpack compilation
            const fs = require('fs');
            let workerPath;
            // Try multiple possible locations
            const possiblePaths = [
                // Source location (most likely)
                path.join(process.cwd(), 'src', 'main', 'electron-cli-bridge', 'workers', scriptName),
                // Alternative if __dirname is available
                path.join(__dirname, 'workers', scriptName),
                // Development build location
                path.join(__dirname, '..', '..', 'src', 'main', 'electron-cli-bridge', 'workers', scriptName),
            ];
            // Log debugging info
            this.log('debug', `Looking for worker ${name} in:`);
            this.log('debug', `  - cwd: ${process.cwd()}`);
            this.log('debug', `  - __dirname: ${__dirname}`);
            // Find the first existing path
            for (const tryPath of possiblePaths) {
                this.log('debug', `  - Checking: ${tryPath}`);
                if (fs.existsSync(tryPath)) {
                    workerPath = tryPath;
                    break;
                }
            }
            if (!workerPath) {
                throw new Error(`Worker script not found. Tried: ${possiblePaths.join(', ')}`);
            }
            this.log('info', `Spawning ${name} worker from: ${workerPath}`);
            const worker = utilityProcess.fork(workerPath, [], {
                serviceName: `cli-bridge-${name}`,
                stdio: 'pipe',
            });
            // Set up event handlers
            worker.on('spawn', () => {
                this.log('info', `Worker ${name} spawned successfully`);
            });
            worker.on('message', (msg) => {
                // In Electron's utilityProcess, messages come directly
                // not wrapped in an event object
                this.handleWorkerMessage(name, msg);
            });
            // Handle stdout/stderr for debugging
            let stderrBuffer = '';
            if (worker.stdout) {
                worker.stdout.on('data', (data) => {
                    const output = data.toString();
                    this.log('debug', `[${name} stdout] ${output}`);
                    // Check for console.log messages from worker
                    if (output.includes('[Worker]')) {
                        this.log('info', `Worker output: ${output.trim()}`);
                    }
                });
            }
            if (worker.stderr) {
                worker.stderr.on('data', (data) => {
                    const output = data.toString();
                    stderrBuffer += output;
                    this.log('error', `[${name} stderr] ${output}`);
                });
            }
            // Handle exit with error reporting
            worker.on('exit', (code) => {
                if (code !== 0 && stderrBuffer) {
                    this.log('error', `Worker ${name} failed with stderr:\n${stderrBuffer}`);
                }
                this.handleWorkerExit(name, code);
            });
            this.workers.set(name, worker);
            // Wait for ready signal
            await this.waitForWorkerReady(name);
        }
        catch (error) {
            this.log('error', `Failed to spawn ${name} worker: ${error}`);
            throw error;
        }
    }
    /**
     * Wait for worker to send ready signal
     */
    waitForWorkerReady(name) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Worker ${name} failed to start within timeout`));
            }, 5000);
            const handler = (workerName, msg) => {
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
    handleWorkerMessage(workerName, msg) {
        this.log('debug', `Message from ${workerName}: ${JSON.stringify(msg)}`);
        this.emit('worker-message', workerName, msg);
        // Handle ready messages
        if (msg && msg.type === 'ready') {
            this.log('info', `Worker ${workerName} is ready`);
            return;
        }
        // Route to pending call
        const response = msg;
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
                const duration = response.duration || (Date.now() - pendingCall.startTime);
                const result = {
                    success: response.exitCode === 0,
                    stdout: response.data || '',
                    stderr: '',
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
    handleWorkerExit(name, code) {
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
                    this.spawnWorker('universal', 'universal-worker.js').catch(error => {
                        this.log('error', `Failed to restart worker ${name}: ${error}`);
                    });
                }
            }, 1000);
        }
    }
    /**
     * Execute a command
     */
    async execute(command, args = [], options = {}) {
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
            const workerCommand = {
                id,
                type: 'execute',
                command,
                args,
                options,
            };
            worker.postMessage(workerCommand);
            this.log('debug', `Sent command ${id} to worker: ${command} ${args.join(' ')}`);
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
    selectWorker(command) {
        // For now, always use universal worker
        // Later we can add routing logic for specialized workers
        return this.workers.get('universal');
    }
    /**
     * Generate unique call ID
     */
    generateCallId() {
        return `${Date.now()}-${++this.callCounter}`;
    }
    /**
     * Shutdown the bridge and all workers
     */
    async shutdown() {
        this.initialized = false;
        // Kill all workers
        for (const [name, worker] of this.workers.entries()) {
            this.log('info', `Shutting down worker ${name}`);
            worker.kill();
        }
        this.workers.clear();
        // Reject all pending calls
        for (const [id, call] of this.pendingCalls.entries()) {
            call.reject(new Error('CLIBridge shutting down'));
        }
        this.pendingCalls.clear();
        this.log('info', 'CLIBridge shutdown complete');
    }
    /**
     * Logging utility
     */
    log(level, message) {
        const levels = ['debug', 'info', 'warn', 'error'];
        const currentLevelIndex = levels.indexOf(this.options.logLevel || 'info');
        const messageLevelIndex = levels.indexOf(level);
        if (messageLevelIndex >= currentLevelIndex) {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] [CLIBridge] [${level.toUpperCase()}] ${message}`);
        }
    }
}
