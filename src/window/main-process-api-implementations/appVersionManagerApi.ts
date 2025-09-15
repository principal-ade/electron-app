import { ipcRenderer } from 'electron';
import { AppVersionManagerAPI } from '../../shared/main-process-api-interfaces/AppVersionManagerAPI';

export enum AppVersionManagerAPIEvent {
  GET_VERSION = 'get-app-version',
  IS_DEV_MODE = 'is-dev-mode',
  CHECK_FOR_UPDATE = 'check-for-update',
  CHECK_FOR_UPDATE_MANUALLY = 'check-for-update-manually',
  CHECK_FOR_UPDATE_SILENTLY = 'check-for-update-silently',
  TEST_DOWNLOAD_UPDATE = 'test-download-update',
  ON_UPDATE_AVAILABLE = 'update-available',
  ON_UPDATE_NOT_AVAILABLE = 'update-not-available',
  ON_UPDATE_ERROR = 'update-error',
  ON_UPDATE_CHECK_COMPLETE = 'update-check-complete',
  REMOVE_UPDATE_LISTENERS = 'remove-update-listeners',
  DOWNLOAD_UPDATE = 'download-update',
  INSTALL_UPDATE = 'install-update',
  ON_UPDATE_DOWNLOAD_PROGRESS = 'update-download-progress',
  ON_UPDATE_DOWNLOADED = 'update-downloaded',
}


export const appVersionManagerApi: AppVersionManagerAPI = {
  getVersion: async (): Promise<string> => 
    ipcRenderer.invoke(AppVersionManagerAPIEvent.GET_VERSION),

  isDevMode: async (): Promise<boolean> =>
    ipcRenderer.invoke(AppVersionManagerAPIEvent.IS_DEV_MODE),

  checkForUpdate: (): void =>
    ipcRenderer.send(AppVersionManagerAPIEvent.CHECK_FOR_UPDATE_MANUALLY),

  checkForUpdateManually: (): void =>
    ipcRenderer.send(AppVersionManagerAPIEvent.CHECK_FOR_UPDATE_MANUALLY),

  checkForUpdateSilently: (): void =>
    ipcRenderer.send(AppVersionManagerAPIEvent.CHECK_FOR_UPDATE_SILENTLY),

  onUpdateAvailable: (callback: (info: any) => void): (() => void) => {
    const handler = (_event: any, info: any) => callback(info);
    ipcRenderer.on(AppVersionManagerAPIEvent.ON_UPDATE_AVAILABLE, handler);
    return () => {
      ipcRenderer.removeListener(AppVersionManagerAPIEvent.ON_UPDATE_AVAILABLE, handler);
    };
  },

  onUpdateNotAvailable: (callback: (info: any) => void): (() => void) => {
    const handler = (_event: any, info: any) => callback(info);
    ipcRenderer.on(AppVersionManagerAPIEvent.ON_UPDATE_NOT_AVAILABLE, handler);
    return () => {
      ipcRenderer.removeListener(AppVersionManagerAPIEvent.ON_UPDATE_NOT_AVAILABLE, handler);
    };
  },

  onUpdateError: (callback: (error: any) => void): (() => void) => {
    const handler = (_event: any, error: any) => callback(error);
    ipcRenderer.on(AppVersionManagerAPIEvent.ON_UPDATE_ERROR, handler);
    return () => {
      ipcRenderer.removeListener(AppVersionManagerAPIEvent.ON_UPDATE_ERROR, handler);
    };
  },

  onUpdateCheckComplete: (callback: () => void): (() => void) => {
    const handler = (_event: any) => callback();
    ipcRenderer.on(AppVersionManagerAPIEvent.ON_UPDATE_CHECK_COMPLETE, handler);
    return () => {
      ipcRenderer.removeListener(AppVersionManagerAPIEvent.ON_UPDATE_CHECK_COMPLETE, handler);
    };
  },

  removeUpdateListeners: (): void => {
    ipcRenderer.removeAllListeners(AppVersionManagerAPIEvent.ON_UPDATE_AVAILABLE);
    ipcRenderer.removeAllListeners(AppVersionManagerAPIEvent.ON_UPDATE_NOT_AVAILABLE);
    ipcRenderer.removeAllListeners(AppVersionManagerAPIEvent.ON_UPDATE_ERROR);
    ipcRenderer.removeAllListeners(AppVersionManagerAPIEvent.ON_UPDATE_CHECK_COMPLETE);
    ipcRenderer.removeAllListeners(AppVersionManagerAPIEvent.ON_UPDATE_DOWNLOAD_PROGRESS);
    ipcRenderer.removeAllListeners(AppVersionManagerAPIEvent.ON_UPDATE_DOWNLOADED);
  },

  downloadUpdate: (): void => {
    ipcRenderer.send(AppVersionManagerAPIEvent.DOWNLOAD_UPDATE);
  },

  installUpdate: (): void => {
    ipcRenderer.send(AppVersionManagerAPIEvent.INSTALL_UPDATE);
  },

  onUpdateDownloadProgress: (callback: (progress: any) => void): (() => void) => {
    const handler = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on(AppVersionManagerAPIEvent.ON_UPDATE_DOWNLOAD_PROGRESS, handler);
    return () => {
      ipcRenderer.removeListener(AppVersionManagerAPIEvent.ON_UPDATE_DOWNLOAD_PROGRESS, handler);
    };
  },

  onUpdateDownloaded: (callback: (info: any) => void): (() => void) => {
    const handler = (_event: any, info: any) => callback(info);
    ipcRenderer.on(AppVersionManagerAPIEvent.ON_UPDATE_DOWNLOADED, handler);
    return () => {
      ipcRenderer.removeListener(AppVersionManagerAPIEvent.ON_UPDATE_DOWNLOADED, handler);
    };
  },

  testDownloadUpdate: (): void => {
    ipcRenderer.send(AppVersionManagerAPIEvent.TEST_DOWNLOAD_UPDATE);
  },
};
