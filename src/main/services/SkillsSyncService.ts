import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { SkillsConfigService } from './SkillsConfigService';
import { SkillsGitService } from './SkillsGitService';
import type {
  SyncState,
  SkillSyncStatus,
  SkillMetadata,
  GlobalSkillDirectory,
} from '../../shared/main-process-api-interfaces/FileSystemAPI';
import { getManager as getRepositoryMonitoringManager } from '../repository-monitoring/ipcHandlers';
import type {
  WorkspaceChangeEventPayload,
  GitStatusWithFiles,
} from '@principal-ai/repository-monitoring-server';

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
 * Pending skill changes detected by file watching
 */
export interface PendingSkillChanges {
  directoryId: string;
  changes: Array<{
    path: string;
    type: 'added' | 'modified' | 'deleted';
  }>;
  lastDetected: Date;
}

/**
 * Callback to emit pending changes events to renderer
 */
export type PendingChangesEmitter = (
  directoryId: string,
  changes: PendingSkillChanges
) => void;

/**
 * Service for orchestrating skills synchronization
 * Manages sync state, change detection, and conflict resolution
 * Integrates with Repository Monitoring Server for file watching
 */
export class SkillsSyncService {
  private configService: SkillsConfigService;
  private gitService: SkillsGitService;
  private syncState: SyncState;
  private syncInterval: NodeJS.Timeout | null = null;

  // Repository monitoring integration
  private pendingChanges: Map<string, PendingSkillChanges> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private watchReferences: Map<string, string> = new Map(); // directoryId -> watchReferenceId
  private pendingChangesEmitter: PendingChangesEmitter | null = null;

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
   * Set the emitter for pending changes events
   * Called by IPC handler to enable event emission to renderer
   */
  setPendingChangesEmitter(emitter: PendingChangesEmitter): void {
    this.pendingChangesEmitter = emitter;
  }

  /**
   * Initialize the sync service
   * Ensures clone directories exist, then registers them with Repository Monitoring Server
   */
  async initialize(): Promise<void> {
    const config = await this.configService.getConfig();

    // Initialize git service
    await this.gitService.initialize();

    // Only proceed if sync is enabled and repo URL is configured
    if (!config.enabled || !config.repoUrl) {
      console.log('[SkillsSync] Sync not enabled or no repo URL configured, skipping initialization');
      return;
    }

    console.log('[SkillsSync] Ensuring clone directories exist...');

    // First, ensure all clone directories exist as git repositories
    for (const directory of config.directories) {
      if (directory.enabled && directory.localClonePath) {
        try {
          // Check if clone exists
          const isCloned = await this.gitService.isDirectoryRepositoryCloned(directory.id);

          if (!isCloned) {
            console.log(
              `[SkillsSync] Clone doesn't exist for ${directory.displayName}, creating initial clone...`
            );
            // Perform initial clone without copying to target directory
            await this.gitService.ensureCloneExists(directory.id);
          } else {
            console.log(
              `[SkillsSync] Clone already exists for ${directory.displayName}`
            );
          }
        } catch (error) {
          console.error(
            `[SkillsSync] Failed to ensure clone exists for ${directory.displayName}:`,
            error
          );
          // Continue with other directories
          continue;
        }
      }
    }

    console.log('[SkillsSync] Registering clone directories with Repository Monitoring...');

    // Now register clone directories with Repository Monitoring Server
    const repoMonitoringManager = getRepositoryMonitoringManager();

    for (const directory of config.directories) {
      if (directory.enabled && directory.localClonePath) {
        try {
          console.log(
            `[SkillsSync] Registering clone directory: ${directory.localClonePath}`
          );

          // Register the repository
          await repoMonitoringManager.registerRepository(directory.localClonePath);

          // Acquire a watch reference
          const watchRef = `skills-sync-${directory.id}`;
          await repoMonitoringManager.acquireWatch(directory.localClonePath, watchRef);

          // Store the watch reference for cleanup
          this.watchReferences.set(directory.id, watchRef);

          console.log(
            `[SkillsSync] Successfully registered ${directory.displayName} for monitoring`
          );
        } catch (error) {
          console.error(
            `[SkillsSync] Failed to register ${directory.displayName} for monitoring:`,
            error
          );
        }
      }
    }

    // Set up event listeners for file changes
    this.setupRepositoryMonitoringListeners();

    // Note: We no longer start automatic periodic sync
    // All syncing is now user-confirmed via pending changes UI
    console.log('[SkillsSync] Initialized with file watching (no auto-sync)');
  }

