import { ipcMain, shell } from 'electron';
import { exec, spawn, type ExecException } from 'child_process';
import { existsSync, realpathSync } from 'fs';
import { promisify } from 'util';
import * as os from 'os';
import {
  ShellAPIEvent,
  type StudioLaunchOptions,
  type StudioLaunchResult,
  type StudioLaunchMode,
} from '../../shared/main-process-api-interfaces/ShellAPI';
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

// ---------------------------------------------------------------------------
// Subsystems Studio launch
// ---------------------------------------------------------------------------

/**
 * Default location of the Studio source checkout. Overridable via
 * PRINCIPAL_STUDIO_REPO so the button isn't tied to one machine's layout.
 */
const STUDIO_REPO_DIR =
  process.env.PRINCIPAL_STUDIO_REPO ??
  path.join(os.homedir(), 'Developer/principal-ai/subsystem-modeling');

/** The dev-served package inside the monorepo (`bun start` runs Electrobun). */
const STUDIO_DEV_DIR = path.join(STUDIO_REPO_DIR, 'packages/subsystems-studio');

/**
 * Build an environment whose PATH includes the locations where `bun`,
 * Homebrew, and globally-installed npm CLIs live. GUI apps launched by Finder
 * don't inherit the user's shell PATH, so we add the common spots explicitly.
 */
