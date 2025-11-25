import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { TerminalSessionManager } from '../TerminalSessionManager';
import { TerminalWindowManager } from '../TerminalWindowManager';
import { TerminalAPIEvents } from '../../../shared/main-process-api-interfaces/TerminalService';

export function setupWindowHandlers(
  sessionManager: TerminalSessionManager,
  windowManager: TerminalWindowManager,
): void {
  // Pop out terminal to new window
  ipcMain.handle(
    TerminalAPIEvents.POP_OUT,
    async (event: IpcMainInvokeEvent, sessionId: string) => {
      try {
        const session = sessionManager.getSession(sessionId);
        if (!session) {
          throw new Error(`Terminal session ${sessionId} not found`);
        }

        return await windowManager.createTerminalWindow(sessionId, session);
      } catch (error) {
        console.error('Failed to pop out terminal:', error);
        throw error;
      }
    },
  );

  // Focus a terminal window by window ID
  ipcMain.handle(
    TerminalAPIEvents.FOCUS_WINDOW,
    async (event: IpcMainInvokeEvent, windowId: number) => {
      try {
        windowManager.focusWindow(windowId);
      } catch (error) {
        console.error('Failed to focus terminal window:', error);
        throw error;
      }
    },
  );

  // Get list of open terminal windows
  ipcMain.handle(TerminalAPIEvents.GET_OPEN_WINDOWS, async () => {
    return windowManager.getOpenWindows();
  });
}
