import { ipcRenderer } from 'electron';
import {
  ProcessRegistryAPI,
  ProcessRegistryEvents,
  ProcessEntry,
  ProcessStartRequest,
  ProcessStartResult,
  ProcessControlResult,
} from '../../shared/main-process-api-interfaces/ProcessRegistryAPI';

export const processRegistryAPI: ProcessRegistryAPI = {
  list: async (): Promise<ProcessEntry[]> =>
    ipcRenderer.invoke(ProcessRegistryEvents.LIST),

  start: async (request: ProcessStartRequest): Promise<ProcessStartResult> =>
    ipcRenderer.invoke(ProcessRegistryEvents.START, request),

  stop: async (id: string): Promise<ProcessControlResult> =>
    ipcRenderer.invoke(ProcessRegistryEvents.STOP, id),

  restart: async (id: string): Promise<ProcessStartResult> =>
    ipcRenderer.invoke(ProcessRegistryEvents.RESTART, id),

  remove: async (id: string): Promise<ProcessControlResult> =>
    ipcRenderer.invoke(ProcessRegistryEvents.REMOVE, id),

  onChanged: (callback: (processes: ProcessEntry[]) => void) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      processes: ProcessEntry[],
    ) => callback(processes);
    ipcRenderer.on(ProcessRegistryEvents.CHANGED, subscription);
    return () =>
      ipcRenderer.removeListener(ProcessRegistryEvents.CHANGED, subscription);
  },
};
