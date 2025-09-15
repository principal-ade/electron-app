/**
 * Agent Session Archive API implementation for renderer process
 */
export declare const agentSessionArchiveAPI: {
    /**
     * Get current archive configuration
     */
    getConfiguration: () => Promise<any>;
    /**
     * Update archive configuration
     */
    updateConfiguration: (config: any) => Promise<any>;
    /**
     * Reset configuration to defaults
     */
    resetConfiguration: () => Promise<any>;
    /**
     * Manually archive a session
     */
    archiveSession: (sessionId: string, options?: any) => Promise<any>;
    /**
     * Archive all inactive sessions
     */
    archiveAllInactive: () => Promise<any>;
    /**
     * Archive all sessions (alias for compatibility)
     */
    archiveAll: () => Promise<any>;
    /**
     * Get archive statistics
     */
    getStatistics: () => Promise<any>;
    /**
     * List all archived sessions
     */
    listArchivedSessions: () => Promise<any>;
    /**
     * Get a specific archived session
     */
    getArchivedSession: (sessionId: string) => Promise<any>;
    /**
     * Delete an archived session
     */
    deleteArchivedSession: (sessionId: string) => Promise<any>;
    /**
     * Restore an archived session to active
     */
    restoreArchivedSession: (sessionId: string) => Promise<any>;
    /**
     * Load an archived session (used by debug views)
     */
    loadSession: (sessionId: string) => Promise<any>;
};
//# sourceMappingURL=agentSessionArchiveApi.d.ts.map