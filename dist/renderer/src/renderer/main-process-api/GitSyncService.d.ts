import { GitSyncConfig, GitSyncConnectionResult, GitSyncStatus, GitSyncMessage, GitSyncRoomTokenRequest, GitSyncRoomTokenResponse } from '../../shared/main-process-api-interfaces/GitSyncAPI';
/**
 * Service layer for Git-sync functionality
 * ALL window.mainProcess.gitSync calls MUST be encapsulated here
 */
export declare class GitSyncService {
    /**
     * Connect to git-sync server for a repository
     */
    static connect(config: GitSyncConfig): Promise<GitSyncConnectionResult>;
    /**
     * Disconnect from git-sync server
     */
    static disconnect(connectionId: string): Promise<{
        success: boolean;
        message?: string;
    }>;
    /**
     * Get current connection status
     */
    static getStatus(connectionId: string): Promise<GitSyncStatus | null>;
    /**
     * Send a message through the git-sync connection
     */
    static sendMessage(message: GitSyncMessage): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Get a room token for git-sync collaboration
     */
    static getRoomToken(request: GitSyncRoomTokenRequest): Promise<GitSyncRoomTokenResponse>;
    /**
     * Get the git-sync server URL
     */
    static getServerUrl(): Promise<string>;
    /**
     * Check if user has access to a repository
     */
    static checkRepoAccess(repoUrl: string, token: string): Promise<boolean>;
    /**
     * Subscribe to git-sync messages
     * @returns Unsubscribe function
     */
    static onMessage(callback: (connectionKey: string, message: any) => void): () => void;
}
//# sourceMappingURL=GitSyncService.d.ts.map