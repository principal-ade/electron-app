/**
 * OAuthServerClient - Adapted from dev-collab-cli for Electron use
 *
 * Handles OAuth authentication flow with the server using PKCE
 * Uses WorkOS authentication with GitHub as the identity provider
 *
 * Token Refresh:
 * - Supports automatic token refresh using refresh tokens
 * - Tokens include expiry information (expires_in from server)
 * - AuthService automatically refreshes tokens before expiry
 * - Refresh tokens are stored securely alongside access tokens
 */

import crypto from 'crypto';
import {
  getAuthEndpoints,
  getAuthProviderName,
  type AuthEndpoints,
} from './AuthProvider';
import { APP_BRANDING } from '../../shared/config/appBranding';

interface AuthStartResponse {
  auth_url: string;
}

interface TokenResponse {
  github_access_token?: string; // GitHub token for GitHub API calls
  workos_access_token: string; // WorkOS token for session management
  refresh_token?: string;
  token_type: string;
  expires_in?: number; // Token lifetime in seconds
  scope?: string;
  user: {
    login: string;
    email: string;
    name: string;
    id: number;
  };
}

export interface AuthResult {
  token: string | undefined; // GitHub token for API calls (may be undefined on refresh)
  workosToken?: string; // WorkOS token for session management
  refreshToken?: string;
  expiresAt?: number; // Unix timestamp when token expires
  user: TokenResponse['user'];
}

export class OAuthServerClient {
  private serverUrl: string;
  private endpoints: AuthEndpoints;
  private state: string;
  private codeVerifier: string;
  private codeChallenge: string;
  private forceReauth: boolean;

  constructor(config?: { serverUrl?: string; forceReauth?: boolean }) {
    // Default to production server, override with environment variable if needed
    this.serverUrl =
      config?.serverUrl ||
      process.env.AUTH_SERVER_URL ||
      APP_BRANDING.AUTH_SERVER_URL.PRODUCTION;

    // Get endpoints for current provider
    this.endpoints = getAuthEndpoints(this.serverUrl);
    this.forceReauth = config?.forceReauth || false;

    // Generate random state for session tracking
    this.state = crypto.randomBytes(16).toString('hex');

    // Generate PKCE challenge/verifier pair
    this.codeVerifier = crypto.randomBytes(32).toString('base64url');
    this.codeChallenge = crypto
      .createHash('sha256')
      .update(this.codeVerifier)
      .digest('base64url');
  }

