/**
 * NodeExecutor - Direct Node.js executor for worker processes
 * Uses child_process directly since worker doesn't have access to Electron APIs
 */

import type {
  Executor,
  ExecuteResult,
  ExecuteOptions,
  StreamOptions,
  StreamResult,
} from '@principal-ai/codebase-quality-lenses';
import { spawn } from 'child_process';
import { Readable } from 'stream';

/**
 * Executor implementation using Node's child_process
 * For use in worker processes that don't have Electron access
 */
export class NodeExecutor implements Executor {
  readonly type = 'node' as const;

  /**
   * Execute a command using Node's child_process
   */
  async execute(
    command: string,
    args: string[] = [],
    options: ExecuteOptions = {},
  ): Promise<ExecuteResult> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';

      // Clean up NODE_OPTIONS to avoid ts-node conflicts from parent process
      // This matches what universal-worker.cjs does
      const baseEnv = options.env || process.env;
      const cleanEnv = { ...baseEnv };
      delete cleanEnv.NODE_OPTIONS;
      delete cleanEnv.TS_NODE_PROJECT;
      delete cleanEnv.TS_NODE_TRANSPILE_ONLY;

      const child = spawn(command, args, {
        cwd: options.cwd,
        env: cleanEnv,
        shell: true,
      });

      if (child.stdout) {
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      // Handle timeout
      let timeoutHandle: NodeJS.Timeout | undefined;
      if (options.timeout) {
        timeoutHandle = setTimeout(() => {
          child.kill('SIGTERM');
        }, options.timeout);
      }

      child.on('error', (error) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        resolve({
          stdout,
          stderr: stderr || error.message,
          exitCode: 1,
          duration: Date.now() - startTime,
          command,
          args,
          error,
        });
      });

      child.on('close', (code) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 0,
          duration: Date.now() - startTime,
          command,
          args,
        });
      });
    });
  }

  /**
   * Stream method required by Executor interface
   */
  stream(
    command: string,
    args: string[] = [],
    options: StreamOptions = {},
  ): StreamResult {
    // Clean up NODE_OPTIONS to avoid ts-node conflicts from parent process
    const baseEnv = options.env || process.env;
    const cleanEnv = { ...baseEnv };
    delete cleanEnv.NODE_OPTIONS;
    delete cleanEnv.TS_NODE_PROJECT;
    delete cleanEnv.TS_NODE_TRANSPILE_ONLY;

    const child = spawn(command, args, {
      cwd: options.cwd,
      env: cleanEnv,
      shell: true,
    });

    const exitPromise = new Promise<ExecuteResult>((resolve) => {
      let stdout = '';
      let stderr = '';
      const startTime = Date.now();

      if (child.stdout) {
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      child.on('close', (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 0,
          duration: Date.now() - startTime,
          command,
          args,
        });
      });

      child.on('error', (error) => {
        resolve({
          stdout,
          stderr: stderr || error.message,
          exitCode: 1,
          duration: Date.now() - startTime,
          command,
          args,
          error,
        });
      });
    });

    return {
      stdout: child.stdout || new Readable({ read() {} }),
      stderr: child.stderr || new Readable({ read() {} }),
      exitPromise,
      kill: () => {
        child.kill('SIGTERM');
      },
    };
  }

  /**
   * Check if a command is available
   */
  async isAvailable(command: string): Promise<boolean> {
    try {
      const testArgs = ['--version'];
      const result = await this.execute(command, testArgs, {
        timeout: 5000,
      });
      return result.exitCode === 0;
    } catch (error) {
      return false;
    }
  }
}
