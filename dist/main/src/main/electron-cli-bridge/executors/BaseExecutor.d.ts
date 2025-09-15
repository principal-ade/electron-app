/**
 * BaseExecutor - Abstract base class for command executors
 * Provides common functionality for all specialized executors
 */
import type { CLIBridge } from '../CLIBridge';
import type { ExecuteOptions, ExecuteResult } from '../types';
export declare abstract class BaseExecutor {
    protected bridge: CLIBridge;
    constructor(bridge: CLIBridge);
    /**
     * Execute a command through the bridge
     */
    protected execute(command: string, args?: string[], options?: ExecuteOptions): Promise<ExecuteResult>;
    /**
     * Parse command output lines into array
     */
    protected parseLines(output: string): string[];
    /**
     * Check if a command is available
     */
    isAvailable(): Promise<boolean>;
    /**
     * Get version of the command (to be implemented by subclasses)
     */
    abstract getVersion(): Promise<string | null>;
}
//# sourceMappingURL=BaseExecutor.d.ts.map