  async authenticate(): Promise<AuthResult> {
    try {
      // 1. Start auth flow with server
      const providerName = getAuthProviderName();
      console.log(
        `[OAuthServerClient] Starting authentication with ${providerName}...`,
      );
      console.log(
        `[OAuthServerClient] Using endpoint: ${this.endpoints.start}`,
      );

      const startResponse = await fetch(this.endpoints.start, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code_challenge: this.codeChallenge,
          state: this.state,
          force_reauth: this.forceReauth,
        }),
      });

      if (!startResponse.ok) {
        const error = (await startResponse.json()) as { error?: string };
        throw new Error(error.error || 'Failed to start authentication');
      }

      const { auth_url } = (await startResponse.json()) as AuthStartResponse;

      // 2. Open browser for user to authenticate
      console.log('[OAuthServerClient] Opening browser for authentication...');
      console.log(`[OAuthServerClient] Auth URL: ${auth_url}`);

      // The caller should handle opening the browser
      if ((global as any).open) {
        await (global as any).open(auth_url);
      } else {
        throw new Error('No browser opener configured');
      }

      // 3. Poll for token (server will have the code after callback)
      console.log('[OAuthServerClient] Waiting for authentication...');

      const tokenResponse = await this.pollForToken();

      // Calculate expiry timestamp if expires_in is provided
      const expiresAt = tokenResponse.expires_in
        ? Date.now() + tokenResponse.expires_in * 1000
        : undefined;

      // Extract GitHub and WorkOS tokens from response
      // CRITICAL: We MUST have a separate github_access_token
      const githubToken = tokenResponse.github_access_token;
      const workosToken = tokenResponse.workos_access_token;

      console.log('[OAuthServerClient] Token received:', {
        hasRefreshToken: !!tokenResponse.refresh_token,
        hasGithubToken: !!tokenResponse.github_access_token,
        hasWorkosToken: !!tokenResponse.workos_access_token,
        expiresIn: tokenResponse.expires_in,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : 'unknown',
        githubTokenPrefix: githubToken?.substring(0, 4),
      });

      // Validate that we have a GitHub token
      if (!githubToken) {
        throw new Error(
          'Authentication failed: No GitHub token received from server',
        );
      }

      // Validate GitHub token format (should start with gh prefix)
      if (!githubToken.startsWith('gh')) {
        console.warn(
          '[OAuthServerClient] WARNING: GitHub token does not start with "gh" prefix:',
          githubToken.substring(0, 10),
        );
      }

      return {
        token: githubToken,
        workosToken: workosToken,
        refreshToken: tokenResponse.refresh_token,
        expiresAt,
        user: tokenResponse.user,
      };
    } catch (error: any) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  private async pollForToken(): Promise<TokenResponse> {
    const maxAttempts = 60; // 5 minutes with 5 second intervals
    const pollInterval = 5000; // 5 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Wait before polling (except first attempt)
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

      try {
        const response = await fetch(this.endpoints.token, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            state: this.state,
            code_verifier: this.codeVerifier,
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as TokenResponse;
          console.log('[OAuthServerClient] Authentication successful');
          return data;
        }

        // If we get a 400, the auth hasn't completed yet, keep polling
        if (response.status === 400) {
          const error = (await response.json()) as { error?: string };
          if (error.error === 'Authorization pending') {
            // This is expected, continue polling
            continue;
          }
          // Some other error
          throw new Error(error.error || 'Token exchange failed');
        }

        // Unexpected status
        throw new Error(`Unexpected response: ${response.status}`);
      } catch (error: any) {
        // Network errors or other issues
        if (attempt === maxAttempts - 1) {
          throw error; // Last attempt, propagate error
        }
        // Otherwise continue polling
        console.log(
          `[OAuthServerClient] Poll attempt ${attempt + 1} failed, retrying...`,
        );
      }
    }

    throw new Error('Authentication timeout - no response received');
  }

  /**
   * Refresh an expired access token using a refresh token
   * @param refreshToken The refresh token to use for refreshing
   * @returns New auth result with fresh tokens
   */
  async refreshAccessToken(refreshToken: string): Promise<AuthResult> {
    try {
      console.log('[OAuthServerClient] Refreshing access token...');
      console.log(
        `[OAuthServerClient] Using refresh endpoint: ${this.endpoints.refresh}`,
      );

      const response = await fetch(this.endpoints.refresh, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: string };
        throw new Error(error.error || 'Token refresh failed');
      }

      const tokenResponse = (await response.json()) as TokenResponse;

      // Calculate expiry timestamp if expires_in is provided
      const expiresAt = tokenResponse.expires_in
        ? Date.now() + tokenResponse.expires_in * 1000
        : undefined;

      console.log('[OAuthServerClient] Token refreshed successfully:', {
        hasRefreshToken: !!tokenResponse.refresh_token,
        expiresIn: tokenResponse.expires_in,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : 'unknown',
      });

      // Important: Always use the new refresh token if provided by the server
      // Many OAuth providers implement refresh token rotation for security
      const newRefreshToken = tokenResponse.refresh_token || refreshToken;

      console.log('[OAuthServerClient] Refresh token rotation:', {
        rotated: !!tokenResponse.refresh_token,
        message: tokenResponse.refresh_token
          ? 'Using new refresh token from server'
          : 'Server did not provide new refresh token, keeping existing one',
      });

      // Extract GitHub and WorkOS tokens from response
      // On refresh, github_access_token may be null - server doesn't always return a new GitHub token
      // In that case, the caller (AuthService) should preserve the existing GitHub token
      const githubToken = tokenResponse.github_access_token;
      const workosToken = tokenResponse.workos_access_token;

      console.log('[OAuthServerClient] Token types in refresh response:', {
        hasGithubToken: !!tokenResponse.github_access_token,
        hasWorkosToken: !!tokenResponse.workos_access_token,
        githubTokenPrefix: githubToken?.substring(0, 4),
        workosTokenPrefix: workosToken?.substring(0, 4),
      });

      // Note: It's OK for githubToken to be null/undefined on refresh
      // The caller (AuthService) will preserve the existing GitHub token if null

      return {
        token: githubToken,
        workosToken: workosToken,
        refreshToken: newRefreshToken,
        expiresAt,
        user: tokenResponse.user,
      };
    } catch (error: any) {
      console.error('[OAuthServerClient] Token refresh failed:', error.message);
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }
}
