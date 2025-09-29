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
}
