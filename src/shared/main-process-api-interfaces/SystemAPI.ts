export interface SystemInfo {
  totalMemory: number;
  freeMemory: number;
  totalDisk: number;
  freeDisk: number;
  platform: string;
  arch: string;
  cpus: number;
  osVersion: string;
}

export interface CommandOptions {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  code: number;
  error?: string;
}

export interface DialogOptions {
  properties?: (
    | 'openFile'
    | 'openDirectory'
    | 'multiSelections'
    | 'createDirectory'
  )[];
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: { name: string; extensions: string[] }[];
}

export interface DialogResult {
  canceled: boolean;
  filePaths: string[];
}

export interface UpdateCheckResult {
  success: boolean;
  updateAvailable: boolean;
  version?: string;
  error?: string;
}

export enum SystemEvents {
  GET_PLATFORM = 'system:get-platform',
  GET_SYSTEM_INFO = 'system:get-system-info',
  EXECUTE_COMMAND = 'system:execute-command',
  OPEN_DIALOG = 'system:open-dialog',
  CHECK_FOR_UPDATE_MANUALLY = 'system:check-for-update-manually',
  RESTART_APP = 'system:restart-app',
  UPDATE_CHECK_COMPLETE = 'system:update-check-complete',
}

export interface SystemAPI {
  // Existing methods
  getPlatform: () => Promise<string>;
  getSystemInfo: () => Promise<SystemInfo | null>;

  // New methods for migration
  executeCommand: (options: CommandOptions) => Promise<CommandResult>;
  openDialog: (options: DialogOptions) => Promise<DialogResult>;
  checkForUpdateManually: () => Promise<UpdateCheckResult>;
  restartApp: () => Promise<void>;

  // Event listeners
  onUpdateCheckComplete: (
    callback: (result: UpdateCheckResult) => void,
  ) => () => void;
}
