import { ipcMain } from 'electron';
import { WindowEvent } from '../../shared/ipc-events/WindowEvents';
import { ClaudeSessionHistoryEvents } from '../../shared/main-process-api-interfaces/ClaudeSessionHistoryAPI';
import { claudeSessionHistoryService } from './ClaudeSessionHistoryService';

export function registerClaudeSessionHistoryHandlers(): void {
  ipcMain.handle(ClaudeSessionHistoryEvents.LIST, () =>
    claudeSessionHistoryService.list(),
  );
  ipcMain.handle(ClaudeSessionHistoryEvents.SEARCH, (_event, query: string) =>
    claudeSessionHistoryService.search(query),
  );
  ipcMain.handle(
    ClaudeSessionHistoryEvents.RESUME,
    async (event, directory: string, sessionId: string) => {
      const session = await claudeSessionHistoryService.resume(
        directory,
        sessionId,
      );
      event.sender.send(WindowEvent.OPEN_TERMINAL_TAB, {
        directory: session.directory,
        label: `Claude Code · ${session.title}`,
        command: `claude --resume ${session.id}`,
      });
    },
  );
}

export function unregisterClaudeSessionHistoryHandlers(): void {
  Object.values(ClaudeSessionHistoryEvents).forEach((event) => {
    ipcMain.removeHandler(event);
  });
}
