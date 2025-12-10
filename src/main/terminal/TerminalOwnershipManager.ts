/**
 * Terminal Ownership Manager
 *
 * Enforces single-writer model for terminal sessions.
 * Only the owner window can send input to the PTY and receives output.
 */

import { BrowserWindow } from 'electron';
import { OwnershipStatus, OwnershipResult } from './types';

export class TerminalOwnershipManager {
  // Map of sessionId -> ownerWindowId
  private ownership = new Map<string, number>();

  /**
   * Check ownership status for a session.
   */
  checkOwnership(sessionId: string, requestingWindowId: number): OwnershipStatus {
    const ownerWindowId = this.ownership.get(sessionId) ?? null;

    // Check if owner window still exists
    let ownerWindowExists = false;
    if (ownerWindowId !== null) {
      const ownerWindow = BrowserWindow.fromId(ownerWindowId);
      ownerWindowExists = ownerWindow !== null && !ownerWindow.isDestroyed();
    }

    // Can claim if: no owner or owner window is gone
    const canClaim = ownerWindowId === null || !ownerWindowExists;

    return {
      exists: this.ownership.has(sessionId),
      ownedByWindowId: ownerWindowId,
      ownedByThisWindow: ownerWindowId === requestingWindowId,
      canClaim,
      ownerWindowExists,
    };
  }

  /**
   * Claim ownership of a session.
   * Returns the previous owner's windowId if ownership was taken.
   */
  claimOwnership(
    sessionId: string,
    windowId: number,
    force: boolean = false
  ): OwnershipResult {
    const currentOwner = this.ownership.get(sessionId);

    // Already own it
    if (currentOwner === windowId) {
      return { success: true, ownedByWindowId: windowId };
    }

    // Check if current owner's window still exists
    let currentOwnerExists = false;
    if (currentOwner !== undefined) {
      const ownerWindow = BrowserWindow.fromId(currentOwner);
      currentOwnerExists = ownerWindow !== null && !ownerWindow.isDestroyed();
    }

    // Can't claim if owned by existing window and not forcing
    if (currentOwnerExists && !force) {
      return {
        success: false,
        reason: 'Session is owned by another window',
        ownedByWindowId: currentOwner,
      };
    }

    // Claim ownership
    const previousOwner = currentOwner;
    this.ownership.set(sessionId, windowId);

    console.log(
      `[OwnershipManager] Window ${windowId} claimed ownership of session ${sessionId}` +
        (previousOwner !== undefined ? ` (from window ${previousOwner})` : '')
    );

    return {
      success: true,
      ownedByWindowId: windowId,
      previousOwner: currentOwnerExists ? previousOwner : undefined,
    };
  }

  /**
   * Release ownership of a session.
   */
  releaseOwnership(sessionId: string, windowId: number): OwnershipResult {
    const currentOwner = this.ownership.get(sessionId);

    if (currentOwner !== windowId) {
      return {
        success: false,
        reason: 'Not the owner of this session',
        ownedByWindowId: currentOwner,
      };
    }

    this.ownership.delete(sessionId);
    console.log(
      `[OwnershipManager] Window ${windowId} released ownership of session ${sessionId}`
    );

    return { success: true };
  }

  /**
   * Check if a window owns a session (for write permission).
   */
  isOwner(sessionId: string, windowId: number): boolean {
    return this.ownership.get(sessionId) === windowId;
  }

  /**
   * Get the owner window ID for a session.
   */
  getOwner(sessionId: string): number | undefined {
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

    for (const [sessionId, owner] of this.ownership.entries()) {
      if (owner === windowId) {
        this.ownership.delete(sessionId);
        releasedSessions.push(sessionId);
      }
    }

    if (releasedSessions.length > 0) {
      console.log(
        `[OwnershipManager] Cleaned up ${releasedSessions.length} sessions for closed window ${windowId}`
      );
    }

    return releasedSessions;
  }
}

// Singleton instance
export const ownershipManager = new TerminalOwnershipManager();
