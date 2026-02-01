import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { SkillsRepoConfig, GlobalSkillDirectory } from '../../shared/main-process-api-interfaces/FileSystemAPI';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: SkillsRepoConfig = {
  version: 1,
  enabled: false,
  repoUrl: '',
  branch: 'main',
  autoSyncInterval: 0,
  syncOnStartup: false,
  credentialProvider: 'system',
  directories: [],
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
      this.config = JSON.parse(data) as SkillsRepoConfig;

      // Migration: Convert old single-directory config to new format
      if (!this.config.version || this.config.version < 1) {
        console.log('[SkillsConfig] Migrating config from version 0 to version 1');
        const homeDir = app.getPath('home');
        const userDataPath = app.getPath('userData');

        // If old config had sync enabled, create directory entries
        if (this.config.enabled && this.config.localPath) {
          this.config.directories = [
            {
              id: randomUUID(),
              path: path.join(homeDir, '.agents', 'skills'),
              displayName: 'Agent Skills',
              enabled: true,
              isCustom: false,
              localClonePath: path.join(userDataPath, 'agent-skills', 'clones', 'agent'),
              lastSyncedAt: this.config.lastSyncedAt,
            },
            {
              id: randomUUID(),
              path: path.join(homeDir, '.claude', 'skills'),
              displayName: 'Claude Skills',
              enabled: true,
              isCustom: false,
              localClonePath: path.join(userDataPath, 'agent-skills', 'clones', 'claude'),
            },
          ];
        } else {
          this.config.directories = [];
        }

        // Remove old localPath field
        delete this.config.localPath;
        this.config.version = 1;

        // Save migrated config
        await this.updateConfig(this.config);
        console.log('[SkillsConfig] Migration completed');
      }

      // De-duplicate directories by path
      if (this.config.directories && this.config.directories.length > 0) {
        const uniqueDirs: GlobalSkillDirectory[] = [];
        const seenPaths = new Set<string>();

        for (const dir of this.config.directories) {
          if (!seenPaths.has(dir.path)) {
            seenPaths.add(dir.path);
            uniqueDirs.push(dir);
          } else {
            console.log(`[SkillsConfig] Removing duplicate directory: ${dir.path}`);
          }
        }

        if (uniqueDirs.length !== this.config.directories.length) {
          this.config.directories = uniqueDirs;
          await this.updateConfig(this.config);
          console.log('[SkillsConfig] Cleaned up duplicate directories');
        }
      }

      console.log('[SkillsConfig] Loaded config from disk');
      return this.config;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Config file doesn't exist, return defaults
        console.log('[SkillsConfig] No config file found, using defaults');
        this.config = { ...DEFAULT_CONFIG };
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
   * Get the local repository path (backwards compatibility)
   * Returns localPath if set, otherwise returns first directory's clone path
   */
  async getLocalPath(): Promise<string> {
    const config = await this.getConfig();
    if (config.localPath) {
      return config.localPath;
    }
    // Fallback to first directory's clone path if localPath not set
    if (config.directories.length > 0) {
      return config.directories[0].localClonePath;
    }
    // Default fallback
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'agent-skills', 'repo');
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
    this.config = { ...DEFAULT_CONFIG };

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

  /**
   * Get a specific directory by ID
   */
  async getDirectory(id: string): Promise<GlobalSkillDirectory | null> {
    const config = await this.getConfig();
    return config.directories.find(d => d.id === id) || null;
  }

  /**
   * Add a new directory to the configuration
   */
  async addDirectory(directory: Omit<GlobalSkillDirectory, 'id' | 'localClonePath'>): Promise<GlobalSkillDirectory> {
    const config = await this.getConfig();

    // Check if directory with this path already exists
    const existingDir = config.directories.find(d => d.path === directory.path);
    if (existingDir) {
      console.log(`[SkillsConfig] Directory already exists: ${directory.path}`);
      return existingDir;
    }

    // Auto-generate localClonePath
    const userDataPath = app.getPath('userData');
    const cloneDirName = directory.displayName.toLowerCase().replace(/\s+/g, '-');
    const localClonePath = path.join(userDataPath, 'agent-skills', 'clones', cloneDirName);

    const newDir: GlobalSkillDirectory = {
      id: randomUUID(),
      localClonePath,
      ...directory,
    };

    config.directories.push(newDir);
    await this.updateConfig(config);

    console.log(`[SkillsConfig] Added directory: ${newDir.displayName}`);
    return newDir;
  }

  /**
   * Update an existing directory
   */
  async updateDirectory(id: string, updates: Partial<GlobalSkillDirectory>): Promise<GlobalSkillDirectory> {
    const config = await this.getConfig();
    const index = config.directories.findIndex(d => d.id === id);

    if (index === -1) {
      throw new Error(`Directory ${id} not found`);
    }

    config.directories[index] = { ...config.directories[index], ...updates };
    await this.updateConfig(config);

    console.log(`[SkillsConfig] Updated directory: ${config.directories[index].displayName}`);
    return config.directories[index];
  }

  /**
   * Remove a directory from the configuration
   */
  async removeDirectory(id: string): Promise<boolean> {
    const config = await this.getConfig();
    const initialLength = config.directories.length;
    config.directories = config.directories.filter(d => d.id !== id);

    if (config.directories.length < initialLength) {
      await this.updateConfig(config);
      console.log(`[SkillsConfig] Removed directory: ${id}`);
      return true;
    }

    return false;
  }

  /**
   * Get all enabled directories
   */
  async getEnabledDirectories(): Promise<GlobalSkillDirectory[]> {
    const config = await this.getConfig();
    return config.directories.filter(d => d.enabled);
  }
}
