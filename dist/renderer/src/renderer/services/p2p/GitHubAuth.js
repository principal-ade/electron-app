import { ShellService } from '../../main-process-api/ShellService';
import { OrbitConfig } from '../../config/orbit.config';
export class GitHubAuth {
    static instance;
    token = null;
    user = null;
    baseUrl;
    oauthCodeCallback = null;
    constructor() {
        this.baseUrl = OrbitConfig.apiUrl;
        this.loadStoredAuth();
    }
    static getInstance() {
        if (!GitHubAuth.instance) {
            GitHubAuth.instance = new GitHubAuth();
        }
        return GitHubAuth.instance;
    }
    loadStoredAuth() {
        // Load from localStorage or electron-store
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
    }
    async authenticate() {
        try {
            // Open GitHub OAuth in browser
            const authUrl = `${this.baseUrl}/api/orbit/auth/github`;
            // Use the ShellService to open external URL
            const shellResult = await ShellService.openExternal(authUrl);
            if (!shellResult.success) {
                console.warn('Failed to open OAuth URL:', shellResult.error);
            }
            // Wait for OAuth code via callback (will be set by UI component)
            const code = await this.waitForOAuthCode();
            if (!code) {
                return { success: false, error: 'OAuth cancelled' };
            }
            return await this.exchangeCodeForToken(code);
        }
        catch (error) {
            console.error('Authentication error:', error);
            return { success: false, error: 'Authentication failed' };
        }
    }
    async waitForOAuthCode() {
        // Wait for the OAuth code to be provided via the callback
        return new Promise((resolve) => {
            this.oauthCodeCallback = resolve;
            // Set a timeout in case user never provides code
            setTimeout(() => {
                if (this.oauthCodeCallback === resolve) {
                    this.oauthCodeCallback = null;
                    resolve(null);
                }
            }, OrbitConfig.timeouts.oauthCode);
        });
    }
    // Called by the UI component when user enters the OAuth code
    submitOAuthCode(code) {
        if (this.oauthCodeCallback) {
            this.oauthCodeCallback(code);
            this.oauthCodeCallback = null;
        }
    }
    async exchangeCodeForToken(code) {
        try {
            const response = await fetch(`${this.baseUrl}/api/orbit/auth/github`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code }),
            });
            if (!response.ok) {
                const error = await response.json();
                return { success: false, error: error.error || 'Authentication failed' };
            }
            const data = await response.json();
            if (data.success && data.token && data.user) {
                this.saveAuth(data.token, data.user);
                return { success: true, user: data.user };
            }
            return { success: false, error: 'Invalid response from server' };
        }
        catch (error) {
            console.error('Token exchange error:', error);
            return { success: false, error: 'Failed to exchange code for token' };
        }
    }
    async checkStatus() {
        if (!this.token) {
            return { status: 'unauthenticated' };
        }
        try {
            const response = await fetch(`${this.baseUrl}/api/orbit/auth/status`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                },
            });
            if (!response.ok) {
                this.logout();
                return { status: 'unauthenticated' };
            }
            const data = await response.json();
            if (data.status === 'new') {
                return { status: 'new' };
            }
            this.user = {
                githubHandle: data.githubHandle,
                email: data.email,
                status: data.status,
                metadata: data.metadata,
            };
            return { status: data.status, user: this.user };
        }
        catch (error) {
            console.error('Status check error:', error);
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
            // Check access via GitHub API
            const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                },
            });
            return response.status === 200;
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
        localStorage.removeItem('orbit_auth');
    }
}
