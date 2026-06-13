/**
 * GitHub API Core
 *
 * Core functionality for GitHub API interactions including:
 * - Token management
 * - API call helper
 * - Command execution
 * - Cache management
 */

import fetch from 'node-fetch';
import { electronCLI } from '../../electron-cli-bridge';
import { authService } from '../../services/AuthService';
import { getGhCliToken } from './ghCliToken';
import { UnifiedSecureStorage } from '../../services/UnifiedSecureStorage';
import type {
  GitHubAPIRequestBody,
  GitHubAPIResponseData,
  GitHubAPICallResult,
  CommandResult,
  CacheEntry,
  AuthStatus,
} from './types';

/**
 * Core GitHub API client with token management, API calls, and caching
 */
export class GitHubAPICore {
  protected cache: Map<string, CacheEntry> = new Map();
  protected storage: UnifiedSecureStorage;

  constructor() {
    this.storage = UnifiedSecureStorage.getInstance();
  }

  // ===========================================================================
  // Token Management
  // ===========================================================================

  /**
   * Get a valid GitHub token with automatic refresh if expired
   * Uses AuthService for centralized token management with auto-refresh
   */
  async getGitHubToken(): Promise<string | null> {
    try {
      const token = await authService.getValidToken();
      if (token) {
        return token;
      }
      // No in-app (WorkOS-backed) token — fall back to the gh CLI token. This
      // call targets api.github.com, which accepts a gh CLI token even when
      // there's no WorkOS session.
      return await getGhCliToken();
    } catch (error) {
      console.error('[GitHub] Failed to get GitHub token:', error);
      return null;
    }
  }

  // ===========================================================================
  // API Call Helper
  // ===========================================================================

  /**
   * Make an API call to GitHub using the stored token
   */
  async makeGitHubAPICall(
    endpoint: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: GitHubAPIRequestBody;
    } = {},
  ): Promise<GitHubAPICallResult> {
    console.log('[GitHub] makeGitHubAPICall: Requesting endpoint:', endpoint);

    const token = await this.getGitHubToken();
    if (!token) {
      console.error('[GitHub] makeGitHubAPICall: No GitHub token available');
      return { success: false, error: 'No GitHub token available' };
    }

    // Debug: Check token format (mask most of it for security)
    console.log('[GitHub] Token info:', {
      length: token.length,
      prefix: token.substring(0, 4),
      hasGho: token.startsWith('gho_'),
      hasGhp: token.startsWith('ghp_'),
    });

    // GitHub OAuth tokens (gho_) use "token" auth, not "Bearer"
    const authHeader = token.startsWith('gho_')
      ? `token ${token}`
      : `Bearer ${token}`;

    try {
      const response = await fetch(`https://api.github.com${endpoint}`, {
        method: options.method || 'GET',
        headers: {
          Authorization: authHeader,
          Accept: 'application/vnd.github.v3+json',
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        const errorDetail = {
          success: false as const,
          status: response.status,
          statusText: response.statusText,
          error: `GitHub API error: ${response.status} ${response.statusText}`,
        };

        if (response.status === 401) {
          console.error(
            '[GitHub] makeGitHubAPICall: Authentication failed (401) - token may be expired or invalid',
          );
        } else if (response.status === 403) {
          console.error(
            '[GitHub] makeGitHubAPICall: Forbidden (403) - token may lack required permissions',
          );
        } else {
          console.error(
            '[GitHub] makeGitHubAPICall: Request failed',
            errorDetail,
          );
        }

        return errorDetail;
      }

      // Check if the response is raw content
      const contentType = response.headers.get('content-type') || '';
      let data: GitHubAPIResponseData;

      if (
        contentType.includes('application/vnd.github.v3.raw') ||
        contentType.includes('text/plain') ||
        options.headers?.Accept?.includes('application/vnd.github.v3.raw')
      ) {
        data = await response.text();
      } else {
        data = await response.json();
      }

      console.log(
        '[GitHub] makeGitHubAPICall: Request successful for endpoint:',
        endpoint,
      );
      return {
        success: true,
        data,
        headers: Object.fromEntries(response.headers.entries()),
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      console.error('[GitHub] API call failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ===========================================================================
  // Command Execution
  // ===========================================================================

  /**
   * Execute a shell command (git, gh, etc.)
   */
  async executeCommand(
    args: string[],
    options: { cwd?: string } = {},
  ): Promise<CommandResult> {
    try {
      await electronCLI.initialize();

      const [command, ...commandArgs] = args;

      const result = await electronCLI.execute(command, commandArgs, {
        cwd: options.cwd || process.cwd(),
        env: {
          ...process.env,
          PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
        },
      });

      return {
        success: result.success,
        stdout: result.stdout.trim(),
        stderr: result.stderr.trim(),
        exitCode: result.exitCode,
      };
    } catch (error) {
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
      };
    }
  }

  // ===========================================================================
  // Cache Management
  // ===========================================================================

  /**
   * Get a value from cache
   */
  getCached<T>(key: string, maxAgeMs: number = 5 * 60 * 1000): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > maxAgeMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set a value in cache
   */
  setCache(key: string, value: unknown): void {
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  /**
   * Clear cache entries matching a pattern
   */
  clearCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  // ===========================================================================
  // Auth Status
  // ===========================================================================

  /**
   * Check GitHub CLI authentication status
   */
  async checkAuthStatus(): Promise<AuthStatus> {
    try {
      const authStatusResult = await this.executeCommand([
        'gh',
        'auth',
        'status',
      ]);

      if (!authStatusResult.success) {
        return { isAuthenticated: false, method: 'none' };
      }

      const userResult = await this.executeCommand(['gh', 'api', 'user']);

      if (userResult.success) {
        const userMatch = authStatusResult.stderr.match(
          /Logged in to github\.com as ([^\s]+)/,
        );
        return {
          isAuthenticated: true,
          method: 'cli',
          username: userMatch?.[1],
        };
      }

      console.warn('[GitHub] CLI auth check passed, but token is invalid.');
      return { isAuthenticated: false, method: 'none' };
    } catch (error) {
      console.log(`[GitHub] CLI auth check failed:`, error);
    }

    return {
      isAuthenticated: false,
      method: 'none',
    };
  }

  /**
   * Get token scopes from GitHub API
   */
  async getTokenScopes(): Promise<string[]> {
    const apiResult = await this.makeGitHubAPICall('/user');
    if (apiResult.success && apiResult.headers) {
      const scopesHeader = apiResult.headers['x-oauth-scopes'];
      if (scopesHeader) {
        return scopesHeader.split(', ').filter((s: string) => s.length > 0);
      }
    }

    // Fallback to CLI
    try {
      const result = await this.executeCommand([
        'gh',
        'api',
        '/user',
        '--include',
      ]);
      if (result.success && result.stdout) {
        const lines = result.stdout.split('\n');
        for (const line of lines) {
          if (line.toLowerCase().startsWith('x-oauth-scopes:')) {
            const scopes = line.substring('x-oauth-scopes:'.length).trim();
            return scopes.split(', ').filter((s: string) => s.length > 0);
          }
        }
      }
    } catch (error) {
      console.error('[GitHub] Error getting token scopes:', error);
    }

    return [];
  }
}

// Export singleton instance for convenience
export const gitHubAPICore = new GitHubAPICore();
