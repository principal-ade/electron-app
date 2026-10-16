/**
 * Secure Authentication Service
 * Uses Electron's secure storage instead of localStorage
 *
 * Now uses the unified AuthenticationAPI instead of direct IPC calls.
 */

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

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  static getInstance(): SecureAuthService {
    if (!SecureAuthService.instance) {
      SecureAuthService.instance = new SecureAuthService();
    }
    return SecureAuthService.instance;
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
}

// Export singleton instance
export const secureAuth = SecureAuthService.getInstance();
