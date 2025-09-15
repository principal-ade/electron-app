/**
 * AuthStateManager - Centralized authentication state management
 *
 * Maintains a single source of truth for authentication state in the main process
 * and broadcasts changes to all renderer processes via IPC events.
 */
import { BrowserWindow, ipcMain } from 'electron';
import { EventEmitter } from 'events';
class AuthStateManager extends EventEmitter {
    static instance;
    state;
    checkInterval = null;
    STATE_CHECK_INTERVAL = 60000; // Check every minute
    constructor() {
        super();
        // Initialize with empty state
        this.state = {
            isAuthenticated: false,
            user: null,
            token: null,
            lastChecked: Date.now()
        };
        this.setupHandlers();
        console.log('[AuthStateManager] Initialized');
    }
    static getInstance() {
        if (!AuthStateManager.instance) {
            AuthStateManager.instance = new AuthStateManager();
        }
        return AuthStateManager.instance;
    }
    setupHandlers() {
        // Handler for renderer processes to get current auth state
        ipcMain.handle('auth-state:get', () => {
            console.log('[AuthStateManager] State requested, returning:', {
                isAuthenticated: this.state.isAuthenticated,
                hasUser: !!this.state.user,
                user: this.state.user?.login
            });
            return this.getPublicState();
        });
        // Handler for renderer processes to subscribe to auth changes
        ipcMain.on('auth-state:subscribe', (event) => {
            const webContents = event.sender;
            const windowId = webContents.id;
            console.log(`[AuthStateManager] Window ${windowId} subscribed to auth state changes`);
            // Send current state immediately
            webContents.send('auth-state:changed', this.getPublicState());
            // Clean up when window is closed
            webContents.on('destroyed', () => {
                console.log(`[AuthStateManager] Window ${windowId} unsubscribed (destroyed)`);
            });
        });
        // Handler for renderer processes to unsubscribe
        ipcMain.on('auth-state:unsubscribe', (event) => {
            const windowId = event.sender.id;
            console.log(`[AuthStateManager] Window ${windowId} unsubscribed`);
        });
    }
    /**
     * Update the authentication state and broadcast to all windows
     */
    updateState(newState) {
        const oldState = { ...this.state };
        // Update state
        this.state = {
            ...this.state,
            ...newState,
            lastChecked: Date.now()
        };
        // Add avatar URL if we have a user
        if (this.state.user && !this.state.user.avatarUrl) {
            this.state.user.avatarUrl = `https://github.com/${this.state.user.login}.png?size=48`;
        }
        console.log('[AuthStateManager] State updated:', {
            wasAuthenticated: oldState.isAuthenticated,
            isAuthenticated: this.state.isAuthenticated,
            user: this.state.user?.login
        });
        // Emit internal event
        this.emit('stateChanged', this.state);
        // Broadcast to all renderer processes
        this.broadcastStateChange();
    }
    /**
     * Set authenticated state with user and token
     */
    setAuthenticated(user, token) {
        console.log('[AuthStateManager] Setting authenticated state for:', user.login);
        this.updateState({
            isAuthenticated: true,
            user: {
                ...user,
                avatarUrl: `https://github.com/${user.login}.png?size=48`
            },
            token
        });
    }
    /**
     * Clear authentication state
     */
    clearAuthentication() {
        console.log('[AuthStateManager] Clearing authentication state');
        this.updateState({
            isAuthenticated: false,
            user: null,
            token: null
        });
    }
    /**
     * Get the current state (without sensitive token)
     */
    getPublicState() {
        return {
            isAuthenticated: this.state.isAuthenticated,
            user: this.state.user,
            lastChecked: this.state.lastChecked
        };
    }
    /**
     * Get the full state (including token) - for internal use only
     */
    getFullState() {
        return { ...this.state };
    }
    /**
     * Broadcast state change to all renderer processes
     */
    broadcastStateChange() {
        const publicState = this.getPublicState();
        // Get all windows and send the update
        BrowserWindow.getAllWindows().forEach(window => {
            if (!window.isDestroyed()) {
                window.webContents.send('auth-state:changed', publicState);
                console.log(`[AuthStateManager] Broadcasted state change to window ${window.id}`);
            }
        });
    }
    /**
     * Start periodic auth state checks
     */
    startPeriodicChecks(checkCallback) {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
        // Initial check
        checkCallback().catch(err => {
            console.error('[AuthStateManager] Initial auth check failed:', err);
        });
        // Set up periodic checks
        this.checkInterval = setInterval(() => {
            checkCallback().catch(err => {
                console.error('[AuthStateManager] Periodic auth check failed:', err);
            });
        }, this.STATE_CHECK_INTERVAL);
        console.log('[AuthStateManager] Started periodic auth checks');
    }
    /**
     * Stop periodic auth state checks
     */
    stopPeriodicChecks() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log('[AuthStateManager] Stopped periodic auth checks');
        }
    }
    /**
     * Check if authentication is still valid
     */
    isAuthenticationValid() {
        // Check if we have auth and it was checked recently (within 5 minutes)
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        return this.state.isAuthenticated &&
            this.state.lastChecked > fiveMinutesAgo;
    }
}
export default AuthStateManager;
