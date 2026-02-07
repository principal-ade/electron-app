/**
 * Secure Authentication Service
 * Uses Electron's secure storage instead of localStorage
 *
 * Now uses the unified AuthenticationAPI instead of direct IPC calls.
 */

import type {
  AuthUser,
} from '../../shared/main-process-api-interfaces/AuthenticationAPI';
import { AuthenticationService } from '../main-process-api/AuthenticationService';

// Map the legacy GitHubUser interface to AuthUser
export interface GitHubUser {
  githubHandle: string;
  email?: string;
  status?: 'waitlisted' | 'approved' | 'denied';
  metadata?: {
    avatarUrl?: string;
    name?: string;
    company?: string;
    location?: string;
  };
}

export interface AuthResult {
  authenticated: boolean;
  token?: string;
  user?: GitHubUser;
}

export class SecureAuthService {
  private static instance: SecureAuthService;

  private constructor() {}

  static getInstance(): SecureAuthService {
    if (!SecureAuthService.instance) {
      SecureAuthService.instance = new SecureAuthService();
    }
    return SecureAuthService.instance;
  }

  /**
   * Save authentication securely
   */
  async saveAuth(token: string, user: GitHubUser): Promise<boolean> {
    try {
      // Convert GitHubUser to AuthUser format
      const authUser: AuthUser = {
        login: user.githubHandle,
        email: user.email || '',
        name: user.metadata?.name,
        avatarUrl: user.metadata?.avatarUrl,
      };

      const result = await AuthenticationService.saveGitHubAuth(
        token,
        authUser,
      );

      if (result.success) {
        // Clear from localStorage after successful save
        this.clearLocalStorage();
      }

      return result.success;
    } catch (error) {
      console.error('Failed to save auth securely:', error);
      return false;
    }
  }

  /**
   * Get authentication status
   */
  async checkAuth(): Promise<AuthResult> {
    try {
      // First try secure storage
      const result = await AuthenticationService.getGitHubAuth();

      if (result.authenticated && result.user) {
        // Convert AuthUser back to GitHubUser format for backward compatibility
        const gitHubUser: GitHubUser = {
          githubHandle: result.user.login,
          email: result.user.email,
          metadata: {
            name: result.user.name,
            avatarUrl: result.user.avatarUrl,
          },
        };

        return {
          authenticated: true,
          token: result.token,
          user: gitHubUser,
        };
      }

      return { authenticated: false };
    } catch (error) {
      console.error('Failed to check auth:', error);
      return { authenticated: false };
    }
  }

  /**
   * Clear authentication
   */
  async logout(): Promise<void> {
    try {
      await AuthenticationService.clearGitHubAuth();
      this.clearLocalStorage();
    } catch (error) {
      console.error('Failed to clear auth:', error);
    }
  }

  /**
   * Check if authenticated (quick check)
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      return await AuthenticationService.isAuthenticated();
    } catch (error) {
      console.error('Failed to check authentication:', error);
      return false;
    }
  }

  /**
   * Clear sensitive data from localStorage
   */
  private clearLocalStorage(): void {
    localStorage.removeItem('orbit_auth');
    localStorage.removeItem('git-sync-auth');
    localStorage.removeItem('github_token');
  }
}

// Export singleton instance
export const secureAuth = SecureAuthService.getInstance();
