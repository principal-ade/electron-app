import { ipcMain } from 'electron';
import { WindowEvent } from '../../shared/ipc-events/WindowEvents';
import { CursorSessionHistoryEvents } from '../../shared/main-process-api-interfaces/CursorSessionHistoryAPI';
import { cursorSessionHistoryService } from './CursorSessionHistoryService';

export function registerCursorSessionHistoryHandlers(): void {
  ipcMain.handle(CursorSessionHistoryEvents.LIST, () =>
    cursorSessionHistoryService.list(),
  );
  ipcMain.handle(CursorSessionHistoryEvents.SEARCH, (_event, query: string) =>
    cursorSessionHistoryService.search(query),
  );
  ipcMain.handle(
    CursorSessionHistoryEvents.RESUME,
    async (event, directory: string, sessionId: string, tabId?: string) => {
      await cursorSessionHistoryService.resume(directory, sessionId);
      event.sender.send(WindowEvent.OPEN_TERMINAL_TAB, {
        directory,
        label: `Cursor · ${sessionId.slice(0, 8)}`,
        command: `agent --resume=${sessionId}`,
        agent: 'cursor',
        tabId,
      });
    },
  );
}

export function unregisterCursorSessionHistoryHandlers(): void {
  Object.values(CursorSessionHistoryEvents).forEach((event) => {
    ipcMain.removeHandler(event);
  });
}
