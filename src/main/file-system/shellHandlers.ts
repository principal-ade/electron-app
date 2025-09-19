import { ipcMain, shell } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import { ShellAPIEvent } from '../../shared/main-process-api-interfaces/ShellAPI';
import path from 'path';
import {
  DEFAULT_EDITOR,
  type EditorId,
  MAC_EDITOR_APP_NAMES,
} from '../../shared/types/editor.types';
import {
  DEFAULT_TERMINAL,
  type TerminalId,
  MAC_TERMINAL_APP_NAMES,
} from '../../shared/types/terminal.types';

const execAsync = promisify(exec);

export function setupShellHandlers() {
  // Handle opening URLs in browser
  ipcMain.handle(ShellAPIEvent.OPEN_EXTERNAL, async (_, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error: any) {
      console.error('Error opening URL in browser:', error);
      return { success: false, error: error.message };
    }
  });

  // Handle running shell commands
  ipcMain.handle(
    ShellAPIEvent.RUN_COMMAND,
    async (
      _,
      command: string,
      options?: { cwd?: string; timeout?: number },
    ) => {
      console.log('[ShellHandler] Running command:', {
        command,
        cwd: options?.cwd,
        timeout: options?.timeout,
      });

      try {
        // Determine the shell based on platform
        const isWindows = os.platform() === 'win32';
        const shellPath: string | undefined = isWindows
          ? process.env.ComSpec || 'C\\\Windows\\\System32\\\cmd.exe'
          : '/bin/bash';

        const { stdout, stderr } = await execAsync(command, {
          cwd: options?.cwd,
          encoding: 'utf8',
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
          shell: shellPath,
          timeout: options?.timeout,
        });

        console.log('[ShellHandler] Command completed successfully');

        return {
          success: true,
          output: stdout,
          error: stderr,
        };
      } catch (error: any) {
        console.error('[ShellHandler] Command failed:', {
          message: error.message,
          code: error.code,
          stdout: error.stdout?.substring(0, 200),
          stderr: error.stderr?.substring(0, 200),
        });

        // Even if the command returns a non-zero exit code, we may still have output
        // Extract exit code from the error
        let exitCode = error.code;
        if (exitCode === undefined && error.message) {
          // Try to extract exit code from error message
          const match = error.message.match(/exit code (\d+)/);
          if (match) {
            exitCode = parseInt(match[1], 10);
          }
        }

        return {
          success: false,
          error: error.message,
          output: error.stdout || '',
          stderr: error.stderr || '',
          code: exitCode,
        };
      }
    },
  );

  // Handle running grep commands
  ipcMain.handle(
    ShellAPIEvent.RUN_GREP,
    async (
      _,
      params: {
        pattern: string;
        path?: string;
        glob?: string;
        output_mode?: string;
        [key: string]: any;
      },
    ) => {
      console.log('[ShellHandler] Running grep:', params);

      try {
        // Build the grep command using ripgrep
        let command = 'rg';

        // Add pattern
        command += ` "${params.pattern.replace(/"/g, '\\"')}"`;

        // Add glob if specified
        if (params.glob) {
          command += ` --glob "${params.glob}"`;
        }

        // Add output mode flags
        if (params.output_mode === 'count') {
          command += ' --count';
        } else if (params.output_mode === 'content') {
          command += ' -n'; // Include line numbers
          if (params['-A']) command += ` -A ${params['-A']}`;
          if (params['-B']) command += ` -B ${params['-B']}`;
          if (params['-C']) command += ` -C ${params['-C']}`;
        } else {
          // Default to files_with_matches
          command += ' --files-with-matches';
        }

        // Add other flags
        if (params['-i']) command += ' -i';

        // Add path at the end
        if (params.path) {
          command += ` "${params.path}"`;
        }

        const { stdout, stderr } = await execAsync(command, {
          cwd: params.path || process.cwd(),
          encoding: 'utf8',
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        });

        // Parse results based on output mode
        let matches = [];
        if (
          params.output_mode === 'files_with_matches' ||
          !params.output_mode
        ) {
          matches = stdout
            .trim()
            .split('\n')
            .filter((line) => line);
        } else {
          matches = stdout
            .trim()
            .split('\n')
            .filter((line) => line);
        }

        return {
          success: true,
          matches,
          stdout,
          stderr,
        };
      } catch (error: any) {
        console.error('[ShellHandler] Grep failed:', error);
        return {
          success: false,
          error: error.message,
          stdout: error.stdout || '',
          stderr: error.stderr || '',
        };
      }
    },
  );

  // Simplified bash command runner
  ipcMain.handle(
    ShellAPIEvent.RUN_BASH_COMMAND,
    async (
      event,
      params: {
        command: string;
        cwd?: string;
      },
    ) => {
      // Call the existing run command handler
      try {
        const result = await execAsync(params.command, {
          cwd: params.cwd || process.cwd(),
          encoding: 'utf8',
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
          shell:
            os.platform() === 'win32'
              ? process.env.ComSpec || 'C\\\Windows\\\System32\\\cmd.exe'
              : '/bin/bash',
        });

        return {
          success: true,
          stdout: result.stdout,
          stderr: result.stderr,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          stdout: error.stdout || '',
          stderr: error.stderr || '',
        };
      }
    },
  );

  // Open a local directory or files in the specified editor
  ipcMain.handle(
    ShellAPIEvent.OPEN_IN_EDITOR,
    async (_, params: { editor: EditorId; dir?: string; files?: string[] }) => {
      try {
        const editor: EditorId = params?.editor ?? DEFAULT_EDITOR;

        // Support both single directory/file and multiple files
        const targets: string[] = [];
        if (params.files && params.files.length > 0) {
          // Multiple files mode
          targets.push(...params.files.map((f) => path.resolve(f)));
        } else if (params.dir) {
          // Single directory/file mode
          targets.push(path.resolve(params.dir));
        } else {
          return { success: false, error: 'No files or directory specified' };
        }

        const platform = os.platform();

        if (platform === 'darwin') {
          const appName =
            MAC_EDITOR_APP_NAMES[editor] ??
            MAC_EDITOR_APP_NAMES[DEFAULT_EDITOR];
          // macOS open command supports multiple files
          const quotedTargets = targets.map((t) => `"${t}"`).join(' ');
          const command = `open -a "${appName}" ${quotedTargets}`;
          await execAsync(command);
          return { success: true };
        }

        if (platform === 'win32') {
          // Windows commands typically support multiple files
          const quotedTargets = targets.map((t) => `"${t}"`).join(' ');
          const editorCommandMap: Record<EditorId, string> = {
            vscode: `code ${quotedTargets}`,
            cursor: `cursor ${quotedTargets}`,
            webstorm: `webstorm64.exe ${quotedTargets}`,
            sublime: `subl ${quotedTargets}`,
            intellij: `idea64.exe ${quotedTargets}`,
          };
          const command =
            editorCommandMap[editor] ?? editorCommandMap[DEFAULT_EDITOR];
          await execAsync(command);
          return { success: true };
        }

        // Linux commands typically support multiple files
        const quotedTargets = targets.map((t) => `"${t}"`).join(' ');
        const editorCommandMap: Record<EditorId, string> = {
          vscode: `code ${quotedTargets}`,
          cursor: `cursor ${quotedTargets}`,
          webstorm: `webstorm ${quotedTargets}`,
          sublime: `subl ${quotedTargets}`,
          intellij: `idea ${quotedTargets}`,
        };
        const command =
          editorCommandMap[editor] ?? editorCommandMap[DEFAULT_EDITOR];
        await execAsync(command);
        return { success: true };
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Failed to open editor';
        console.error('Error opening editor:', error);
        return { success: false, error: message };
      }
    },
  );

  // Move file to trash
  ipcMain.handle(ShellAPIEvent.MOVE_TO_TRASH, async (_, filePath: string) => {
    try {
      await shell.trashItem(filePath);
      return { success: true };
    } catch (error: any) {
      console.error('Error moving file to trash:', error);
      return { success: false, error: error.message };
    }
  });

  // Open a terminal in the specified directory
  ipcMain.handle(
    ShellAPIEvent.OPEN_IN_TERMINAL,
    async (
      _,
      params: { terminal: TerminalId; dir: string; command?: string },
    ) => {
      try {
        const terminal: TerminalId = params?.terminal ?? DEFAULT_TERMINAL;
        const dir = path.resolve(params.dir);
        const platform = os.platform();

        if (platform === 'darwin') {
          const appName =
            MAC_TERMINAL_APP_NAMES[terminal] ??
            MAC_TERMINAL_APP_NAMES[DEFAULT_TERMINAL];

          // Different terminals require different approaches on macOS
          if (terminal === 'terminal') {
            // macOS Terminal.app
            if (params.command) {
              // Open Terminal and run command
              const script = `tell application "Terminal"
                activate
                do script "cd '${dir}' && ${params.command}"
              end tell`;
              await execAsync(`osascript -e "${script.replace(/"/g, '\\"')}"`);
            } else {
              // Just open Terminal in directory
              const script = `tell application "Terminal"
                activate
                do script "cd '${dir}'"
              end tell`;
              await execAsync(`osascript -e "${script.replace(/"/g, '\\"')}"`);
            }
          } else if (terminal === 'iterm2') {
            // iTerm2
            if (params.command) {
              const script = `tell application "iTerm"
                activate
                create window with default profile
                tell current session of current window
                  write text "cd '${dir}' && ${params.command}"
                end tell
              end tell`;
              await execAsync(`osascript -e "${script.replace(/"/g, '\\"')}"`);
            } else {
              const script = `tell application "iTerm"
                activate
                create window with default profile
                tell current session of current window
                  write text "cd '${dir}'"
                end tell
              end tell`;
              await execAsync(`osascript -e "${script.replace(/"/g, '\\"')}"`);
            }
          } else if (terminal === 'warp') {
            // Warp terminal
            if (params.command) {
              await execAsync(`open -a Warp "${dir}"`);
              // Note: Warp doesn't support running commands via AppleScript yet
            } else {
              await execAsync(`open -a Warp "${dir}"`);
            }
          } else if (terminal === 'ghostty') {
            // Ghostty terminal
            if (params.command) {
              await execAsync(
                `open -a Ghostty "${dir}" --args -e "${params.command}"`,
              );
            } else {
              await execAsync(`open -a Ghostty "${dir}"`);
            }
          } else {
            // Generic approach for other terminals
            await execAsync(`open -a "${appName}" "${dir}"`);
          }

          return { success: true };
        }

        if (platform === 'win32') {
          // Windows Terminal or Command Prompt
          if (terminal === 'terminal') {
            // Windows Terminal
            const command = params.command
              ? `wt -d "${dir}" cmd /k "${params.command}"`
              : `wt -d "${dir}"`;
            await execAsync(command);
          } else {
            // Fallback to cmd
            const command = params.command
              ? `start cmd /k "cd /d ${dir} && ${params.command}"`
              : `start cmd /k "cd /d ${dir}"`;
            await execAsync(command);
          }
          return { success: true };
        }

        // Linux
        const terminalCommandMap: Record<TerminalId, string> = {
          terminal: 'gnome-terminal',
          iterm2: 'gnome-terminal', // iTerm2 doesn't exist on Linux
          warp: 'warp-terminal',
          kitty: 'kitty',
          alacritty: 'alacritty',
          wezterm: 'wezterm',
          ghostty: 'ghostty',
        };

        const terminalCmd = terminalCommandMap[terminal] ?? 'gnome-terminal';

        if (params.command) {
          // Run terminal with command
          await execAsync(
            `${terminalCmd} --working-directory="${dir}" -- bash -c "${params.command}; bash"`,
          );
        } else {
          // Just open terminal in directory
          await execAsync(`${terminalCmd} --working-directory="${dir}"`);
        }

        return { success: true };
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Failed to open terminal';
        console.error('Error opening terminal:', error);
        return { success: false, error: message };
      }
    },
  );
}
