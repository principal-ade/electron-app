/**
 * BaseExecutor - Abstract base class for command executors
 * Provides common functionality for all specialized executors
 */

import type { CLIBridge } from '../CLIBridge';
import type { ExecuteOptions, ExecuteResult } from '../types';

export abstract class BaseExecutor {
  protected bridge: CLIBridge;

  constructor(bridge: CLIBridge) {
    this.bridge = bridge;
  }

  /**
   * Execute a command through the bridge
   */
  protected async execute(
    command: string,
    args: string[] = [],
    options: ExecuteOptions = {},
  ): Promise<ExecuteResult> {
    return this.bridge.execute(command, args, options);
  }

  /**
   * Parse command output lines into array
   */
  protected parseLines(output: string): string[] {
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  /**
   * Check if a command is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.getVersion();
      return result !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get version of the command (to be implemented by subclasses)
   */
  abstract getVersion(): Promise<string | null>;
}
