/**
 * Shell Service - Wrapper for shell operations
 * Provides a centralized service for opening external URLs, files, and terminals
 */

import type { EditorId } from '../../shared/types/editor.types';
import type { TerminalId } from '../../shared/types/terminal.types';
import type {
  StudioLaunchMode,
  StudioLaunchOptions,
  StudioLaunchResult,
} from '../../shared/main-process-api-interfaces/ShellAPI';

export type { StudioLaunchMode, StudioLaunchOptions, StudioLaunchResult };

export class ShellService {
  /**
   * Open a URL in the default browser
   */
  static async openExternal(
    url: string,
  ): Promise<{ success: boolean; error?: string }> {
    console.info(`[ShellService] Opening external URL: ${url}`);

    try {
      const result = await window.mainProcess.shell.openExternal(url);

      if (!result.success) {
        console.warn(
          `[ShellService] Failed to open URL via shell: ${result.error}`,
        );

        // Fallback to window.open for web compatibility
        if (typeof window !== 'undefined') {
          window.open(url, '_blank');
          return { success: true };
        }
      }

      return result;
    } catch (error) {
      console.error('[ShellService] Error opening external URL:', error);

      // Try fallback
      if (typeof window !== 'undefined') {
        try {
          window.open(url, '_blank');
          return { success: true };
        } catch {
          return {
            success: false,
            error: `Failed to open URL: ${error}`,
          };
        }
      }

      return {
        success: false,
        error: `Failed to open URL: ${error}`,
      };
    }
  }

  /**
   * Run a shell command
   */
  static async runCommand(
    command: string,
    options?: { cwd?: string; timeout?: number },
  ): Promise<{
    success: boolean;
    output?: string;
    error?: string;
    stderr?: string;
    code?: number;
  }> {
    console.info(`[ShellService] Running command: ${command}`);
    return window.mainProcess.shell.runCommand(command, options);
  }

  /**
   * Open a file or directory in an external editor
   */
  static async openInEditor(params: {
    editor: EditorId;
    dir?: string;
    files?: string[];
  }): Promise<{ success: boolean; error?: string }> {
    console.info(`[ShellService] Opening in editor: ${params.editor}`);
    return window.mainProcess.shell.openInEditor(params);
  }

  /**
   * Open a terminal with optional command
   */
  static async openInTerminal(params: {
    terminal: TerminalId;
    dir: string;
    command?: string;
  }): Promise<{ success: boolean; error?: string }> {
    console.info(`[ShellService] Opening terminal: ${params.terminal}`);
    return window.mainProcess.shell.openInTerminal(params);
  }

  /**
   * Open a file or directory in the system's default application.
   * For directories, opens them in Finder/Explorer showing their contents.
   * Similar to openExternal but specifically for local paths.
   */
  static async openPath(
    path: string,
  ): Promise<{ success: boolean; error?: string }> {
    console.info(`[ShellService] Opening path: ${path}`);
    return window.mainProcess.shell.openPath(path);
  }

  /**
   * Open a terminal window at the specified path.
   * Uses the system's default terminal application.
   */
  static async openTerminal(path: string): Promise<void> {
    console.info(`[ShellService] Opening terminal at: ${path}`);
    return window.mainProcess.shell.openTerminal(path);
  }

  /**
   * Check if a command is available in the system PATH.
   * Returns information about the command's location and availability.
   */
  static async checkCommand(command: string): Promise<{
    exists: boolean;
    path?: string;
    error?: string;
  }> {
    console.info(`[ShellService] Checking command: ${command}`);
    return window.mainProcess.shell.checkCommand(command);
  }

  /**
   * Clear the cached PATH information.
   * Useful when the system PATH has been modified.
   */
  static async clearPathCache(): Promise<void> {
    console.info(`[ShellService] Clearing PATH cache`);
    return window.mainProcess.shell.clearPathCache();
  }

  /**
   * Open the macOS Keychain Access application.
   */
  static async openKeychainAccess(): Promise<{
    success: boolean;
    error?: string;
  }> {
    console.info('[ShellService] Opening Keychain Access');
    return window.mainProcess.shell.openKeychainAccess();
  }

  /**
   * Open the macOS System Settings → Privacy & Security pane.
   */
  static async openPrivacySettings(): Promise<{
    success: boolean;
    error?: string;
  }> {
    console.info('[ShellService] Opening Privacy & Security settings');
    return window.mainProcess.shell.openPrivacySettings();
  }

  /**
   * Open a path in the default editor (simplified version)
   * This is a convenience method that uses VS Code as the default editor
   */
  static async openInDefaultEditor(
    path: string,
  ): Promise<{ success: boolean; error?: string }> {
    console.info(`[ShellService] Opening in default editor: ${path}`);
    // Try VS Code first, then Cursor as fallback
    const result = await this.openInEditor({
      editor: 'vscode' as EditorId,
      dir: path,
    });
    if (!result.success) {
      // Try Cursor as fallback
      return this.openInEditor({ editor: 'cursor' as EditorId, dir: path });
    }
    return result;
  }

  /**
   * Show a file or directory in the system file manager (Finder/Explorer).
   * Opens the parent folder and selects the item.
   */
  static async showItemInFolder(
    filePath: string,
  ): Promise<{ success: boolean; error?: string }> {
    console.info(`[ShellService] Showing item in folder: ${filePath}`);
    return window.mainProcess.shell.showItemInFolder(filePath);
  }

  /**
   * Move a file or directory to the system trash/recycle bin.
   */
  static async moveToTrash(
    filePath: string,
  ): Promise<{ success: boolean; error?: string }> {
    console.info(`[ShellService] Moving to trash: ${filePath}`);
    return window.mainProcess.shell.moveToTrash(filePath);
  }

  /**
   * Launch Subsystems Studio from either the local source checkout (dev) or
   * the published build (installed). Non-blocking.
   */
  static async launchStudio(
    options: StudioLaunchOptions,
  ): Promise<StudioLaunchResult> {
    console.info(`[ShellService] Launching Studio (${options.mode})`);
    return window.mainProcess.shell.launchStudio(options);
  }
}
