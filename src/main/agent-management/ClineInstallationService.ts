import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import { app } from 'electron';

import {
  BaseAgentInstallationService,
  GitHubRelease,
  GitHubAsset
} from './BaseAgentInstallationService';

import { CUSTOM_INSTALL_DIRECTORY, SupportedAgent, getAgentInfo } from "@principal-ai/agent-monitoring";
import { AgentConfigurationService } from './AgentConfigurationService';

const execAsync = promisify(exec);

// Cline configuration types (similar to Claude's structure)
interface ClineHook {
  id: string;
  [key: string]: unknown;
}

interface ClineConfig {
  hooks?: ClineHook[];
  [key: string]: unknown;
}

export class ClineInstallationService
  extends BaseAgentInstallationService  {

  private static instance: ClineInstallationService;
  private agentInfo = getAgentInfo(SupportedAgent.CLINE);

  private constructor() {
    super(SupportedAgent.CLINE, getAgentInfo(SupportedAgent.CLINE));
  }

  static getInstance(): ClineInstallationService {
    if (!ClineInstallationService.instance) {
      ClineInstallationService.instance = new ClineInstallationService();
    }
    return ClineInstallationService.instance;
  }

  protected getAssetNameForRelease(release: GitHubRelease): string | undefined {
    // Cline releases binaries with platform-specific names
    const platform = process.platform;
    const arch = process.arch;

    let assetPattern: string;

    switch (platform) {
      case 'darwin':
        assetPattern = arch === 'arm64' ? 'cline-darwin-arm64' : 'cline-darwin-x64';
        break;
      case 'linux':
        assetPattern = arch === 'arm64' ? 'cline-linux-arm64' : 'cline-linux-x64';
        break;
      case 'win32':
        assetPattern = 'cline-windows-x64.exe';
        break;
      default:
        console.warn(`[ClineService] Unsupported platform: ${platform}`);
        return undefined;
    }

    // Find the asset that matches our pattern
    const asset = release.assets.find((a: GitHubAsset) =>
      a.name === assetPattern || a.name === `${assetPattern}.zip` || a.name === `${assetPattern}.tar.gz`
    );

    return asset?.name;
  }

  protected async getVersionFromBinary(binaryPath: string): Promise<string | null> {
    try {
      // Cline uses standard --version flag
      const { stdout } = await execAsync(`"${binaryPath}" --version`);

      // Parse version from output
      const match = stdout.match(/v?(\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    } catch (error) {
      console.error('[ClineService] Error getting version:', error);
      return null;
    }
  }

  protected async isOurVersion(installPath: string): Promise<boolean> {
    try {
      // Check if it's a symlink pointing to our managed directory
      const stats = await fs.lstat(installPath);
      if (stats.isSymbolicLink()) {
        const _target = await fs.readlink(installPath);
        const realPath = await fs.realpath(installPath);

        // Check if the real path is within our managed installation directory
        const userData = app.getPath('userData');
        const ourInstallPath = path.join(userData, CUSTOM_INSTALL_DIRECTORY, this.agentType);

        return realPath.startsWith(ourInstallPath);
      }

      // If it's not a symlink, check if the file itself is in our managed directory
      const realPath = await fs.realpath(installPath).catch(() => installPath);
      const userData = app.getPath('userData');
      const ourInstallPath = path.join(userData, CUSTOM_INSTALL_DIRECTORY, this.agentType);

      return realPath.startsWith(ourInstallPath);
    } catch {
      return false;
    }
  }

  protected async postInstallSetup(versionPath: string, _version: string): Promise<void> {
    const binaryPath = path.join(versionPath, this.binaryName);

    try {
      // Check if the binary file needs extraction
      const fileType = await execAsync(`file "${binaryPath}"`);

      if (fileType.stdout.includes('Zip archive')) {
        console.log('[ClineService] Downloaded file is a zip archive, extracting...');

        // Rename to .zip temporarily for extraction
        const zipPath = `${binaryPath}.zip`;
        await fs.rename(binaryPath, zipPath);

        // Extract the zip file
        await execAsync(`unzip -o "${zipPath}" -d "${versionPath}"`);

        // Remove the zip file after extraction
        await fs.unlink(zipPath);

        // Find the actual binary in the extracted files
        const extractedFiles = await fs.readdir(versionPath);
        const actualBinary = extractedFiles.find(f =>
          f.startsWith('cline') && !f.endsWith('.zip') && !f.endsWith('.tar.gz')
        );

        if (actualBinary && actualBinary !== this.binaryName) {
          await fs.rename(
            path.join(versionPath, actualBinary),
            path.join(versionPath, this.binaryName)
          );
        }
      } else if (fileType.stdout.includes('gzip compressed data')) {
        console.log('[ClineService] Downloaded file is a tar.gz archive, extracting...');

        // Extract tar.gz file
        await execAsync(`tar -xzf "${binaryPath}" -C "${versionPath}"`);

        // Find and rename the extracted binary
        const extractedFiles = await fs.readdir(versionPath);
        const actualBinary = extractedFiles.find(f =>
          f.startsWith('cline') && !f.endsWith('.tar.gz')
        );

        if (actualBinary && actualBinary !== this.binaryName) {
          await fs.rename(
            path.join(versionPath, actualBinary),
            path.join(versionPath, this.binaryName)
          );
        }
      }

      // Ensure the binary is executable
      await fs.chmod(binaryPath, 0o755);
    } catch (error) {
      console.error('[ClineService] Error in post-install setup:', error);
      throw error;
    }
  }

  protected async cleanAgentSpecificConfigs(): Promise<void> {
    // Clean up Cline-specific configuration
    const agentConfigService = AgentConfigurationService.getInstance();
    try {
      await agentConfigService.removeHooksFromConfig(SupportedAgent.CLINE);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') {
        console.warn('Could not clean up Cline settings:', error);
      }
    }
  }

  // Cline-specific public methods (implementing the interface)
  async installCline(version?: string): Promise<void> {
    return this.install(version);
  }

  async uninstallCline(): Promise<void> {
    return this.uninstall();
  }

  async updateCline(): Promise<void> {
    return this.update();
  }

  async isOurClineVersion(installPath: string): Promise<boolean> {
    return this.isOurVersion(installPath);
  }

  async getClineConfig(): Promise<ClineConfig> {
    try {
      // Use the settings path from agent info
      const configPath = this.expandHomePath(this.agentInfo.settingsPath || '~/.cline/settings.json');
      const content = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  private expandHomePath(filePath: string): string {
    if (filePath.startsWith('~/')) {
      return path.join(os.homedir(), filePath.slice(2));
    }
    return filePath;
  }

  async updateClineConfig(newConfig: ClineConfig): Promise<void> {
    const configPath = this.expandHomePath(this.agentInfo.settingsPath || '~/.cline/settings.json');
    const configDir = path.dirname(configPath);
    await fs.mkdir(configDir, { recursive: true });

    let finalConfig = newConfig;
    try {
      const existingConfig = await this.getClineConfig();
      if (Object.keys(existingConfig).length > 0) {
        finalConfig = this.deepMerge(existingConfig, newConfig);
      }
    } catch (error) {
      console.error('Could not merge existing cline config, overwriting.', error);
    }

    await fs.writeFile(configPath, JSON.stringify(finalConfig, null, 2));
  }

  async testClineConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Cline might have a different test command or health check
      const { stdout: _stdout } = await execAsync(`${this.binaryName} --help`);
      return {
        success: true,
        message: 'Cline is installed and accessible',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  private isObject(item: unknown): item is Record<string, unknown> {
    return Boolean(item && typeof item === 'object' && !Array.isArray(item));
  }

  private deepMerge(target: ClineConfig, source: ClineConfig): ClineConfig {
    const output = { ...target };

    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach((key) => {
        if (
          key === 'hooks' &&
          Array.isArray(source[key]) &&
          Array.isArray(target[key])
        ) {
          const targetHooks = target[key] as ClineHook[];
          const sourceHooks = source[key] as ClineHook[];
          const mergedHooks = [...targetHooks];

          sourceHooks.forEach((sourceHook) => {
            const existingHookIndex = mergedHooks.findIndex(
              (h) => (h as ClineHook).id === sourceHook.id,
            );
            if (existingHookIndex !== -1) {
              mergedHooks[existingHookIndex] = {
                ...mergedHooks[existingHookIndex],
                ...sourceHook,
              };
            } else {
              mergedHooks.push(sourceHook);
            }
          });
          output[key] = mergedHooks;
        } else if (
          this.isObject(source[key]) &&
          key in target &&
          this.isObject(target[key])
        ) {
          output[key] = this.deepMerge(target[key] as ClineConfig, source[key] as ClineConfig);
        } else {
          output[key] = source[key];
        }
      });
    }
    return output;
  }
}