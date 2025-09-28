/**
 * AuthStateManager - Centralized authentication state management
 *
 * Maintains a single source of truth for authentication state in the main process
 * and broadcasts changes to all renderer processes via IPC events.
 */

import { BrowserWindow, ipcMain } from 'electron';
import { EventEmitter } from 'events';
import { AuthEvent } from '../../shared/ipc-events/AuthEvents';

export interface AuthUser {
  login: string;
  email: string;
  name?: string;
  id?: number;
  avatarUrl?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  token: string | null;
  lastChecked: number;
}

class AuthStateManager extends EventEmitter {
  private static instance: AuthStateManager;
  private state: AuthState;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly STATE_CHECK_INTERVAL = 60000; // Check every minute

  private constructor() {
    super();

    // Initialize with empty state
    this.state = {
      isAuthenticated: false,
      user: null,
      token: null,
      lastChecked: Date.now(),
    };

    this.setupHandlers();
    console.log('[AuthStateManager] Initialized');
  }

  static getInstance(): AuthStateManager {
    if (!AuthStateManager.instance) {
      AuthStateManager.instance = new AuthStateManager();
    }
    return AuthStateManager.instance;
  }

  private setupHandlers() {
    // Handler for renderer processes to get current auth state
    ipcMain.handle(AuthEvent.STATE_GET, () => {
      const publicState = this.getPublicState();
      console.log('[AuthStateManager] auth-state:get called, returning:', {
        isAuthenticated: publicState.isAuthenticated,
        hasUser: !!publicState.user,
        user: publicState.user?.login,
        internalStateCheck: {
          isAuthenticated: this.state.isAuthenticated,
          user: this.state.user?.login,
          hasToken: !!this.state.token,
        }
      });
      return publicState;
    });

    // Handler for renderer processes to subscribe to auth changes
    ipcMain.on(AuthEvent.STATE_SUBSCRIBE, (event) => {
      const webContents = event.sender;
      const windowId = webContents.id;

      console.log(
        `[AuthStateManager] Window ${windowId} subscribed to auth state changes`,
      );

      // Send current state immediately
      webContents.send(AuthEvent.STATE_CHANGED, this.getPublicState());

      // Clean up when window is closed
      webContents.on('destroyed', () => {
        console.log(
          `[AuthStateManager] Window ${windowId} unsubscribed (destroyed)`,
        );
      });
    });

    // Handler for renderer processes to unsubscribe
    ipcMain.on(AuthEvent.STATE_UNSUBSCRIBE, (event) => {
      const windowId = event.sender.id;
      console.log(`[AuthStateManager] Window ${windowId} unsubscribed`);
    });
  }

  /**
   * Update the authentication state and broadcast to all windows
   */
  updateState(newState: Partial<AuthState>) {
    const oldState = { ...this.state };

    // Update state
    this.state = {
      ...this.state,
      ...newState,
      lastChecked: Date.now(),
    };

    // Add avatar URL if we have a user
    if (this.state.user && !this.state.user.avatarUrl) {
      this.state.user.avatarUrl = `https://github.com/${this.state.user.login}.png?size=48`;
    }

    console.log('[AuthStateManager] State updated:', {
      wasAuthenticated: oldState.isAuthenticated,
      isAuthenticated: this.state.isAuthenticated,
      user: this.state.user?.login,
    });

    // Emit internal event
    this.emit('stateChanged', this.state);

    // Broadcast to all renderer processes
    this.broadcastStateChange();
  }

  /**
   * Set authenticated state with user and token
   */
  setAuthenticated(user: AuthUser, token: string) {
    console.log(
      '[AuthStateManager] setAuthenticated called for:',
      user.login,
      'Current state before update:',
      {
        isAuthenticated: this.state.isAuthenticated,
        currentUser: this.state.user?.login,
      }
    );

    this.updateState({
      isAuthenticated: true,
      user: {
        ...user,
        avatarUrl: `https://github.com/${user.login}.png?size=48`,
      },
      token,
    });

    console.log(
      '[AuthStateManager] State after setAuthenticated:',
      {
        isAuthenticated: this.state.isAuthenticated,
        user: this.state.user?.login,
        hasToken: !!this.state.token,
      }
    );
  }

  /**
   * Clear authentication state
   */
  clearAuthentication() {
    console.log('[AuthStateManager] Clearing authentication state');

    this.updateState({
      isAuthenticated: false,
      user: null,
      token: null,
    });
  }

  /**
   * Get the current state (without sensitive token)
   */
  getPublicState(): Omit<AuthState, 'token'> {
    return {
      isAuthenticated: this.state.isAuthenticated,
      user: this.state.user,
      lastChecked: this.state.lastChecked,
    };
  }

  /**
   * Get the full state (including token) - for internal use only
   */
  getFullState(): AuthState {
    return { ...this.state };
  }

  /**
   * Broadcast state change to all renderer processes
   */
  private broadcastStateChange() {
    const publicState = this.getPublicState();

    // Get all windows and send the update
    BrowserWindow.getAllWindows().forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send(AuthEvent.STATE_CHANGED, publicState);
        console.log(
          `[AuthStateManager] Broadcasted state change to window ${window.id}`,
        );
      }
    });
  }

  /**
   * Start periodic auth state checks
   */
  startPeriodicChecks(checkCallback: () => Promise<void>) {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Initial check
    checkCallback().catch((err) => {
      console.error('[AuthStateManager] Initial auth check failed:', err);
    });

    // Set up periodic checks
    this.checkInterval = setInterval(() => {
      checkCallback().catch((err) => {
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
  isAuthenticationValid(): boolean {
    // Check if we have auth and it was checked recently (within 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return (
      this.state.isAuthenticated && this.state.lastChecked > fiveMinutesAgo
    );
  }
}

export default AuthStateManager;
