import { ipcRenderer } from 'electron';
import {
  SystemInfo,
  SystemEvents,
  SystemAPI,
  CommandOptions,
  CommandResult,
  DialogOptions,
  DialogResult,
  UpdateCheckResult,
} from '../../shared/main-process-api-interfaces/SystemAPI';

export const systemAPI: SystemAPI = {
  // Existing methods
  getPlatform: async (): Promise<string> => {
    return ipcRenderer.invoke(SystemEvents.GET_PLATFORM);
  },

  getSystemInfo: async (): Promise<SystemInfo | null> => {
    return ipcRenderer.invoke(SystemEvents.GET_SYSTEM_INFO);
  },

  // New methods for migration
  executeCommand: async (options: CommandOptions): Promise<CommandResult> => {
    return ipcRenderer.invoke(SystemEvents.EXECUTE_COMMAND, options);
  },

  openDialog: async (options: DialogOptions): Promise<DialogResult> => {
    return ipcRenderer.invoke(SystemEvents.OPEN_DIALOG, options);
  },

  checkForUpdateManually: async (): Promise<UpdateCheckResult> => {
    return ipcRenderer.invoke(SystemEvents.CHECK_FOR_UPDATE_MANUALLY);
  },

  restartApp: async (): Promise<void> => {
    return ipcRenderer.invoke(SystemEvents.RESTART_APP);
  },

  // Event listeners
  onUpdateCheckComplete: (callback: (result: UpdateCheckResult) => void) => {
    const subscription = (_event: any, result: UpdateCheckResult) =>
      callback(result);
    ipcRenderer.on(SystemEvents.UPDATE_CHECK_COMPLETE, subscription);
    return () =>
      ipcRenderer.removeListener(
        SystemEvents.UPDATE_CHECK_COMPLETE,
        subscription,
      );
  },
};
