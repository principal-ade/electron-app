/**
 * Service layer for Authentication functionality
 * ALL window.mainProcess.authentication calls MUST be encapsulated here
 */
import { AuthUser, AuthResult, AuthStatus, AuthState, TokenResult, TokenWithMetadata } from '../../shared/main-process-api-interfaces/AuthenticationAPI';
export declare class AuthenticationService {
    /**
     * Login via OAuth authentication
     */
    static login(options?: {
        forceNew?: boolean;
    }): Promise<AuthResult>;
    /**
     * Logout from authentication
     */
    static logout(): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Check authentication status
     */
    static check(): Promise<AuthResult>;
    /**
     * Get current authentication status
     */
    static status(): Promise<AuthStatus>;
    /**
     * Save GitHub authentication token
     */
    static saveGitHubAuth(token: string, authUser: AuthUser): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Get GitHub authentication token
     */
    static getGitHubAuth(): Promise<TokenWithMetadata>;
    /**
     * Clear GitHub authentication
     */
    static clearGitHubAuth(): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Check if authenticated
     */
    static isAuthenticated(): Promise<boolean>;
    /**
     * Set a secure token
     */
    static saveToken(key: string, value: string, metadata?: any): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Get a secure token
     */
    static getToken(key: string): Promise<TokenResult>;
    /**
     * Delete a secure token
     */
    static deleteToken(key: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Migrate tokens from localStorage
     */
    static migrateFromLocalStorage(tokens: any[]): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Get current auth state
     */
    static getAuthState(): Promise<AuthState>;
    /**
     * Subscribe to auth state changes
     * @returns Unsubscribe function
     */
    static onAuthStateChanged(callback: (state: AuthState) => void): () => void;
}
//# sourceMappingURL=AuthenticationService.d.ts.map