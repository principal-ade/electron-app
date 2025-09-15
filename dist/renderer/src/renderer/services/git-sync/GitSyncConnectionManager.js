import { EventEmitter } from 'events';
import { GitSyncClient } from './GitSyncClient';
import { GitSyncService } from '../../main-process-api/GitSyncService';
import { AuthenticationService } from '../../main-process-api/AuthenticationService';
/**
 * Singleton service that manages persistent GitSync connections
 * Survives component mounting/unmounting and maintains connection state
 */
export class GitSyncConnectionManager extends EventEmitter {
    static instance;
    connections = new Map();
    authUser = null;
    authToken = null;
    isAuthenticated = false;
    constructor() {
        super();
        this.initializeAuth();
        this.setupIPCMessageForwarding();
        this.subscribeToAuthChanges();
    }
    static getInstance() {
        if (!GitSyncConnectionManager.instance) {
            GitSyncConnectionManager.instance = new GitSyncConnectionManager();
        }
        return GitSyncConnectionManager.instance;
    }
    async initializeAuth() {
        // Check for CLI auth instead of GitHubAuth
        try {
            const cliAuthResult = await AuthenticationService.check();
            if (cliAuthResult.success && cliAuthResult.token && cliAuthResult.user) {
                this.authUser = {
                    githubHandle: cliAuthResult.user.login,
                    email: cliAuthResult.user.email,
                    status: 'authenticated',
                    metadata: {}
                };
                this.authToken = cliAuthResult.token;
                this.isAuthenticated = true;
                this.emit('auth-changed', true, this.authUser);
            }
        }
        catch (error) {
            console.error('[GitSyncConnectionManager] Failed to check CLI auth:', error);
        }
    }
    setupIPCMessageForwarding() {
        // Listen for WebSocket messages from main process using GitSyncService
        const unsubscribe = GitSyncService.onMessage((connectionKey, message) => {
            const connection = this.connections.get(connectionKey);
            if (connection && connection.client) {
                // Forward message to the client's event handlers
                connection.client.emit('message', message);
                connection.client.handleMessage?.(message);
            }
        });
        // Store unsubscribe function for cleanup if needed
        this._messageUnsubscribe = unsubscribe;
    }
    subscribeToAuthChanges() {
        // Subscribe to auth state changes from the main process
        if (window.mainProcess?.authentication) {
            // Store the unsubscribe function for cleanup if needed
            const unsubscribe = AuthenticationService.onAuthStateChanged(async (state) => {
                console.log('[GitSyncConnectionManager] Auth state changed:', {
                    isAuthenticated: state.isAuthenticated,
                    user: state.user?.login
                });
                if (state.isAuthenticated && state.user) {
                    // The auth state doesn't include the token, so we need to get it
                    // However, we should NOT call check() as it triggers another state change
                    // Instead, get the token directly without triggering state updates
                    try {
                        const tokenResult = await AuthenticationService.getGitHubAuth();
                        if (tokenResult.success && tokenResult.token) {
                            this.updateAuth(state.user, tokenResult.token);
                        }
                    }
                    catch (error) {
                        console.error('[GitSyncConnectionManager] Failed to get token after auth change:', error);
                    }
                }
                else {
                    // Clear auth
                    this.clearAuth();
                }
            });
            // Store unsubscribe function for potential cleanup
            this.unsubscribeAuth = unsubscribe;
        }
    }
    /**
     * Update authentication state
     */
    updateAuth(user, token) {
        console.log('[GitSyncConnectionManager] Updating auth for user:', user.login);
        this.authUser = {
            githubHandle: user.login,
            email: user.email,
            status: 'authenticated',
            metadata: {}
        };
        this.authToken = token;
        this.isAuthenticated = true;
        this.emit('auth-changed', true, this.authUser);
    }
    /**
     * Clear authentication state
     */
    clearAuth() {
        console.log('[GitSyncConnectionManager] Clearing auth state');
        this.authUser = null;
        this.authToken = null;
        this.isAuthenticated = false;
        // Disconnect all connections when auth is cleared
        this.disconnectAllConnections();
        this.emit('auth-changed', false, null);
    }
    /**
     * Get or create a connection for a repository
     */
    async getConnection(repoPath, branch = 'main', repository) {
        // Check authentication first
        if (!this.isAuthenticated || !this.authToken || !this.authUser) {
            console.warn('GitSyncConnectionManager: Not authenticated');
            return null;
        }
        // Generate a unique key for this repo/branch combination
        const repoId = repository && repository.owner && repository.name
            ? `${repository.owner}/${repository.name}`
            : `${this.authUser.githubHandle}/${repoPath.split('/').pop() || 'unknown-repo'}`;
        const connectionKey = `${repoId}:${branch}`;
        // Return existing connection if available
        const existing = this.connections.get(connectionKey);
        if (existing && existing.client) {
            const status = existing.client.getStatus();
            if (status.connected) {
                console.log(`GitSyncConnectionManager: Returning existing connection for ${connectionKey}`);
                return existing.client;
            }
        }
        // Create new connection via main process (secure)
        try {
            console.log(`GitSyncConnectionManager: Creating new connection for ${connectionKey}`);
            // Get stored GitHub token from localStorage
            const stored = localStorage.getItem('orbit_auth');
            if (!stored) {
                console.warn('No auth token available for git-sync connection');
                return null;
            }
            const authData = JSON.parse(stored);
            const githubToken = authData.token;
            if (!githubToken) {
                console.warn('No token in stored auth data');
                return null;
            }
            // Generate a stable device ID for this session
            let deviceId = sessionStorage.getItem('git-sync-device-id');
            if (!deviceId) {
                deviceId = `${this.authUser.githubHandle}-${Math.random().toString(36).substr(2, 9)}`;
                sessionStorage.setItem('git-sync-device-id', deviceId);
            }
            // Request connection from main process (handles all authentication securely)
            const connectionResult = await GitSyncService.connect({
                repoId,
                repoPath,
                branch,
                token: githubToken
            });
            if (!connectionResult.success) {
                console.error('Failed to connect to git-sync:', connectionResult.error);
                // Throw error with details for UI handling
                const error = new Error(connectionResult.error || 'Connection failed');
                throw error;
            }
            // Create a proxy client that communicates through IPC
            const client = new GitSyncClient({
                serverUrl: '', // Not used in proxy mode
                githubToken: '', // Not used in proxy mode  
                repoUrl: `github.com/${repoId}`,
                repoPath,
                branch,
                userId: this.authUser.githubHandle,
                agentId: deviceId,
                proxyMode: true
            });
            // Override client methods to use IPC instead of direct WebSocket
            this.setupProxyClient(client, repoId, branch);
            // Set up event forwarding
            this.setupClientEventHandlers(client, connectionKey);
            // Store connection info
            const connectionInfo = {
                repoId,
                repoPath,
                branch,
                client,
                status: {
                    connected: true,
                    authenticated: true,
                    repoId,
                    branch,
                    activeLocks: [],
                    queuedLocks: 0,
                    peers: []
                }
            };
            this.connections.set(connectionKey, connectionInfo);
            this.emit('connection-added', connectionKey);
            return client;
        }
        catch (error) {
            console.error(`GitSyncConnectionManager: Failed to create connection for ${connectionKey}:`, error);
            // Re-throw the error so the UI can handle it properly
            throw error;
        }
    }
    /**
     * Set up proxy client to communicate through IPC instead of direct WebSocket
     */
    setupProxyClient(client, repoId, branch) {
        // Override send method to use GitSyncService
        const originalSend = client.send;
        client.send = async (message) => {
            try {
                const result = await GitSyncService.sendMessage({
                    connectionId: `${repoId}:${branch}`,
                    type: message.type || 'message',
                    data: message
                });
                if (!result.success) {
                    console.error('Failed to send git-sync message:', result.error);
                }
            }
            catch (error) {
                console.error('Failed to send git-sync message via GitSyncService:', error);
            }
        };
        // Override disconnect to use GitSyncService
        const originalDisconnect = client.disconnect.bind(client);
        client.disconnect = () => {
            GitSyncService.disconnect(`${repoId}:${branch}`).catch(error => {
                console.error('Failed to disconnect via GitSyncService:', error);
            });
            originalDisconnect();
        };
    }
    /**
     * Set up event handlers for a client
     */
    setupClientEventHandlers(client, connectionKey) {
        // Forward important events
        client.on('connected', () => {
            console.log(`GitSyncConnectionManager: Client connected for ${connectionKey}`);
            this.updateConnectionStatus(connectionKey);
        });
        client.on('disconnected', () => {
            console.log(`GitSyncConnectionManager: Client disconnected for ${connectionKey}`);
            this.updateConnectionStatus(connectionKey);
        });
        client.on('authenticated', () => {
            console.log(`GitSyncConnectionManager: Client authenticated for ${connectionKey}`);
            this.updateConnectionStatus(connectionKey);
        });
        client.on('error', (error) => {
            console.error(`GitSyncConnectionManager: Client error for ${connectionKey}:`, error);
        });
    }
    /**
     * Update connection status
     */
    updateConnectionStatus(connectionKey) {
        const connection = this.connections.get(connectionKey);
        if (connection && connection.client) {
            connection.status = connection.client.getStatus();
            this.emit('connection-status-changed', connectionKey, connection.status);
        }
    }
    /**
     * Get all active connections
     */
    getActiveConnections() {
        return new Map(this.connections);
    }
    /**
     * Get connection for a specific repo/branch
     */
    getExistingConnection(repoId, branch = 'main') {
        const connectionKey = `${repoId}:${branch}`;
        const connection = this.connections.get(connectionKey);
        return connection?.client || null;
    }
    /**
     * Disconnect a specific connection
     */
    disconnectConnection(repoId, branch = 'main') {
        const connectionKey = `${repoId}:${branch}`;
        const connection = this.connections.get(connectionKey);
        if (connection && connection.client) {
            console.log(`GitSyncConnectionManager: Disconnecting ${connectionKey}`);
            connection.client.disconnect();
            this.connections.delete(connectionKey);
            this.emit('connection-removed', connectionKey);
        }
    }
    /**
     * Disconnect all connections
     */
    disconnectAll() {
        console.log('GitSyncConnectionManager: Disconnecting all connections');
        for (const [key, connection] of this.connections) {
            if (connection.client) {
                connection.client.disconnect();
            }
        }
        this.connections.clear();
    }
    /**
     * Update authentication status
     */
    async updateAuth(authenticated, user, token) {
        this.isAuthenticated = authenticated;
        this.authUser = user || null;
        this.authToken = token || null;
        this.emit('auth-changed', authenticated, user);
        // If logged out, disconnect all connections
        if (!authenticated) {
            this.disconnectAll();
        }
    }
    /**
     * Get current auth status
     */
    getAuthStatus() {
        return {
            isAuthenticated: this.isAuthenticated,
            user: this.authUser
        };
    }
    // Type-safe event emitter override
    emit(event, ...args) {
        return super.emit(event, ...args);
    }
    on(event, listener) {
        return super.on(event, listener);
    }
    off(event, listener) {
        return super.off(event, listener);
    }
}
// Export singleton instance
export const gitSyncConnectionManager = GitSyncConnectionManager.getInstance();
