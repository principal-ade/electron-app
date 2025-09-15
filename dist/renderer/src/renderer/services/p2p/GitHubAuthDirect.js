/**
 * GitHub Authentication Service (Direct Token Version)
 * For use when user manually copies token from success page
 */
import { ApiProxyService } from '../../main-process-api/ApiProxyService';
export class GitHubAuth {
    static instance;
    token = null;
    user = null;
    tokenCallback = null;
    // Cache for status checks to avoid excessive API calls
    statusCache = null;
    CACHE_DURATION = 30000; // 30 seconds
    checkStatusPromise = null;
    constructor() {
        this.loadStoredAuth();
    }
    static getInstance() {
        if (!GitHubAuth.instance) {
            GitHubAuth.instance = new GitHubAuth();
        }
        return GitHubAuth.instance;
    }
    loadStoredAuth() {
        const stored = localStorage.getItem('orbit_auth');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                this.token = data.token;
                this.user = data.user;
            }
            catch (error) {
                console.error('Failed to load stored auth:', error);
            }
        }
    }
    saveAuth(token, user) {
        this.token = token;
        this.user = user;
        localStorage.setItem('orbit_auth', JSON.stringify({ token, user }));
        // Clear cache when auth changes
        this.statusCache = null;
    }
    async authenticate() {
        try {
            // Note: User should manually go to principle-md.com to get token
            // We don't automatically open the browser anymore
            // Wait for user to paste the token
            const token = await this.waitForToken();
            if (!token) {
                return { success: false, error: 'Authentication cancelled' };
            }
            // Save the token and check status
            this.token = token;
            // Check user status with the token
            const statusResult = await this.checkStatus();
            if (statusResult.user) {
                this.saveAuth(token, statusResult.user);
                return { success: true, user: statusResult.user };
            }
            return { success: false, error: 'Failed to verify token' };
        }
        catch (error) {
            console.error('Authentication error:', error);
            return { success: false, error: 'Authentication failed' };
        }
    }
    async waitForToken() {
        return new Promise((resolve) => {
            this.tokenCallback = resolve;
            // Set a timeout (5 minutes)
            setTimeout(() => {
                if (this.tokenCallback === resolve) {
                    this.tokenCallback = null;
                    resolve(null);
                }
            }, 5 * 60 * 1000);
        });
    }
    // Called by the UI component when user enters the token
    submitOAuthCode(token) {
        if (this.tokenCallback) {
            this.tokenCallback(token);
            this.tokenCallback = null;
        }
    }
    // Direct token submission (for manual paste flow)
    async submitToken(token) {
        try {
            // Set the token
            this.token = token;
            // Check if it's valid
            const status = await this.checkStatus();
            if (status.user) {
                // Save to localStorage
                this.saveAuth(token, status.user);
                return { success: true, user: status.user };
            }
            else {
                // Clear invalid token
                this.token = null;
                return { success: false, error: `Invalid token or authentication failed: ${status.status}` };
            }
        }
        catch (error) {
            this.token = null;
            console.error('Token submission error:', error);
            return { success: false, error: 'Failed to verify token' };
        }
    }
    async checkStatus() {
        // Return cached status if it's still valid
        if (this.statusCache && Date.now() - this.statusCache.timestamp < this.CACHE_DURATION) {
            console.log('[GitHubAuthDirect] Returning cached status');
            return { status: this.statusCache.status, user: this.statusCache.user };
        }
        // If there's already a check in progress, wait for it
        if (this.checkStatusPromise) {
            console.log('[GitHubAuthDirect] Status check already in progress, waiting...');
            return this.checkStatusPromise;
        }
        // Start a new check
        this.checkStatusPromise = this.performStatusCheck();
        try {
            const result = await this.checkStatusPromise;
            // Cache the result
            this.statusCache = {
                ...result,
                timestamp: Date.now()
            };
            return result;
        }
        finally {
            this.checkStatusPromise = null;
        }
    }
    async performStatusCheck() {
        console.log('[GitHubAuthDirect] Performing actual status check with token:', this.token ? `${this.token.substring(0, 10)}...` : 'NO TOKEN');
        if (!this.token) {
            console.log('[GitHubAuthDirect] No token available');
            return { status: 'unauthenticated' };
        }
        try {
            console.log('[GitHubAuthDirect] Using API proxy to check status...');
            const response = await ApiProxyService.checkStatus(this.token);
            console.log('[GitHubAuthDirect] checkStatus response:', response);
            if (!response.success) {
                console.log('[GitHubAuthDirect] API call failed:', response.error);
                return { status: 'unauthenticated' };
            }
            if (response.status === 'new') {
                console.log('[GitHubAuthDirect] User is new (not in database)');
                return { status: 'new' };
            }
            if (response.githubHandle) {
                console.log('[GitHubAuthDirect] User authenticated:', response.githubHandle, 'Status:', response.status);
                this.user = {
                    githubHandle: response.githubHandle,
                    email: response.email,
                    status: response.status,
                    metadata: response.metadata,
                };
                return { status: response.status || 'authenticated', user: this.user };
            }
            // If we got an error response, the token might be invalid
            console.log('[GitHubAuthDirect] No githubHandle in response, treating as unauthenticated');
            this.logout();
            return { status: 'unauthenticated' };
        }
        catch (error) {
            console.error('[GitHubAuthDirect] Status check error:', error);
            return { status: 'error' };
        }
    }
    async verifyRepoAccess(repoUrl) {
        if (!this.token) {
            return false;
        }
        try {
            // Parse repo URL
            const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
            if (!match)
                return false;
            const [, owner, repo] = match;
            const repoName = repo.replace(/\.git$/, '');
            // For now, assume access if authenticated
            // In production, would check via GitHub API
            return true;
        }
        catch (error) {
            console.error('Repo access check error:', error);
            return false;
        }
    }
    getToken() {
        return this.token;
    }
    getUser() {
        return this.user;
    }
    isAuthenticated() {
        return this.token !== null;
    }
    isApproved() {
        return this.user?.status === 'approved';
    }
    logout() {
        this.token = null;
        this.user = null;
        this.statusCache = null;
        localStorage.removeItem('orbit_auth');
    }
}
