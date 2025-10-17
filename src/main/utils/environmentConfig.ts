import { app } from 'electron';
import * as path from 'path';
import * as os from 'os';

/**
 * Environment configuration to ensure dev/prod parity
 */
export class EnvironmentConfig {
  private static _forceProductionPaths =
    process.env.FORCE_PRODUCTION_PATHS === 'true';
  private static _hasWarnedAboutUnsafeMode = false;
  private static _isPackagedSimulation =
    process.env.NODE_ENV_PACKAGED_SIMULATION === 'true';

  static {
    // Log warning if running in unsafe mode
    // Check if app is available (not available in worker contexts)
    if (
      app &&
      !app.isPackaged &&
      !this._forceProductionPaths &&
      !this._hasWarnedAboutUnsafeMode
    ) {
      console.warn('\n⚠️  WARNING: Running in UNSAFE development mode!');
      console.warn('Commands that work now may FAIL in production.');
      console.warn('Use "npm run dev" for production-safe development.\n');
      this._hasWarnedAboutUnsafeMode = true;
    }
  }

  /**
   * Get user data path that works consistently in dev and prod
   */
  static getUserDataPath(): string {
    if (!app) {
      throw new Error('EnvironmentConfig.getUserDataPath() cannot be used in worker context');
    }
    if (app.isPackaged || this._forceProductionPaths) {
      return app.getPath('userData');
    }
    // In dev, still use userData to match production behavior
    return app.getPath('userData');
  }

  /**
   * Get assets path that works in both environments
   */
  static getAssetsPath(...paths: string[]): string {
    if (!app) {
      throw new Error('EnvironmentConfig.getAssetsPath() cannot be used in worker context');
    }
    const RESOURCES_PATH = app.isPackaged
      ? path.join(process.resourcesPath, 'assets')
      : path.join(__dirname, '../../assets');
    return path.join(RESOURCES_PATH, ...paths);
  }

  /**
   * Get bundled binary path that works in both environments
   * In packaged app: resources/bin/
   * In dev: resources/bin/ (if downloaded)
   */
  static getBundledBinaryPath(...paths: string[]): string {
    if (!app) {
      throw new Error('EnvironmentConfig.getBundledBinaryPath() cannot be used in worker context');
    }
    const RESOURCES_PATH = app.isPackaged
      ? path.join(process.resourcesPath, 'bin')
      : path.join(__dirname, '../../resources/bin');
    return path.join(RESOURCES_PATH, ...paths);
  }

  /**
   * Get the bundled act binary path for the current platform
   * Returns null if the binary doesn't exist
   */
  static async getBundledActPath(): Promise<string | null> {
    const fs = require('fs/promises');
    const { constants: fsConstants } = require('fs');

    let binaryName: string;

    switch (process.platform) {
      case 'darwin':
        binaryName = process.arch === 'arm64' ? 'act-darwin-arm64' : 'act-darwin-x64';
        break;
      case 'linux':
        binaryName = process.arch === 'arm64' ? 'act-linux-arm64' : 'act-linux-x64';
        break;
      case 'win32':
        binaryName = 'act-win32-x64.exe';
        break;
      default:
        return null;
    }

    try {
      const binaryPath = this.getBundledBinaryPath(binaryName);
      await fs.access(binaryPath, fsConstants.X_OK);
      return binaryPath;
    } catch {
      return null;
    }
  }

  static getHomeDir(): string {
    return os.homedir();
  }

  static expandHome(filePath: string): string {
    if (filePath.startsWith('~/')) {
      return path.join(os.homedir(), filePath.slice(2));
    }
    if (process.platform === 'win32' && filePath.includes('%USERPROFILE%')) {
      return filePath.replace('%USERPROFILE%', os.homedir());
    }
    return filePath;
  }

  static getPlatformHomeLocalBinPath(): string {
    const homeDir = this.getHomeDir();
    switch (process.platform) {
      case 'win32':
        // Windows: Use AppData\Local for user-installed binaries
        return path.join(homeDir, 'AppData', 'Local', 'Programs');
      case 'darwin':
        // macOS: Use ~/.local/bin (standard for Homebrew, etc.)
        return path.join(homeDir, '.local', 'bin');
      case 'linux':
        // Linux: Use ~/.local/bin (XDG Base Directory Specification)
        return path.join(homeDir, '.local', 'bin');
      default:
        // Fallback to .local/bin for other Unix-like systems
        return path.join(homeDir, '.local', 'bin');
    }
  }

