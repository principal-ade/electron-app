/**
 * AuthService - GitHub authentication via gh CLI and local token storage
 *
 * The hosted OAuth server (auth.principal-ade.com / WorkOS) has been removed.
 * Authentication now works via:
 * 1. gh CLI token (`gh auth token`) — primary source
 * 2. Locally stored GitHub tokens in UnifiedSecureStorage — fallback
 *
 * Users authenticate by running `gh auth login` in their terminal.
 */

import { ipcMain } from 'electron';
import Store from 'electron-store';
import AuthStateManager from './AuthStateManager';
import { UnifiedSecureStorage, TOKEN_KEYS } from './UnifiedSecureStorage';
import { AuthEvent } from '../../shared/ipc-events/AuthEvents';
import { GitCredentialHelper } from './GitCredentialHelper';
import { getGhCliToken } from '../version-control-providers/github/ghCliToken';
import type { AuthUser } from '../../shared/main-process-api-interfaces/AuthenticationAPI';

interface AuthResult {
  success: boolean;
  authenticated?: boolean;
  token?: string;
  user?: {
    login: string;
    email: string;
    name?: string;
    id?: number;
    avatarUrl?: string;
  };
  error?: string;
}

export class AuthService {
  private store: Store;
  private storage: UnifiedSecureStorage;

  constructor() {
    // Use electron-store for non-secret auth prefs (not tokens)
    this.store = new Store({
      name: 'dev-collab-auth',
    });

    // Tokens / secrets: plaintext file under userData (mode 0o600)
    this.storage = UnifiedSecureStorage.getInstance();

    this.setupHandlers();
    console.log('[AuthService] Initialized (gh CLI + local token storage)');
  }

