/**
 * Clean up orphaned terminal sessions that may have been left over from previous sessions
 * This helps prevent hitting the terminal session limit
 */
export declare function cleanupOrphanedTerminals(keepSessionIds?: string[]): Promise<void>;
/**
 * Get the count of active terminal sessions
 */
export declare function getTerminalSessionCount(): Promise<number>;
//# sourceMappingURL=terminalCleanup.d.ts.map