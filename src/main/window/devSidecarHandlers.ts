import { ipcMain } from 'electron';
import { DevSidecarManager } from './devSidecarManager';
import {
  DevSidecarEvent,
  type CreateDevSidecarWindowPayload,
  type RestartDevSidecarServerPayload,
  type StartDevSidecarServerPayload,
  type StopDevSidecarServerPayload,
} from '../../shared/main-process-api-interfaces/DevSidecarAPI';

export function registerDevSidecarHandlers(
  manager: DevSidecarManager,
): void {
  ipcMain.handle(
    DevSidecarEvent.CREATE_WINDOW,
    async (_event, payload: CreateDevSidecarWindowPayload) => {
      try {
        return await manager.createWindow(payload);
      } catch (error) {
        console.error('[DevSidecar] Failed to create window', error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    DevSidecarEvent.DESTROY_WINDOW,
    async (_event, { sessionId }: { sessionId: string }) => {
      try {
        return await manager.destroyWindow(sessionId);
      } catch (error) {
        console.error('[DevSidecar] Failed to destroy window', error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    DevSidecarEvent.FOCUS_WINDOW,
    async (_event, { sessionId }: { sessionId: string }) => {
      try {
        return await manager.focusWindow(sessionId);
      } catch (error) {
        console.error('[DevSidecar] Failed to focus window', error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    DevSidecarEvent.SERVER_START,
    async (_event, payload: StartDevSidecarServerPayload) => {
      try {
        return await manager.startServer(payload);
      } catch (error) {
        console.error('[DevSidecar] Failed to start server', error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    DevSidecarEvent.SERVER_STOP,
    async (_event, payload: StopDevSidecarServerPayload) => {
      try {
        return await manager.stopServer(payload);
      } catch (error) {
        console.error('[DevSidecar] Failed to stop server', error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    DevSidecarEvent.SERVER_RESTART,
    async (_event, payload: RestartDevSidecarServerPayload) => {
      try {
        return await manager.restartServer(payload);
      } catch (error) {
        console.error('[DevSidecar] Failed to restart server', error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    DevSidecarEvent.SERVER_STATUS,
    async (_event, { sessionId }: { sessionId: string }) => {
      try {
        return await manager.getStatus(sessionId);
      } catch (error) {
        console.error('[DevSidecar] Failed to get server status', error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    DevSidecarEvent.RELOAD,
    async (
      _event,
      { sessionId, clearCache }: { sessionId: string; clearCache?: boolean },
    ) => {
      try {
        await manager.reload(sessionId, clearCache);
      } catch (error) {
        console.error('[DevSidecar] Failed to reload view', error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    DevSidecarEvent.NAVIGATE,
    async (_event, { sessionId, path }: { sessionId: string; path: string }) => {
      try {
        await manager.navigate(sessionId, path);
      } catch (error) {
        console.error('[DevSidecar] Failed to navigate dev server view', error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    DevSidecarEvent.TOGGLE_DEVTOOLS,
    async (_event, { sessionId }: { sessionId: string }) => {
      try {
        await manager.toggleDevTools(sessionId);
      } catch (error) {
        console.error('[DevSidecar] Failed to toggle devtools', error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    DevSidecarEvent.TOGGLE_LOGS,
    async (_event, { sessionId }: { sessionId: string }) => {
      try {
        return await manager.toggleLogs(sessionId);
      } catch (error) {
        console.error('[DevSidecar] Failed to toggle logs view', error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    DevSidecarEvent.GET_BUFFERED_LOGS,
    async (_event, { sessionId }: { sessionId: string }) => {
      try {
        return await manager.getBufferedLogs(sessionId);
      } catch (error) {
        console.error('[DevSidecar] Failed to retrieve buffered logs', error);
        throw error;
      }
    },
  );
}

export function unregisterDevSidecarHandlers(): void {
  ipcMain.removeHandler(DevSidecarEvent.CREATE_WINDOW);
  ipcMain.removeHandler(DevSidecarEvent.DESTROY_WINDOW);
  ipcMain.removeHandler(DevSidecarEvent.FOCUS_WINDOW);
  ipcMain.removeHandler(DevSidecarEvent.SERVER_START);
  ipcMain.removeHandler(DevSidecarEvent.SERVER_STOP);
  ipcMain.removeHandler(DevSidecarEvent.SERVER_RESTART);
  ipcMain.removeHandler(DevSidecarEvent.SERVER_STATUS);
  ipcMain.removeHandler(DevSidecarEvent.RELOAD);
  ipcMain.removeHandler(DevSidecarEvent.NAVIGATE);
  ipcMain.removeHandler(DevSidecarEvent.TOGGLE_DEVTOOLS);
  ipcMain.removeHandler(DevSidecarEvent.TOGGLE_LOGS);
  ipcMain.removeHandler(DevSidecarEvent.GET_BUFFERED_LOGS);
}
