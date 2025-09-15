/**
 * Professional terminal environment manager for Electron apps
 * Handles PATH resolution and environment setup for spawned terminals
 */
export declare class TerminalEnvironment {
    private static instance;
    private userPath;
    private userShell;
    private lastPathFetch;
    private readonly PATH_CACHE_DURATION;
    private constructor();
    static getInstance(): TerminalEnvironment;
    /**
     * Get the user's shell, with intelligent fallbacks
     */
    getUserShell(): string;
    /**
     * Get the user's PATH from their login shell
     * Caches the result for performance
     */
    getUserPath(): Promise<string>;
    /**
     * Clear the cached PATH (useful after installing new tools)
     */
    clearCache(): void;
    /**
     * Get a complete environment for spawning terminals
     */
    getTerminalEnvironment(workingDirectory: string, sessionId?: string): Promise<NodeJS.ProcessEnv>;
    /**
     * Test if a command is available in the user's PATH
     */
    isCommandAvailable(command: string): Promise<boolean>;
    /**
     * Find the full path to a command
     */
    findCommand(command: string): Promise<string | null>;
}
export declare const terminalEnvironment: TerminalEnvironment;
//# sourceMappingURL=terminalEnvironment.d.ts.map