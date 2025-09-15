/**
 * GitHub Authentication Service (Direct Token Version)
 * For use when user manually copies token from success page
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
    private tokenCallback;
    private statusCache;
    private readonly CACHE_DURATION;
    private checkStatusPromise;
    private constructor();
    static getInstance(): GitHubAuth;
    private loadStoredAuth;
    saveAuth(token: string, user: GitHubUser): void;
    authenticate(): Promise<{
        success: boolean;
        user?: GitHubUser;
        error?: string;
    }>;
    private waitForToken;
    submitOAuthCode(token: string | null): void;
    submitToken(token: string): Promise<{
        success: boolean;
        user?: GitHubUser;
        error?: string;
    }>;
    checkStatus(): Promise<{
        status: string;
        user?: GitHubUser;
    }>;
    private performStatusCheck;
    verifyRepoAccess(repoUrl: string): Promise<boolean>;
    getToken(): string | null;
    getUser(): GitHubUser | null;
    isAuthenticated(): boolean;
    isApproved(): boolean;
    logout(): void;
}
//# sourceMappingURL=GitHubAuthDirect.d.ts.map