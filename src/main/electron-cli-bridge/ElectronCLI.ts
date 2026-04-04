/**
 * ElectronCLI - High-level API for electron-cli-bridge
 * Provides convenient methods for common CLI operations
 */

import { CLIBridge } from './CLIBridge';
import {
  CLIBridgeOptions,
  ExecuteOptions,
  ExecuteResult,
  ESLintResult,
} from './types';
import { GitExecutor } from './executors/GitExecutor';

export class ElectronCLI {
  private bridge: CLIBridge;
  private initPromise: Promise<void> | null = null;
  private _git: GitExecutor | null = null;

  constructor(options?: CLIBridgeOptions) {
    this.bridge = new CLIBridge(options);
  }

  /**
   * Initialize the CLI bridge
   */
  async initialize(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.bridge.initialize();
    }
    return this.initPromise;
  }

  /**
   * Ensure bridge is initialized before executing commands
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      await this.initialize();
    }
  }

  /**
   * Get GitExecutor instance (lazy initialization)
   */
  get git(): GitExecutor {
    if (!this._git) {
      this._git = new GitExecutor(this.bridge);
    }
    return this._git;
  }

  /**
   * Execute a generic command
   */
  async execute(
    command: string,
    args: string[] = [],
    options: ExecuteOptions = {},
  ): Promise<ExecuteResult> {
    await this.ensureInitialized();
    return this.bridge.execute(command, args, options);
  }

  /**
   * Execute a command from a string (parses command and args)
   */
  async exec(
    commandString: string,
    options?: ExecuteOptions,
  ): Promise<ExecuteResult> {
    // Simple parsing - splits on spaces but respects quotes
    const parts = commandString.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const command = parts[0] || '';
    const args = parts.slice(1).map((arg) => arg.replace(/^"|"$/g, ''));

    return this.execute(command, args, options);
  }

  /**
   * Execute npm commands
   */
  async npm(args: string[], options?: ExecuteOptions): Promise<ExecuteResult> {
    return this.execute('npm', args, options);
  }

  /**
   * Execute yarn commands
   */
  async yarn(args: string[], options?: ExecuteOptions): Promise<ExecuteResult> {
    return this.execute('yarn', args, options);
  }

  /**
   * Execute pnpm commands
   */
  async pnpm(args: string[], options?: ExecuteOptions): Promise<ExecuteResult> {
    return this.execute('pnpm', args, options);
  }

  /**
   * Run ESLint on files
   */
  async eslint(
    patterns: string[],
    options: ExecuteOptions & { fix?: boolean; format?: string } = {},
  ): Promise<ESLintResult[]> {
    const eslintArgs = ['eslint'];

    // Add format flag for JSON output
    eslintArgs.push('--format', options.format || 'json');

    // Add fix flag if requested
    if (options.fix) {
      eslintArgs.push('--fix');
    }

    // Add file patterns
    eslintArgs.push(...patterns);

    // Execute ESLint
    const result = await this.execute('npx', eslintArgs, {
      ...options,
      // Increase timeout for ESLint as it can take a while
      timeout: options.timeout || 120000,
    });

    console.log('[ESLint] Execute result:', {
      exitCode: result.exitCode,
      hasStdout: !!result.stdout,
      stdoutLength: result.stdout?.length || 0,
      hasStderr: !!result.stderr,
      stderrPreview: result.stderr?.substring(0, 200),
    });

    // Parse JSON output
    try {
      // ESLint may exit with code 1 if there are linting errors
      // But the output is still valid JSON
      if (result.stdout) {
        const results = JSON.parse(result.stdout) as ESLintResult[];
        console.log(
          `[ESLint] Successfully parsed ${results.length} file results`,
        );
        const totalMessages = results.reduce(
          (sum, r) => sum + r.messages.length,
          0,
        );
        console.log(
          `[ESLint] Total messages across all files: ${totalMessages}`,
        );
        return results;
      }
      console.log('[ESLint] No stdout, returning empty results');
      return [];
    } catch (error) {
      // If parsing fails, return empty results
      console.error('[ESLint] Failed to parse output:', error);
      console.error('[ESLint] Raw stdout:', result.stdout?.substring(0, 500));
      return [];
    }
  }

  /**
   * Run Prettier on files
   */
  async prettier(
    patterns: string[],
    options: ExecuteOptions & { write?: boolean; check?: boolean } = {},
  ): Promise<ExecuteResult> {
    const prettierArgs = ['prettier'];

    // Add write flag if requested
    if (options.write) {
      prettierArgs.push('--write');
    }

    // Add check flag if requested
    if (options.check) {
      prettierArgs.push('--check');
    }

    // Add file patterns
    prettierArgs.push(...patterns);

    return this.execute('npx', prettierArgs, options);
  }

  /**
   * Run Jest tests
   */
  async jest(
    args: string[] = [],
    options: ExecuteOptions & { coverage?: boolean; watch?: boolean } = {},
  ): Promise<ExecuteResult> {
    const jestArgs = ['jest'];

    // Add coverage flag if requested
    if (options.coverage) {
      jestArgs.push('--coverage');
    }

    // Add watch flag if requested
    if (options.watch) {
      jestArgs.push('--watch');
    }

    // Add any additional args
    jestArgs.push(...args);

    return this.execute('npx', jestArgs, options);
  }

  /**
   * Run TypeScript compiler
   */
  async tsc(
    args: string[] = [],
    options?: ExecuteOptions,
  ): Promise<ExecuteResult> {
    return this.execute('npx', ['tsc', ...args], options);
  }

  /**
   * Check if a command is available
   */
  async which(command: string): Promise<string | null> {
    try {
      const result = await this.execute('which', [command]);
      if (result.success && result.stdout) {
        return result.stdout.trim();
      }
    } catch (_error) {
      // Command not found
    }
    return null;
  }

  /**
   * Get version of a command
   */
  async version(command: string): Promise<string | null> {
    try {
      const result = await this.execute(command, ['--version']);
      if (result.success && result.stdout) {
        return result.stdout.trim();
      }
    } catch {
      // Command failed
    }
    return null;
  }

  /**
   * Shutdown the CLI bridge
   */
  async shutdown(): Promise<void> {
    await this.bridge.shutdown();
    this.initPromise = null;
  }

  /**
   * Get status of CLIBridge and its workers (for diagnostics)
   */
  getStatus(): {
    initialized: boolean;
    workers: Array<{
      name: string;
      pid: number | null;
      isRunning: boolean;
      startedAt: number | null;
    }>;
    pendingCalls: number;
  } {
    return this.bridge.getStatus();
  }

  /**
   * Test the worker by executing a simple command (for diagnostics)
   */
  async testWorker(): Promise<{
    success: boolean;
    duration: number;
    output?: string;
    error?: string;
  }> {
    return this.bridge.testWorker();
  }

  /**
   * Restart the universal worker (for diagnostics)
   */
  async restartWorker(name: string = 'universal'): Promise<{ success: boolean; error?: string }> {
    return this.bridge.restartWorker(name);
  }
}

// Export a singleton instance for convenience
export const electronCLI = new ElectronCLI();
