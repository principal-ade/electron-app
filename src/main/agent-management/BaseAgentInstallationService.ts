import * as crypto from 'crypto';
import { app } from 'electron';
import * as fs from 'fs/promises';
import fetch, { RequestInit } from 'node-fetch';
import * as path from 'path';
import * as os from 'os';
import { EnvironmentConfig } from '../utils/environmentConfig';
import { AgentInfo, CUSTOM_INSTALL_DIRECTORY, SupportedAgent } from "@principal-ai/agent-monitoring";
import { AgentInstallProgress, AgentInstallStatus, AgentVersion } from '../../shared/main-process-api-interfaces/AgentInstallationAPI';

// GitHub API types
export interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  created_at: string;
  published_at: string;
  assets: GitHubAsset[];
}

export abstract class BaseAgentInstallationService {
  // Properties that must be set by subclasses
  protected agentType: SupportedAgent;
  protected binaryName: string;
  protected githubRepo: string;
  
  // TODO: Future enhancement - add fallback URLs for when GitHub API is unavailable
  // This would help with: rate limits, network restrictions, and GitHub outages
  // Example: protected fallbackManifestUrl?: string;

  // Common properties
  protected installPath: string;
  protected versionsPath: string;
  protected currentSymlink: string;
  protected binPath: string;
  protected progressCallback?: (progress: AgentInstallProgress) => void;

  constructor(agentType: SupportedAgent, agentInfo: AgentInfo) {
    this.agentType = agentType;
    
    // Validate and set required fields from agentInfo
    if (!agentInfo.installation?.binaryName) {
      throw new Error(`Agent ${agentType} is missing required installation.binaryName in agent info`);
    }
    this.binaryName = agentInfo.installation.binaryName;
    
    if (!agentInfo.installation?.githubRepo && agentInfo.installation?.source === 'github-release') {
      throw new Error(`Agent ${agentType} with github-release source is missing required installation.githubRepo`);
    }
    this.githubRepo = agentInfo.installation.githubRepo || '';
    
    
    const userData = app.getPath('userData');
    this.installPath = path.join(userData, CUSTOM_INSTALL_DIRECTORY, agentType);
    this.versionsPath = path.join(this.installPath, 'versions');
    this.currentSymlink = path.join(this.installPath, 'current');
    this.binPath = EnvironmentConfig.getPlatformHomeLocalBinPath();
  }

  // Abstract methods that subclasses must implement
  protected abstract getAssetNameForRelease(release: GitHubRelease): string | undefined;
  protected abstract getVersionFromBinary(binaryPath: string): Promise<string | null>;
  protected abstract isOurVersion(installPath: string): Promise<boolean>;
  
  // Optional methods that subclasses can override
  protected createWrapperScript?(version: string, bundlePath: string): Promise<string>;
  protected postInstallSetup?(versionPath: string, version: string): Promise<void>;
  protected cleanAgentSpecificConfigs?(): Promise<void>;

  // Common public methods
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
        
        // Verify the binary exists
        const binaryPath = path.join(versionPath, this.binaryName);
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

  async getInstalledVersion(): Promise<string | null> {
    try {
      const possiblePaths = [
        path.join(this.binPath, this.binaryName),
        path.join(os.homedir(), '.local', 'bin', this.binaryName),
      ];
      
      let commandPath = this.binaryName;
      for (const checkPath of possiblePaths) {
        try {
          await fs.access(checkPath, fs.constants.F_OK);
          commandPath = checkPath;
          break;
        } catch {
          // Continue checking
        }
      }
      
      return await this.getVersionFromBinary(commandPath);
    } catch (error) {
      console.error(`[${this.agentType}Service] Error getting version:`, error);
      return null;
    }
  }

