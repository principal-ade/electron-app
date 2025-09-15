import { AppVersionManagerAPI } from '../../shared/main-process-api-interfaces/AppVersionManagerAPI';
export declare enum AppVersionManagerAPIEvent {
    GET_VERSION = "get-app-version",
    IS_DEV_MODE = "is-dev-mode",
    CHECK_FOR_UPDATE = "check-for-update",
    CHECK_FOR_UPDATE_MANUALLY = "check-for-update-manually",
    CHECK_FOR_UPDATE_SILENTLY = "check-for-update-silently",
    TEST_DOWNLOAD_UPDATE = "test-download-update",
    ON_UPDATE_AVAILABLE = "update-available",
    ON_UPDATE_NOT_AVAILABLE = "update-not-available",
    ON_UPDATE_ERROR = "update-error",
    ON_UPDATE_CHECK_COMPLETE = "update-check-complete",
    REMOVE_UPDATE_LISTENERS = "remove-update-listeners",
    DOWNLOAD_UPDATE = "download-update",
    INSTALL_UPDATE = "install-update",
    ON_UPDATE_DOWNLOAD_PROGRESS = "update-download-progress",
    ON_UPDATE_DOWNLOADED = "update-downloaded"
}
export declare const appVersionManagerApi: AppVersionManagerAPI;
//# sourceMappingURL=appVersionManagerApi.d.ts.map