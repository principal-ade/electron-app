/**
 * Utility functions for terminal operations
 *
 * Now uses the unified ShellAPI instead of direct IPC calls.
 */
/**
 * Check if a command is available in the user's PATH
 */
export declare function checkCommandAvailability(command: string): Promise<{
    available: boolean;
    path: string | null;
}>;
/**
 * Clear the cached PATH (useful after installing new tools)
 */
export declare function clearTerminalPathCache(): Promise<boolean>;
/**
 * Debug helper to check common developer tools
 */
export declare function checkDeveloperTools(): Promise<Record<string, {
    available: boolean;
    path: string | null;
}>>;
/**
 * Log available developer tools to console (useful for debugging)
 */
export declare function logAvailableTools(): Promise<void>;
//# sourceMappingURL=terminalUtils.d.ts.map