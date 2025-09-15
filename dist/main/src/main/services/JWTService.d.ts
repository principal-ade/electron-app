interface RepositoryPermission {
    repoId: string;
    permissions: string[];
}
interface JWTPayload {
    userId: string;
    githubId: string;
    repositories: RepositoryPermission[];
    iat?: number;
    exp?: number;
}
export declare class JWTService {
    /**
     * Validate GitHub token and get user repositories with permissions
     */
    private static validateGitHubToken;
    /**
     * Create JWT from GitHub token
     */
    static createJWT(githubToken: string): Promise<{
        success: boolean;
        token?: string;
        user?: any;
        error?: string;
    }>;
    /**
     * Verify and decode JWT
     */
    static verifyJWT(token: string): {
        valid: boolean;
        payload?: JWTPayload;
        error?: string;
    };
    /**
     * Check if user has specific permission for a repository
     */
    static hasPermission(payload: JWTPayload, repoId: string, requiredPermission: 'pull' | 'push' | 'admin'): boolean;
    /**
     * Register IPC handlers
     */
    static registerHandlers(): void;
}
export {};
//# sourceMappingURL=JWTService.d.ts.map