import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';
import { app } from 'electron';

import { 
  BaseAgentInstallationService,
  GitHubRelease
} from './BaseAgentInstallationService';

import { CUSTOM_INSTALL_DIRECTORY, SupportedAgent, getAgentInfo } from "@principal-ai/agent-monitoring";
import { AgentConfigurationService } from './AgentConfigurationService';
import { AgentInstallStatus } from '../../shared/main-process-api-interfaces/AgentInstallationAPI';

const execAsync = promisify(exec);


export class GeminiInstallationService 
  extends BaseAgentInstallationService  {
  
  private static instance: GeminiInstallationService;
  private agentInfo = getAgentInfo(SupportedAgent.GEMINI);
  private versionFlag = '--principal-ai-version';

  private constructor() {
    super(SupportedAgent.GEMINI, getAgentInfo(SupportedAgent.GEMINI));
  }

  static getInstance(): GeminiInstallationService {
    if (!GeminiInstallationService.instance) {
      GeminiInstallationService.instance = new GeminiInstallationService();
    }
    return GeminiInstallationService.instance;
  }

  protected getAssetNameForRelease(_release: GitHubRelease): string {
    if (!this.agentInfo.installation.assetName) {
      throw new Error('Asset name is not set for Gemini');
    }
    return this.agentInfo.installation.assetName;
  }

  protected async getVersionFromBinary(binaryPath: string): Promise<string | null> {
    try {
      // First try our custom version flag
      const { stdout: customVersion } = await execAsync(
        `"${binaryPath}" ${this.versionFlag}`,
      ).catch(() => ({ stdout: '' }));
      if (!this.agentInfo.installation.binaryName) {
        throw new Error('Binary name is not set for Gemini');
      }
      if (customVersion.includes(this.binaryName)) {
        const match = customVersion.match(/v?(\d+\.\d+\.\d+)/);
        if (match) return match[1];
      }

      // Fallback to standard version flag
      const { stdout } = await execAsync(`"${binaryPath}" --version`);
      const match = stdout.match(/v?(\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    } catch (error) {
      console.error('[GeminiService] Error getting version:', error);
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

  protected async createWrapperScript(version: string, bundlePath: string): Promise<string> {
    // Always use system Node.js, not Electron's
    // TODO: Determine if node is installed
    const nodeCommand = 'node';
    
    // Use the asset name for the actual file, not the binary name
    const actualBundlePath = path.join(path.dirname(bundlePath), this.agentInfo.installation.assetName || 'gemini.mjs');
    
    return `#!/bin/bash
# Gemini CLI wrapper for Principal AI 
export GEMINI_PRINCIPLE_VERSION="${version}"

# Handle special version check
if [[ "$1" == "${this.versionFlag}" ]]; then
  echo "${this.binaryName} v${version}"
  exit 0
fi

# Run the actual gemini CLI (ESM module)
exec ${nodeCommand} "${actualBundlePath}" "$@"
`;
  }

  protected async postInstallSetup(versionPath: string, version: string): Promise<void> {
    // For Gemini, the downloaded file is named as the binary name, but we need it as the asset name
    if (!this.agentInfo.installation.assetName) {
      throw new Error('Asset name is not set for Gemini');
    }
    
    // The base class downloads using binaryName, but we need the asset name
    const downloadedPath = path.join(versionPath, this.binaryName);
    const mjsPath = path.join(versionPath, this.agentInfo.installation.assetName);
    
    console.log('[GeminiService] Post-install setup for version:', version);
    console.log('[GeminiService] Version path:', versionPath);
    console.log('[GeminiService] Downloaded path:', downloadedPath);
    console.log('[GeminiService] Target mjs path:', mjsPath);
    
    // Check what files exist in the version directory
    try {
      const files = await fs.readdir(versionPath);
      console.log('[GeminiService] Files in version directory:', files);
    } catch (error) {
      console.error('[GeminiService] Error reading version directory:', error);
    }
    
    // Check if the downloaded file exists
    try {
      const downloadedStats = await fs.stat(downloadedPath);
      console.log('[GeminiService] Downloaded file exists, size:', downloadedStats.size);
    } catch (error) {
      console.error('[GeminiService] Downloaded file does not exist:', error);
      throw new Error(`Downloaded file not found at ${downloadedPath}`);
    }
    
    // Rename the downloaded file to the correct asset name
    try {
      await fs.rename(downloadedPath, mjsPath);
      console.log('[GeminiService] Successfully renamed file to:', mjsPath);
    } catch (error) {
      console.error('[GeminiService] Error renaming downloaded file:', error);
      throw error;
    }
    
    // Ensure the file is executable
    await fs.chmod(mjsPath, 0o755);
    console.log('[GeminiService] Successfully made file executable');
  }

  protected async cleanAgentSpecificConfigs(): Promise<void> {
    // Clean up Gemini-specific configuration
    const agentConfigService = AgentConfigurationService.getInstance();
    try {
      await agentConfigService.removeHooksFromConfig(SupportedAgent.GEMINI);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') {
        console.warn('Could not clean up Gemini settings:', error);
      }
    }
  }

  // Override checkInstallation to handle the renamed file
  async checkInstallation(): Promise<AgentInstallStatus> {
    try {
      console.log(`[${this.agentType}Service] Checking installation...`);
      
      // Check if our installation directory exists
      const currentPath = this.currentSymlink;
      console.log(`[${this.agentType}Service] Checking symlink at:`, currentPath);
      
      try {
        const stats = await fs.lstat(currentPath);
        if (!stats.isSymbolicLink()) {
          return {
            agentType: this.agentType,
            installed: false,
            isOurVersion: false,
            lastChecked: new Date(),
          };
        }

        const targetPath = await fs.readlink(currentPath);
        const versionPath = path.isAbsolute(targetPath)
          ? targetPath
          : path.join(this.installPath, targetPath);
        
        // For Gemini, check for the asset name (gemini.mjs) instead of binary name
        const binaryPath = path.join(versionPath, this.agentInfo.installation.assetName || 'gemini.mjs');
        await fs.access(binaryPath, fs.constants.F_OK);
        
      } catch (err) {
        console.log(`[${this.agentType}Service] Symlink or binary not found:`, err);
        return {
          agentType: this.agentType,
          installed: false,
          isOurVersion: false,
          lastChecked: new Date(),
        };
      }

      // Check if binary exists in PATH
      const checkPath = path.join(this.binPath, this.binaryName);
      let installPath = '';
      
      try {
        await fs.access(checkPath, fs.constants.F_OK);
        installPath = checkPath;
        console.log(`[${this.agentType}Service] Found command at:`, checkPath);
      } catch {
        console.log(`[${this.agentType}Service] Command not found at:`, checkPath);
        return {
          agentType: this.agentType,
          installed: false,
          isOurVersion: false,
          lastChecked: new Date(),
        };
      }

      // Check if it's our version
      const isOurs = await this.isOurVersion(installPath);
      
      // Get version if it's ours
      let version: string | null = null;
      if (isOurs) {
        version = await this.getInstalledVersion();
      }

      return {
        agentType: this.agentType,
        installed: true,
        version: version || 'unknown',
        installPath,
        isOurVersion: isOurs,
        lastChecked: new Date(),
      };
    } catch (error) {
      console.error(`Error checking ${this.agentType} installation:`, error);
      return {
        agentType: this.agentType,
        installed: false,
        isOurVersion: false,
        lastChecked: new Date(),
      };
    }
  }
}