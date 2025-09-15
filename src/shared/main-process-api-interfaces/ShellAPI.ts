export enum ShellAPIEvent {
  OPEN_EXTERNAL = 'shell:open-external',
  RUN_COMMAND = 'shell:run-command',
  RUN_GREP = 'shell:run-grep',
  RUN_BASH_COMMAND = 'shell:run-bash-command',
  OPEN_IN_EDITOR = 'shell:open-in-editor',
  OPEN_IN_TERMINAL = 'shell:open-in-terminal',
  MOVE_TO_TRASH = 'shell:move-to-trash',
  OPEN_PATH = 'shell:openPath',
  OPEN_TERMINAL = 'shell:openTerminal',
  CHECK_COMMAND = 'terminal:checkCommand',
  CLEAR_PATH_CACHE = 'terminal:clearPathCache',
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
  openInEditor: (
    params: { 
      editor: import("../types/editor.types").EditorId; 
      dir?: string;  // For single directory/file
      files?: string[];  // For multiple files
    },
  ) => Promise<{ success: boolean; error?: string }>;
  
  /**
   * Open a terminal in the specified directory.
   * Can optionally run a command after opening.
   */
  openInTerminal: (
    params: { 
      terminal: import("../types/terminal.types").TerminalId; 
      dir: string;
      command?: string;  // Optional command to run after opening
    },
  ) => Promise<{ success: boolean; error?: string }>;
  
  /**
   * Move a file or directory to the system trash/recycle bin.
   */
  moveToTrash: (
    filePath: string
  ) => Promise<{ success: boolean; error?: string }>;
  
  /**
   * Open a file or directory in the system's default application.
   * Similar to openExternal but specifically for local paths.
   */
  openPath: (
    path: string
  ) => Promise<void>;
  
  /**
   * Open a terminal window at the specified path.
   * Uses the system's default terminal application.
   */
  openTerminal: (
    path: string
  ) => Promise<void>;
  
  /**
   * Check if a command is available in the system PATH.
   * Returns information about the command's location and availability.
   */
  checkCommand: (
    command: string
  ) => Promise<{
    exists: boolean;
    path?: string;
    error?: string;
  }>;
  
  /**
   * Clear the cached PATH information.
   * Useful when the system PATH has been modified.
   */
  clearPathCache: () => Promise<void>;
}