function buildStudioEnv(): NodeJS.ProcessEnv {
  const extraPaths = [
    path.join(os.homedir(), '.bun', 'bin'),
    path.join(os.homedir(), '.local', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
  ];
  const existing = (process.env.PATH ?? '').split(':').filter(Boolean);
  for (const dir of extraPaths) {
    if (!existing.includes(dir)) existing.push(dir);
  }
  const env: NodeJS.ProcessEnv = { ...process.env, PATH: existing.join(':') };

  // Strip the desktop app's Node/tooling vars. The main process runs with
  // NODE_OPTIONS="-r ts-node/register ..." (and TS_NODE_*), which the Studio
  // dev server's own node subprocess can't resolve — it dies with
  // "Cannot find module 'ts-node/register'" before it can launch.
  delete env.NODE_OPTIONS;
  delete env.TS_NODE_PROJECT;
  delete env.TS_NODE_TRANSPILE_ONLY;
  delete env.ELECTRON_RUN_AS_NODE;

  return env;
}

/** Resolve an executable by scanning a PATH-style env value. */
function findInPath(command: string, env: NodeJS.ProcessEnv): string | null {
  for (const dir of (env.PATH ?? '').split(':').filter(Boolean)) {
    const candidate = path.join(dir, command);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Locate the published Studio bundle. Prefers an explicit override, then the
 * common global npm roots (where the principal-ai CLI installs its optional
 * dependency).
 */
function resolveInstalledStudioBin(): string | null {
  const override = process.env.PRINCIPAL_STUDIO_BIN;
  if (override && existsSync(override)) return override;

  const roots = [
    process.env.PRINCIPAL_STUDIO_NPM_ROOT,
    '/opt/homebrew/lib/node_modules',
    '/usr/local/lib/node_modules',
    path.join(os.homedir(), '.npm-global', 'lib', 'node_modules'),
  ].filter((root): root is string => Boolean(root));

  const relCandidates = [
    '@principal-ai/subsystems-studio/bin/subsystems-studio.cjs',
    '@principal-ai/principal-studio-cli/node_modules/@principal-ai/subsystems-studio/bin/subsystems-studio.cjs',
  ];
  for (const root of roots) {
    for (const rel of relCandidates) {
      const candidate = path.join(root, rel);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

/**
 * Spawn a detached process and watch it briefly so fast failures surface to the
 * UI. Resolves with an error string when the child errors or exits non-zero
 * within the grace window; otherwise resolves `undefined` and leaves the child
 * running detached.
 */
function spawnDetachedChecked(
  command: string,
  args: string[],
  options: { cwd?: string; env: NodeJS.ProcessEnv; graceMs?: number },
): Promise<string | undefined> {
  const graceMs = options.graceMs ?? 1500;
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      detached: true,
      stdio: 'ignore',
    });

    const finish = (error?: string) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      child.removeAllListeners('exit');
      child.removeAllListeners('error');
      if (!error) child.unref();
      resolve(error);
    };

    timer = setTimeout(() => finish(), graceMs);

    child.on('error', (error) => {
      console.error('[ShellHandler] Studio launch failed:', error);
      finish(error.message);
    });
    child.on('exit', (code) => {
      if (code && code !== 0) {
        finish(`Process exited with code ${code}`);
      } else {
        // Exited cleanly (e.g. a focus/forwarding no-op) — treat as success.
        finish();
      }
    });
  });
}

async function launchStudio(
  options: StudioLaunchOptions,
): Promise<StudioLaunchResult> {
  const mode: StudioLaunchMode = options?.mode === 'dev' ? 'dev' : 'installed';
  const env = buildStudioEnv();

  if (mode === 'dev') {
    const devDir = options.devPath ?? STUDIO_DEV_DIR;
    if (!existsSync(devDir)) {
      return {
        success: false,
        mode,
        error: `Studio source checkout not found at ${devDir}. Pass devPath or set PRINCIPAL_STUDIO_REPO.`,
      };
    }
    const bun = findInPath('bun', env);
    if (!bun) {
      return {
        success: false,
        mode,
        error: 'Could not find "bun" on PATH. Install it from https://bun.sh',
      };
    }
    const error = await spawnDetachedChecked(bun, ['start'], {
      cwd: devDir,
      env,
    });
    return error
      ? { success: false, mode, error, target: `${bun} start (${devDir})` }
      : { success: true, mode, target: `${bun} start (${devDir})` };
  }

  // Installed: prefer the principal-ai CLI, invoked through its real path.
  // When reached via a global bin symlink the CLI can't resolve its own
  // optionalDependency, so resolving the symlink first restores both launching
  // and focus-if-already-running.
  const cli = findInPath('principal-ai', env);
  if (cli) {
    let cliReal = cli;
    try {
      cliReal = realpathSync(cli);
    } catch {
      // Keep the path as found.
    }
    const error = await spawnDetachedChecked(cliReal, ['open-studio'], {
      env,
    });
    if (!error) {
      return { success: true, mode, target: `${cliReal} open-studio` };
    }
    console.warn(
      '[ShellHandler] principal-ai open-studio failed; falling back to bundle:',
      error,
    );
  }

  // Fallback: launch the bundle shim directly. This opens Studio when it isn't
  // already running; if it is, the app will report the port conflict.
  const studioBin = resolveInstalledStudioBin();
  if (studioBin) {
    const error = await spawnDetachedChecked(studioBin, [], { env });
    return error
      ? { success: false, mode, error, target: studioBin }
      : { success: true, mode, target: studioBin };
  }

  return {
    success: false,
    mode,
    error:
      'Could not find an installed Studio. Install the principal-ai CLI or @principal-ai/subsystems-studio, or use the dev option.',
  };
}

export function setupShellHandlers() {
  // Handle opening URLs in browser
  ipcMain.handle(ShellAPIEvent.OPEN_EXTERNAL, async (_, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error: unknown) {
      console.error('Error opening URL in browser:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
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
          ? process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe'
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
      } catch (error: unknown) {
        // Handle ExecException from child_process
        if (error && typeof error === 'object' && 'code' in error) {
          const execError = error as ExecException & { stdout?: string; stderr?: string };
          console.error('[ShellHandler] Command failed:', {
            message: execError.message,
            code: execError.code,
            stdout: execError.stdout?.substring(0, 200),
            stderr: execError.stderr?.substring(0, 200),
          });

          // Even if the command returns a non-zero exit code, we may still have output
          // Extract exit code from the error
          let exitCode = execError.code;
          if (exitCode === undefined && execError.message) {
            // Try to extract exit code from error message
            const match = execError.message.match(/exit code (\d+)/);
            if (match) {
              exitCode = parseInt(match[1], 10);
            }
          }

          return {
            success: false,
            error: execError.message,
            output: execError.stdout || '',
            stderr: execError.stderr || '',
            code: exitCode,
          };
        }

        // Handle other errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          error: errorMessage,
          output: '',
          stderr: '',
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
        '-A'?: number;  // After context
        '-B'?: number;  // Before context
        '-C'?: number;  // Context (both before and after)
        '-i'?: boolean; // Case insensitive
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
      } catch (error: unknown) {
        console.error('[ShellHandler] Grep failed:', error);
        // Handle ExecException from child_process
        if (error && typeof error === 'object' && 'stdout' in error) {
          const execError = error as ExecException & { stdout?: string; stderr?: string };
          return {
            success: false,
            error: execError.message || 'Grep command failed',
            stdout: execError.stdout || '',
            stderr: execError.stderr || '',
          };
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          error: errorMessage,
          stdout: '',
          stderr: '',
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
              ? process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe'
              : '/bin/bash',
        });

        return {
          success: true,
          stdout: result.stdout,
          stderr: result.stderr,
        };
      } catch (error: unknown) {
        // Handle ExecException from child_process
        if (error && typeof error === 'object' && 'stdout' in error) {
          const execError = error as ExecException & { stdout?: string; stderr?: string };
          return {
            success: false,
            error: execError.message || 'Command failed',
            stdout: execError.stdout || '',
            stderr: execError.stderr || '',
          };
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          error: errorMessage,
          stdout: '',
          stderr: '',
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
    } catch (error: unknown) {
      console.error('Error moving file to trash:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  });

  // Show item in file manager (Finder/Explorer)
  ipcMain.handle(
    ShellAPIEvent.SHOW_ITEM_IN_FOLDER,
    async (_, filePath: string) => {
      try {
        shell.showItemInFolder(path.resolve(filePath));
        return { success: true };
      } catch (error: unknown) {
        console.error('Error showing item in folder:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    },
  );

  // Open a path in the system's default application
  ipcMain.handle(ShellAPIEvent.OPEN_PATH, async (_, filePath: string) => {
    try {
      const resolvedPath = path.resolve(filePath);
      const errorString = await shell.openPath(resolvedPath);

      // openPath returns an empty string on success, or an error message on failure
      if (errorString) {
        console.error('Error opening path:', errorString);
        return { success: false, error: errorString };
      }

      return { success: true };
    } catch (error: unknown) {
      console.error('Error opening path:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
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

  // Open the macOS Keychain Access application
  ipcMain.handle(ShellAPIEvent.OPEN_KEYCHAIN_ACCESS, async () => {
    if (os.platform() !== 'darwin') {
      return { success: false, error: 'Only supported on macOS' };
    }
    try {
      await execAsync('open -a "Keychain Access"');
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error opening Keychain Access:', error);
      return { success: false, error: message };
    }
  });

  // Open macOS System Settings app
  ipcMain.handle(ShellAPIEvent.OPEN_PRIVACY_SETTINGS, async () => {
    if (os.platform() !== 'darwin') {
      return { success: false, error: 'Only supported on macOS' };
    }
    try {
      await execAsync('open -b com.apple.systempreferences');
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error opening System Settings:', error);
      return { success: false, error: message };
    }
  });

  // Launch Subsystems Studio (dev checkout or installed build)
  ipcMain.handle(
    ShellAPIEvent.LAUNCH_STUDIO,
    async (_, options: StudioLaunchOptions): Promise<StudioLaunchResult> => {
      try {
        return launchStudio(options ?? { mode: 'installed' });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Failed to launch Studio';
        console.error('[ShellHandler] Error launching Studio:', error);
        return { success: false, error: message };
      }
    },
  );
}
