/**
 * GitSyncIPC - IPC handlers for git-sync operations
 *
 * Provides IPC endpoints for git-sync operations that renderers can call.
 * This is a placeholder service that will eventually connect to the actual
 * git-sync server implementation.
 */
declare class GitSyncIPC {
    constructor();
    private setupHandlers;
    /**
     * Utility function to emit git-sync messages to all renderer processes
     */
    emitMessage(connectionKey: string, message: any): void;
}
export declare const gitSyncIPC: GitSyncIPC;
export {};
//# sourceMappingURL=GitSyncIPC.d.ts.map