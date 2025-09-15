export class AppVersionManagerService {
    static async getVersion() {
        return await window.mainProcess.appVersionManager.getVersion();
    }
    static async isDevMode() {
        return await window.mainProcess.appVersionManager.isDevMode();
    }
    static checkForUpdate() {
        window.mainProcess.appVersionManager.checkForUpdate();
    }
    static checkForUpdateSilently() {
        window.mainProcess.appVersionManager.checkForUpdateSilently();
    }
    static onUpdateAvailable(callback) {
        return window.mainProcess.appVersionManager.onUpdateAvailable(callback);
    }
    static onUpdateNotAvailable(callback) {
        return window.mainProcess.appVersionManager.onUpdateNotAvailable(callback);
    }
    static onUpdateError(callback) {
        return window.mainProcess.appVersionManager.onUpdateError(callback);
    }
    static onUpdateCheckComplete(callback) {
        return window.mainProcess.appVersionManager.onUpdateCheckComplete(callback);
    }
    static removeUpdateListeners() {
        window.mainProcess.appVersionManager.removeUpdateListeners();
    }
    static downloadUpdate() {
        window.mainProcess.appVersionManager.downloadUpdate();
    }
    static installUpdate() {
        window.mainProcess.appVersionManager.installUpdate();
    }
    static onUpdateDownloadProgress(callback) {
        return window.mainProcess.appVersionManager.onUpdateDownloadProgress(callback);
    }
    static onUpdateDownloaded(callback) {
        return window.mainProcess.appVersionManager.onUpdateDownloaded(callback);
    }
    static testDownloadUpdate() {
        window.mainProcess.appVersionManager.testDownloadUpdate();
    }
}
