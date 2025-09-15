/**
 * IPC handlers for secure token storage
 * Provides a bridge between renderer process and secure storage in main process
 */
export declare class SecureTokenIPC {
    private storage;
    constructor();
    private setupHandlers;
    /**
     * Attempt to migrate existing tokens from localStorage (one-time)
     * This should be called on app startup
     */
    private migrateExistingTokens;
}
export declare const secureTokenIPC: SecureTokenIPC;
//# sourceMappingURL=SecureTokenIPC.d.ts.map