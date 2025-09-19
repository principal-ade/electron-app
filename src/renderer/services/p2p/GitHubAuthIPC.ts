/**
 * GitHub Authentication Service (IPC Version)
 * Uses Electron IPC to communicate with main process
 * Avoids CORS issues and is more secure
 */

import { OrbitService } from '../../main-process-api/OrbitService';

export interface GitHubUser {
  githubHandle: string;
  email?: string;
  status: 'waitlisted' | 'approved' | 'denied';
  metadata?: {
    avatarUrl?: string;
    name?: string;
    company?: string;
    location?: string;
  };
}

export class GitHubAuth {
  private static instance: GitHubAuth;
  private token: string | null = null;
  private user: GitHubUser | null = null;
  private oauthCodeCallback: ((code: string | null) => void) | null = null;

  private constructor() {
    this.loadStoredAuth();
  }

  static getInstance(): GitHubAuth {
    if (!GitHubAuth.instance) {
      GitHubAuth.instance = new GitHubAuth();
    }
    return GitHubAuth.instance;
  }

  private loadStoredAuth() {
    // Load from localStorage or electron-store
    const stored = localStorage.getItem('orbit_auth');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        this.token = data.token;
        this.user = data.user;
      } catch (error) {
        console.error('Failed to load stored auth:', error);
      }
    }
  }

  private saveAuth(token: string, user: GitHubUser) {
    this.token = token;
    this.user = user;
    localStorage.setItem('orbit_auth', JSON.stringify({ token, user }));
  }

  async authenticate(): Promise<{
    success: boolean;
    user?: GitHubUser;
    error?: string;
  }> {
    try {
      // Open GitHub OAuth in browser via main process
      const openResult = await OrbitService.openAuth();

      if (!openResult.success) {
        console.warn('Failed to open OAuth URL:', openResult.error);
      }

      // Wait for OAuth code via callback (will be set by UI component)
      const code = await this.waitForOAuthCode();

      if (!code) {
        return { success: false, error: 'OAuth cancelled' };
      }

      return await this.exchangeCodeForToken(code);
    } catch (error) {
      console.error('Authentication error:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }

  private async waitForOAuthCode(): Promise<string | null> {
    // Wait for the OAuth code to be provided via the callback
    return new Promise((resolve) => {
      this.oauthCodeCallback = resolve;

      // Set a timeout in case user never provides code (5 minutes)
      setTimeout(
        () => {
          if (this.oauthCodeCallback === resolve) {
            this.oauthCodeCallback = null;
            resolve(null);
          }
        },
        5 * 60 * 1000,
      );
    });
  }

  // Called by the UI component when user enters the OAuth code
  submitOAuthCode(code: string | null) {
    if (this.oauthCodeCallback) {
      this.oauthCodeCallback(code);
      this.oauthCodeCallback = null;
    }
  }

  private async exchangeCodeForToken(
    code: string,
  ): Promise<{ success: boolean; user?: GitHubUser; error?: string }> {
    try {
      // Use IPC to exchange code for token
      const response = await OrbitService.authenticate(code);

      if (!response.success) {
        return {
          success: false,
          error: response.error || 'Authentication failed',
        };
      }

      if (response.user && response.token) {
        this.saveAuth(response.token, response.user);
        return { success: true, user: response.user };
      }

      return { success: false, error: 'Invalid response from server' };
    } catch (error) {
      console.error('Token exchange error:', error);
      return { success: false, error: 'Failed to exchange code for token' };
    }
  }

  async checkStatus(): Promise<{ status: string; user?: GitHubUser }> {
    if (!this.token) {
      return { status: 'unauthenticated' };
    }

    try {
      const response = await OrbitService.checkStatus(this.token);

      if (response.status === 'new') {
        return { status: 'new' };
      }

      if (response.githubHandle) {
        this.user = {
          githubHandle: response.githubHandle,
          email: response.email,
          status: response.status as any,
          metadata: response.metadata,
        };
        return { status: response.status, user: this.user };
      }

      return { status: 'error' };
    } catch (error) {
      console.error('Status check error:', error);
      return { status: 'error' };
    }
  }

  getToken(): string | null {
    return this.token;
  }

  getUser(): GitHubUser | null {
    return this.user;
  }

  isAuthenticated(): boolean {
    return this.token !== null;
  }

  isApproved(): boolean {
    return this.user?.status === 'approved';
  }

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('orbit_auth');
  }
}
