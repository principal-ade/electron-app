/**
 * Terminal Ownership Manager
 *
 * Enforces single-writer model for terminal sessions.
 * Supports both local (Electron window) and remote (browser) owners.
 * Only the owner can send input to the PTY and receives output.
 */

import { BrowserWindow } from 'electron';
import {
  OwnershipStatus,
  OwnershipResult,
  TerminalOwner,
  OwnerType,
  RemoteClientInfo,
} from './types';

export class TerminalOwnershipManager {
  // Map of sessionId -> owner info
  private ownership = new Map<string, TerminalOwner>();

  // Track remote client connections for validation
  private remoteClients = new Map<string, RemoteClientInfo>();

  /**
   * Register a remote client connection
   */
  registerRemoteClient(clientInfo: RemoteClientInfo): void {
    this.remoteClients.set(clientInfo.clientId, clientInfo);
    console.log(
      `[OwnershipManager] Registered remote client ${clientInfo.clientId} (${clientInfo.githubHandle})`,
    );
  }

  /**
   * Unregister a remote client connection
   */
  unregisterRemoteClient(clientId: string): void {
    this.remoteClients.delete(clientId);
    console.log(
      `[OwnershipManager] Unregistered remote client ${clientId}`,
    );
  }

  /**
   * Check ownership status for a session (local window).
   */
  checkOwnership(
    sessionId: string,
    requestingWindowId: number,
  ): OwnershipStatus {
    const owner = this.ownership.get(sessionId) ?? null;

    // Check if owner still exists
    let ownerExists = false;
    if (owner !== null) {
      ownerExists = this.doesOwnerExist(owner);
    }

    // Can claim if: no owner or owner is gone
    const canClaim = owner === null || !ownerExists;

    return {
      exists: this.ownership.has(sessionId),
      owner,
      ownedByThisClient:
        owner !== null &&
        owner.type === 'local' &&
        owner.id === requestingWindowId.toString(),
      canClaim,
      ownerExists,
      remoteClients: 0, // TODO: Track remote attachments separately
    };
  }

  /**
   * Check ownership status for a session (generic - local or remote).
   */
  checkOwnershipGeneric(
    sessionId: string,
    requestingId: string,
    requestingType: OwnerType,
  ): OwnershipStatus {
    const owner = this.ownership.get(sessionId) ?? null;

    // Check if owner still exists
    let ownerExists = false;
    if (owner !== null) {
      ownerExists = this.doesOwnerExist(owner);
    }

    // Can claim if: no owner or owner is gone
    const canClaim = owner === null || !ownerExists;

    return {
      exists: this.ownership.has(sessionId),
      owner,
      ownedByThisClient:
        owner !== null &&
        owner.type === requestingType &&
        owner.id === requestingId,
      canClaim,
      ownerExists,
      remoteClients: 0, // TODO: Track remote attachments separately
    };
  }

  /**
   * Check if an owner still exists (window not closed / remote client connected)
   */
  private doesOwnerExist(owner: TerminalOwner): boolean {
    if (owner.type === 'local') {
      const windowId = parseInt(owner.id, 10);
      const window = BrowserWindow.fromId(windowId);
      return window !== null && !window.isDestroyed();
    } else {
      // Remote client - check if still registered
      return this.remoteClients.has(owner.id);
    }
  }

  /**
   * Claim ownership of a session (legacy - for local windows).
   */
  claimOwnership(
    sessionId: string,
    windowId: number,
    force: boolean = false,
  ): OwnershipResult {
    const owner: TerminalOwner = {
      type: 'local',
      id: windowId.toString(),
      userId: 'local-user', // TODO: Get actual user ID from auth
      githubHandle: 'local', // TODO: Get actual GitHub handle
      claimedAt: Date.now(),
    };

    return this.claimOwnershipGeneric(sessionId, owner, force);
  }

  /**
   * Claim ownership of a session (generic - local or remote).
   */
  claimOwnershipGeneric(
    sessionId: string,
    newOwner: TerminalOwner,
    force: boolean = false,
  ): OwnershipResult {
    const currentOwner = this.ownership.get(sessionId);

    // Already own it
    if (
      currentOwner &&
      currentOwner.type === newOwner.type &&
      currentOwner.id === newOwner.id
    ) {
      return { success: true, owner: currentOwner };
    }

    // Check if current owner still exists
    let currentOwnerExists = false;
    if (currentOwner !== undefined) {
      currentOwnerExists = this.doesOwnerExist(currentOwner);
    }

    // Can't claim if owned by existing client and not forcing
    if (currentOwnerExists && !force) {
      return {
        success: false,
        reason: `Session is owned by another ${currentOwner!.type} client`,
        owner: currentOwner,
      };
    }

    // Claim ownership
    const previousOwner = currentOwner;
    this.ownership.set(sessionId, newOwner);

    console.log(
      `[OwnershipManager] ${newOwner.type} client ${newOwner.id} (${newOwner.githubHandle}) claimed ownership of session ${sessionId}` +
        (previousOwner !== undefined
          ? ` (from ${previousOwner.type} ${previousOwner.id})`
          : ''),
    );

    return {
      success: true,
      owner: newOwner,
      previousOwner: currentOwnerExists ? previousOwner : undefined,
    };
  }

