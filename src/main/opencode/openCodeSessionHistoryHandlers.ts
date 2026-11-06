import { ipcMain } from 'electron';
import { WindowEvent } from '../../shared/ipc-events/WindowEvents';
import { OpenCodeSessionHistoryEvents } from '../../shared/main-process-api-interfaces/OpenCodeSessionHistoryAPI';
import { openCodeSessionHistoryService } from './OpenCodeSessionHistoryService';

export function registerOpenCodeSessionHistoryHandlers(): void {
  ipcMain.handle(
    OpenCodeSessionHistoryEvents.LIST,
    (_event, directory: string) =>
      openCodeSessionHistoryService.list(directory),
  );
  ipcMain.handle(
    OpenCodeSessionHistoryEvents.LIST_PROJECTS,
    (_event, directories: string[]) =>
      openCodeSessionHistoryService.listProjects(directories),
  );
  ipcMain.handle(
    OpenCodeSessionHistoryEvents.SEARCH,
    (_event, directory: string, query: string) =>
      openCodeSessionHistoryService.search(directory, query),
  );
  ipcMain.handle(
    OpenCodeSessionHistoryEvents.SEARCH_PROJECTS,
    (_event, directories: string[], query: string) =>
      openCodeSessionHistoryService.searchProjects(directories, query),
  );
  ipcMain.handle(
    OpenCodeSessionHistoryEvents.RESUME_TARGET,
    (_event, directory: string, sessionId: string) =>
      openCodeSessionHistoryService.getResumeTarget(directory, sessionId),
  );
  ipcMain.handle(
    OpenCodeSessionHistoryEvents.RESUME,
    async (event, directory: string, sessionId: string) => {
      const target = await openCodeSessionHistoryService.getResumeTarget(
        directory,
        sessionId,
      );
      event.sender.send(WindowEvent.OPEN_TERMINAL_TAB, {
        directory: target.cwd,
        label: `OpenCode · ${target.title}`,
        command: `${target.executable} ${target.args.join(' ')}`,
      });
    },
  );
}

export function unregisterOpenCodeSessionHistoryHandlers(): void {
  Object.values(OpenCodeSessionHistoryEvents).forEach((event) => {
    ipcMain.removeHandler(event);
  });
}
