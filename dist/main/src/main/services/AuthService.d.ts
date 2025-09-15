/**
 * AuthService - Handles OAuth authentication for the Electron app
 *
 * Uses Electron's safeStorage for secure credential storage without
 * keychain permission prompts. Communicates with code-city-landing
 * OAuth server for GitHub authentication.
 */
declare class AuthService {
    private store;
    private isAuthenticating;
    private currentAuthController;
    constructor();
    private setupHandlers;
    private cancelAuthentication;
    private getStoredAuth;
    private storeAuth;
    private clearStoredAuth;
    /**
     * Initialize auth state on startup
     * Only checks if credentials exist without decrypting (to avoid keychain prompt)
     */
    initializeAuthState(): Promise<void>;
    /**
     * Check if stored auth exists without decrypting
     */
    private hasStoredAuth;
}
export declare const authService: AuthService;
export {};
//# sourceMappingURL=AuthService.d.ts.map