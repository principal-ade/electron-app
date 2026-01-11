import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { SkillsConfigService } from './SkillsConfigService';
import { SkillsGitService } from './SkillsGitService';
import type {
  SyncState,
  SkillSyncStatus,
  SkillMetadata,
} from '../../shared/main-process-api-interfaces/FileSystemAPI';

/**
 * Result of detecting changes for a skill
 */
export interface ChangeDetectionResult {
  hasChanges: boolean;
  localSha: string | null;
  remoteSha: string | null;
  needsSync: boolean;
  hasLocalModifications: boolean;
}

/**
 * Service for orchestrating skills synchronization
 * Manages sync state, change detection, and conflict resolution
 */
export class SkillsSyncService {
  private configService: SkillsConfigService;
  private gitService: SkillsGitService;
  private syncState: SyncState;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(configService: SkillsConfigService, gitService: SkillsGitService) {
    this.configService = configService;
    this.gitService = gitService;
    this.syncState = {
      isSyncing: false,
      changedSkills: [],
      conflictingSkills: [],
    };
  }

  /**
   * Initialize the sync service
   * Sets up periodic sync if configured
   */
  async initialize(): Promise<void> {
    const config = await this.configService.getConfig();

    // Initialize git service
    await this.gitService.initialize();

    // Set up periodic sync if enabled
    if (config.autoSyncInterval && config.autoSyncInterval > 0) {
      this.startPeriodicSync(config.autoSyncInterval);
    }

    // Sync on startup if enabled
    if (config.syncOnStartup) {
      setTimeout(() => this.sync().catch(console.error), 5000); // 5s delay
    }
  }

