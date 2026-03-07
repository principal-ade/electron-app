// Import types from the shared API interface
import type { UpdateInfo, ProgressInfo, UpdateDownloadedEvent } from '../../shared/main-process-api-interfaces/AppVersionManagerAPI';
import { appVersionClient } from '../tipc/appVersionClient';

export class AppVersionManagerService {
  // ===========================================================================
  // Version Info (via TIPC)
  // ===========================================================================

  static async getVersion(): Promise<string> {
    return await appVersionClient.getVersion();
  }

  static async isDevMode(): Promise<boolean> {
    return await appVersionClient.isDevMode();
  }

  // ===========================================================================
  // Update Operations (via TIPC)
  // ===========================================================================

  static checkForUpdate(): void {
    appVersionClient.checkForUpdate({ trigger: 'manual' });
  }

  static checkForUpdateSilently(): void {
    appVersionClient.checkForUpdate({ trigger: 'silent' });
  }

  static downloadUpdate(): void {
    appVersionClient.downloadUpdate();
  }

  static installUpdate(): void {
    appVersionClient.installUpdate();
  }

  static testDownloadUpdate(): void {
    appVersionClient.testDownloadUpdate();
  }

  // ===========================================================================
  // Event Subscriptions (legacy IPC - TIPC doesn't support push events)
  // ===========================================================================

  static onUpdateAvailable(callback: (info: UpdateInfo) => void): () => void {
    return window.mainProcess.appVersionManager.onUpdateAvailable(callback);
  }

  static onUpdateNotAvailable(callback: (info: UpdateInfo) => void): () => void {
    return window.mainProcess.appVersionManager.onUpdateNotAvailable(callback);
  }

  static onUpdateError(callback: (error: Error) => void): () => void {
    return window.mainProcess.appVersionManager.onUpdateError(callback);
  }

  static onUpdateCheckComplete(callback: () => void): () => void {
    return window.mainProcess.appVersionManager.onUpdateCheckComplete(callback);
  }

  static removeUpdateListeners(): void {
    window.mainProcess.appVersionManager.removeUpdateListeners();
  }

  static onUpdateDownloadProgress(
    callback: (progress: ProgressInfo) => void,
  ): () => void {
    return window.mainProcess.appVersionManager.onUpdateDownloadProgress(
      callback,
    );
  }

  static onUpdateDownloaded(callback: (info: UpdateDownloadedEvent) => void): () => void {
    return window.mainProcess.appVersionManager.onUpdateDownloaded(callback);
  }
}
