
// Import types from electron-updater
interface UpdateInfo {
  version: string;
  files?: Array<{ url: string; size: number }>;
  releaseDate?: string;
  releaseName?: string;
  releaseNotes?: string | Array<{ version: string; note: string }>;
}

interface ProgressInfo {
  total: number;
  delta: number;
  transferred: number;
  percent: number;
  bytesPerSecond: number;
}

interface UpdateDownloadedEvent {
  downloadedFile: string;
  version?: string;
  releaseNotes?: string | Array<{ version: string; note: string }>;
}

export interface AppVersionManagerAPI {
  getVersion: () => Promise<string>;
  isDevMode: () => Promise<boolean>;
  checkForUpdate: () => void;
  checkForUpdateManually: () => void;
  checkForUpdateSilently: () => void;
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => (() => void);
  onUpdateNotAvailable: (callback: (info: UpdateInfo) => void) => (() => void);
  onUpdateError: (callback: (error: Error) => void) => (() => void);
  onUpdateCheckComplete: (callback: () => void) => (() => void);
  removeUpdateListeners: () => void;
  downloadUpdate: () => void;
  installUpdate: () => void;
  onUpdateDownloadProgress: (callback: (progress: ProgressInfo) => void) => (() => void);
  onUpdateDownloaded: (callback: (info: UpdateDownloadedEvent) => void) => (() => void);
  testDownloadUpdate: () => void;
}