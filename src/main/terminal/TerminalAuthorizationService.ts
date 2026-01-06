/**
 * Terminal Authorization Service
 *
 * Handles authorization checks for remote terminal access.
 * Ensures that only the same GitHub user who owns the desktop app
 * can access terminal sessions.
 */

import type { TerminalSession, RemoteClientInfo } from './types';
import type { TerminalSessionManager } from './TerminalSessionManager';

export interface AuthorizationResult {
  authorized: boolean;
  reason?: string;
}

export interface SessionPermissions {
  canRead: boolean;
  canWrite: boolean;
  canResize: boolean;
  canClaim: boolean;
}

export class TerminalAuthorizationService {
  constructor(
    private sessionManager: TerminalSessionManager,
    private desktopUserId: string,
    private desktopGithubHandle: string,
  ) {
    console.log(
      `[TerminalAuthorizationService] Initialized for user ${desktopGithubHandle} (${desktopUserId})`,
    );
  }

  /**
   * Check if a remote client can access a terminal session
   * Phase 1: Simple same-user check
   */
  async canAccessSession(
    clientInfo: RemoteClientInfo,
    sessionId: string,
  ): Promise<AuthorizationResult> {
    // Check if session exists
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      return {
        authorized: false,
        reason: 'Session not found',
      };
    }

    // Phase 1: Must be same GitHub user
    if (clientInfo.githubHandle !== this.desktopGithubHandle) {
      return {
        authorized: false,
        reason: 'Unauthorized: Different GitHub user',
      };
    }

    if (clientInfo.userId !== this.desktopUserId) {
      return {
        authorized: false,
        reason: 'Unauthorized: User ID mismatch',
      };
    }

    return { authorized: true };
  }

  /**
   * Get permissions for a session
   * Phase 1: All or nothing based on user match
   */
  async getSessionPermissions(
    clientInfo: RemoteClientInfo,
    sessionId: string,
  ): Promise<SessionPermissions> {
    const authResult = await this.canAccessSession(clientInfo, sessionId);

    if (!authResult.authorized) {
      return {
        canRead: false,
        canWrite: false,
        canResize: false,
        canClaim: false,
      };
    }

    // Same user = full access
    return {
      canRead: true,
      canWrite: true,
      canResize: true,
      canClaim: true,
    };
  }

  /**
   * Check if a client can claim ownership of a session
   */
  async canClaimOwnership(
    clientInfo: RemoteClientInfo,
    sessionId: string,
  ): Promise<AuthorizationResult> {
    // First check basic access
    const accessResult = await this.canAccessSession(clientInfo, sessionId);
    if (!accessResult.authorized) {
      return accessResult;
    }

    // Additional ownership checks could go here in future phases
    // (e.g., user is in the same team, has admin role, etc.)

    return { authorized: true };
  }

  /**
   * Check if a client can write to a session
   */
  async canWriteToSession(
    clientInfo: RemoteClientInfo,
    sessionId: string,
  ): Promise<AuthorizationResult> {
    // For now, same as access check
    return this.canAccessSession(clientInfo, sessionId);
  }

  /**
   * Check if a client can resize a session
   */
  async canResizeSession(
    clientInfo: RemoteClientInfo,
    sessionId: string,
  ): Promise<AuthorizationResult> {
    // For now, same as access check
    return this.canAccessSession(clientInfo, sessionId);
  }

  /**
   * Validate remote client credentials
   */
  validateClientCredentials(
    clientInfo: RemoteClientInfo,
  ): AuthorizationResult {
    // Basic validation
    if (!clientInfo.clientId) {
      return { authorized: false, reason: 'Missing client ID' };
    }

    if (!clientInfo.userId) {
      return { authorized: false, reason: 'Missing user ID' };
    }

    if (!clientInfo.githubHandle) {
      return { authorized: false, reason: 'Missing GitHub handle' };
    }

    return { authorized: true };
  }

  /**
   * Update desktop user info (called on auth state change)
   */
  updateDesktopUser(userId: string, githubHandle: string): void {
    this.desktopUserId = userId;
    this.desktopGithubHandle = githubHandle;
    console.log(
      `[TerminalAuthorizationService] Updated desktop user to ${githubHandle} (${userId})`,
    );
  }

  /**
   * Get current desktop user info
   */
  getDesktopUser(): { userId: string; githubHandle: string } {
    return {
      userId: this.desktopUserId,
      githubHandle: this.desktopGithubHandle,
    };
  }
}
