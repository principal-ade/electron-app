export declare class AppVersionManagerService {
    static getVersion(): Promise<string>;
    static isDevMode(): Promise<boolean>;
    static checkForUpdate(): void;
    static checkForUpdateSilently(): void;
    static onUpdateAvailable(callback: (info: any) => void): (() => void);
    static onUpdateNotAvailable(callback: (info: any) => void): (() => void);
    static onUpdateError(callback: (error: any) => void): (() => void);
    static onUpdateCheckComplete(callback: () => void): (() => void);
    static removeUpdateListeners(): void;
    static downloadUpdate(): void;
    static installUpdate(): void;
    static onUpdateDownloadProgress(callback: (progress: any) => void): (() => void);
    static onUpdateDownloaded(callback: (info: any) => void): (() => void);
    static testDownloadUpdate(): void;
}
//# sourceMappingURL=AppVersionManagerService.d.ts.map