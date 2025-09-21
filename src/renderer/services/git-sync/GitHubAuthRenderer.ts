/**
 * GitHub Authentication - Renderer Process
 * Simple IPC wrapper that delegates all auth to main process
 */

import { AuthenticationService } from '../../main-process-api/AuthenticationService';

export class GitHubAuthRenderer {
  /**
   * Authenticate with GitHub
   * Opens browser and handles OAuth flow in main process
   */
  static async authenticate(): Promise<{ token: string; user: any }> {
    // Use proper service layer - login handles GitHub OAuth
    const result = await AuthenticationService.login();
    if (result.success && result.user) {
      return {
        token: result.token || '',
        user: result.user,
      };
    }
    throw new Error(result.error || 'Authentication failed');
  }

  /**
   * Check if authenticated
   */
  static async checkAuth(): Promise<{ authenticated: boolean; user?: any }> {
    // Use proper service layer
    const authState = await AuthenticationService.getAuthState();
    return {
      authenticated: authState.isAuthenticated,
      user: authState.user,
    };
  }

  /**
   * Create JWT for git-sync server
   * Main process creates JWT using stored GitHub token
   */
  static async createGitSyncJWT(payload: {
    repoId: string;
    agentId: string;
    userId: string;
    branch: string;
  }): Promise<string> {
    // TODO: Implement JWT creation in AuthenticationService
    throw new Error('JWT creation not yet implemented in service layer');
  }

  /**
   * Logout
   */
  static async logout(): Promise<void> {
    // Use proper service layer
    await AuthenticationService.logout();
  }
}
