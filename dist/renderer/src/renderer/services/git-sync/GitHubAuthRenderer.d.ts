/**
 * GitHub Authentication - Renderer Process
 * Simple IPC wrapper that delegates all auth to main process
 */
export declare class GitHubAuthRenderer {
    /**
     * Authenticate with GitHub
     * Opens browser and handles OAuth flow in main process
     */
    static authenticate(): Promise<{
        token: string;
        user: any;
    }>;
    /**
     * Check if authenticated
     */
    static checkAuth(): Promise<{
        authenticated: boolean;
        user?: any;
    }>;
    /**
     * Create JWT for git-sync server
     * Main process creates JWT using stored GitHub token
     */
    static createGitSyncJWT(payload: {
        repoId: string;
        agentId: string;
        userId: string;
        branch: string;
    }): Promise<string>;
    /**
     * Logout
     */
    static logout(): Promise<void>;
}
//# sourceMappingURL=GitHubAuthRenderer.d.ts.map