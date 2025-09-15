/**
 * GitSyncAPI - Type-safe interface for git-sync operations
 * Manages connections to git-sync server for real-time collaboration
 */
export interface GitSyncConfig {
    repoId: string;
    repoPath: string;
    branch: string;
    token?: string;
}
export interface GitSyncConnectionResult {
    success: boolean;
    connectionId?: string;
    error?: string;
    message?: string;
}
export interface GitSyncStatus {
    connected: boolean;
    authenticated: boolean;
    repoId: string;
    branch: string;
    activeLocks: any[];
    queuedLocks: number;
    peers: any[];
}
export interface GitSyncMessage {
    connectionId: string;
    type: string;
    data: any;
}
export interface GitSyncRoomTokenRequest {
    repositoryId: string;
    branch: string;
    isOwner: boolean;
}
export interface GitSyncRoomTokenResponse {
    success: boolean;
    token?: string;
    error?: string;
}
export interface GitSyncAPI {
    /**
     * Connect to git-sync server for a repository
     */
    connect(config: GitSyncConfig): Promise<GitSyncConnectionResult>;
    /**
     * Disconnect from git-sync server
     */
    disconnect(connectionId: string): Promise<{
        success: boolean;
        message?: string;
    }>;
    /**
     * Get current connection status
     */
    getStatus(connectionId: string): Promise<GitSyncStatus>;
    /**
     * Send a message through the git-sync connection
     */
    sendMessage(message: GitSyncMessage): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Get a room token for git-sync collaboration
     */
    getRoomToken(request: GitSyncRoomTokenRequest): Promise<GitSyncRoomTokenResponse>;
    /**
     * Get the git-sync server URL
     */
    getServerUrl(): Promise<string>;
    /**
     * Check if user has access to a repository
     */
    checkRepoAccess(repoUrl: string, token: string): Promise<boolean>;
    /**
     * Subscribe to git-sync messages
     * @returns Unsubscribe function
     */
    onMessage(callback: (connectionKey: string, message: any) => void): () => void;
}
//# sourceMappingURL=GitSyncAPI.d.ts.map