import { BrowserWindow } from 'electron';
import { TerminalSession, OwnershipCheckResult, OwnershipClaimResult } from './types';
import { TerminalAPIEvents } from '../../shared/main-process-api-interfaces/TerminalService';

export class TerminalOwnershipManager {

  // Check ownership status for a session
  checkOwnership(
    session: TerminalSession | undefined,
    senderWindowId: number | undefined,
  ): OwnershipCheckResult {
    if (!session) {
      return { exists: false, ownedByWindowId: null, canClaim: false };
    }

    const isOwnedByThisWindow = session.ownedByWindowId === senderWindowId;
    const isUnowned = !session.ownedByWindowId;

    // Check if owned by a window that no longer exists
    let ownerWindowExists = false;
    if (session.ownedByWindowId) {
      const ownerWindow = BrowserWindow.fromId(session.ownedByWindowId);
      ownerWindowExists = !!ownerWindow && !ownerWindow.isDestroyed();
    }

    return {
      exists: true,
      ownedByWindowId: session.ownedByWindowId || null,
      ownedByThisWindow: isOwnedByThisWindow,
      canClaim: isUnowned || !ownerWindowExists,
      ownerWindowExists,
    };
  }

  // Claim ownership of a session
  claimOwnership(
    session: TerminalSession,
    senderWindowId: number,
    force: boolean = false,
  ): OwnershipClaimResult {
    console.log(
      `[Terminal] Window ${senderWindowId} attempting to claim ownership of session ${session.id}`,
    );
    console.log(
      `[Terminal] Current owner: ${session.ownedByWindowId || 'none'}`,
    );

    // Check if already owned by another window
    if (
      session.ownedByWindowId &&
      session.ownedByWindowId !== senderWindowId
    ) {
      const ownerWindow = BrowserWindow.fromId(session.ownedByWindowId);
      const ownerExists = ownerWindow && !ownerWindow.isDestroyed();

      console.log(
        `[Terminal] Session owned by window ${session.ownedByWindowId}, ownerExists: ${ownerExists}, force: ${force}`,
      );

      if (ownerExists && !force) {
        return {
          success: false,
          reason: 'Owned by another window',
          ownedByWindowId: session.ownedByWindowId,
        };
      }

      // If owner window doesn't exist or force=true, notify old owner (if it exists)
      if (ownerExists) {
        console.log(
          `[Terminal] Notifying window ${session.ownedByWindowId} that it lost ownership to window ${senderWindowId}`,
        );
        ownerWindow.webContents.send(TerminalAPIEvents.OWNERSHIP_LOST, {
          sessionId: session.id,
          newOwnerWindowId: senderWindowId,
        });
      }

      // Remove old owner from active viewers
      if (session.ownedByWindowId) {
        session.activeViewers.delete(session.ownedByWindowId);
      }
    }

    // Claim ownership
    session.ownedByWindowId = senderWindowId;
    session.ownershipClaimedAt = Date.now();
    // Add new owner to active viewers
    session.activeViewers.add(senderWindowId);

    console.log(
      `[Terminal] Window ${senderWindowId} successfully claimed ownership of session ${session.id}`,
    );

    return { success: true };
  }

  // Release ownership of a session
  releaseOwnership(
    session: TerminalSession,
    senderWindowId: number | undefined,
  ): OwnershipClaimResult {
    // Only the owner can release ownership
    if (session.ownedByWindowId !== senderWindowId) {
      return { success: false, reason: 'Not the owner' };
    }

    session.ownedByWindowId = undefined;
    session.ownershipClaimedAt = undefined;
    // Remove from active viewers
    if (senderWindowId) {
      session.activeViewers.delete(senderWindowId);
    }

    console.log(
      `[Terminal] Window ${senderWindowId} released ownership of session ${session.id}`,
    );

    return { success: true };
  }

  // Handle ownership transfer during getOrCreate
  handleAutomaticOwnershipClaim(
    session: TerminalSession,
    senderWindowId: number,
  ): void {
    // Remove old owner from active viewers if exists
    if (session.ownedByWindowId && session.ownedByWindowId !== senderWindowId) {
      session.activeViewers.delete(session.ownedByWindowId);

      // Notify old owner that they lost ownership
      const oldOwnerWindow = BrowserWindow.fromId(session.ownedByWindowId);
      if (oldOwnerWindow && !oldOwnerWindow.isDestroyed()) {
        oldOwnerWindow.webContents.send(TerminalAPIEvents.OWNERSHIP_LOST, {
          sessionId: session.id,
          newOwnerWindowId: senderWindowId,
        });
      }
    }

    // Claim ownership
    session.ownedByWindowId = senderWindowId;
    session.ownershipClaimedAt = Date.now();
    session.activeViewers.add(senderWindowId);

    console.log(
      `[Terminal] Window ${senderWindowId} automatically claimed ownership of session ${session.id}`,
    );
  }

  // Add a viewer to a session
  addViewer(session: TerminalSession, windowId: number): void {
    session.activeViewers.add(windowId);
  }

  // Remove a viewer from a session
  removeViewer(session: TerminalSession, windowId: number): void {
    session.activeViewers.delete(windowId);
  }
}
