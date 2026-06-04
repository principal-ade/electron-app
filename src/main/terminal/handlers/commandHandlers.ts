import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { TerminalSessionManager } from '../TerminalSessionManager';
import { TerminalAPIEvents } from '../../../shared/main-process-api-interfaces/TerminalService';
import { terminalEnvironment } from '../../terminalEnvironment';

export function setupCommandHandlers(
  sessionManager: TerminalSessionManager,
): void {
  // Write data to terminal
  ipcMain.handle(
    TerminalAPIEvents.WRITE,
    async (event: IpcMainInvokeEvent, sessionId: string, data: string) => {
      sessionManager.writeToSession(sessionId, data);
    },
  );

  // Resize terminal
  ipcMain.handle(
    TerminalAPIEvents.RESIZE,
    async (
      event: IpcMainInvokeEvent,
      sessionId: string,
      cols: number,
      rows: number,
      force?: boolean,
    ) => {
      sessionManager.resizeSession(sessionId, cols, rows, force ?? false);
    },
  );

  // Request terminal to refresh its display
  ipcMain.handle(
    TerminalAPIEvents.REFRESH,
    async (event: IpcMainInvokeEvent, sessionId: string) => {
      return sessionManager.refreshSession(sessionId);
    },
  );

  // Check if a command is available in the user's PATH
  ipcMain.handle(
    TerminalAPIEvents.CHECK_COMMAND,
    async (event: IpcMainInvokeEvent, command: string) => {
      try {
        const isAvailable =
          await terminalEnvironment.isCommandAvailable(command);
        const fullPath = isAvailable
          ? await terminalEnvironment.findCommand(command)
          : null;
        // Shape matches the ShellAPI.checkCommand contract ({ exists, path }),
        // the only renderer wrapper exposing this channel.
        return { exists: isAvailable, path: fullPath ?? undefined };
      } catch (error) {
        console.error(`Failed to check command ${command}:`, error);
        return {
          exists: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  // Clear cached PATH (useful after installing new tools)
  ipcMain.handle(TerminalAPIEvents.CLEAR_PATH_CACHE, async () => {
    terminalEnvironment.clearCache();
    console.log('[Terminal] PATH cache cleared');
    return true;
  });
}
