/**
 * GitHub Authentication Service (IPC Version)
 * Uses Electron IPC to communicate with main process
 * Avoids CORS issues and is more secure
 */
export interface GitHubUser {
    githubHandle: string;
    email?: string;
    status: 'waitlisted' | 'approved' | 'denied';
    metadata?: {
        avatarUrl?: string;
        name?: string;
        company?: string;
        location?: string;
    };
}
export declare class GitHubAuth {
    private static instance;
    private token;
    private user;
    private oauthCodeCallback;
    private constructor();
    static getInstance(): GitHubAuth;
    private loadStoredAuth;
    private saveAuth;
    authenticate(): Promise<{
        success: boolean;
        user?: GitHubUser;
        error?: string;
    }>;
    private waitForOAuthCode;
    submitOAuthCode(code: string | null): void;
    private exchangeCodeForToken;
    checkStatus(): Promise<{
        status: string;
        user?: GitHubUser;
    }>;
    getToken(): string | null;
    getUser(): GitHubUser | null;
    isAuthenticated(): boolean;
    isApproved(): boolean;
    logout(): void;
}
//# sourceMappingURL=GitHubAuthIPC.d.ts.map