  async getAvailableVersions(): Promise<AgentVersion[]> {
    try {
      const response = await this.fetchWithFallback(
        `https://api.github.com/repos/${this.githubRepo}/releases`,
      );
      const releases = await response.json() as GitHubRelease[];

      return releases
        .map((release: GitHubRelease): AgentVersion | null => {
          const assetName = this.getAssetNameForRelease(release);
          const asset = release.assets.find((a: GitHubAsset) => a.name === assetName);
          
          if (!asset) return null;

          return {
            version: release.tag_name.replace('v', ''),
            releaseDate: release.published_at,
            downloadUrl: asset.browser_download_url,
            checksum: this.extractChecksumFromRelease(release),
            size: asset.size,
            releaseNotes: release.body,
          };
        })
        .filter((v: AgentVersion | null): v is AgentVersion => v !== null);
    } catch (error) {
      console.error(`[${this.agentType}Service] Error fetching versions:`, error);
      this.reportProgress({
        agentType: this.agentType,
        stage: 'error',
        progress: 0,
        message: 'Network unavailable. Please check your internet connection and try again.',
      });
      return [];
    }
  }

  async getLatestVersion(): Promise<AgentVersion> {
    try {
      console.log(`[${this.agentType}Service] Fetching latest version...`);
      const response = await this.fetchWithFallback(
        `https://api.github.com/repos/${this.githubRepo}/releases/latest`,
      );
      const release = await response.json() as GitHubRelease;
      
      const assetName = this.getAssetNameForRelease(release);
      const asset = release.assets.find((a: GitHubAsset) => a.name === assetName);
      
      if (!asset) {
        throw new Error(`No asset found matching pattern for ${this.agentType}`);
      }

      const version: AgentVersion = {
        version: release.tag_name.replace('v', ''),
        releaseDate: release.published_at,
        downloadUrl: asset.browser_download_url,
        checksum: this.extractChecksumFromRelease(release),
        size: asset.size,
        releaseNotes: release.body,
      };
      
      console.log(`[${this.agentType}Service] Latest version:`, version.version);
      return version;
    } catch (error) {
      console.error(`[${this.agentType}Service] Error fetching latest version:`, error);
      
      // Fallback to first version from list
      const versions = await this.getAvailableVersions();
      if (versions.length === 0) {
        throw new Error('No versions available - network connectivity required');
      }
      return versions[0];
    }
  }

  async checkForUpdates(): Promise<{
    hasUpdate: boolean;
    currentVersion?: string;
    latestVersion: string;
  }> {
    const currentVersion = await this.getInstalledVersion();
    const latestVersion = await this.getLatestVersion();

    const hasUpdate = currentVersion
      ? this.compareVersions(currentVersion, latestVersion.version) < 0
      : true;

    return {
      hasUpdate,
      currentVersion: currentVersion || undefined,
      latestVersion: latestVersion.version,
    };
  }

