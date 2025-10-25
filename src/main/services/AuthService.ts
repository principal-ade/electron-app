/**
 * AuthService - Handles OAuth authentication for the Electron app
 *
 * Uses Electron's safeStorage for secure credential storage without
 * keychain permission prompts. Communicates with code-city-landing
 * OAuth server for GitHub authentication.
 */

import { ipcMain, shell } from 'electron';
import Store from 'electron-store';
import {
  OAuthServerClient,
  type AuthResult as OAuthAuthResult,
} from './OAuthServerClient';
import AuthStateManager from './AuthStateManager';
import { UnifiedSecureStorage, TOKEN_KEYS } from './UnifiedSecureStorage';
import { AuthEvent } from '../../shared/ipc-events/AuthEvents';

interface AuthResult {
  success: boolean;
  authenticated?: boolean;
  token?: string;
  user?: {
    login: string;
    email: string;
    name?: string;
    id?: number;
  };
  error?: string;
}

class AuthService {
  private store: Store;
  private storage: UnifiedSecureStorage;
  private isAuthenticating = false;
  private currentAuthController: AbortController | null = null;

  constructor() {
    // Use electron-store for persistent storage
    this.store = new Store({
      name: 'dev-collab-auth',
      // Don't use encryption key here - we'll use UnifiedSecureStorage for encryption
    });

    // Lazy init UnifiedSecureStorage to defer keychain access
    this.storage = UnifiedSecureStorage.getInstance();

    this.setupHandlers();
    console.log('[AuthService] Initialized with UnifiedSecureStorage');
    // Note: UnifiedSecureStorage will handle keychain access when needed
  }

