import { ipcMain, BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { TerminalSessionManager } from '../TerminalSessionManager';
import { ownershipManager } from '../TerminalOwnershipManager';
import { TerminalAPIEvents } from '../../../shared/main-process-api-interfaces/TerminalService';

export function setupOwnershipHandlers(
  sessionManager: TerminalSessionManager,
): void {
  // Check ownership of a terminal session
  ipcMain.handle(
    TerminalAPIEvents.CHECK_OWNERSHIP,
    async (event: IpcMainInvokeEvent, sessionId: string) => {
      const senderWindowId = BrowserWindow.fromWebContents(event.sender)?.id;
      if (!senderWindowId) {
        return {
          exists: false,
          ownedByWindowId: null,
          ownedByThisWindow: false,
          canClaim: false,
          ownerWindowExists: false,
        };
      }

      if (!sessionManager.hasSession(sessionId)) {
        return {
          exists: false,
          ownedByWindowId: null,
          ownedByThisWindow: false,
          canClaim: false,
          ownerWindowExists: false,
        };
      }

      return ownershipManager.checkOwnership(sessionId, senderWindowId);
    },
  );

  // Claim ownership of a terminal session
  // This also creates a MessageChannel to ensure data can flow
  ipcMain.handle(
    TerminalAPIEvents.CLAIM_OWNERSHIP,
    async (
      event: IpcMainInvokeEvent,
      sessionId: string,
      force: boolean = false,
    ) => {
      if (!sessionManager.hasSession(sessionId)) {
        console.log(
          `[Terminal] Cannot claim ownership: session ${sessionId} not found`,
        );
        return { success: false, reason: 'Session not found' };
      }

      const senderWindowId = BrowserWindow.fromWebContents(event.sender)?.id;
      if (!senderWindowId) {
        console.log(
          `[Terminal] Cannot claim ownership: could not determine sender window ID`,
        );
        return { success: false, reason: 'Could not determine window ID' };
      }

      const result = ownershipManager.claimOwnership(
        sessionId,
        senderWindowId,
        force,
      );

      // Always create/refresh the MessageChannel when claiming ownership
      // This handles reconnection after page reload/window reopen
      if (result.success) {
        sessionManager.createMessageChannelForSession(
          sessionId,
          senderWindowId,
        );
        console.log(
          `[Terminal] Created MessageChannel during ownership claim for session ${sessionId} -> window ${senderWindowId}`,
        );
      }

      return result;
    },
  );

  // Release ownership of a terminal session
  ipcMain.handle(
    TerminalAPIEvents.RELEASE_OWNERSHIP,
    async (event: IpcMainInvokeEvent, sessionId: string) => {
      if (!sessionManager.hasSession(sessionId)) {
        return { success: false, reason: 'Session not found' };
      }

      const senderWindowId = BrowserWindow.fromWebContents(event.sender)?.id;
      if (!senderWindowId) {
        return { success: false, reason: 'Could not determine window ID' };
      }

      return ownershipManager.releaseOwnership(sessionId, senderWindowId);
    },
  );

  // Request a MessagePort for terminal data streaming
  // This creates a MessageChannel and transfers the port to the renderer
  ipcMain.handle(
    TerminalAPIEvents.REQUEST_DATA_PORT,
    async (event: IpcMainInvokeEvent, sessionId: string) => {
      if (!sessionManager.hasSession(sessionId)) {
        console.log(
          `[Terminal] Cannot request data port: session ${sessionId} not found`,
        );
        return { success: false, reason: 'Session not found' };
      }

      const senderWindowId = BrowserWindow.fromWebContents(event.sender)?.id;
      if (!senderWindowId) {
        console.log(
          `[Terminal] Cannot request data port: could not determine sender window ID`,
        );
        return { success: false, reason: 'Could not determine window ID' };
      }

      // Create MessageChannel and transfer port to renderer
      const success = sessionManager.createMessageChannelForSession(
        sessionId,
        senderWindowId,
      );
      if (success) {
        console.log(
          `[Terminal] Created MessageChannel for session ${sessionId} -> window ${senderWindowId}`,
        );
        return { success: true };
      } else {
        return { success: false, reason: 'Failed to create MessageChannel' };
      }
    },
  );
}
