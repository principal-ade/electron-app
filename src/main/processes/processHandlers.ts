/**
 * ipcMain handlers for the process registry. Thin wrappers over the singleton
 * — the registry broadcasts `processes:changed` to every window itself, so the
 * renderer stays in sync without polling.
 */

import { ipcMain } from 'electron';
import { getProcessRegistry } from './ProcessRegistry';
import {
  ProcessRegistryEvents,
  ProcessStartRequest,
} from '../../shared/main-process-api-interfaces/ProcessRegistryAPI';

export function registerProcessHandlers(): void {
  const registry = getProcessRegistry();

  ipcMain.handle(ProcessRegistryEvents.LIST, async () => registry.list());
  ipcMain.handle(ProcessRegistryEvents.LOGS, async (_event, id: string) =>
    registry.getLogs(id),
  );

  ipcMain.handle(
    ProcessRegistryEvents.START,
    async (_event, request: ProcessStartRequest) =>
      registry.start(request, 'user'),
  );

  ipcMain.handle(ProcessRegistryEvents.STOP, async (_event, id: string) =>
    registry.stop(id),
  );

  ipcMain.handle(ProcessRegistryEvents.RESTART, async (_event, id: string) =>
    registry.restart(id),
  );

  ipcMain.handle(ProcessRegistryEvents.REMOVE, async (_event, id: string) =>
    registry.remove(id),
  );

  ipcMain.handle(
    ProcessRegistryEvents.SET_PINNED,
    async (_event, id: string, pinned: boolean) => {
      if (typeof id !== 'string' || typeof pinned !== 'boolean') {
        return { success: false, error: 'Invalid process pin request.' };
      }
      return registry.setPinned(id, pinned);
    },
  );

  console.log('[ProcessRegistry] Handlers registered');
}
