/**
 * Custom executor that integrates codebase-quality-lenses with electron-cli-bridge
 * This bridges the gap between the lens package and our app's Git implementation
 */

import type {
  Executor,
  ExecuteResult,
  ExecuteOptions,
  StreamOptions,
  StreamResult
} from '@principal-ai/codebase-quality-lenses';
import { electronCLI } from '../electron-cli-bridge';
import { Readable } from 'stream';

/**
 * Executor implementation that uses the app's electron-cli-bridge
 * for running Git commands through the existing infrastructure
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
   * @param command - The command to execute (e.g., 'git')
   * @param args - Command arguments
   * @param options - Execution options (cwd, env, timeout, etc.)
   * @returns Execution result with stdout, stderr, and exit code
   */
  async execute(
    command: string,
    args: string[] = [],
    options: ExecuteOptions = {}
  ): Promise<ExecuteResult> {
    await this.ensureInitialized();

    try {
      // Use the git executor from electron-cli-bridge for git commands
      if (command === 'git') {
        const result = await electronCLI.git.raw(options.cwd || process.cwd(), args);

        return {
          stdout: result.stdout || '',
          stderr: result.stderr || '',
          exitCode: result.exitCode || 0,
          duration: 0,
          command,
          args,
        };
      }

      // For non-git commands, use general execute if available
      if (electronCLI.execute) {
        const result = await electronCLI.execute(command, args, {
          cwd: options.cwd,
          env: options.env,
          timeout: options.timeout,
        });

        return {
          stdout: result.stdout || '',
          stderr: result.stderr || '',
          exitCode: result.exitCode || 0,
          duration: 0,
          command,
          args,
        };
      }

      // If no general execute available, throw error
      throw new Error(`Command '${command}' not supported by electron-cli-bridge`);
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
    options: StreamOptions = {}
  ): StreamResult {
    // Create dummy streams for now as GitLens doesn't use streaming
    const stdout = new Readable({ read() {} });
    const stderr = new Readable({ read() {} });

    const exitPromise = this.execute(command, args, options).then(result => {
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
      }
    };
  }

  /**
   * Check if a command is available
   */
  async isAvailable(command: string): Promise<boolean> {
    if (command === 'git') {
      // Git is always available through electron-cli-bridge
      await this.ensureInitialized();
      const result = await electronCLI.git.checkAvailability();
      return result.available;
    }
    // For other commands, assume they're not available through our bridge
    return false;
  }
}