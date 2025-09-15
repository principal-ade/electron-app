/**
 * Secure Authentication Service
 * Uses Electron's secure storage instead of localStorage
 *
 * Now uses the unified AuthenticationAPI instead of direct IPC calls.
 */
import { AuthenticationService } from '../main-process-api/AuthenticationService';
export class SecureAuthService {
    static instance;
    migrationDone = false;
    constructor() {
        this.migrateFromLocalStorage();
    }
    static getInstance() {
        if (!SecureAuthService.instance) {
            SecureAuthService.instance = new SecureAuthService();
        }
        return SecureAuthService.instance;
    }
    /**
     * Save authentication securely
     */
    async saveAuth(token, user) {
        try {
            // Convert GitHubUser to AuthUser format
            const authUser = {
                login: user.githubHandle,
                email: user.email || '',
                name: user.metadata?.name,
                avatarUrl: user.metadata?.avatarUrl
            };
            const result = await AuthenticationService.saveGitHubAuth(token, authUser);
            if (result.success) {
                // Clear from localStorage after successful save
                this.clearLocalStorage();
            }
            return result.success;
        }
        catch (error) {
            console.error('Failed to save auth securely:', error);
            return false;
        }
    }
    /**
     * Get authentication status
     */
    async checkAuth() {
        try {
            // First try secure storage
            const result = await AuthenticationService.getGitHubAuth();
            if (result.authenticated && result.user) {
                // Convert AuthUser back to GitHubUser format for backward compatibility
                const gitHubUser = {
                    githubHandle: result.user.login,
                    email: result.user.email,
                    metadata: {
                        name: result.user.name,
                        avatarUrl: result.user.avatarUrl
                    }
                };
                return {
                    authenticated: true,
                    token: result.token,
                    user: gitHubUser
                };
            }
            // Fallback to localStorage (for migration)
            const stored = localStorage.getItem('orbit_auth');
            if (stored && !this.migrationDone) {
                try {
                    const data = JSON.parse(stored);
                    if (data.token && data.user) {
                        // Migrate to secure storage
                        await this.saveAuth(data.token, data.user);
                        return {
                            authenticated: true,
                            token: data.token,
                            user: data.user
                        };
                    }
                }
                catch (error) {
                    console.error('Failed to parse localStorage auth:', error);
                }
            }
            return { authenticated: false };
        }
        catch (error) {
            console.error('Failed to check auth:', error);
            return { authenticated: false };
        }
    }
    /**
     * Clear authentication
     */
    async logout() {
        try {
            await AuthenticationService.clearGitHubAuth();
            this.clearLocalStorage();
        }
        catch (error) {
            console.error('Failed to clear auth:', error);
        }
    }
    /**
     * Check if authenticated (quick check)
     */
    async isAuthenticated() {
        try {
            return await AuthenticationService.isAuthenticated();
        }
        catch (error) {
            console.error('Failed to check authentication:', error);
            return false;
        }
    }
    /**
     * Migrate tokens from localStorage to secure storage
     */
    async migrateFromLocalStorage() {
        if (this.migrationDone)
            return;
        try {
            const tokensToMigrate = [];
            // Check for orbit_auth
            const orbitAuth = localStorage.getItem('orbit_auth');
            if (orbitAuth) {
                try {
                    const data = JSON.parse(orbitAuth);
                    tokensToMigrate.push({
                        key: 'orbit_auth',
                        value: data
                    });
                }
                catch (error) {
                    console.error('Failed to parse orbit_auth:', error);
                }
            }
            // Check for git-sync-auth
            const gitSyncAuth = localStorage.getItem('git-sync-auth');
            if (gitSyncAuth) {
                try {
                    const data = JSON.parse(gitSyncAuth);
                    tokensToMigrate.push({
                        key: 'git-sync-auth',
                        value: data
                    });
                }
                catch (error) {
                    console.error('Failed to parse git-sync-auth:', error);
                }
            }
            if (tokensToMigrate.length > 0) {
                const result = await AuthenticationService.migrateFromLocalStorage(tokensToMigrate);
                if (result.success) {
                    console.log('Successfully migrated tokens to secure storage');
                    this.clearLocalStorage();
                }
            }
            this.migrationDone = true;
        }
        catch (error) {
            console.error('Failed to migrate from localStorage:', error);
        }
    }
    /**
     * Clear sensitive data from localStorage
     */
    clearLocalStorage() {
        localStorage.removeItem('orbit_auth');
        localStorage.removeItem('git-sync-auth');
        localStorage.removeItem('github_token');
    }
}
// Export singleton instance
export const secureAuth = SecureAuthService.getInstance();
