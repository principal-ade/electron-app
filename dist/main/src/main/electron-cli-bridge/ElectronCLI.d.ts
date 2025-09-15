/**
 * ElectronCLI - High-level API for electron-cli-bridge
 * Provides convenient methods for common CLI operations
 */
import { CLIBridgeOptions, ExecuteOptions, ExecuteResult, ESLintResult } from './types';
import { GitExecutor } from './executors/GitExecutor';
export declare class ElectronCLI {
    private bridge;
    private initPromise;
    private _git;
    constructor(options?: CLIBridgeOptions);
    /**
     * Initialize the CLI bridge
     */
    initialize(): Promise<void>;
    /**
     * Ensure bridge is initialized before executing commands
     */
    private ensureInitialized;
    /**
     * Get GitExecutor instance (lazy initialization)
     */
    get git(): GitExecutor;
    /**
     * Execute a generic command
     */
    execute(command: string, args?: string[], options?: ExecuteOptions): Promise<ExecuteResult>;
    /**
     * Execute a command from a string (parses command and args)
     */
    exec(commandString: string, options?: ExecuteOptions): Promise<ExecuteResult>;
    /**
     * Execute npm commands
     */
    npm(args: string[], options?: ExecuteOptions): Promise<ExecuteResult>;
    /**
     * Execute yarn commands
     */
    yarn(args: string[], options?: ExecuteOptions): Promise<ExecuteResult>;
    /**
     * Execute pnpm commands
     */
    pnpm(args: string[], options?: ExecuteOptions): Promise<ExecuteResult>;
    /**
     * Run ESLint on files
     */
    eslint(patterns: string[], options?: ExecuteOptions & {
        fix?: boolean;
        format?: string;
    }): Promise<ESLintResult[]>;
    /**
     * Run Prettier on files
     */
    prettier(patterns: string[], options?: ExecuteOptions & {
        write?: boolean;
        check?: boolean;
    }): Promise<ExecuteResult>;
    /**
     * Run Jest tests
     */
    jest(args?: string[], options?: ExecuteOptions & {
        coverage?: boolean;
        watch?: boolean;
    }): Promise<ExecuteResult>;
    /**
     * Run TypeScript compiler
     */
    tsc(args?: string[], options?: ExecuteOptions): Promise<ExecuteResult>;
    /**
     * Check if a command is available
     */
    which(command: string): Promise<string | null>;
    /**
     * Get version of a command
     */
    version(command: string): Promise<string | null>;
    /**
     * Shutdown the CLI bridge
     */
    shutdown(): Promise<void>;
}
export declare const electronCLI: ElectronCLI;
//# sourceMappingURL=ElectronCLI.d.ts.map