  private setupHandlers() {
    // Check handler - reads stored credentials or gh CLI token
    ipcMain.handle(AuthEvent.CHECK, async () => {
      try {
        const result = await this.getStoredAuth();
        if (result.success && result.token && result.user) {
          AuthStateManager.getInstance().setAuthenticated(
            result.user,
            result.token,
          );
        }
        return result;
      } catch (error) {
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

    // Token metadata handler
    ipcMain.handle(AuthEvent.GET_TOKEN_METADATA, async () => {
      return await this.getTokenMetadata();
    });

    // Keychain/secure storage status handlers
    ipcMain.handle(AuthEvent.CHECK_KEYCHAIN_STATUS, async () => {
      return { available: true, error: null };
    });

    ipcMain.handle(AuthEvent.TEST_KEYCHAIN_ACCESS, async () => {
      return { success: true };
    });

    // Validate GitHub token handler
    ipcMain.handle(AuthEvent.VALIDATE_GITHUB_TOKEN, async () => {
      return await this.validateGitHubToken();
    });
  }

  /**
   * Get auth from gh CLI token or local storage.
   * Primary: gh CLI (`gh auth token`)
   * Fallback: locally stored GitHub token
   */
  private async getStoredAuth(): Promise<AuthResult> {
    // Try gh CLI token first
    const ghToken = await getGhCliToken();
    if (ghToken) {
      // Fetch user info from GitHub API
      try {
        const response = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${ghToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        });
        if (response.ok) {
          const githubUser = (await response.json()) as {
            login: string;
            email?: string;
            name?: string;
            id: number;
            avatar_url?: string;
          };
          return {
            success: true,
            authenticated: true,
            token: ghToken,
            user: {
              login: githubUser.login,
              email: githubUser.email || '',
              name: githubUser.name,
              id: githubUser.id,
              avatarUrl: githubUser.avatar_url,
            },
          };
        }
      } catch (error) {
        console.warn(
          '[AuthService] Failed to fetch GitHub user from gh CLI token:',
          error,
        );
      }
      // Token exists but couldn't fetch user — still return token
      return {
        success: true,
        authenticated: true,
        token: ghToken,
      };
    }

    // Fall back to locally stored token
    const tokenData = await this.storage.getTokenWithMetadata(
      TOKEN_KEYS.GITHUB_TOKEN,
    );
    if (!tokenData?.token) {
      return { success: false, authenticated: false };
    }

    const metadata = tokenData.metadata as
      | {
          user?: AuthUser;
          expiresAt?: number;
        }
      | undefined;

    return {
      success: true,
      authenticated: true,
      token: tokenData.token,
      user: metadata?.user
        ? {
            login: metadata.user.login,
            email: metadata.user.email || '',
            name: metadata.user.name,
            id: metadata.user.id,
            avatarUrl: metadata.user.avatarUrl,
          }
        : undefined,
    };
  }

  async initializeAuthState(): Promise<void> {
    try {
      const storedAuth = await this.getStoredAuth();
      if (storedAuth.success && storedAuth.token && storedAuth.user) {
        AuthStateManager.getInstance().setAuthenticated(
          storedAuth.user,
          storedAuth.token,
        );
        console.log(
          '[AuthService] Auth state initialized for:',
          storedAuth.user.login,
        );
      }
    } catch (error) {
      console.error('[AuthService] Failed to initialize auth state:', error);
    }
  }

  /**
   * Get a valid GitHub token.
   * Primary: gh CLI token
   * Fallback: locally stored token
   */
  async getValidToken(): Promise<string | null> {
    try {
      // Try gh CLI first
      const ghToken = await getGhCliToken();
      if (ghToken) {
        return ghToken;
      }

      // Fall back to stored token
      const tokenData = await this.storage.getToken(TOKEN_KEYS.GITHUB_TOKEN);
      return tokenData || null;
    } catch (error) {
      console.error('[AuthService] Error getting valid token:', error);
      return null;
    }
  }

  /**
   * Get current authenticated user information
   */
  async getCurrentUser(): Promise<{
    login: string;
    email: string;
    name?: string;
    id?: number;
    avatarUrl?: string;
  } | null> {
    try {
      const auth = await this.getStoredAuth();
      if (auth.success && auth.user) {
        return auth.user;
      }
      return null;
    } catch (error) {
      console.error('[AuthService] Error getting current user:', error);
      return null;
    }
  }

  /**
   * Get token metadata including expiry info
   */
  async getTokenMetadata(): Promise<{
    hasToken: boolean;
    hasRefreshToken: boolean;
    expiresAt?: number;
    expiresAtFormatted?: string;
    isExpired?: boolean;
    isExpiringSoon?: boolean;
    timeUntilExpiry?: string;
    user?: AuthUser;
  }> {
    try {
      // Check gh CLI token first
      const ghToken = await getGhCliToken();
      if (ghToken) {
        return {
          hasToken: true,
          hasRefreshToken: false,
          user: undefined,
        };
      }

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
        user: metadata?.user as AuthUser | undefined,
      };
    } catch (error: unknown) {
      console.error('[AuthService] Error getting token metadata:', error);
      return {
        hasToken: false,
        hasRefreshToken: false,
      };
    }
  }

  async validateGitHubToken(): Promise<{
    valid: boolean;
    tokenPresent: boolean;
    tokenPrefix?: string;
    error?: string;
    statusCode?: number;
  }> {
    try {
      const token = await this.getValidToken();
      if (!token) {
        return {
          valid: false,
          tokenPresent: false,
          error: 'No GitHub token found. Run `gh auth login` to authenticate.',
        };
      }

      const tokenPrefix = token.substring(0, 4);

      // Validate token by making a test API call to GitHub
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (response.ok) {
        return {
          valid: true,
          tokenPresent: true,
          tokenPrefix,
        };
      } else {
        return {
          valid: false,
          tokenPresent: true,
          tokenPrefix,
          error: `GitHub API returned ${response.status}: ${response.statusText}`,
          statusCode: response.status,
        };
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        valid: false,
        tokenPresent: true,
        error: errorMessage || 'Failed to validate token',
      };
    }
  }

  /**
   * Store a GitHub token and user info locally.
   * Used when a token is manually provided (e.g., pasted by the user).
   */
  async storeManualAuth(
    token: string,
    user: {
      login: string;
      email: string;
      name?: string;
      id?: number;
      avatarUrl?: string;
    },
  ): Promise<void> {
    await this.storage.setToken(TOKEN_KEYS.GITHUB_TOKEN, token, {
      user: user as AuthUser,
    });
    AuthStateManager.getInstance().setAuthenticated(user, token);
    try {
      await GitCredentialHelper.configureGitCredentials(token);
    } catch (error) {
      console.error(
        '[AuthService] Failed to configure git credentials:',
        error,
      );
    }
  }
}

// Create and export singleton instance
export const authService = new AuthService();
