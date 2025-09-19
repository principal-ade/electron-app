import { ipcRenderer } from 'electron';
import type { EditorId } from '../../shared/types/editor.types';
import type { TerminalId } from '../../shared/types/terminal.types';
import { ShellAPIEvent } from '../../shared/main-process-api-interfaces/ShellAPI';

export const shellAPI = {
  // Open URL in external browser
  openExternal: async (url: string) =>
    ipcRenderer.invoke(ShellAPIEvent.OPEN_EXTERNAL, url),

  // Run shell command
  runCommand: async (
    command: string,
    options?: { cwd?: string; timeout?: number },
  ) => ipcRenderer.invoke(ShellAPIEvent.RUN_COMMAND, command, options),

  // Run grep command
  runGrep: async (params: {
    pattern: string;
    path?: string;
    glob?: string;
    output_mode?: string;
    [key: string]: any;
  }) => ipcRenderer.invoke(ShellAPIEvent.RUN_GREP, params),

  // Run bash command (simplified)
  runBashCommand: async (params: { command: string; cwd?: string }) =>
    ipcRenderer.invoke(ShellAPIEvent.RUN_BASH_COMMAND, params),

  // Open a local directory or files in the specified editor
  openInEditor: async (params: {
    editor: EditorId;
    dir?: string;
    files?: string[];
  }) => ipcRenderer.invoke(ShellAPIEvent.OPEN_IN_EDITOR, params),

  // Open a terminal in the specified directory
  openInTerminal: async (params: {
    terminal: TerminalId;
    dir: string;
    command?: string;
  }) => ipcRenderer.invoke(ShellAPIEvent.OPEN_IN_TERMINAL, params),

  // Move file to trash
  moveToTrash: async (filePath: string) =>
    ipcRenderer.invoke(ShellAPIEvent.MOVE_TO_TRASH, filePath),

  // Open a file or directory in the system's default application
  openPath: async (path: string) =>
    ipcRenderer.invoke(ShellAPIEvent.OPEN_PATH, path),

  // Open a terminal window at the specified path
  openTerminal: async (path: string) =>
    ipcRenderer.invoke(ShellAPIEvent.OPEN_TERMINAL, path),

  // Check if a command is available in the system PATH
  checkCommand: async (command: string) =>
    ipcRenderer.invoke(ShellAPIEvent.CHECK_COMMAND, command),

  // Clear the cached PATH information
  clearPathCache: async () =>
    ipcRenderer.invoke(ShellAPIEvent.CLEAR_PATH_CACHE),
};