  /**
   * Set up event listeners for Repository Monitoring events
   * Listens for file changes and git status changes in clone directories
   */
  private setupRepositoryMonitoringListeners(): void {
    const repoMonitoringManager = getRepositoryMonitoringManager();

    // Listen for workspace changes (file add/change/delete)
    repoMonitoringManager.on('workspace-changed', (payload: WorkspaceChangeEventPayload) => {
      if (payload.changes) {
        this.handleCloneChange(payload.repoPath, payload.changes);
      }
    });

    // Listen for git status changes (commits, branch switches)
    repoMonitoringManager.on('git-status-changed', (payload: GitStatusWithFiles) => {
      this.handleGitStatusChange(payload.repoPath, payload);
    });

    console.log('[SkillsSync] Repository monitoring event listeners registered');
  }

  /**
   * Handle file changes detected in a clone directory
   * Accumulates changes as "pending" for user review
   */
  private async handleCloneChange(
    clonePath: string,
    changes: Array<{ path: string; type: string }>
  ): Promise<void> {
    // Find the directory that owns this clone
    const config = await this.configService.getConfig();
    const directory = config.directories.find(
      (d: GlobalSkillDirectory) => d.localClonePath === clonePath
    );

    if (!directory || !directory.enabled) {
      return;
    }

    console.log(`[SkillsSync] File changes detected in ${directory.displayName}:`, changes);

    // Filter to only skill files (*.md)
    const skillChanges = changes.filter((change) => {
      const fileName = path.basename(change.path);
      return fileName.endsWith('.md');
    });

    if (skillChanges.length === 0) {
      console.log('[SkillsSync] No skill file changes detected, ignoring');
      return;
    }

    // Debounce rapid changes (batch within 1 second)
    clearTimeout(this.debounceTimers.get(directory.id));

    this.debounceTimers.set(
      directory.id,
      setTimeout(async () => {
        // Store pending changes for UI
        const pendingChange: PendingSkillChanges = {
          directoryId: directory.id,
          changes: skillChanges.map((c) => ({
            path: c.path,
            type: c.type as 'added' | 'modified' | 'deleted',
          })),
          lastDetected: new Date(),
        };

        this.pendingChanges.set(directory.id, pendingChange);

        console.log(
          `[SkillsSync] Stored ${skillChanges.length} pending changes for ${directory.displayName}`
        );

        // Emit event to UI to notify user of pending changes
        if (this.pendingChangesEmitter) {
          this.pendingChangesEmitter(directory.id, pendingChange);
        }
      }, 1000)
    );
  }

  /**
   * Handle git status changes in a clone directory
   * This is triggered when commits, branch switches, etc. occur
   */
  private async handleGitStatusChange(
    clonePath: string,
    status: GitStatusWithFiles
  ): Promise<void> {
    // Find the directory
    const config = await this.configService.getConfig();
    const directory = config.directories.find(
      (d: GlobalSkillDirectory) => d.localClonePath === clonePath
    );

    if (!directory || !directory.enabled) {
      return;
    }

    // Log git status for debugging
    console.log(`[SkillsSync] Git status changed in ${directory.displayName}:`, {
      branch: status.branch,
      ahead: status.ahead,
      behind: status.behind,
      isDirty: status.isDirty,
    });

    // Note: We don't auto-sync here
    // User will manually trigger sync via the pending changes UI
  }

  /**
   * Cleanup on shutdown
   * Releases all watch references and clears timers
   */
  async cleanup(): Promise<void> {
    console.log('[SkillsSync] Cleaning up...');

    const repoMonitoringManager = getRepositoryMonitoringManager();
    const config = await this.configService.getConfig();

    // Release all watch references
    for (const directory of config.directories) {
      if (directory.localClonePath) {
        const watchRef = this.watchReferences.get(directory.id);
        if (watchRef) {
          try {
            await repoMonitoringManager.releaseWatch(directory.localClonePath, watchRef);
            console.log(`[SkillsSync] Released watch for ${directory.displayName}`);
          } catch (error) {
            console.error(
              `[SkillsSync] Failed to release watch for ${directory.displayName}:`,
              error
            );
          }
        }

        // Optionally unregister (if no other watchers)
        try {
          await repoMonitoringManager.unregisterRepository(directory.localClonePath);
        } catch (error) {
          // Ignore errors - other watchers might still be using it
        }
      }
    }

    // Clear debounce timers
    this.debounceTimers.forEach((timer) => clearTimeout(timer));
    this.debounceTimers.clear();

    // Clear watch references
    this.watchReferences.clear();

    // Clear pending changes
    this.pendingChanges.clear();

    console.log('[SkillsSync] Cleanup complete');
  }

  /**
   * Get pending changes for UI display
   */
  getPendingChanges(): Map<string, PendingSkillChanges> {
    return new Map(this.pendingChanges);
  }

  /**
   * Clear pending changes for a specific directory
   * Called after user confirms sync
   */
  clearPendingChanges(directoryId: string): void {
    this.pendingChanges.delete(directoryId);
    console.log(`[SkillsSync] Cleared pending changes for directory: ${directoryId}`);
  }

  /**
   * Clear all pending changes
   */
  clearAllPendingChanges(): void {
    this.pendingChanges.clear();
    console.log('[SkillsSync] Cleared all pending changes');
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
