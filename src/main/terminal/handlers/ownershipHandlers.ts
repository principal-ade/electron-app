import { ipcMain, BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { TerminalSessionManager } from '../TerminalSessionManager';
import { TerminalOwnershipManager } from '../TerminalOwnershipManager';
import { TerminalAPIEvents } from '../../../shared/main-process-api-interfaces/TerminalService';

export function setupOwnershipHandlers(
  sessionManager: TerminalSessionManager,
  ownershipManager: TerminalOwnershipManager,
): void {
  // Check ownership of a terminal session
  ipcMain.handle(
    TerminalAPIEvents.CHECK_OWNERSHIP,
    async (event: IpcMainInvokeEvent, sessionId: string) => {
      const session = sessionManager.getSession(sessionId);
      const senderWindowId = BrowserWindow.fromWebContents(event.sender)?.id;
      return ownershipManager.checkOwnership(session, senderWindowId);
    },
  );

  // Claim ownership of a terminal session
  ipcMain.handle(
    TerminalAPIEvents.CLAIM_OWNERSHIP,
    async (event: IpcMainInvokeEvent, sessionId: string, force: boolean = false) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) {
        console.log(`[Terminal] Cannot claim ownership: session ${sessionId} not found`);
        return { success: false, reason: 'Session not found' };
      }

      const senderWindowId = BrowserWindow.fromWebContents(event.sender)?.id;
      if (!senderWindowId) {
        console.log(`[Terminal] Cannot claim ownership: could not determine sender window ID`);
        return { success: false, reason: 'Could not determine window ID' };
      }

      return ownershipManager.claimOwnership(session, senderWindowId, force);
    },
  );

  // Release ownership of a terminal session
  ipcMain.handle(
    TerminalAPIEvents.RELEASE_OWNERSHIP,
    async (event: IpcMainInvokeEvent, sessionId: string) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) {
        return { success: false, reason: 'Session not found' };
      }

      const senderWindowId = BrowserWindow.fromWebContents(event.sender)?.id;
      return ownershipManager.releaseOwnership(session, senderWindowId);
    },
  );

  // Request a MessagePort for terminal data streaming
  // This creates a MessageChannel and transfers the port to the renderer
  ipcMain.handle(
    TerminalAPIEvents.REQUEST_DATA_PORT,
    async (event: IpcMainInvokeEvent, sessionId: string) => {
      const session = sessionManager.getSession(sessionId);
      if (!session) {
        console.log(`[Terminal] Cannot request data port: session ${sessionId} not found`);
        return { success: false, reason: 'Session not found' };
      }

      const senderWindowId = BrowserWindow.fromWebContents(event.sender)?.id;
      if (!senderWindowId) {
        console.log(`[Terminal] Cannot request data port: could not determine sender window ID`);
        return { success: false, reason: 'Could not determine window ID' };
      }

      // Create MessageChannel and transfer port to renderer
      const success = sessionManager.createMessageChannelForSession(sessionId, senderWindowId);
      if (success) {
        console.log(`[Terminal] Created MessageChannel for session ${sessionId} -> window ${senderWindowId}`);
        return { success: true };
      } else {
        return { success: false, reason: 'Failed to create MessageChannel' };
      }
    },
  );
}
