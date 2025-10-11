/**
 * Custom executor that integrates codebase-quality-lenses with electron-cli-bridge
 * This bridges the gap between the lens package and our app's command execution infrastructure
 */

import type {
  Executor,
  ExecuteResult,
  ExecuteOptions,
  StreamOptions,
  StreamResult,
} from '@principal-ai/codebase-quality-lenses';
import { electronCLI } from '../electron-cli-bridge';
import { Readable } from 'stream';

/**
 * Executor implementation that uses the app's electron-cli-bridge
 * for running all commands through the existing infrastructure
 */
export class ElectronCLIBridgeExecutor implements Executor {
  readonly type = 'electron' as const;
  private initialized = false;

  /**
   * Ensure electron-cli-bridge is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await electronCLI.initialize();
      this.initialized = true;
    }
  }

  /**
   * Execute a command using electron-cli-bridge
   *
   * @param command - The command to execute (e.g., 'git', 'npm', 'eslint')
   * @param args - Command arguments
   * @param options - Execution options (cwd, env, timeout, etc.)
   * @returns Execution result with stdout, stderr, and exit code
   */
  async execute(
    command: string,
    args: string[] = [],
    options: ExecuteOptions = {},
  ): Promise<ExecuteResult> {
    await this.ensureInitialized();

    try {
      // Use the general execute method from electron-cli-bridge for all commands
      const result = await electronCLI.execute(command, args, {
        cwd: options.cwd,
        env: options.env,
        timeout: options.timeout,
      });

      console.log(`[ElectronCLIBridgeExecutor] Command executed:`, {
        command,
        args,
        exitCode: result.exitCode,
        stdoutLength: result.stdout?.length || 0,
        stderrLength: result.stderr?.length || 0,
      });

      return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.exitCode || 0,
        duration: 0,
        command,
        args,
      };
    } catch (error: any) {
      return {
        stdout: '',
        stderr: error.message || 'Command failed',
        exitCode: 1,
        duration: 0,
        command,
        args,
        error,
      };
    }
  }

  /**
   * Stream method required by Executor interface
   * Not currently implemented as GitLens doesn't use streaming
   */
  stream(
    command: string,
    args: string[] = [],
    options: StreamOptions = {},
  ): StreamResult {
    // Create dummy streams for now as GitLens doesn't use streaming
    const stdout = new Readable({ read() {} });
    const stderr = new Readable({ read() {} });

    const exitPromise = this.execute(command, args, options).then((result) => {
      stdout.push(result.stdout);
      stdout.push(null);
      stderr.push(result.stderr);
      stderr.push(null);
      return result;
    });

    return {
      stdout,
      stderr,
      exitPromise,
      kill: () => {
        stdout.destroy();
        stderr.destroy();
      },
    };
  }

  /**
   * Check if a command is available
   * Uses electron-cli-bridge to check command availability
   */
  async isAvailable(command: string): Promise<boolean> {
    await this.ensureInitialized();

    try {
      // For git commands, use the specific git availability check
      if (command === 'git') {
        const result = await electronCLI.git.checkAvailability();
        return result.available;
      }

      // For other commands, try a simple execution test
      // Most commands support --version or --help
      const testArgs = command === 'npm' ? ['--version'] : ['--version'];
      const result = await electronCLI.execute(command, testArgs, {
        timeout: 5000,
      });
      return result.exitCode === 0;
    } catch (error) {
      // If execution fails, command is not available
      return false;
    }
  }
}
