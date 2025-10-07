import { ipcRenderer } from 'electron';
import type {
  CreateDevSidecarWindowPayload,
  RestartDevSidecarServerPayload,
  StartDevSidecarServerPayload,
  StopDevSidecarServerPayload,
  DevSidecarAPI,
  DevSidecarWindowInfo,
  DevSidecarServerStatusResponse,
} from '../../shared/main-process-api-interfaces/DevSidecarAPI';
import { DevSidecarEvent } from '../../shared/main-process-api-interfaces/DevSidecarAPI';
import type { DevServerLogEntry } from '../../shared/types/devServer.types';

function registerListener<T>(
  channel: DevSidecarEvent,
  listener: (payload: T) => void,
): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: T) => {
    listener(payload);
  };
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

export const devSidecarAPI: DevSidecarAPI = {
  createWindow(payload: CreateDevSidecarWindowPayload) {
    return ipcRenderer.invoke(
      DevSidecarEvent.CREATE_WINDOW,
      payload,
    ) as Promise<DevSidecarWindowInfo>;
  },
  destroyWindow(sessionId: string) {
    return ipcRenderer.invoke(DevSidecarEvent.DESTROY_WINDOW, {
      sessionId,
    }) as Promise<{ success: boolean }>;
  },
  focusWindow(sessionId: string) {
    return ipcRenderer.invoke(DevSidecarEvent.FOCUS_WINDOW, {
      sessionId,
    }) as Promise<{ success: boolean }>;
  },
  startServer(payload: StartDevSidecarServerPayload) {
    return ipcRenderer.invoke(
      DevSidecarEvent.SERVER_START,
      payload,
    ) as Promise<DevSidecarServerStatusResponse>;
  },
  stopServer(payload: StopDevSidecarServerPayload) {
    return ipcRenderer.invoke(
      DevSidecarEvent.SERVER_STOP,
      payload,
    ) as Promise<{ success: boolean }>;
  },
  restartServer(payload: RestartDevSidecarServerPayload) {
    return ipcRenderer.invoke(
      DevSidecarEvent.SERVER_RESTART,
      payload,
    ) as Promise<DevSidecarServerStatusResponse>;
  },
  getStatus(sessionId: string) {
    return ipcRenderer.invoke(DevSidecarEvent.SERVER_STATUS, {
      sessionId,
    }) as Promise<DevSidecarServerStatusResponse>;
  },
  reload(sessionId: string, clearCache?: boolean) {
    return ipcRenderer.invoke(DevSidecarEvent.RELOAD, {
      sessionId,
      clearCache,
    });
  },
  navigate(sessionId: string, path: string) {
    return ipcRenderer.invoke(DevSidecarEvent.NAVIGATE, {
      sessionId,
      path,
    });
  },
  toggleDevTools(sessionId: string) {
    return ipcRenderer.invoke(DevSidecarEvent.TOGGLE_DEVTOOLS, {
      sessionId,
    });
  },
  toggleLogs(sessionId: string) {
    return ipcRenderer.invoke(DevSidecarEvent.TOGGLE_LOGS, {
      sessionId,
    }) as Promise<{ visible: boolean }>;
  },
  getBufferedLogs(sessionId: string) {
    return ipcRenderer.invoke(DevSidecarEvent.GET_BUFFERED_LOGS, {
      sessionId,
    }) as Promise<DevServerLogEntry[]>;
  },
  onWindowCreated(listener) {
    return registerListener<DevSidecarWindowInfo>(
      DevSidecarEvent.WINDOW_CREATED,
      listener,
    );
  },
  onWindowClosed(listener) {
    return registerListener<{ sessionId: string }>(
      DevSidecarEvent.WINDOW_CLOSED,
      ({ sessionId }) => listener(sessionId),
    );
  },
  onWindowFocused(listener) {
    return registerListener<{ sessionId: string }>(
      DevSidecarEvent.WINDOW_FOCUSED,
      ({ sessionId }) => listener(sessionId),
    );
  },
  onServerStarted(listener) {
    return registerListener<DevSidecarServerStatusResponse>(
      DevSidecarEvent.SERVER_STARTED,
      listener,
    );
  },
  onServerStopped(listener) {
    return registerListener<DevSidecarServerStatusResponse>(
      DevSidecarEvent.SERVER_STOPPED,
      listener,
    );
  },
  onServerError(listener) {
    return registerListener<DevSidecarServerStatusResponse>(
      DevSidecarEvent.SERVER_ERROR,
      listener,
    );
  },
  onServerOutput(listener) {
    return registerListener<DevServerLogEntry>(
      DevSidecarEvent.SERVER_OUTPUT,
      listener,
    );
  },
  onLogsToggled(listener) {
    return registerListener<{ sessionId: string; visible: boolean }>(
      DevSidecarEvent.LOGS_TOGGLED,
      listener,
    );
  },
  onServerStatus(listener) {
    return registerListener<DevSidecarServerStatusResponse>(
      DevSidecarEvent.SERVER_STATUS,
      listener,
    );
  },
};
