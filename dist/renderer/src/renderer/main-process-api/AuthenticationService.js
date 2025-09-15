/**
 * Service layer for Authentication functionality
 * ALL window.mainProcess.authentication calls MUST be encapsulated here
 */
export class AuthenticationService {
    /**
     * Login via OAuth authentication
     */
    static async login(options) {
        return window.mainProcess.authentication.login(options);
    }
    /**
     * Logout from authentication
     */
    static async logout() {
        return window.mainProcess.authentication.logout();
    }
    /**
     * Check authentication status
     */
    static async check() {
        return window.mainProcess.authentication.check();
    }
    /**
     * Get current authentication status
     */
    static async status() {
        return window.mainProcess.authentication.getStatus();
    }
    /**
     * Save GitHub authentication token
     */
    static async saveGitHubAuth(token, authUser) {
        return window.mainProcess.authentication.saveGitHubAuth(token, authUser);
    }
    /**
     * Get GitHub authentication token
     */
    static async getGitHubAuth() {
        return window.mainProcess.authentication.getGitHubAuth();
    }
    /**
     * Clear GitHub authentication
     */
    static async clearGitHubAuth() {
        return window.mainProcess.authentication.clearGitHubAuth();
    }
    /**
     * Check if authenticated
     */
    static async isAuthenticated() {
        return window.mainProcess.authentication.isAuthenticated();
    }
    /**
     * Set a secure token
     */
    static async saveToken(key, value, metadata) {
        return window.mainProcess.authentication.saveToken(key, value, metadata);
    }
    /**
     * Get a secure token
     */
    static async getToken(key) {
        return window.mainProcess.authentication.getToken(key);
    }
    /**
     * Delete a secure token
     */
    static async deleteToken(key) {
        return window.mainProcess.authentication.deleteToken(key);
    }
    /**
     * Migrate tokens from localStorage
     */
    static async migrateFromLocalStorage(tokens) {
        return window.mainProcess.authentication.migrateFromLocalStorage(tokens);
    }
    /**
     * Get current auth state
     */
    static async getAuthState() {
        return window.mainProcess.authentication.getAuthState();
    }
    /**
     * Subscribe to auth state changes
     * @returns Unsubscribe function
     */
    static onAuthStateChanged(callback) {
        return window.mainProcess.authentication.onAuthStateChanged(callback);
    }
}
