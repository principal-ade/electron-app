import { ipcRenderer } from 'electron';
import {
  LocalhostDetectionAPI,
  LocalhostDetectionEvents,
  DetectServersOptions,
  ServerScanResult,
} from '../../shared/main-process-api-interfaces/LocalhostDetectionAPI';

export const localhostDetectionAPI: LocalhostDetectionAPI = {
  detectRunningServers: async (
    options?: DetectServersOptions,
  ): Promise<ServerScanResult> => {
    return ipcRenderer.invoke(
      LocalhostDetectionEvents.DETECT_RUNNING_SERVERS,
      options,
    );
  },

  checkPort: async (port: number, timeout?: number): Promise<boolean> => {
    return ipcRenderer.invoke(
      LocalhostDetectionEvents.CHECK_PORT,
      port,
      timeout,
    );
  },

  getCommonPorts: async (): Promise<number[]> => {
    return ipcRenderer.invoke(LocalhostDetectionEvents.GET_COMMON_PORTS);
  },

  startWatching: async (
    ports?: number[],
    intervalMs?: number,
  ): Promise<{ watchId: string }> => {
    return ipcRenderer.invoke(
      LocalhostDetectionEvents.START_WATCHING,
      ports,
      intervalMs,
    );
  },

  stopWatching: async (watchId: string): Promise<void> => {
    return ipcRenderer.invoke(LocalhostDetectionEvents.STOP_WATCHING, watchId);
  },

  onServersUpdated: (callback: (result: ServerScanResult) => void) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      result: ServerScanResult,
    ) => callback(result);
    ipcRenderer.on(LocalhostDetectionEvents.SERVERS_UPDATED, subscription);
    return () =>
      ipcRenderer.removeListener(
        LocalhostDetectionEvents.SERVERS_UPDATED,
        subscription,
      );
  },

  killServer: async (
    pid: number,
  ): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke(LocalhostDetectionEvents.KILL_SERVER, pid);
  },
};