  /**
   * Start periodic synchronization
   */
  private startPeriodicSync(intervalMinutes: number): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`[SkillsSync] Starting periodic sync every ${intervalMinutes} minutes`);

    this.syncInterval = setInterval(() => {
      this.sync().catch((error) => {
        console.error('[SkillsSync] Periodic sync failed:', error);
      });
    }, intervalMs);
  }

  /**
   * Stop periodic synchronization
   */
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('[SkillsSync] Stopped periodic sync');
    }
  }

  /**
   * Main sync operation
   * Fetches updates and syncs to global directories
   */
  async sync(): Promise<boolean> {
    if (this.syncState.isSyncing) {
      console.log('[SkillsSync] Sync already in progress');
      return false;
    }

    try {
      this.syncState.isSyncing = true;
      this.syncState.lastSyncAttempt = new Date().toISOString();

      console.log('[SkillsSync] Starting sync...');

      // Fetch updates from remote
      const fetchResult = await this.gitService.fetchUpdates();

      if (fetchResult.hasUpdates) {
        console.log(`[SkillsSync] ${fetchResult.changedPaths.length} files changed remotely`);

        // Pull changes
        const pullSuccess = await this.gitService.pullChanges();
        if (!pullSuccess) {
          throw new Error('Failed to pull changes');
        }

        // Sync to global directories
        const syncSuccess = await this.gitService.syncToGlobalDirectories();
        if (!syncSuccess) {
          throw new Error('Failed to sync to global directories');
        }

        // Update changed skills list
        this.syncState.changedSkills = await this.getChangedSkillsFromPaths(
          fetchResult.changedPaths
        );

        console.log('[SkillsSync] Sync completed successfully');
      } else {
        console.log('[SkillsSync] No updates available');
      }

      this.syncState.lastSyncSuccess = new Date().toISOString();
      this.syncState.lastError = undefined;
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[SkillsSync] Sync failed:', errorMsg);
      this.syncState.lastError = errorMsg;
      return false;
    } finally {
      this.syncState.isSyncing = false;
    }
  }

  /**
   * Get current sync state
   */
  getSyncState(): SyncState {
    return { ...this.syncState };
  }

  /**
   * Detect changes for a specific skill
   */
  async detectChanges(
    skillPath: string,
    metadata: SkillMetadata
  ): Promise<ChangeDetectionResult> {
    try {
      // Get current local SHA (file hash)
      const localSha = await this.calculateFileHash(skillPath);

      // Get the SHA from metadata (last synced)
      const lastSyncedSha = metadata.lastSyncedSha || null;

      // Get current remote SHA from git
      const remoteSha = await this.gitService.getCurrentCommitSha();

      // Determine if there are local modifications
      const hasLocalModifications = localSha !== lastSyncedSha;

      // Determine if remote has changed
      const remoteHasChanged = remoteSha !== lastSyncedSha;

      return {
        hasChanges: remoteHasChanged,
        localSha,
        remoteSha,
        needsSync: remoteHasChanged && !hasLocalModifications,
        hasLocalModifications,
      };
    } catch (error) {
      console.error('[SkillsSync] Error detecting changes:', error);
      return {
        hasChanges: false,
        localSha: null,
        remoteSha: null,
        needsSync: false,
        hasLocalModifications: false,
      };
    }
  }

  /**
   * Get sync status for a skill
   */
  async getSkillSyncStatus(
    skillPath: string,
    metadata?: SkillMetadata
  ): Promise<SkillSyncStatus> {
    // If no metadata or sync not enabled, return disabled
    if (!metadata || !metadata.syncEnabled) {
      return 'disabled';
    }

    try {
      const changes = await this.detectChanges(skillPath, metadata);

      if (changes.hasLocalModifications && changes.hasChanges) {
        return 'conflict';
      }

      if (changes.hasChanges) {
        return 'update-available';
      }

      if (changes.hasLocalModifications) {
        return 'modified';
      }

      return 'synced';
    } catch (error) {
      console.error('[SkillsSync] Error getting skill sync status:', error);
      return 'disabled';
    }
  }

  /**
   * Sync a specific project skill from global source
   */
  async syncProjectSkill(
    projectSkillPath: string,
    globalSkillPath: string,
    metadata: SkillMetadata
  ): Promise<boolean> {
    try {
      console.log(`[SkillsSync] Syncing skill from ${globalSkillPath} to ${projectSkillPath}`);

      // Check for conflicts
      const changes = await this.detectChanges(projectSkillPath, metadata);

      if (changes.hasLocalModifications && changes.hasChanges) {
        console.log('[SkillsSync] Conflict detected, applying resolution strategy');

        // Apply conflict resolution strategy
        const strategy = metadata.conflictResolution || 'prompt';

        if (strategy === 'preserve-local') {
          console.log('[SkillsSync] Preserving local changes');
          return false;
        }

        if (strategy === 'prompt') {
          // Add to conflicting skills list for UI handling
          const skillName = path.basename(projectSkillPath);
          if (!this.syncState.conflictingSkills.includes(skillName)) {
            this.syncState.conflictingSkills.push(skillName);
          }
          return false;
        }

        // strategy === 'overwrite' - continue with sync
      }

      // Copy files from global to project
      await this.copySkillDirectory(globalSkillPath, projectSkillPath);

      // Update metadata
      const newSha = await this.gitService.getCurrentCommitSha();
      const updatedMetadata: SkillMetadata = {
        ...metadata,
        lastSyncedAt: new Date().toISOString(),
        lastSyncedSha: newSha || undefined,
      };

      await this.writeSkillMetadata(projectSkillPath, updatedMetadata);

      console.log('[SkillsSync] Skill synced successfully');
      return true;
    } catch (error) {
      console.error('[SkillsSync] Error syncing project skill:', error);
      return false;
    }
  }

  /**
   * Resolve a conflict for a skill
   */
  async resolveConflict(
    skillPath: string,
    resolution: 'keep-local' | 'use-remote'
  ): Promise<boolean> {
    try {
      const skillName = path.basename(skillPath);

      if (resolution === 'keep-local') {
        // Remove from conflicting list
        this.syncState.conflictingSkills = this.syncState.conflictingSkills.filter(
          (s) => s !== skillName
        );
        return true;
      }

      if (resolution === 'use-remote') {
        // Find the global source path
        const metadata = await this.readSkillMetadata(skillPath);
        if (!metadata || !metadata.syncSource) {
          return false;
        }

        const globalPath = await this.getGlobalSkillPath(skillName, metadata.syncSource);
        if (!globalPath) {
          return false;
        }

        // Sync from global
        const success = await this.syncProjectSkill(skillPath, globalPath, metadata);

        if (success) {
          // Remove from conflicting list
          this.syncState.conflictingSkills = this.syncState.conflictingSkills.filter(
            (s) => s !== skillName
          );
        }

        return success;
      }

      return false;
    } catch (error) {
      console.error('[SkillsSync] Error resolving conflict:', error);
      return false;
    }
  }

  /**
   * Enable sync for a project skill
   */
  async enableSkillSync(
    skillPath: string,
    syncSource: 'git-global' | 'github'
  ): Promise<boolean> {
    try {
      const metadata = await this.readSkillMetadata(skillPath);
      const currentSha = await this.gitService.getCurrentCommitSha();

      const updatedMetadata: SkillMetadata = {
        ...metadata,
        syncEnabled: true,
        syncSource,
        lastSyncedAt: new Date().toISOString(),
        lastSyncedSha: currentSha || undefined,
        syncStrategy: 'auto',
        conflictResolution: 'prompt',
      };

      await this.writeSkillMetadata(skillPath, updatedMetadata);
      console.log(`[SkillsSync] Enabled sync for skill at ${skillPath}`);
      return true;
    } catch (error) {
      console.error('[SkillsSync] Error enabling skill sync:', error);
      return false;
    }
  }

  /**
   * Disable sync for a project skill
   */
  async disableSkillSync(skillPath: string): Promise<boolean> {
    try {
      const metadata = await this.readSkillMetadata(skillPath);

      const updatedMetadata: SkillMetadata = {
        ...metadata,
        syncEnabled: false,
      };

      await this.writeSkillMetadata(skillPath, updatedMetadata);
      console.log(`[SkillsSync] Disabled sync for skill at ${skillPath}`);
      return true;
    } catch (error) {
      console.error('[SkillsSync] Error disabling skill sync:', error);
      return false;
    }
  }

  // --- Helper Methods ---

  /**
   * Calculate SHA-256 hash of a file
   */
  private async calculateFileHash(filePath: string): Promise<string | null> {
    try {
      const content = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract skill names from changed file paths
   */
  private async getChangedSkillsFromPaths(paths: string[]): Promise<string[]> {
    const skillDirs = new Set<string>();

    for (const filePath of paths) {
      // Skills are typically in format: skill-name/SKILL.md or skill-name/scripts/...
      const parts = filePath.split('/');
      if (parts.length > 0) {
        skillDirs.add(parts[0]);
      }
    }

    return Array.from(skillDirs);
  }

  /**
   * Copy skill directory recursively
   */
  private async copySkillDirectory(source: string, target: string): Promise<void> {
    await fs.mkdir(target, { recursive: true });

    const entries = await fs.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const targetPath = path.join(target, entry.name);

      if (entry.isDirectory()) {
        await this.copySkillDirectory(sourcePath, targetPath);
      } else {
        await fs.copyFile(sourcePath, targetPath);
      }
    }
  }

  /**
   * Read skill metadata from .metadata.json
   */
  private async readSkillMetadata(skillPath: string): Promise<SkillMetadata> {
    try {
      const metadataPath = path.join(skillPath, '.metadata.json');
      const content = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      // Return empty metadata if file doesn't exist
      return {};
    }
  }

  /**
   * Write skill metadata to .metadata.json
   */
  private async writeSkillMetadata(
    skillPath: string,
    metadata: SkillMetadata
  ): Promise<void> {
    const metadataPath = path.join(skillPath, '.metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
  }

  /**
   * Get the global path for a skill
   */
  private async getGlobalSkillPath(
    skillName: string,
    source: 'git-global' | 'github'
  ): Promise<string | null> {
    const home = process.env.HOME || process.env.USERPROFILE;
    if (!home) {
      return null;
    }

    // For now, check both .agent and .claude directories
    const globalDirs = [
      path.join(home, '.agent', 'skills'),
      path.join(home, '.claude', 'skills'),
    ];

    for (const dir of globalDirs) {
      const skillPath = path.join(dir, skillName);
      try {
        await fs.access(skillPath);
        return skillPath;
      } catch {
        continue;
      }
    }

    return null;
  }
}