  /**
   * Release ownership of a session (legacy - for local windows).
   */
  releaseOwnership(sessionId: string, windowId: number): OwnershipResult {
    return this.releaseOwnershipGeneric(sessionId, windowId.toString(), 'local');
  }

  /**
   * Release ownership of a session (generic - local or remote).
   */
  releaseOwnershipGeneric(
    sessionId: string,
    ownerId: string,
    ownerType: OwnerType,
  ): OwnershipResult {
    const currentOwner = this.ownership.get(sessionId);

    if (
      !currentOwner ||
      currentOwner.type !== ownerType ||
      currentOwner.id !== ownerId
    ) {
      return {
        success: false,
        reason: 'Not the owner of this session',
        owner: currentOwner,
      };
    }

    this.ownership.delete(sessionId);
    console.log(
      `[OwnershipManager] ${ownerType} client ${ownerId} released ownership of session ${sessionId}`,
    );

    return { success: true, previousOwner: currentOwner };
  }

  /**
   * Check if a window owns a session (for write permission).
   */
  isOwner(sessionId: string, windowId: number): boolean {
    const owner = this.ownership.get(sessionId);
    return (
      owner !== undefined &&
      owner.type === 'local' &&
      owner.id === windowId.toString()
    );
  }

  /**
   * Check if a client owns a session (generic - local or remote).
   */
  isOwnerGeneric(
    sessionId: string,
    ownerId: string,
    ownerType: OwnerType,
  ): boolean {
    const owner = this.ownership.get(sessionId);
    return (
      owner !== undefined &&
      owner.type === ownerType &&
      owner.id === ownerId
    );
  }

  /**
   * Get the owner for a session.
   */
  getOwner(sessionId: string): TerminalOwner | undefined {
    return this.ownership.get(sessionId);
  }

  /**
   * Remove ownership tracking for a session (called when session is destroyed).
   */
  removeSession(sessionId: string): void {
    this.ownership.delete(sessionId);
  }

  /**
   * Clean up ownership for a closed window.
   * Returns list of session IDs that were released.
   */
  cleanupWindow(windowId: number): string[] {
    const releasedSessions: string[] = [];
    const windowIdStr = windowId.toString();

    for (const [sessionId, owner] of this.ownership.entries()) {
      if (owner.type === 'local' && owner.id === windowIdStr) {
        this.ownership.delete(sessionId);
        releasedSessions.push(sessionId);
      }
    }

    if (releasedSessions.length > 0) {
      console.log(
        `[OwnershipManager] Cleaned up ${releasedSessions.length} sessions for closed window ${windowId}`,
      );
    }

    return releasedSessions;
  }

  /**
   * Clean up ownership for a disconnected remote client.
   * Returns list of session IDs that were released.
   */
  cleanupRemoteClient(clientId: string): string[] {
    const releasedSessions: string[] = [];

    for (const [sessionId, owner] of this.ownership.entries()) {
      if (owner.type === 'remote' && owner.id === clientId) {
        this.ownership.delete(sessionId);
        releasedSessions.push(sessionId);
      }
    }

    // Unregister the remote client
    this.unregisterRemoteClient(clientId);

    if (releasedSessions.length > 0) {
      console.log(
        `[OwnershipManager] Cleaned up ${releasedSessions.length} sessions for disconnected remote client ${clientId}`,
      );
    }

    return releasedSessions;
  }

  /**
   * Get all sessions owned by a remote client
   */
  getRemoteClientSessions(clientId: string): string[] {
    const sessions: string[] = [];

    for (const [sessionId, owner] of this.ownership.entries()) {
      if (owner.type === 'remote' && owner.id === clientId) {
        sessions.push(sessionId);
      }
    }

    return sessions;
  }

  /**
   * Get all registered remote clients
   */
  getRemoteClients(): Map<string, RemoteClientInfo> {
    return new Map(this.remoteClients);
  }
}

// Singleton instance
export const ownershipManager = new TerminalOwnershipManager();
