import { ipcRenderer } from 'electron';
export var AppVersionManagerAPIEvent;
(function (AppVersionManagerAPIEvent) {
    AppVersionManagerAPIEvent["GET_VERSION"] = "get-app-version";
    AppVersionManagerAPIEvent["IS_DEV_MODE"] = "is-dev-mode";
    AppVersionManagerAPIEvent["CHECK_FOR_UPDATE"] = "check-for-update";
    AppVersionManagerAPIEvent["CHECK_FOR_UPDATE_MANUALLY"] = "check-for-update-manually";
    AppVersionManagerAPIEvent["CHECK_FOR_UPDATE_SILENTLY"] = "check-for-update-silently";
    AppVersionManagerAPIEvent["TEST_DOWNLOAD_UPDATE"] = "test-download-update";
    AppVersionManagerAPIEvent["ON_UPDATE_AVAILABLE"] = "update-available";
    AppVersionManagerAPIEvent["ON_UPDATE_NOT_AVAILABLE"] = "update-not-available";
    AppVersionManagerAPIEvent["ON_UPDATE_ERROR"] = "update-error";
    AppVersionManagerAPIEvent["ON_UPDATE_CHECK_COMPLETE"] = "update-check-complete";
    AppVersionManagerAPIEvent["REMOVE_UPDATE_LISTENERS"] = "remove-update-listeners";
    AppVersionManagerAPIEvent["DOWNLOAD_UPDATE"] = "download-update";
    AppVersionManagerAPIEvent["INSTALL_UPDATE"] = "install-update";
    AppVersionManagerAPIEvent["ON_UPDATE_DOWNLOAD_PROGRESS"] = "update-download-progress";
    AppVersionManagerAPIEvent["ON_UPDATE_DOWNLOADED"] = "update-downloaded";
})(AppVersionManagerAPIEvent || (AppVersionManagerAPIEvent = {}));
export const appVersionManagerApi = {
    getVersion: async () => ipcRenderer.invoke(AppVersionManagerAPIEvent.GET_VERSION),
    isDevMode: async () => ipcRenderer.invoke(AppVersionManagerAPIEvent.IS_DEV_MODE),
    checkForUpdate: () => ipcRenderer.send(AppVersionManagerAPIEvent.CHECK_FOR_UPDATE_MANUALLY),
    checkForUpdateManually: () => ipcRenderer.send(AppVersionManagerAPIEvent.CHECK_FOR_UPDATE_MANUALLY),
    checkForUpdateSilently: () => ipcRenderer.send(AppVersionManagerAPIEvent.CHECK_FOR_UPDATE_SILENTLY),
    onUpdateAvailable: (callback) => {
        const handler = (_event, info) => callback(info);
        ipcRenderer.on(AppVersionManagerAPIEvent.ON_UPDATE_AVAILABLE, handler);
        return () => {
            ipcRenderer.removeListener(AppVersionManagerAPIEvent.ON_UPDATE_AVAILABLE, handler);
        };
    },
    onUpdateNotAvailable: (callback) => {
        const handler = (_event, info) => callback(info);
        ipcRenderer.on(AppVersionManagerAPIEvent.ON_UPDATE_NOT_AVAILABLE, handler);
        return () => {
            ipcRenderer.removeListener(AppVersionManagerAPIEvent.ON_UPDATE_NOT_AVAILABLE, handler);
        };
    },
    onUpdateError: (callback) => {
        const handler = (_event, error) => callback(error);
        ipcRenderer.on(AppVersionManagerAPIEvent.ON_UPDATE_ERROR, handler);
        return () => {
            ipcRenderer.removeListener(AppVersionManagerAPIEvent.ON_UPDATE_ERROR, handler);
        };
    },
    onUpdateCheckComplete: (callback) => {
        const handler = (_event) => callback();
        ipcRenderer.on(AppVersionManagerAPIEvent.ON_UPDATE_CHECK_COMPLETE, handler);
        return () => {
            ipcRenderer.removeListener(AppVersionManagerAPIEvent.ON_UPDATE_CHECK_COMPLETE, handler);
        };
    },
    removeUpdateListeners: () => {
        ipcRenderer.removeAllListeners(AppVersionManagerAPIEvent.ON_UPDATE_AVAILABLE);
        ipcRenderer.removeAllListeners(AppVersionManagerAPIEvent.ON_UPDATE_NOT_AVAILABLE);
        ipcRenderer.removeAllListeners(AppVersionManagerAPIEvent.ON_UPDATE_ERROR);
        ipcRenderer.removeAllListeners(AppVersionManagerAPIEvent.ON_UPDATE_CHECK_COMPLETE);
        ipcRenderer.removeAllListeners(AppVersionManagerAPIEvent.ON_UPDATE_DOWNLOAD_PROGRESS);
        ipcRenderer.removeAllListeners(AppVersionManagerAPIEvent.ON_UPDATE_DOWNLOADED);
    },
    downloadUpdate: () => {
        ipcRenderer.send(AppVersionManagerAPIEvent.DOWNLOAD_UPDATE);
    },
    installUpdate: () => {
        ipcRenderer.send(AppVersionManagerAPIEvent.INSTALL_UPDATE);
    },
    onUpdateDownloadProgress: (callback) => {
        const handler = (_event, progress) => callback(progress);
        ipcRenderer.on(AppVersionManagerAPIEvent.ON_UPDATE_DOWNLOAD_PROGRESS, handler);
        return () => {
            ipcRenderer.removeListener(AppVersionManagerAPIEvent.ON_UPDATE_DOWNLOAD_PROGRESS, handler);
        };
    },
    onUpdateDownloaded: (callback) => {
        const handler = (_event, info) => callback(info);
        ipcRenderer.on(AppVersionManagerAPIEvent.ON_UPDATE_DOWNLOADED, handler);
        return () => {
            ipcRenderer.removeListener(AppVersionManagerAPIEvent.ON_UPDATE_DOWNLOADED, handler);
        };
    },
    testDownloadUpdate: () => {
        ipcRenderer.send(AppVersionManagerAPIEvent.TEST_DOWNLOAD_UPDATE);
    },
};