  /**
   * Check if we should use production constraints in dev
   */
  static shouldUseProductionConstraints(): boolean {
    if (!app) {
      // In worker context, assume production constraints
      return this._forceProductionPaths || this._isPackagedSimulation || true;
    }
    return (
      app.isPackaged || this._forceProductionPaths || this._isPackagedSimulation
    );
  }

  /**
   * Check if we're simulating a packaged environment
   */
  static isPackagedOrSimulated(): boolean {
    if (!app) {
      // In worker context, assume packaged
      return this._isPackagedSimulation || true;
    }
    return app.isPackaged || this._isPackagedSimulation;
  }

  /**
   * Execute command with production constraints
   */
  static async executeCommand(
    command: string,
    args: string[] = [],
  ): Promise<{ stdout: string; stderr: string }> {
    if (this.shouldUseProductionConstraints()) {
      // In production, avoid shell execution
      const { spawn } = require('child_process');
      return new Promise((resolve, reject) => {
        const proc = spawn(command, args, {
          shell: false,
          env: {
            ...process.env,
            PATH: `${this.getPlatformHomeLocalBinPath()}:${process.env.PATH}`,
          },
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });
        proc.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        proc.on('close', (code: number) => {
          if (code === 0) {
            resolve({ stdout, stderr });
          } else {
            reject(new Error(`Command failed with code ${code}: ${stderr}`));
          }
        });
      });
    } else {
      // In dev without constraints, use exec for convenience
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      return execAsync(`${command} ${args.join(' ')}`);
    }
  }

  /**
   * Log warnings for production-incompatible code
   */
  static warnIfProductionIncompatible(feature: string): void {
    if (!app) {
      // In worker context, skip warnings
      return;
    }
    if (
      !app.isPackaged &&
      !this._forceProductionPaths &&
      !this._isPackagedSimulation
    ) {
      console.warn(
        `⚠️  Warning: Using "${feature}" which may not work in production. Consider using EnvironmentConfig methods instead.`,
      );
    }
  }

  /**
   * Find executable in production-safe way
   */
  static async findExecutable(execName: string): Promise<string | null> {
    const fs = require('fs/promises');
    const { constants: fsConstants } = require('fs');

    // List of paths to check, in order of preference
    const pathsToCheck = [
      `/usr/local/bin/${execName}`,
      `/opt/homebrew/bin/${execName}`,
      path.join(os.homedir(), '.local', 'bin', execName),
      path.join(os.homedir(), 'bin', execName),
      `/usr/bin/${execName}`, // System-wide installation on Linux
    ];

    // Add NVM paths - check for common node versions
    const nvmBasePath = path.join(os.homedir(), '.nvm', 'versions', 'node');
    try {
      const nodeVersions = await fs.readdir(nvmBasePath);
      // Sort versions to check newest first
      const sortedVersions = nodeVersions.sort((a: string, b: string) =>
        b.localeCompare(a),
      );
      for (const version of sortedVersions) {
        pathsToCheck.push(path.join(nvmBasePath, version, 'bin', execName));
      }
    } catch {
      // NVM directory doesn't exist or can't be read, continue
    }

    // Add macOS-specific paths for Ollama
    if (process.platform === 'darwin' && execName === 'ollama') {
      pathsToCheck.unshift('/Applications/Ollama.app/Contents/MacOS/ollama');
      pathsToCheck.push('/Applications/Ollama.app/Contents/Resources/ollama');
    }

    // Add Windows-specific paths
    if (process.platform === 'win32') {
      pathsToCheck.push(
        path.join(
          os.homedir(),
          'AppData',
          'Local',
          'Programs',
          execName,
          `${execName}.exe`,
        ),
        path.join('C:', 'Program Files', execName, `${execName}.exe`),
      );

      // Add Windows-specific paths for Ollama
      if (execName === 'ollama') {
        pathsToCheck.push(
          path.join(os.homedir(), 'AppData', 'Local', 'Ollama', 'ollama.exe'),
          path.join(
            os.homedir(),
            'AppData',
            'Local',
            'Programs',
            'Ollama',
            'ollama.exe',
          ),
          path.join('C:', 'Program Files', 'Ollama', 'ollama.exe'),
        );
      }
    }

    for (const checkPath of pathsToCheck) {
      try {
        await fs.access(checkPath, fsConstants.X_OK);
        return checkPath;
      } catch {
        // Continue checking other paths
      }
    }

    // If not found in known locations, try using which command (but with constraints)
    if (!this.shouldUseProductionConstraints()) {
      try {
        const { stdout } = await this.executeCommand('which', [execName]);
        return stdout.trim();
      } catch {
        // Command not found
      }
    }

    return null;
  }
}
