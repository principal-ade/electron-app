import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Configuration for the global skills Git repository
 */
export interface SkillsRepoConfig {
  enabled: boolean;
  repoUrl: string;
  branch: string;
  localPath: string;
  lastSyncedAt?: string;
  autoSyncInterval?: number; // Minutes (0 = manual only)
  syncOnStartup?: boolean;
  credentialProvider?: 'system' | 'oauth';
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: SkillsRepoConfig = {
  enabled: false,
  repoUrl: '',
  branch: 'main',
  localPath: '', // Will be set to userData/agent-skills/repo
  autoSyncInterval: 0,
  syncOnStartup: false,
  credentialProvider: 'system',
};

/**
 * Service for managing skills repository configuration
 * Handles reading/writing ~/.config/agent-skills/config.json
 */
export class SkillsConfigService {
  private configPath: string;
  private config: SkillsRepoConfig | null = null;

  constructor() {
    // Use Electron's userData path for cross-platform compatibility
    const userDataPath = app.getPath('userData');
    const configDir = path.join(userDataPath, 'agent-skills');
    this.configPath = path.join(configDir, 'config.json');
  }

  /**
   * Initialize the service and ensure config directory exists
   */
  async initialize(): Promise<void> {
    const configDir = path.dirname(this.configPath);

    try {
      await fs.mkdir(configDir, { recursive: true });
      console.log(`[SkillsConfig] Config directory initialized: ${configDir}`);
    } catch (error) {
      console.error('[SkillsConfig] Failed to create config directory:', error);
      throw error;
    }
  }

  /**
   * Get the current configuration
   * Loads from disk if not already cached
   */
  async getConfig(): Promise<SkillsRepoConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(data);

      // Set default localPath if not specified
      if (!this.config!.localPath) {
        const userDataPath = app.getPath('userData');
        this.config!.localPath = path.join(userDataPath, 'agent-skills', 'repo');
      }

      console.log('[SkillsConfig] Loaded config from disk');
      return this.config!;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Config file doesn't exist, return defaults
        console.log('[SkillsConfig] No config file found, using defaults');
        const userDataPath = app.getPath('userData');
        this.config = {
          ...DEFAULT_CONFIG,
          localPath: path.join(userDataPath, 'agent-skills', 'repo'),
        };
        return this.config;
      }

      console.error('[SkillsConfig] Failed to read config:', error);
      throw error;
    }
  }

  /**
   * Update the configuration
   * Merges with existing config and saves to disk
   */
  async updateConfig(updates: Partial<SkillsRepoConfig>): Promise<SkillsRepoConfig> {
    const currentConfig = await this.getConfig();
    this.config = { ...currentConfig, ...updates };

    try {
      await fs.writeFile(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf-8'
      );
      console.log('[SkillsConfig] Config saved to disk');
      return this.config;
    } catch (error) {
      console.error('[SkillsConfig] Failed to save config:', error);
      throw error;
    }
  }

  /**
   * Check if Git sync is enabled
   */
  async isEnabled(): Promise<boolean> {
    const config = await this.getConfig();
    return config.enabled && !!config.repoUrl;
  }

  /**
   * Get the local repository path
   */
  async getLocalPath(): Promise<string> {
    const config = await this.getConfig();
    return config.localPath;
  }

  /**
   * Update the last synced timestamp
   */
  async updateLastSynced(): Promise<void> {
    await this.updateConfig({
      lastSyncedAt: new Date().toISOString(),
    });
  }

  /**
   * Reset configuration to defaults
   */
  async resetConfig(): Promise<SkillsRepoConfig> {
    const userDataPath = app.getPath('userData');
    this.config = {
      ...DEFAULT_CONFIG,
      localPath: path.join(userDataPath, 'agent-skills', 'repo'),
    };

    try {
      await fs.writeFile(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf-8'
      );
      console.log('[SkillsConfig] Config reset to defaults');
      return this.config;
    } catch (error) {
      console.error('[SkillsConfig] Failed to reset config:', error);
      throw error;
    }
  }

  /**
   * Get the configuration file path
   */
  getConfigPath(): string {
    return this.configPath;
  }
}
