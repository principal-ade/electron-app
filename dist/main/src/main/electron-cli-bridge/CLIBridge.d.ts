/**
 * CLIBridge - Core orchestrator for electron-cli-bridge
 * Manages utilityProcess workers and routes commands
 */
import { EventEmitter } from 'events';
import { CLIBridgeOptions, ExecuteOptions, ExecuteResult } from './types';
export declare class CLIBridge extends EventEmitter {
    private workers;
    private pendingCalls;
    private initialized;
    private options;
    private callCounter;
    constructor(options?: CLIBridgeOptions);
    /**
     * Initialize the bridge and spawn workers
     */
    initialize(): Promise<void>;
    /**
     * Spawn a worker process
     */
    private spawnWorker;
    /**
     * Wait for worker to send ready signal
     */
    private waitForWorkerReady;
    /**
     * Handle messages from workers
     */
    private handleWorkerMessage;
    /**
     * Handle worker exit
     */
    private handleWorkerExit;
    /**
     * Execute a command
     */
    execute(command: string, args?: string[], options?: ExecuteOptions): Promise<ExecuteResult>;
    /**
     * Select appropriate worker for command
     */
    private selectWorker;
    /**
     * Generate unique call ID
     */
    private generateCallId;
    /**
     * Shutdown the bridge and all workers
     */
    shutdown(): Promise<void>;
    /**
     * Logging utility
     */
    private log;
}
//# sourceMappingURL=CLIBridge.d.ts.map