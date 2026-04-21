/**
 * AuthMethodDetector - Detects which authentication methods are available
 *
 * Supports three authentication methods:
 * 1. App OAuth - Tokens managed by the app in keychain
 * 2. GitHub CLI (gh) - Separate CLI authentication
 * 3. Git credentials - For git operations only
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import AuthStateManager from './AuthStateManager';

const execAsync = promisify(exec);

export type AuthMethod = 'oauth' | 'cli' | 'git' | 'none';

export interface AuthMethodStatus {
  oauth: {
    available: boolean;
    authenticated: boolean;
    user?: string;
  };
  cli: {
    available: boolean; // gh CLI installed
    authenticated: boolean; // gh auth status
    user?: string;
  };
  git: {
    available: boolean; // git installed
    configured: boolean; // has credential helper
    method?: string; // credential helper type
  };
  primary: AuthMethod; // Which method to use
}

export class AuthMethodDetector {
  private static instance: AuthMethodDetector;
  private cachedStatus: AuthMethodStatus | null = null;
  private cacheTimestamp = 0;
  private readonly CACHE_TTL = 60000; // 1 minute

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  static getInstance(): AuthMethodDetector {
    if (!AuthMethodDetector.instance) {
      AuthMethodDetector.instance = new AuthMethodDetector();
    }
    return AuthMethodDetector.instance;
  }

  /**
   * Clear cached status - call after auth state changes
   */
  clearCache(): void {
    this.cachedStatus = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Detect all available authentication methods
   */
  async detectAuthMethods(): Promise<AuthMethodStatus> {
    // Return cached if valid
    const now = Date.now();
    if (this.cachedStatus && (now - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.cachedStatus;
    }

    const [oauth, cli, git] = await Promise.all([
      this.checkOAuthAuth(),
      this.checkGhCliAuth(),
      this.checkGitAuth(),
    ]);

    // Determine primary auth method
    let primary: AuthMethod = 'none';
    if (oauth.authenticated) {
      primary = 'oauth';
    } else if (cli.authenticated) {
      primary = 'cli';
    } else if (git.configured) {
      primary = 'git';
    }

    const status: AuthMethodStatus = {
      oauth,
      cli,
      git,
      primary,
    };

    // Cache result
    this.cachedStatus = status;
    this.cacheTimestamp = now;

    return status;
  }

  /**
   * Check if App OAuth is available and authenticated
   */
  private async checkOAuthAuth(): Promise<AuthMethodStatus['oauth']> {
    try {
      const authStateManager = AuthStateManager.getInstance();
      const authState = authStateManager.getFullState();

      return {
        available: true, // OAuth always available in the app
        authenticated: authState.isAuthenticated,
        user: authState.user?.login,
      };
    } catch (error) {
      console.error('[AuthMethodDetector] Error checking OAuth auth:', error);
      return {
        available: true,
        authenticated: false,
      };
    }
  }

  /**
   * Check if GitHub CLI is installed and authenticated
   */
  private async checkGhCliAuth(): Promise<AuthMethodStatus['cli']> {
    try {
      // Check if gh is installed
      await execAsync('which gh');

      // Check auth status
      try {
        const { stdout } = await execAsync('gh auth status 2>&1');
        const isAuthenticated = stdout.includes('Logged in to github.com');

        // Try to extract username
        let user: string | undefined;
        const userMatch = stdout.match(/Logged in to github.com account (\S+)/);
        if (userMatch) {
          user = userMatch[1];
        }

        return {
          available: true,
          authenticated: isAuthenticated,
          user,
        };
      } catch (_authError) {
        // gh is installed but not authenticated
        return {
          available: true,
          authenticated: false,
        };
      }
    } catch (_error) {
      // gh CLI not installed
      return {
        available: false,
        authenticated: false,
      };
    }
  }

  /**
   * Check if git is installed and has credentials configured
   */
  private async checkGitAuth(): Promise<AuthMethodStatus['git']> {
    try {
      // Check if git is installed
      await execAsync('which git');

      // Check for credential helper
      try {
        const { stdout } = await execAsync('git config --global credential.helper');
        const helper = stdout.trim();

        return {
          available: true,
          configured: helper.length > 0,
          method: helper || undefined,
        };
      } catch (_configError) {
        // git installed but no credential helper configured
        return {
          available: true,
          configured: false,
        };
      }
    } catch (_error) {
      // git not installed
      return {
        available: false,
        configured: false,
      };
    }
  }

  /**
   * Quick check for which auth method will be used for GitHub API calls
   * This follows the precedence: OAuth → gh CLI → none
   */
  async getActiveAuthMethodForAPI(): Promise<AuthMethod> {
    const status = await this.detectAuthMethods();

    if (status.oauth.authenticated) {
      return 'oauth';
    }
    if (status.cli.authenticated) {
      return 'cli';
    }
    return 'none';
  }

  /**
   * Get user-friendly description of current auth state
   */
  async getAuthDescription(): Promise<string> {
    const status = await this.detectAuthMethods();
    const api = await this.getActiveAuthMethodForAPI();

    if (api === 'oauth') {
      return `Authenticated via app OAuth${status.oauth.user ? ` as ${status.oauth.user}` : ''}`;
    }
    if (api === 'cli') {
      return `Using GitHub CLI credentials${status.cli.user ? ` (${status.cli.user})` : ''}`;
    }
    if (status.git.configured) {
      return `Git credentials configured (${status.git.method}), but not authenticated for API calls`;
    }
    return 'Not authenticated';
  }
}

// Export singleton instance
export const authMethodDetector = AuthMethodDetector.getInstance();
