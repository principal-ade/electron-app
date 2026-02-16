// Import types from the shared API interface
import type { UpdateInfo, ProgressInfo, UpdateDownloadedEvent } from '../../shared/main-process-api-interfaces/AppVersionManagerAPI';

export class AppVersionManagerService {
  static async getVersion(): Promise<string> {
    return await window.mainProcess.appVersionManager.getVersion();
  }

  static async isDevMode(): Promise<boolean> {
    return await window.mainProcess.appVersionManager.isDevMode();
  }

  static checkForUpdate(): void {
    window.mainProcess.appVersionManager.checkForUpdate();
  }

  static checkForUpdateSilently(): void {
    window.mainProcess.appVersionManager.checkForUpdateSilently();
  }

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

  static downloadUpdate(): void {
    window.mainProcess.appVersionManager.downloadUpdate();
  }

  static installUpdate(): void {
    window.mainProcess.appVersionManager.installUpdate();
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

  static testDownloadUpdate(): void {
    window.mainProcess.appVersionManager.testDownloadUpdate();
  }
}
