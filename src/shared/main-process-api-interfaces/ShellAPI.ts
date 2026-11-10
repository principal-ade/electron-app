export enum ShellAPIEvent {
  OPEN_EXTERNAL = 'shell:open-external',
  RUN_COMMAND = 'shell:run-command',
  RUN_GREP = 'shell:run-grep',
  RUN_BASH_COMMAND = 'shell:run-bash-command',
  OPEN_IN_EDITOR = 'shell:open-in-editor',
  OPEN_IN_TERMINAL = 'shell:open-in-terminal',
  MOVE_TO_TRASH = 'shell:move-to-trash',
  SHOW_ITEM_IN_FOLDER = 'shell:show-item-in-folder',
  OPEN_PATH = 'shell:openPath',
  OPEN_TERMINAL = 'shell:openTerminal',
  CHECK_COMMAND = 'terminal:checkCommand',
  CLEAR_PATH_CACHE = 'terminal:clearPathCache',
  OPEN_KEYCHAIN_ACCESS = 'shell:open-keychain-access',
  OPEN_PRIVACY_SETTINGS = 'shell:open-privacy-settings',
  LAUNCH_STUDIO = 'shell:launch-studio',
  GET_STUDIO_STATUS = 'shell:get-studio-status',
  INSTALL_STUDIO = 'shell:install-studio',
}

/** How to launch Subsystems Studio. */
export type StudioLaunchMode = 'dev' | 'installed';

export interface StudioLaunchOptions {
  /** `dev` runs the source checkout, `installed` runs the published build. */
  mode: StudioLaunchMode;
  /**
   * Override the root of the Studio source checkout (dev mode only). When
   * omitted the main process uses its default subsystem-modeling checkout.
   */
  devPath?: string;
}

export interface StudioLaunchResult {
  success: boolean;
  mode?: StudioLaunchMode;
  /** What was launched (command + path), for diagnostics. */
  target?: string;
  error?: string;
}

export interface StudioStatusOptions {
  /** Registered Studio source clone, used to read the dev build's version. */
  devPath?: string;
}

export interface StudioInstalledInfo {
  /** True when an installed build can be launched. */
  available: boolean;
  /** Version of Studio itself (the nested package when the CLI is the entry). */
  version?: string;
  /** Package a global install/update should target. */
  packageName?: string;
  /** Version of `packageName` as installed, used for registry comparison. */
  packageVersion?: string;
  /** Global npm root containing `packageName`, when known. */
  npmRoot?: string;
}

export interface StudioDevInfo {
  available: boolean;
  version?: string;
  /** Root of the source checkout the dev build would run from. */
  path?: string;
}

export interface StudioStatusResult {
  running: boolean;
  mode?: StudioLaunchMode;
  port?: number;
  /** Published build discovered on disk, whether or not it is running. */
  installed: StudioInstalledInfo;
  /** Source checkout discovered on disk, whether or not it is running. */
  dev: StudioDevInfo;
}

export interface StudioInstallOptions {
  /** Dev builds are managed in source; only `installed` is supported. */
  mode: StudioLaunchMode;
  /** Quit and relaunch a running installed Studio after updating. */
  restart?: boolean;
}

export interface StudioInstallResult {
  success: boolean;
  mode?: StudioLaunchMode;
  /** Studio version read back after the install completes. */
  version?: string;
  packageName?: string;
  /** True when a running Studio was relaunched and answered its health check. */
  restarted?: boolean;
  /** The user dismissed the update-and-restart confirmation. */
  cancelled?: boolean;
  /** Update succeeded but Studio could not be restarted. */
  restartError?: string;
  output?: string;
  error?: string;
}

export interface ShellAPI {
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
  runCommand: (
    command: string,
    options?: { cwd?: string; timeout?: number },
  ) => Promise<{
    success: boolean;
    output?: string;
    error?: string;
    stderr?: string;
    code?: number;
  }>;
  /**
   * Open a local directory or files in the specified editor.
   * Can open either a single directory/file or multiple files.
   */
  openInEditor: (params: {
    editor: import('../types/editor.types').EditorId;
    dir?: string; // For single directory/file
    files?: string[]; // For multiple files
  }) => Promise<{ success: boolean; error?: string }>;

  /**
   * Open a terminal in the specified directory.
   * Can optionally run a command after opening.
   */
  openInTerminal: (params: {
    terminal: import('../types/terminal.types').TerminalId;
    dir: string;
    command?: string; // Optional command to run after opening
  }) => Promise<{ success: boolean; error?: string }>;

  /**
   * Move a file or directory to the system trash/recycle bin.
   */
  moveToTrash: (
    filePath: string,
  ) => Promise<{ success: boolean; error?: string }>;

  /**
   * Show a file or directory in the system file manager (Finder/Explorer).
   * Opens the parent folder and selects the item.
   */
  showItemInFolder: (
    filePath: string,
  ) => Promise<{ success: boolean; error?: string }>;

  /**
   * Open a file or directory in the system's default application.
   * For directories, opens them in Finder/Explorer showing their contents.
   * Similar to openExternal but specifically for local paths.
   */
  openPath: (path: string) => Promise<{ success: boolean; error?: string }>;

  /**
   * Open a terminal window at the specified path.
   * Uses the system's default terminal application.
   */
  openTerminal: (path: string) => Promise<void>;

  /**
   * Check if a command is available in the system PATH.
   * Returns information about the command's location and availability.
   */
  checkCommand: (command: string) => Promise<{
    exists: boolean;
    path?: string;
    error?: string;
  }>;

  /**
   * Clear the cached PATH information.
   * Useful when the system PATH has been modified.
   */
  clearPathCache: () => Promise<void>;

  /**
   * Open the macOS Keychain Access application.
   * No-op on non-macOS platforms.
   */
  openKeychainAccess: () => Promise<{ success: boolean; error?: string }>;

  /**
   * Open the macOS System Settings → Privacy & Security pane.
   * No-op on non-macOS platforms.
   */
  openPrivacySettings: () => Promise<{ success: boolean; error?: string }>;

  /**
   * Launch Subsystems Studio, either from the local source checkout (dev) or
   * the published build (installed). Non-blocking: the launched app runs
   * detached from the desktop app.
   */
  launchStudio: (options: StudioLaunchOptions) => Promise<StudioLaunchResult>;
  /** Probe Studio's read-only local health endpoint without focusing its window. */
  getStudioStatus: (
    options?: StudioStatusOptions,
  ) => Promise<StudioStatusResult>;
  /**
   * Install or update the published Studio build through its global npm
   * package. Dev builds return an error; update their source clone instead.
   */
  installStudio: (
    options: StudioInstallOptions,
  ) => Promise<StudioInstallResult>;
}
