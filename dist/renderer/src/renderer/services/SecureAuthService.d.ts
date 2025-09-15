/**
 * Secure Authentication Service
 * Uses Electron's secure storage instead of localStorage
 *
 * Now uses the unified AuthenticationAPI instead of direct IPC calls.
 */
export interface GitHubUser {
    githubHandle: string;
    email?: string;
    status?: 'waitlisted' | 'approved' | 'denied';
    metadata?: {
        avatarUrl?: string;
        name?: string;
        company?: string;
        location?: string;
    };
}
export interface AuthResult {
    authenticated: boolean;
    token?: string;
    user?: GitHubUser;
}
export declare class SecureAuthService {
    private static instance;
    private migrationDone;
    private constructor();
    static getInstance(): SecureAuthService;
    /**
     * Save authentication securely
     */
    saveAuth(token: string, user: GitHubUser): Promise<boolean>;
    /**
     * Get authentication status
     */
    checkAuth(): Promise<AuthResult>;
    /**
     * Clear authentication
     */
    logout(): Promise<void>;
    /**
     * Check if authenticated (quick check)
     */
    isAuthenticated(): Promise<boolean>;
    /**
     * Migrate tokens from localStorage to secure storage
     */
    private migrateFromLocalStorage;
    /**
     * Clear sensitive data from localStorage
     */
    private clearLocalStorage;
}
export declare const secureAuth: SecureAuthService;
//# sourceMappingURL=SecureAuthService.d.ts.map