import { ipcRenderer } from 'electron';
import { ShellAPIEvent } from '../../shared/main-process-api-interfaces/ShellAPI';
export const shellAPI = {
    // Open URL in external browser
    openExternal: async (url) => ipcRenderer.invoke(ShellAPIEvent.OPEN_EXTERNAL, url),
    // Run shell command
    runCommand: async (command, options) => ipcRenderer.invoke(ShellAPIEvent.RUN_COMMAND, command, options),
    // Run grep command
    runGrep: async (params) => ipcRenderer.invoke(ShellAPIEvent.RUN_GREP, params),
    // Run bash command (simplified)
    runBashCommand: async (params) => ipcRenderer.invoke(ShellAPIEvent.RUN_BASH_COMMAND, params),
    // Open a local directory or files in the specified editor
    openInEditor: async (params) => ipcRenderer.invoke(ShellAPIEvent.OPEN_IN_EDITOR, params),
    // Open a terminal in the specified directory
    openInTerminal: async (params) => ipcRenderer.invoke(ShellAPIEvent.OPEN_IN_TERMINAL, params),
    // Move file to trash
    moveToTrash: async (filePath) => ipcRenderer.invoke(ShellAPIEvent.MOVE_TO_TRASH, filePath),
    // Open a file or directory in the system's default application
    openPath: async (path) => ipcRenderer.invoke(ShellAPIEvent.OPEN_PATH, path),
    // Open a terminal window at the specified path
    openTerminal: async (path) => ipcRenderer.invoke(ShellAPIEvent.OPEN_TERMINAL, path),
    // Check if a command is available in the system PATH
    checkCommand: async (command) => ipcRenderer.invoke(ShellAPIEvent.CHECK_COMMAND, command),
    // Clear the cached PATH information
    clearPathCache: async () => ipcRenderer.invoke(ShellAPIEvent.CLEAR_PATH_CACHE),
};
