/**
 * Service layer for Git-sync functionality
 * ALL window.mainProcess.gitSync calls MUST be encapsulated here
 */
export class GitSyncService {
    /**
     * Connect to git-sync server for a repository
     */
    static async connect(config) {
        try {
            return await window.mainProcess.gitSync.connect(config);
        }
        catch (error) {
            console.error('[GitSyncService] Failed to connect:', error);
            return {
                success: false,
                error: 'Failed to connect to git-sync server'
            };
        }
    }
    /**
     * Disconnect from git-sync server
     */
    static async disconnect(connectionId) {
        try {
            return await window.mainProcess.gitSync.disconnect(connectionId);
        }
        catch (error) {
            console.error('[GitSyncService] Failed to disconnect:', error);
            return {
                success: false,
                message: 'Failed to disconnect from git-sync server'
            };
        }
    }
    /**
     * Get current connection status
     */
    static async getStatus(connectionId) {
        try {
            return await window.mainProcess.gitSync.getStatus(connectionId);
        }
        catch (error) {
            console.error('[GitSyncService] Failed to get status:', error);
            return null;
        }
    }
    /**
     * Send a message through the git-sync connection
     */
    static async sendMessage(message) {
        try {
            return await window.mainProcess.gitSync.sendMessage(message);
        }
        catch (error) {
            console.error('[GitSyncService] Failed to send message:', error);
            return {
                success: false,
                error: 'Failed to send message'
            };
        }
    }
    /**
     * Get a room token for git-sync collaboration
     */
    static async getRoomToken(request) {
        try {
            return await window.mainProcess.gitSync.getRoomToken(request);
        }
        catch (error) {
            console.error('[GitSyncService] Failed to get room token:', error);
            return {
                success: false,
                error: 'Failed to get room token'
            };
        }
    }
    /**
     * Get the git-sync server URL
     */
    static async getServerUrl() {
        try {
            return await window.mainProcess.gitSync.getServerUrl();
        }
        catch (error) {
            console.error('[GitSyncService] Failed to get server URL:', error);
            return 'wss://localhost:8080'; // Default fallback
        }
    }
    /**
     * Check if user has access to a repository
     */
    static async checkRepoAccess(repoUrl, token) {
        try {
            return await window.mainProcess.gitSync.checkRepoAccess(repoUrl, token);
        }
        catch (error) {
            console.error('[GitSyncService] Failed to check repo access:', error);
            return false;
        }
    }
    /**
     * Subscribe to git-sync messages
     * @returns Unsubscribe function
     */
    static onMessage(callback) {
        try {
            return window.mainProcess.gitSync.onMessage(callback);
        }
        catch (error) {
            console.error('[GitSyncService] Failed to subscribe to messages:', error);
            return () => { }; // Return no-op unsubscribe function
        }
    }
}
