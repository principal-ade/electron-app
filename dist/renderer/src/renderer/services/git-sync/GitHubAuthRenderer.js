/**
 * GitHub Authentication - Renderer Process
 * Simple IPC wrapper that delegates all auth to main process
 */
const { ipcRenderer } = window.electron || {};
export class GitHubAuthRenderer {
    /**
     * Authenticate with GitHub
     * Opens browser and handles OAuth flow in main process
     */
    static async authenticate() {
        if (!ipcRenderer) {
            throw new Error('IPC not available');
        }
        // Main process handles everything
        return await ipcRenderer.invoke('github:authenticate');
    }
    /**
     * Check if authenticated
     */
    static async checkAuth() {
        if (!ipcRenderer) {
            return { authenticated: false };
        }
        return await ipcRenderer.invoke('github:check-auth');
    }
    /**
     * Create JWT for git-sync server
     * Main process creates JWT using stored GitHub token
     */
    static async createGitSyncJWT(payload) {
        if (!ipcRenderer) {
            throw new Error('IPC not available');
        }
        // Main process has the GitHub token and creates JWT
        return await ipcRenderer.invoke('github:create-jwt', payload);
    }
    /**
     * Logout
     */
    static async logout() {
        if (!ipcRenderer) {
            return;
        }
        await ipcRenderer.invoke('github:logout');
    }
}
