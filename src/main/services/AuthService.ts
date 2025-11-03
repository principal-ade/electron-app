/**
 * AuthService - Handles OAuth authentication for the Electron app
 *
 * Uses Electron's safeStorage for secure credential storage without
 * keychain permission prompts. Communicates with code-city-landing
 * OAuth server for GitHub authentication.
 */

import { ipcMain, shell } from 'electron';
import Store from 'electron-store';
import { OAuthServerClient } from './OAuthServerClient';
import AuthStateManager from './AuthStateManager';
import {
  UnifiedSecureStorage,
  TOKEN_KEYS,
  KeychainTimeoutError,
  KeychainPermissionError,
  KeychainNotAvailableError,
} from './UnifiedSecureStorage';
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
      } catch (error) {
        console.error('[AuthService] CHECK ERROR:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        return { success: false, authenticated: false, error: errorMessage };
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
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        return { authenticated: false, error: errorMessage };
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

          // Fetch GitHub user profile to get canonical user data
          let enrichedUser = result.user;
          try {
            console.log('[AuthService] Fetching GitHub user profile...');
            const response = await fetch('https://api.github.com/user', {
              headers: {
                Authorization: `Bearer ${result.token}`,
                Accept: 'application/vnd.github.v3+json',
              },
            });

            if (response.ok) {
              const githubUser = await response.json();
              // Use GitHub API as source of truth for all user data
              enrichedUser = {
                login: githubUser.login, // GitHub's canonical username
                email: githubUser.email || result.user.email,
                name: githubUser.name || result.user.name,
                id: githubUser.id,
                avatarUrl: githubUser.avatar_url,
              };
              console.log(
                '[AuthService] GitHub user profile fetched successfully:',
                enrichedUser.login,
              );
            } else {
              console.warn(
                '[AuthService] Failed to fetch GitHub profile:',
                response.status,
              );
              console.warn(
                '[AuthService] Falling back to OAuth server user data',
              );
            }
          } catch (avatarError) {
            console.error(
              '[AuthService] Error fetching GitHub profile:',
              avatarError,
            );
            console.warn(
              '[AuthService] Falling back to OAuth server user data',
            );
          }

          // Store the credentials securely with refresh token and expiry
          await this.storeAuth(
            result.token,
            enrichedUser,
            result.workosToken,
            result.refreshToken,
            result.expiresAt,
          );

          console.log(
            '[AuthService] Authentication successful for:',
            enrichedUser.login,
          );

          // Update AuthStateManager
          AuthStateManager.getInstance().setAuthenticated(
            enrichedUser,
            result.token,
          );

          return {
            success: true,
            authenticated: true,
            token: result.token,
            user: enrichedUser,
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

    // Get token metadata handler
    ipcMain.handle(AuthEvent.GET_TOKEN_METADATA, async () => {
      try {
        return await this.getTokenMetadata();
      } catch (error: any) {
        console.error('[AuthService] Get token metadata error:', error);
        return {
          hasToken: false,
          hasRefreshToken: false,
          error: error.message,
        };
      }
    });

    // Test refresh token handler
    ipcMain.handle(AuthEvent.TEST_REFRESH_TOKEN, async () => {
      try {
        return await this.testRefreshToken();
      } catch (error) {
        console.error('[AuthService] Test refresh token error:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    });

    // Check keychain status handler
    ipcMain.handle(AuthEvent.CHECK_KEYCHAIN_STATUS, async () => {
      try {
        return await this.storage.checkKeychainStatus();
      } catch (error) {
        console.error('[AuthService] Check keychain status error:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        return {
          available: false,
          initialized: false,
          error: errorMessage,
          errorType: 'unknown',
        };
      }
    });

    // Test keychain access handler
    ipcMain.handle(AuthEvent.TEST_KEYCHAIN_ACCESS, async () => {
      try {
        return await this.storage.testKeychainAccess();
      } catch (error) {
        console.error('[AuthService] Test keychain access error:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          error: errorMessage,
          errorType: 'unknown',
        };
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

      // Get GitHub token (primary token for API calls)
      const githubTokenData = await this.storage.getTokenWithMetadata(
        TOKEN_KEYS.GITHUB_TOKEN,
      );

      if (!githubTokenData) {
        console.log('[AuthService] No stored credentials found');
        return { success: false, authenticated: false };
      }

      const { token: githubToken, metadata: githubMetadata } = githubTokenData;
      const user = githubMetadata?.user as
        | { login: string; email: string; name?: string; id?: number }
        | undefined;

      if (!user) {
        console.log('[AuthService] No user data found in token metadata');
        return { success: false, authenticated: false };
      }

      // Get WorkOS token (for session management)
      const workosTokenData = await this.storage.getTokenWithMetadata(
        TOKEN_KEYS.WORKOS_TOKEN,
      );

      // Get refresh token and expiry info
      // First try from WorkOS token metadata, fallback to GitHub token metadata (backward compatibility)
      let refreshToken = (workosTokenData?.metadata?.refreshToken ||
        githubMetadata?.refreshToken) as string | undefined;
      let expiresAt = (workosTokenData?.metadata?.expiresAt ||
        githubMetadata?.expiresAt) as number | undefined;

      // Check if WorkOS token is expired or about to expire (within 5 minutes)
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      const isExpired = expiresAt && expiresAt <= now;
      const isExpiringSoon = expiresAt && expiresAt <= now + fiveMinutes;

      if ((isExpired || isExpiringSoon) && refreshToken) {
        console.log(
          '[AuthService] WorkOS token expired or expiring soon, refreshing...',
          {
            expiresAt: expiresAt
              ? new Date(expiresAt).toISOString()
              : 'unknown',
            isExpired,
            isExpiringSoon,
          },
        );

        try {
          // Attempt to refresh the token
          const authClient = new OAuthServerClient({
            serverUrl:
              process.env.AUTH_SERVER_URL || 'https://principal-ade.com',
          });

          const refreshedAuth =
            await authClient.refreshAccessToken(refreshToken);

          // ✅ CRITICAL: Only update WorkOS token, preserve GitHub token
          console.log('[AuthService] Token refresh response received:', {
            receivedNewGithubToken: !!refreshedAuth.token,
            githubTokenPrefix: refreshedAuth.token?.substring(0, 4),
            willPreserveExisting:
              !refreshedAuth.token || !refreshedAuth.token.startsWith('gh'),
          });

          // If refresh gave us a new GitHub token, use it; otherwise keep the existing one
          // refreshedAuth.token may be null/undefined if server doesn't return a new GitHub token
          const newGithubToken =
            refreshedAuth.token && refreshedAuth.token.startsWith('gh')
              ? refreshedAuth.token
              : githubToken;

          console.log('[AuthService] Using GitHub token:', {
            tokenPrefix: newGithubToken?.substring(0, 4),
            isNewToken: newGithubToken === refreshedAuth.token,
            isPreservedToken: newGithubToken === githubToken,
          });

          await this.storeAuth(
            newGithubToken,
            refreshedAuth.user,
            refreshedAuth.workosToken,
            refreshedAuth.refreshToken,
            refreshedAuth.expiresAt,
          );

          // Update AuthStateManager with GitHub token (not WorkOS token!)
          AuthStateManager.getInstance().setAuthenticated(
            refreshedAuth.user,
            newGithubToken,
          );

          console.log(
            '[AuthService] Token refreshed successfully, GitHub token preserved',
          );

          return {
            success: true,
            authenticated: true,
            token: newGithubToken, // ✅ Return GitHub token for API calls
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
          hasWorkosToken: !!workosTokenData,
          hasAvatarUrl: !!user.avatarUrl,
        },
      );

      // If avatar URL is missing or user data seems incorrect, fetch from GitHub
      let enrichedUser = user;
      const needsGitHubFetch = !user.avatarUrl || user.login.includes('.');

      if (needsGitHubFetch) {
        try {
          console.log('[AuthService] Fetching canonical GitHub user data...');
          const response = await fetch('https://api.github.com/user', {
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          });

          if (response.ok) {
            const githubUser = await response.json();
            // Use GitHub API as source of truth for all user data
            enrichedUser = {
              login: githubUser.login, // GitHub's canonical username
              email: githubUser.email || user.email,
              name: githubUser.name || user.name,
              id: githubUser.id,
              avatarUrl: githubUser.avatar_url,
            };
            console.log(
              '[AuthService] GitHub user data fetched and cached successfully:',
              enrichedUser.login,
            );

            // Update stored user data with canonical GitHub data
            await this.storage.setToken(TOKEN_KEYS.GITHUB_TOKEN, githubToken, {
              user: enrichedUser,
            });
          } else {
            console.warn(
              '[AuthService] Failed to fetch GitHub profile:',
              response.status,
            );
          }
        } catch (avatarError) {
          console.error(
            '[AuthService] Error fetching GitHub profile:',
            avatarError,
          );
          // Continue with existing user data
        }
      }

      return {
        success: true,
        authenticated: true,
        token: githubToken, // ✅ Always return GitHub token for API calls
        user: enrichedUser,
      };
    } catch (error) {
      console.error('[AuthService] Failed to get stored auth:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        authenticated: false,
        error: errorMessage,
      };
    }
  }

  private async storeAuth(
    githubToken: string,
    user: any,
    workosToken?: string,
    refreshToken?: string,
    expiresAt?: number,
  ): Promise<void> {
    try {
      console.log('[AuthService] Storing credentials for:', user.login, {
        hasWorkosToken: !!workosToken,
        hasRefreshToken: !!refreshToken,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : 'unknown',
      });

      // Store GitHub token (never expires) with user metadata
      await this.storage.setToken(TOKEN_KEYS.GITHUB_TOKEN, githubToken, {
        user,
      });

      console.log('[AuthService] GitHub token stored successfully');

      // Store WorkOS token with refresh info (expires after 1 hour)
      if (workosToken) {
        await this.storage.setToken(TOKEN_KEYS.WORKOS_TOKEN, workosToken, {
          refreshToken,
          expiresAt,
        });
        console.log('[AuthService] WorkOS token stored successfully');
      } else if (refreshToken || expiresAt) {
        // If we don't have a separate WorkOS token but have refresh info,
        // store it with the GitHub token for backward compatibility
        await this.storage.setToken(TOKEN_KEYS.GITHUB_TOKEN, githubToken, {
          user,
          refreshToken,
          expiresAt,
        });
        console.log('[AuthService] Single token stored with refresh info');
      }

      console.log('[AuthService] Credentials stored successfully');
    } catch (error) {
      console.error('[AuthService] Failed to store credentials:', error);

      // Provide user-friendly error messages for keychain issues
      if (error instanceof KeychainTimeoutError) {
        throw new Error(
          'Keychain access timed out. Please unlock your system keychain and try again.',
        );
      } else if (error instanceof KeychainPermissionError) {
        throw new Error(
          'Keychain access was denied. Please grant permission in System Preferences → Security & Privacy and try again.',
        );
      } else if (error instanceof KeychainNotAvailableError) {
        throw new Error(
          'Keychain is not available. Please ensure your system keychain is unlocked and try again.',
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to save credentials: ${errorMessage}`);
    }
  }

  private async clearStoredAuth(): Promise<void> {
    try {
      // Delete both GitHub and WorkOS tokens from unified storage
      await this.storage.deleteToken(TOKEN_KEYS.GITHUB_TOKEN);
      await this.storage.deleteToken(TOKEN_KEYS.WORKOS_TOKEN);

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

  /**
   * Get token metadata including expiry and refresh token info
   */
  async getTokenMetadata(): Promise<{
    hasToken: boolean;
    hasRefreshToken: boolean;
    expiresAt?: number;
    expiresAtFormatted?: string;
    isExpired?: boolean;
    isExpiringSoon?: boolean;
    timeUntilExpiry?: string;
    user?: any;
  }> {
    try {
      const tokenData = await this.storage.getTokenWithMetadata(
        TOKEN_KEYS.GITHUB_TOKEN,
      );

      if (!tokenData) {
        return {
          hasToken: false,
          hasRefreshToken: false,
        };
      }

      const { metadata } = tokenData;
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      const expiresAt = metadata?.expiresAt as number | undefined;
      const isExpired = expiresAt ? expiresAt <= now : false;
      const isExpiringSoon = expiresAt ? expiresAt <= now + fiveMinutes : false;

      let timeUntilExpiry: string | undefined;
      if (expiresAt && !isExpired) {
        const diff = expiresAt - now;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
          timeUntilExpiry = `${days} day${days !== 1 ? 's' : ''}`;
        } else if (hours > 0) {
          timeUntilExpiry = `${hours} hour${hours !== 1 ? 's' : ''}`;
        } else {
          timeUntilExpiry = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
        }
      }

      return {
        hasToken: true,
        hasRefreshToken: !!metadata?.refreshToken,
        expiresAt,
        expiresAtFormatted: expiresAt
          ? new Date(expiresAt).toLocaleString()
          : undefined,
        isExpired,
        isExpiringSoon,
        timeUntilExpiry,
        user: metadata?.user,
      };
    } catch (error: any) {
      console.error('[AuthService] Error getting token metadata:', error);
      return {
        hasToken: false,
        hasRefreshToken: false,
      };
    }
  }

  /**
   * Test the refresh token mechanism by forcing a token refresh
   */
  async testRefreshToken(): Promise<{
    success: boolean;
    error?: string;
    newExpiresAt?: number;
  }> {
    try {
      console.log('[AuthService] Testing refresh token mechanism...');

      const tokenData = await this.storage.getTokenWithMetadata(
        TOKEN_KEYS.GITHUB_TOKEN,
      );

      if (!tokenData) {
        return {
          success: false,
          error: 'No token found to refresh',
        };
      }

      const { metadata } = tokenData;
      const refreshToken = metadata?.refreshToken as string | undefined;

      if (!refreshToken) {
        return {
          success: false,
          error: 'No refresh token available',
        };
      }

      // Attempt to refresh the token
      const authClient = new OAuthServerClient({
        serverUrl: process.env.AUTH_SERVER_URL || 'https://principal-ade.com',
      });

      const refreshedAuth = await authClient.refreshAccessToken(refreshToken);

      // Get the existing GitHub token to preserve it
      const githubTokenData = await this.storage.getTokenWithMetadata(
        TOKEN_KEYS.GITHUB_TOKEN,
      );
      const existingGithubToken = githubTokenData?.token;

      // If refresh gave us a new GitHub token, use it; otherwise keep the existing one
      const newGithubToken = refreshedAuth.token.startsWith('gho_')
        ? refreshedAuth.token
        : existingGithubToken || refreshedAuth.token;

      // Store the new tokens
      await this.storeAuth(
        newGithubToken,
        refreshedAuth.user,
        refreshedAuth.workosToken,
        refreshedAuth.refreshToken,
        refreshedAuth.expiresAt,
      );

      // Update AuthStateManager with GitHub token
      AuthStateManager.getInstance().setAuthenticated(
        refreshedAuth.user,
        newGithubToken,
      );

      console.log('[AuthService] Token refresh test successful:', {
        newExpiresAt: refreshedAuth.expiresAt
          ? new Date(refreshedAuth.expiresAt).toISOString()
          : 'unknown',
      });

      return {
        success: true,
        newExpiresAt: refreshedAuth.expiresAt,
      };
    } catch (error: any) {
      console.error('[AuthService] Token refresh test failed:', error);
      return {
        success: false,
        error: error.message || 'Token refresh failed',
      };
    }
  }
}

// Create and export singleton instance
export const authService = new AuthService();