  async install(version?: string): Promise<void> {
    try {
      this.reportProgress({
        agentType: this.agentType,
        stage: 'downloading',
        progress: 0,
        message: 'Fetching version information...',
      });

      // Get the version to install
      const versionInfo = version
        ? (await this.getAvailableVersions()).find((v) => v.version === version)
        : await this.getLatestVersion();

      if (!versionInfo) {
        throw new Error(`Version ${version} not found`);
      }

      // Create installation directories
      await fs.mkdir(this.versionsPath, { recursive: true });
      const versionPath = path.join(this.versionsPath, versionInfo.version);
      await fs.mkdir(versionPath, { recursive: true });

      // Download the release
      this.reportProgress({
        agentType: this.agentType,
        stage: 'downloading',
        progress: 10,
        message: `Downloading ${this.agentType} v${versionInfo.version}...`,
      });

      const binaryPath = path.join(versionPath, this.binaryName);
      console.log(`[${this.agentType}Service] Downloading to:`, binaryPath);
      console.log(`[${this.agentType}Service] Download URL:`, versionInfo.downloadUrl);
      
      await this.downloadFile(
        versionInfo.downloadUrl,
        binaryPath,
        (progress) => {
          this.reportProgress({
            agentType: this.agentType,
            stage: 'downloading',
            progress: 10 + progress * 0.6,
            message: `Downloading... ${Math.round(progress * 100)}%`,
          });
        },
      );

      console.log(`[${this.agentType}Service] Download completed, checking file exists...`);
      try {
        const stats = await fs.stat(binaryPath);
        console.log(`[${this.agentType}Service] Downloaded file exists, size:`, stats.size);
      } catch (error) {
        console.error(`[${this.agentType}Service] Downloaded file does not exist:`, error);
        throw new Error(`Download failed - file not found at ${binaryPath}`);
      }

      // Verify checksum if available
      if (versionInfo.checksum) {
        this.reportProgress({
          agentType: this.agentType,
          stage: 'installing',
          progress: 70,
          message: 'Verifying download...',
        });

        const fileHash = await this.calculateChecksum(binaryPath);
        if (fileHash !== versionInfo.checksum) {
          throw new Error('Checksum verification failed');
        }
      }

      // Make the binary executable
      await fs.chmod(binaryPath, 0o755);

      // Create wrapper script if needed
      if (this.createWrapperScript) {
        this.reportProgress({
          agentType: this.agentType,
          stage: 'installing',
          progress: 80,
          message: 'Creating wrapper script...',
        });
        
        const wrapperContent = await this.createWrapperScript(versionInfo.version, binaryPath);
        const wrapperPath = path.join(versionPath, `${this.binaryName}-wrapper`);
        await fs.writeFile(wrapperPath, wrapperContent);
        await fs.chmod(wrapperPath, 0o755);
      }

      // Run any agent-specific post-install setup
      if (this.postInstallSetup) {
        await this.postInstallSetup(versionPath, versionInfo.version);
      }

      // Update current symlink
      this.reportProgress({
        agentType: this.agentType,
        stage: 'configuring',
        progress: 90,
        message: 'Configuring system paths...',
      });

      // Remove old symlink if exists
      try {
        await fs.unlink(this.currentSymlink);
      } catch {}

      await fs.symlink(versionPath, this.currentSymlink);

      // Install to user's local bin
      await fs.mkdir(this.binPath, { recursive: true });
      const userLink = path.join(this.binPath, this.binaryName);

      // Remove old symlink if exists
      try {
        await fs.unlink(userLink);
      } catch {}

      const targetBinary = this.createWrapperScript
        ? path.join(versionPath, `${this.binaryName}-wrapper`)
        : binaryPath;
      
      await fs.symlink(targetBinary, userLink);

      // Add to PATH if not already there
      await this.ensureInPath(this.binPath);

      this.reportProgress({
        agentType: this.agentType,
        stage: 'completed',
        progress: 100,
        message: `${this.agentType} v${versionInfo.version} installed successfully!`,
      });
    } catch (error) {
      this.reportProgress({
        agentType: this.agentType,
        stage: 'error',
        progress: 0,
        message: 'Installation failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async uninstall(): Promise<void> {
    try {
      // Remove symlink from bin
      const userLink = path.join(this.binPath, this.binaryName);
      await fs.unlink(userLink).catch(() => {});

      // Remove installation directory
      await fs.rm(this.installPath, { recursive: true, force: true });

      // Clean agent-specific configs
      if (this.cleanAgentSpecificConfigs) {
        await this.cleanAgentSpecificConfigs();
      }

      // Clean shell configs
      await this.cleanShellConfigs();
    } catch (error) {
      console.error(`Error uninstalling ${this.agentType}:`, error);
      throw error;
    }
  }

  async update(): Promise<void> {
    const { hasUpdate, latestVersion } = await this.checkForUpdates();
    if (!hasUpdate) {
      throw new Error('Already on the latest version');
    }

    await this.install(latestVersion);
  }

  setProgressCallback(callback: (progress: AgentInstallProgress) => void) {
    this.progressCallback = callback;
  }

  // Protected helper methods
  protected async fetchWithFallback(url: string, options?: RequestInit): Promise<Response> {
    // TODO: In the future, we could add fallback URLs here for reliability
    // For now, just fetch from the primary URL
    try {
      console.log(`[${this.agentType}Service] Fetching from: ${url}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      }) as unknown as Response;
      
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`[${this.agentType}Service] Successfully fetched from: ${url}`);
      return response;
    } catch (error) {
      console.error(`[${this.agentType}Service] Failed to fetch from ${url}:`, error);
      throw new Error(
        `Failed to fetch from GitHub. ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  protected reportProgress(progress: AgentInstallProgress) {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }

  protected compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      if (part1 < part2) return -1;
      if (part1 > part2) return 1;
    }
    return 0;
  }

  protected extractChecksumFromRelease(release: GitHubRelease): string | undefined {
    // Common patterns for checksums in release notes
    const patterns = [
      /SHA256:\s*([a-f0-9]{64})/i,
      /sha256:\s*([a-f0-9]{64})/i,
      /([a-f0-9]{64})\s+\w+/,
    ];

    if (release.body) {
      for (const pattern of patterns) {
        const match = release.body.match(pattern);
        if (match) return match[1];
      }
    }

    return undefined;
  }

  protected async downloadFile(
    url: string,
    destination: string,
    onProgress?: (progress: number) => void,
  ): Promise<void> {
    console.log(`[${this.agentType}Service] Starting download from:`, url);
    console.log(`[${this.agentType}Service] Downloading to:`, destination);
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const totalSize = parseInt(response.headers.get('content-length') || '0');
    console.log(`[${this.agentType}Service] Total file size:`, totalSize, 'bytes');
    
    let downloadedSize = 0;

    const fileStream = await fs.open(destination, 'w');
    const writer = fileStream.createWriteStream();

    if (response.body) {
      for await (const chunk of response.body) {
        writer.write(chunk);
        downloadedSize += chunk.length;
        if (onProgress && totalSize > 0) {
          onProgress(downloadedSize / totalSize);
        }
      }
    }

    writer.end();
    await fileStream.close();
    
    console.log(`[${this.agentType}Service] Download completed, downloaded:`, downloadedSize, 'bytes');
  }

  protected async calculateChecksum(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const stream = await fs.readFile(filePath);
    hash.update(stream);
    return hash.digest('hex');
  }

  protected async ensureInPath(binPath: string): Promise<void> {
    const homeDir = os.homedir();
    const shellConfigs = [
      path.join(homeDir, '.zshrc'),
      path.join(homeDir, '.bashrc'),
      path.join(homeDir, '.profile'),
    ];

    const exportLine = `export PATH="${binPath}:$PATH"`;
    const comment = `# Added by Principle AI for ${this.binaryName}`;

    let updated = false;
    for (const shellConfig of shellConfigs) {
      try {
        const content = await fs.readFile(shellConfig, 'utf-8');
        if (!content.includes(binPath)) {
          await fs.appendFile(shellConfig, `\n${comment}\n${exportLine}\n`);
          updated = true;
          break;
        } else {
          updated = true;
          break;
        }
      } catch {
        // File doesn't exist, try next
      }
    }

    if (!updated) {
      await fs.writeFile(shellConfigs[2], `${comment}\n${exportLine}\n`);
    }
  }

  protected async cleanShellConfigs(): Promise<void> {
    const homeDir = os.homedir();
    const shellConfigs = [
      path.join(homeDir, '.zshrc'),
      path.join(homeDir, '.bashrc'),
      path.join(homeDir, '.profile'),
    ];
    const comment = `# Added by Principle AI for ${this.binaryName}`;
    const exportLineContent = `export PATH="${this.binPath}:$PATH"`;

    for (const shellConfig of shellConfigs) {
      try {
        const content = await fs.readFile(shellConfig, 'utf-8');
        const lines = content.split('\n');
        const newLines = lines.filter(
          (line) =>
            line.trim() !== comment &&
            line.trim() !== exportLineContent &&
            !line.includes(this.binaryName),
        );

        // Remove consecutive empty lines
        for (let i = newLines.length - 2; i > 0; i--) {
          if (newLines[i].trim() === '' && newLines[i + 1].trim() === '') {
            newLines.splice(i, 1);
          }
        }

        const newContent = newLines.join('\n');

        if (content !== newContent) {
          await fs.writeFile(shellConfig, newContent.trim() + '\n');
        }
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
          console.warn(`Could not clean up ${shellConfig}:`, error);
        }
      }
    }
  }
}