  private setupHandlers() {
    // Check handler - reads from safeStorage
    ipcMain.handle(AuthEvent.CHECK, async () => {
      try {
        console.log('\n========================================');
        console.log('[AuthService] CHECK HANDLER INVOKED');
        console.log(
          '[AuthService] Checking safeStorage for stored credentials...',
        );
        console.log('========================================\n');

        const result = await this.getStoredAuth();

        console.log('[AuthService] getStoredAuth returned:', {
          success: result.success,
          hasToken: !!result.token,
          hasUser: !!result.user,
          error: result.error,
        });

        if (result.success && result.token && result.user) {
          console.log(
            '[AuthService] SUCCESS: Found stored credentials for:',
            result.user?.login,
          );
          // Update AuthStateManager when credentials are successfully retrieved
          AuthStateManager.getInstance().setAuthenticated(
            result.user,
            result.token,
          );
        } else {
          console.log('[AuthService] FAILURE: No stored credentials found');
          // Only clear auth if we're currently authenticated but have no stored credentials
          // This prevents clearing auth due to transient storage access issues
          const currentState = AuthStateManager.getInstance().getFullState();
          if (!currentState.isAuthenticated) {
            console.log('[AuthService] Already unauthenticated, not clearing');
          } else {
            console.log(
              '[AuthService] WARNING: Currently authenticated but no stored credentials found',
            );
            // Don't clear - this might be a transient storage issue
          }
        }

        return result;
      } catch (error: any) {
        console.error('[AuthService] CHECK ERROR:', error);
        return { success: false, authenticated: false, error: error.message };
      }
    });

    // Status handler
    ipcMain.handle(AuthEvent.STATUS, async () => {
      try {
        const auth = await this.getStoredAuth();
        if (auth.success && auth.user) {
          return {
            authenticated: true,
            user: auth.user.login,
            email: auth.user.email,
          };
        }
        return { authenticated: false };
      } catch (error: any) {
        return { authenticated: false, error: error.message };
      }
    });

    // Login handler - implements OAuth flow
    ipcMain.handle(AuthEvent.LOGIN, async (event, options = {}) => {
      console.log('[AuthService] Login requested with options:', options);

      if (this.isAuthenticating && !options.forceNew) {
        console.log('[AuthService] Authentication already in progress');
        return { success: false, error: 'Authentication already in progress' };
      }

      if (options.forceNew && this.currentAuthController) {
        console.log(
          '[AuthService] Force new auth - canceling existing authentication',
        );
        this.cancelAuthentication();
        // Add a small delay to ensure cleanup
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Check if already authenticated
      if (!options.forceNew) {
        const existingAuth = await this.getStoredAuth();
        if (existingAuth.success) {
          console.log(
            '[AuthService] Already authenticated as:',
            existingAuth.user?.login,
          );
          return existingAuth;
        }
      }

      this.isAuthenticating = true;
      this.currentAuthController = new AbortController();

      try {
        // Use the OAuth client from dev-collab-cli
        const authClient = new OAuthServerClient({
          serverUrl: process.env.AUTH_SERVER_URL || 'https://principal-ade.com',
          forceReauth: options.forceNew || false,
        });

        // Override the open function to use Electron's shell
        const originalOpen = (global as any).open;
        (global as any).open = (url: string) => shell.openExternal(url);

        try {
          console.log('[AuthService] Starting OAuth flow...');
          const result = await authClient.authenticate();

          // Store the credentials securely with refresh token and expiry
          await this.storeAuth(
            result.token,
            result.user,
            result.refreshToken,
            result.expiresAt,
          );

          console.log(
            '[AuthService] Authentication successful for:',
            result.user.login,
          );

          // Update AuthStateManager
          AuthStateManager.getInstance().setAuthenticated(
            result.user,
            result.token,
          );

          return {
            success: true,
            authenticated: true,
            token: result.token,
            user: result.user,
          };
        } finally {
          // Restore original open function
          (global as any).open = originalOpen;
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('[AuthService] Authentication was canceled');
          return { success: false, error: 'Authentication canceled' };
        }
        console.error('[AuthService] Authentication error:', error);

        // Provide more user-friendly error messages
        let errorMessage = error.message;
        if (error.message.includes('timeout')) {
          errorMessage = 'Authentication timed out. Please try again.';
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection.';
        }

        return { success: false, error: errorMessage };
      } finally {
        this.isAuthenticating = false;
        this.currentAuthController = null;
      }
    });

    // Logout handler
    ipcMain.handle(AuthEvent.LOGOUT, async () => {
      try {
        await this.clearStoredAuth();

        // Clear AuthStateManager
        AuthStateManager.getInstance().clearAuthentication();

        return { success: true };
      } catch (error: any) {
        console.error('[AuthService] Logout error:', error);
        return { success: false, error: error.message };
      }
    });
  }

  private cancelAuthentication(): void {
    if (this.currentAuthController) {
      this.currentAuthController.abort();
      this.currentAuthController = null;
      this.isAuthenticating = false;
    }
  }

  private async getStoredAuth(): Promise<AuthResult> {
    try {
      console.log('[AuthService] Reading from UnifiedSecureStorage...');

      // Get token and metadata from unified storage
      const tokenData = await this.storage.getTokenWithMetadata(
        TOKEN_KEYS.GITHUB_TOKEN,
      );

      if (!tokenData) {
        console.log('[AuthService] No stored credentials found');
        return { success: false, authenticated: false };
      }

      let { token, metadata } = tokenData;
      const user = metadata?.user;
      const refreshToken = metadata?.refreshToken;
      const expiresAt = metadata?.expiresAt;

      if (!user) {
        console.log('[AuthService] No user data found in token metadata');
        return { success: false, authenticated: false };
      }

      // Check if token is expired or about to expire (within 5 minutes)
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      const isExpired = expiresAt && expiresAt <= now;
      const isExpiringSoon = expiresAt && expiresAt <= now + fiveMinutes;

      if ((isExpired || isExpiringSoon) && refreshToken) {
        console.log('[AuthService] Token expired or expiring soon, refreshing...', {
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : 'unknown',
          isExpired,
          isExpiringSoon,
        });

        try {
          // Attempt to refresh the token
          const authClient = new OAuthServerClient({
            serverUrl:
              process.env.AUTH_SERVER_URL || 'https://principal-ade.com',
          });

          const refreshedAuth = await authClient.refreshAccessToken(
            refreshToken,
          );

          // Store the new tokens
          await this.storeAuth(
            refreshedAuth.token,
            refreshedAuth.user,
            refreshedAuth.refreshToken,
            refreshedAuth.expiresAt,
          );

          // Update AuthStateManager with new token
          AuthStateManager.getInstance().setAuthenticated(
            refreshedAuth.user,
            refreshedAuth.token,
          );

          console.log('[AuthService] Token refreshed successfully');

          return {
            success: true,
            authenticated: true,
            token: refreshedAuth.token,
            user: refreshedAuth.user,
          };
        } catch (refreshError: any) {
          console.error(
            '[AuthService] Token refresh failed:',
            refreshError.message,
          );
          // If refresh fails, clear auth and require re-login
          await this.clearStoredAuth();
          AuthStateManager.getInstance().clearAuthentication();
          return {
            success: false,
            authenticated: false,
            error: 'Token expired and refresh failed. Please log in again.',
          };
        }
      }

      console.log(
        '[AuthService] Successfully retrieved credentials for:',
        user.login,
        {
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : 'unknown',
          hasRefreshToken: !!refreshToken,
        },
      );

      return {
        success: true,
        authenticated: true,
        token,
        user,
      };
    } catch (error: any) {
      console.error('[AuthService] Failed to get stored auth:', error);
      return {
        success: false,
        authenticated: false,
        error: error.message,
      };
    }
  }

  private async storeAuth(
    token: string,
    user: any,
    refreshToken?: string,
    expiresAt?: number,
  ): Promise<void> {
    try {
      console.log('[AuthService] Storing credentials for:', user.login, {
        hasRefreshToken: !!refreshToken,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : 'unknown',
      });

      // Store token with user metadata, refresh token, and expiry in unified storage
      await this.storage.setToken(TOKEN_KEYS.GITHUB_TOKEN, token, {
        user,
        refreshToken,
        expiresAt,
      });

      console.log('[AuthService] Credentials stored successfully');
    } catch (error) {
      console.error('[AuthService] Failed to store credentials:', error);
      throw error;
    }
  }

  private async clearStoredAuth(): Promise<void> {
    try {
      // Delete token from unified storage
      await this.storage.deleteToken(TOKEN_KEYS.GITHUB_TOKEN);

      console.log('[AuthService] Credentials cleared');
    } catch (error) {
      console.error('[AuthService] Failed to clear credentials:', error);
      // Don't throw - clearing non-existent credentials is fine
    }
  }

  /**
   * Initialize auth state on startup
   * Checks and loads stored credentials to populate AuthStateManager
   */
  async initializeAuthState(): Promise<void> {
    try {
      console.log('[AuthService] Initializing auth state on startup...');

      // Try to get stored auth - this will decrypt credentials
      const storedAuth = await this.getStoredAuth();

      if (storedAuth.success && storedAuth.token && storedAuth.user) {
        console.log(
          '[AuthService] Found and loaded stored credentials for:',
          storedAuth.user.login,
        );
        // Update AuthStateManager with stored credentials
        AuthStateManager.getInstance().setAuthenticated(
          storedAuth.user,
          storedAuth.token,
        );
      } else {
        console.log('[AuthService] No existing authentication found');
        // Ensure AuthStateManager is in unauthenticated state
        AuthStateManager.getInstance().clearAuthentication();
      }
    } catch (error) {
      console.error('[AuthService] Error initializing auth state:', error);
      // On error, ensure we're in unauthenticated state
      AuthStateManager.getInstance().clearAuthentication();
    }
  }

  /**
   * Check if stored auth exists without decrypting
   */
  private async hasStoredAuth(): Promise<boolean> {
    try {
      // Check if token exists without retrieving it (avoids keychain access)
      const token = await this.storage.getToken(TOKEN_KEYS.GITHUB_TOKEN);
      return token !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get a valid GitHub token with automatic refresh if expired/expiring
   * This is the centralized method that all GitHub API calls should use
   * @returns Valid token or null if not authenticated
   */
  async getValidToken(): Promise<string | null> {
    try {
      const auth = await this.getStoredAuth();

      if (auth.success && auth.token) {
        return auth.token;
      }

      return null;
    } catch (error) {
      console.error('[AuthService] Error getting valid token:', error);
      return null;
    }
  }
}

// Create and export singleton instance
export const authService = new AuthService();
