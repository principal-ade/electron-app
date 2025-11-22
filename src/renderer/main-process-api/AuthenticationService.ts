/**
 * Service layer for Authentication functionality
 * ALL window.mainProcess.authentication calls MUST be encapsulated here
 */

import {
  AuthUser,
  AuthResult,
  AuthStatus,
  AuthState,
  TokenResult,
  TokenWithMetadata,
  TokenMigrationEntry,
  TokenMetadata,
} from '../../shared/main-process-api-interfaces/AuthenticationAPI';

export class AuthenticationService {
  /**
   * Login via OAuth authentication
   */
  static async login(options?: { forceNew?: boolean }): Promise<AuthResult> {
    return window.mainProcess.authentication.login(options);
  }

  /**
   * Logout from authentication
   */
  static async logout(): Promise<{ success: boolean; error?: string }> {
    return window.mainProcess.authentication.logout();
  }

  /**
   * Check authentication status
   */
  static async check(): Promise<AuthResult> {
    return window.mainProcess.authentication.check();
  }

  /**
   * Get current authentication status
   */
  static async status(): Promise<AuthStatus> {
    return window.mainProcess.authentication.getStatus();
  }

  /**
   * Save GitHub authentication token
   */
  static async saveGitHubAuth(
    token: string,
    authUser: AuthUser,
  ): Promise<{ success: boolean; error?: string }> {
    return window.mainProcess.authentication.saveGitHubAuth(token, authUser);
  }

  /**
   * Get GitHub authentication token
   */
  static async getGitHubAuth(): Promise<TokenWithMetadata> {
    return window.mainProcess.authentication.getGitHubAuth();
  }

  /**
   * Clear GitHub authentication
   */
  static async clearGitHubAuth(): Promise<{
    success: boolean;
    error?: string;
  }> {
    return window.mainProcess.authentication.clearGitHubAuth();
  }

  /**
   * Check if authenticated
   */
  static async isAuthenticated(): Promise<boolean> {
    return window.mainProcess.authentication.isAuthenticated();
  }

  /**
   * Get token metadata including expiry and refresh token info
   */
  static async getTokenMetadata(): Promise<TokenMetadata> {
    return window.mainProcess.authentication.getTokenMetadata();
  }

  /**
   * Test refresh token mechanism by forcing a token refresh
   */
  static async testRefreshToken(): Promise<{
    success: boolean;
    error?: string;
    newExpiresAt?: number;
  }> {
    return window.mainProcess.authentication.testRefreshToken();
  }

  /**
   * Validate GitHub token by making a test API call
   */
  static async validateGitHubToken(): Promise<{
    valid: boolean;
    tokenPresent: boolean;
    tokenPrefix?: string;
    error?: string;
    statusCode?: number;
  }> {
    return window.mainProcess.authentication.validateGitHubToken();
  }

  /**
   * Set a secure token
   */
  static async saveToken(
    key: string,
    value: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ success: boolean; error?: string }> {
    return window.mainProcess.authentication.saveToken(key, value, metadata);
  }

  /**
   * Get a secure token
   */
  static async getToken(key: string): Promise<TokenResult> {
    return window.mainProcess.authentication.getToken(key);
  }

  /**
   * Delete a secure token
   */
  static async deleteToken(
    key: string,
  ): Promise<{ success: boolean; error?: string }> {
    return window.mainProcess.authentication.deleteToken(key);
  }

  /**
   * Migrate tokens from localStorage
   */
  static async migrateFromLocalStorage(
    tokens: TokenMigrationEntry[],
  ): Promise<{ success: boolean; error?: string }> {
    return window.mainProcess.authentication.migrateFromLocalStorage(tokens);
  }

  /**
   * Get current auth state
   */
  static async getAuthState(): Promise<AuthState> {
    return window.mainProcess.authentication.getAuthState();
  }

  /**
   * Subscribe to auth state changes
   * @returns Unsubscribe function
   */
  static onAuthStateChanged(callback: (state: AuthState) => void): () => void {
    return window.mainProcess.authentication.onAuthStateChanged(callback);
  }

  /**
   * Check keychain status
   */
  static async checkKeychainStatus(): Promise<{
    available: boolean;
    initialized: boolean;
    error?: string;
    errorType?: string;
  }> {
    return window.mainProcess.authentication.checkKeychainStatus();
  }

  /**
   * Test keychain access
   */
  static async testKeychainAccess(): Promise<{
    success: boolean;
    error?: string;
    errorType?: string;
  }> {
    return window.mainProcess.authentication.testKeychainAccess();
  }
}
