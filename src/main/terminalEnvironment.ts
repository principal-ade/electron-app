import { execSync } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import { EnvironmentConfig } from './utils/environmentConfig';

/**
 * Professional terminal environment manager for Electron apps
 * Handles PATH resolution and environment setup for spawned terminals
 */
export class TerminalEnvironment {
  private static instance: TerminalEnvironment;
  private userPath: string | null = null;
  private userShell: string | null = null;
  private lastPathFetch: number = 0;
  private readonly PATH_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): TerminalEnvironment {
    if (!TerminalEnvironment.instance) {
      TerminalEnvironment.instance = new TerminalEnvironment();
    }
    return TerminalEnvironment.instance;
  }

  /**
   * Get the user's shell, with intelligent fallbacks
   */
  getUserShell(): string {
    if (this.userShell) {
      return this.userShell;
    }

    const fs = require('fs');

    if (process.platform === 'win32') {
      this.userShell = 'powershell.exe';
    } else if (process.platform === 'darwin') {
      // macOS - prefer user's configured shell, fallback to zsh (default since Catalina)
      const preferredShell = process.env.SHELL || '/bin/zsh';

      // Verify the shell exists
      if (fs.existsSync(preferredShell)) {
        this.userShell = preferredShell;
      } else if (fs.existsSync('/bin/zsh')) {
        this.userShell = '/bin/zsh';
      } else {
        this.userShell = '/bin/bash';
      }
    } else {
      // Linux
      const preferredShell = process.env.SHELL || '/bin/bash';

      if (fs.existsSync(preferredShell)) {
        this.userShell = preferredShell;
      } else if (fs.existsSync('/bin/bash')) {
        this.userShell = '/bin/bash';
      } else {
        this.userShell = '/bin/sh';
      }
    }

    console.log(`[TerminalEnvironment] Selected shell: ${this.userShell}`);
    return this.userShell;
  }

  /**
   * Get the user's PATH from their login shell
   * Caches the result for performance
   */
  async getUserPath(): Promise<string> {
    // Check cache
    const now = Date.now();
    if (this.userPath && now - this.lastPathFetch < this.PATH_CACHE_DURATION) {
      return this.userPath;
    }

    try {
      // Try multiple approaches to get the most complete PATH
      const paths: string[] = [];

      // Method 1: Get PATH from login shell
      const shells = [
        process.env.SHELL,
        '/bin/zsh',
        '/bin/bash',
        '/bin/sh',
      ].filter(Boolean);

      for (const shell of shells) {
        try {
          console.log(
            `[TerminalEnvironment] Attempting to get PATH from ${shell}...`,
          );
          const result = execSync(`${shell} -l -c "echo $PATH"`, {
            encoding: 'utf8',
            timeout: 5000,
            env: {
              ...process.env,
              // Ensure we get a clean environment
              ELECTRON_RUN_AS_NODE: undefined,
              NODE_OPTIONS: undefined,
            },
          });

          if (result && result.trim()) {
            const pathValue = result.trim();
            paths.push(pathValue);
            console.log(`[TerminalEnvironment] Got PATH from ${shell}`);
            console.log(
              `[TerminalEnvironment] PATH contains ${pathValue.split(':').length} directories`,
            );
            // Check if Bun is in the PATH
            if (pathValue.includes('.bun/bin')) {
              console.log(`[TerminalEnvironment] ✓ Bun found in shell PATH`);
            } else {
              console.warn(
                `[TerminalEnvironment] ⚠ Bun NOT found in shell PATH`,
              );
            }
            break;
          } else {
            console.warn(
              `[TerminalEnvironment] Shell ${shell} returned empty PATH`,
            );
          }
        } catch (e) {
          console.warn(
            `[TerminalEnvironment] Failed to get PATH from ${shell}:`,
            e instanceof Error ? e.message : e,
          );
        }
      }

      // Method 2: Include common tool paths that might not be in the default PATH
      const additionalPaths = [
        '/usr/local/bin',
        '/opt/homebrew/bin', // Apple Silicon Macs
        path.join(os.homedir(), '.local', 'bin'),
        path.join(os.homedir(), 'bin'),
        path.join(os.homedir(), '.bun', 'bin'), // Bun package manager
        '/usr/bin',
        '/bin',
        '/usr/sbin',
        '/sbin',
      ];

      // Method 3: Include platform-specific paths
      if (process.platform === 'darwin') {
        additionalPaths.push(
          '/opt/homebrew/sbin',
          '/Library/Apple/usr/bin',
          path.join(os.homedir(), '.cargo', 'bin'),
          path.join(os.homedir(), '.npm-global', 'bin'),
          EnvironmentConfig.getPlatformHomeLocalBinPath(),
        );
      }

      // Combine all paths, deduplicate, and filter existing directories
      const fs = require('fs');
      const allPathElements = new Set<string>();

      // Add discovered PATH first
      if (paths.length > 0) {
        paths[0].split(':').forEach((p) => allPathElements.add(p));
      }

      // Add additional paths
      additionalPaths.forEach((p) => {
        if (fs.existsSync(p)) {
          allPathElements.add(p);
        }
      });

      // Add current process PATH as fallback
      if (process.env.PATH) {
        process.env.PATH.split(path.delimiter).forEach((p) =>
          allPathElements.add(p),
        );
      }

      this.userPath = Array.from(allPathElements).join(path.delimiter);
      this.lastPathFetch = now;

      console.log(
        `[TerminalEnvironment] Resolved PATH with ${allPathElements.size} directories`,
      );

      // Log detailed PATH composition
      const pathArray = Array.from(allPathElements);
      console.log(
        `[TerminalEnvironment] PATH composition breakdown:`,
      );
      console.log(
        `  - From shell extraction: ${paths.length > 0 ? paths[0].split(':').length : 0} directories`,
      );
      console.log(
        `  - Additional paths found: ${additionalPaths.filter((p) => require('fs').existsSync(p)).length} directories`,
      );
      console.log(`  - From process.env.PATH: ${process.env.PATH?.split(':').length || 0} directories`);

      // Check final PATH for important tools
      const bunPath = pathArray.find((p) => p.includes('.bun/bin'));
      if (bunPath) {
        console.log(`[TerminalEnvironment] ✓ Final PATH includes Bun: ${bunPath}`);
      } else {
        console.warn(`[TerminalEnvironment] ⚠ Final PATH MISSING Bun`);
      }

      return this.userPath;
    } catch (error) {
      console.error('[TerminalEnvironment] Failed to get user PATH:', error);
      // Return current process PATH as fallback
      return process.env.PATH || '';
    }
  }

  /**
   * Clear the cached PATH (useful after installing new tools)
   */
  clearCache(): void {
    this.userPath = null;
    this.lastPathFetch = 0;
    console.log('[TerminalEnvironment] Cache cleared');
  }

  /**
   * Get a complete environment for spawning terminals
   */
  async getTerminalEnvironment(
    workingDirectory: string,
    sessionId?: string,
  ): Promise<NodeJS.ProcessEnv> {
    const userPath = await this.getUserPath();

    // Clean the current environment
    const cleanEnv = { ...process.env };

    // Remove Electron/Node specific variables that might interfere
    delete cleanEnv.NODE_OPTIONS;
    delete cleanEnv.ELECTRON_RUN_AS_NODE;

    // Build the terminal environment
    const env: NodeJS.ProcessEnv = {
      ...cleanEnv,
      // Essential PATH with user's full environment
      PATH: userPath,
      // Terminal configuration
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      // Locale settings
      LANG: process.env.LANG || 'en_US.UTF-8',
      LC_ALL: process.env.LC_ALL || 'en_US.UTF-8',
      // User information
      HOME: process.env.HOME || os.homedir(),
      USER: process.env.USER || os.userInfo().username,
      SHELL: this.getUserShell(),
      // Working directory
      PWD: workingDirectory,
    };

    // Add session-specific variables if provided
    if (sessionId) {
      env.CLAUDE_SESSION_ID = sessionId;
      env.AGENT_SESSION_ID = sessionId;
      env.CLAUDE_PROJECT_ROOT = workingDirectory;
      env.CLAUDE_WORKING_DIRECTORY = workingDirectory;
    }

    return env;
  }

  /**
   * Test if a command is available in the user's PATH
   */
  async isCommandAvailable(command: string): Promise<boolean> {
    try {
      const userPath = await this.getUserPath();
      const env = { PATH: userPath };

      execSync(`which ${command}`, {
        encoding: 'utf8',
        env,
        timeout: 2000,
      });

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Find the full path to a command
   */
  async findCommand(command: string): Promise<string | null> {
    try {
      const userPath = await this.getUserPath();
      const env = { PATH: userPath };

      const result = execSync(`which ${command}`, {
        encoding: 'utf8',
        env,
        timeout: 2000,
      });

      return result.trim();
    } catch {
      return null;
    }
  }
}

// Export singleton instance
export const terminalEnvironment = TerminalEnvironment.getInstance();
