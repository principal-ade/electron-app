import * as fs from 'fs/promises';
import * as path from 'path';
import { GitClientFactory } from '../utils/gitClientFactory';
import type { SkillsRepoConfig, GlobalSkillDirectory } from '../../shared/main-process-api-interfaces/FileSystemAPI';
import { SkillsConfigService } from './SkillsConfigService';

/**
 * Result of fetching updates from Git remote
 */
export interface FetchUpdatesResult {
  hasUpdates: boolean;
  changedPaths: string[];
  currentSha: string;
}

/**
 * Service for managing the global skills Git repository
 * Handles cloning, fetching, pulling, and change detection
 */
export class SkillsGitService {
  private configService: SkillsConfigService;

  constructor(configService: SkillsConfigService) {
    this.configService = configService;
  }

  /**
   * Initialize the service and clone repository if needed
   */
  async initialize(): Promise<void> {
    const config = await this.configService.getConfig();

    if (!config.enabled || !config.repoUrl) {
      console.log('[SkillsGit] Git sync is disabled or no repo URL configured');
      return;
    }

    const isCloned = await this.isRepositoryCloned();

    if (!isCloned) {
      console.log('[SkillsGit] Repository not found locally, cloning...');
      const success = await this.cloneRepository();
      if (!success) {
        throw new Error('Failed to clone skills repository');
      }
    } else {
      console.log('[SkillsGit] Repository already cloned');
    }
  }

  /**
   * Check if the repository is already cloned locally
   */
  async isRepositoryCloned(): Promise<boolean> {
    const localPath = await this.configService.getLocalPath();

    try {
      // Check if .git directory exists
      const gitDir = path.join(localPath, '.git');
      await fs.access(gitDir);

      // Verify it's a valid git repository
      return await GitClientFactory.isGitRepository(localPath);
    } catch {
      return false;
    }
  }

  /**
   * Clone the skills repository to the local path
   */
  async cloneRepository(): Promise<boolean> {
    const config = await this.configService.getConfig();

    if (!config.repoUrl) {
      console.error('[SkillsGit] No repository URL configured');
      return false;
    }

    const localPath = await this.configService.getLocalPath();

    try {
      // Ensure parent directory exists
      const parentDir = path.dirname(localPath);
      await fs.mkdir(parentDir, { recursive: true });

      console.log(`[SkillsGit] Cloning ${config.repoUrl} to ${localPath}`);

      // Get the Git executor
      const git = await GitClientFactory.getClient(localPath);

      // Clone with shallow depth for performance
      const success = await git.raw(['clone', '--depth', '1', '--branch', config.branch, config.repoUrl, localPath]);

      if (success !== undefined && success !== false) {
        console.log('[SkillsGit] Repository cloned successfully');
        await this.configService.updateLastSynced();
        return true;
      }

      console.error('[SkillsGit] Failed to clone repository');
      return false;
    } catch (error) {
      console.error('[SkillsGit] Error cloning repository:', error);
      return false;
    }
  }

  /**
   * Fetch updates from the remote repository
   * Returns information about changes without applying them
   */
  async fetchUpdates(): Promise<FetchUpdatesResult> {
    const config = await this.configService.getConfig();

    if (!await this.isRepositoryCloned()) {
      throw new Error('Repository not cloned');
    }

    try {
      const localPath = await this.configService.getLocalPath();

      // Get current commit SHA before fetching
      const beforeSha = await this.getCurrentCommitSha();

      // Fetch from remote
      console.log('[SkillsGit] Fetching updates from remote...');
      const git = await GitClientFactory.getClient(localPath);
      await git.raw(['fetch'], { cwd: localPath });

      // Get the remote SHA for the configured branch
      const remoteSha = await git.raw(
        ['rev-parse', `origin/${config.branch}`],
        { cwd: localPath }
      );

      const hasUpdates = beforeSha !== remoteSha.trim();

      if (hasUpdates) {
        // Get list of changed files
        const diffResult = await git.raw(
          ['diff', '--name-only', beforeSha, remoteSha.trim()],
          { cwd: localPath }
        );

        const changedPaths = diffResult.trim().split('\n').filter((p: string) => p.length > 0);
        console.log(`[SkillsGit] ${changedPaths.length} files changed`);

        return {
          hasUpdates: true,
          changedPaths,
          currentSha: remoteSha.trim(),
        };
      }

      console.log('[SkillsGit] No updates available');
      return {
        hasUpdates: false,
        changedPaths: [],
        currentSha: beforeSha || '',
      };
    } catch (error) {
      console.error('[SkillsGit] Error fetching updates:', error);
      throw error;
    }
  }

  /**
   * Pull changes from the remote repository
   * Applies updates to the local repository
   */
  async pullChanges(): Promise<boolean> {
    const config = await this.configService.getConfig();

    if (!await this.isRepositoryCloned()) {
      throw new Error('Repository not cloned');
    }

    try {
      const localPath = await this.configService.getLocalPath();
      console.log('[SkillsGit] Pulling changes from remote...');

      const git = await GitClientFactory.getClient(localPath);
      const result = await git.raw(['pull', 'origin', config.branch], { cwd: localPath });

      if (result !== undefined && result !== false) {
        console.log('[SkillsGit] Changes pulled successfully');
        await this.configService.updateLastSynced();
        return true;
      }

      console.error('[SkillsGit] Failed to pull changes');
      return false;
    } catch (error) {
      console.error('[SkillsGit] Error pulling changes:', error);
      return false;
    }
  }

  /**
   * Get the current commit SHA of the local repository
   */
  async getCurrentCommitSha(): Promise<string | null> {
    const config = await this.configService.getConfig();

    if (!await this.isRepositoryCloned()) {
      return null;
    }

    try {
      const localPath = await this.configService.getLocalPath();
      return await GitClientFactory.getCurrentCommit(localPath);
    } catch (error) {
      console.error('[SkillsGit] Error getting current commit:', error);
      return null;
    }
  }

  /**
   * Get list of changed skills since a specific commit SHA
   */
  async getChangedSkills(sinceSha: string): Promise<string[]> {
    const config = await this.configService.getConfig();

    if (!await this.isRepositoryCloned()) {
      return [];
    }

    try {
      const localPath = await this.configService.getLocalPath();
      const git = await GitClientFactory.getClient(localPath);

      const currentSha = await this.getCurrentCommitSha();
      if (!currentSha || currentSha === sinceSha) {
        return [];
      }

      // Get list of changed files
      const diffResult = await git.raw(
        ['diff', '--name-only', sinceSha, currentSha],
        { cwd: localPath }
      );

      const changedFiles = diffResult.trim().split('\n').filter((p: string) => p.length > 0);

      // Extract skill names (directories containing changed files)
      const skillDirs = new Set<string>();
      for (const file of changedFiles) {
        // Skills are typically in format: skill-name/SKILL.md or skill-name/scripts/...
        const parts = file.split('/');
        if (parts.length > 0) {
          skillDirs.add(parts[0]);
        }
      }

      return Array.from(skillDirs);
    } catch (error) {
      console.error('[SkillsGit] Error getting changed skills:', error);
      return [];
    }
  }

  /**
   * Check if Git is available and authentication works
   */
  async isAuthenticated(): Promise<boolean> {
    const config = await this.configService.getConfig();

    if (!config.repoUrl) {
      return false;
    }

    try {
      // Try to fetch (ls-remote) without cloning
      const git = await GitClientFactory.getClient('.');
      const result = await git.raw(['ls-remote', config.repoUrl]);

      return result !== undefined && result !== false;
    } catch (error) {
      console.error('[SkillsGit] Authentication check failed:', error);
      return false;
    }
  }

  /**
   * Sync the repository to all enabled global skills directories
   * Each directory gets its own clone and syncs independently
   */
  async syncToGlobalDirectories(): Promise<boolean> {
    try {
      const enabledDirs = await this.configService.getEnabledDirectories();

      if (enabledDirs.length === 0) {
        console.log('[SkillsGit] No directories enabled for syncing');
        return true;
      }

      console.log(`[SkillsGit] Syncing to ${enabledDirs.length} directories...`);

      for (const directory of enabledDirs) {
        await this.syncSingleDirectory(directory);
      }

      console.log('[SkillsGit] Sync to all global directories completed');
      return true;
    } catch (error) {
      console.error('[SkillsGit] Error syncing directories:', error);
      return false;
    }
  }

  /**
   * Sync a single directory
   * Clones if needed, pulls latest changes, and copies to target directory
   */
  async syncSingleDirectory(directory: GlobalSkillDirectory): Promise<boolean> {
    try {
      const config = await this.configService.getConfig();

      console.log(`[SkillsGit] Syncing ${directory.displayName}...`);

      // Ensure directory's git repo is cloned
      if (!await this.isDirectoryRepositoryCloned(directory.id)) {
        console.log(`[SkillsGit] Cloning repository for ${directory.displayName}...`);
        await this.cloneDirectoryRepository(directory, config);
      }

      // Pull latest changes
      await this.pullDirectoryChanges(directory, config);

      // Copy from clone to actual directory
      await this.copyDirectoryFiles(directory);

      // Update last sync timestamp
      await this.configService.updateDirectory(directory.id, {
        lastSyncedAt: new Date().toISOString(),
      });

      console.log(`[SkillsGit] Successfully synced ${directory.displayName}`);
      return true;
    } catch (error) {
      console.error(`[SkillsGit] Error syncing ${directory.displayName}:`, error);
      return false;
    }
  }

  /**
   * Check if a directory's repository is cloned
   * Public method for use by SkillsSyncService
   */
  async isDirectoryRepositoryCloned(directoryId: string): Promise<boolean> {
    const config = await this.configService.getConfig();
    const directory = config.directories.find((d) => d.id === directoryId);

    if (!directory || !directory.localClonePath) return false;

    try {
      await fs.access(path.join(directory.localClonePath, '.git'));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure a clone exists for a specific directory
   * Public method for use by SkillsSyncService initialization
   */
  async ensureCloneExists(directoryId: string): Promise<void> {
    const config = await this.configService.getConfig();
    const directory = config.directories.find((d) => d.id === directoryId);

    if (!directory) {
      throw new Error(`Directory not found: ${directoryId}`);
    }

    if (!directory.localClonePath) {
      throw new Error(`No local clone path configured for ${directory.displayName}`);
    }

    // Clone the repository
    await this.cloneDirectoryRepository(directory, config);
  }

  /**
   * Get status information for a directory
   * Checks if target and clone directories exist and are git repos
   */
  async getDirectoryStatus(directoryId: string): Promise<{
    targetExists: boolean;
    targetIsGit: boolean;
    cloneExists: boolean;
    cloneIsGit: boolean;
  }> {
    const config = await this.configService.getConfig();
    const directory = config.directories.find((d) => d.id === directoryId);

    const status = {
      targetExists: false,
      targetIsGit: false,
      cloneExists: false,
      cloneIsGit: false,
    };

    if (!directory) {
      return status;
    }

    // Check target directory
    try {
      await fs.access(directory.path);
      status.targetExists = true;

      // Check if target is a git repo
      try {
        await fs.access(path.join(directory.path, '.git'));
        status.targetIsGit = await GitClientFactory.isGitRepository(directory.path);
      } catch {
        status.targetIsGit = false;
      }
    } catch {
      status.targetExists = false;
    }

    // Check clone directory
    if (directory.localClonePath) {
      try {
        await fs.access(directory.localClonePath);
        status.cloneExists = true;

        // Check if clone is a git repo
        try {
          await fs.access(path.join(directory.localClonePath, '.git'));
          status.cloneIsGit = await GitClientFactory.isGitRepository(directory.localClonePath);
        } catch {
          status.cloneIsGit = false;
        }
      } catch {
        status.cloneExists = false;
      }
    }

    return status;
  }

  /**
   * Clone the repository for a specific directory
   */
  private async cloneDirectoryRepository(directory: GlobalSkillDirectory, config: SkillsRepoConfig): Promise<void> {
    const gitClient = await GitClientFactory.getClient(directory.localClonePath);

    // Ensure parent directory exists
    await fs.mkdir(directory.localClonePath, { recursive: true });

    console.log(`[SkillsGit] Cloning ${config.repoUrl} to ${directory.localClonePath}`);

    await gitClient.raw([
      'clone',
      '--depth', '1',
      '--branch', config.branch,
      config.repoUrl,
      directory.localClonePath
    ]);
  }

  /**
   * Pull latest changes for a directory's repository
   */
  private async pullDirectoryChanges(directory: GlobalSkillDirectory, config: SkillsRepoConfig): Promise<void> {
    const gitClient = await GitClientFactory.getClient(directory.localClonePath);

    console.log(`[SkillsGit] Pulling latest changes for ${directory.displayName}`);

    await gitClient.raw(['pull', 'origin', config.branch], {
      cwd: directory.localClonePath,
    });
  }

  /**
   * Copy files from directory's clone to the actual target directory
   */
  private async copyDirectoryFiles(directory: GlobalSkillDirectory): Promise<void> {
    // Ensure target directory exists
    await fs.mkdir(directory.path, { recursive: true });

    console.log(`[SkillsGit] Copying skills from ${directory.localClonePath} to ${directory.path}`);

    // Read skills from clone
    const cloneContents = await fs.readdir(directory.localClonePath);

    for (const item of cloneContents) {
      // Skip .git directory and hidden files
      if (item === '.git' || item.startsWith('.')) {
        continue;
      }

      const sourcePath = path.join(directory.localClonePath, item);
      const targetPath = path.join(directory.path, item);

      const stat = await fs.stat(sourcePath);
      if (stat.isDirectory()) {
        await this.copyDirectory(sourcePath, targetPath);
        console.log(`[SkillsGit] Copied ${item} to ${directory.path}`);
      }
    }
  }

  /**
   * Initialize a new Git repository at the local path
   * Used during onboarding to create a fresh skills repository
   */
  async initializeRepository(): Promise<boolean> {
    const config = await this.configService.getConfig();

    try {
      const localPath = await this.configService.getLocalPath();
      console.log(`[SkillsGit] Initializing repository at ${localPath}`);

      // Ensure directory exists
      await fs.mkdir(localPath, { recursive: true });

      // Initialize git repository
      const git = await GitClientFactory.getClient(localPath);
      await git.raw(['init'], { cwd: localPath });

      // Create initial README
      const readmePath = path.join(localPath, 'README.md');
      const readmeContent = `# Agent Skills Repository

This repository contains your agent skills, synced across all your projects.

## Structure

Each skill is stored in its own directory with the following structure:

\`\`\`
skill-name/
  SKILL.md           # Main skill definition
  .metadata.json     # Installation and sync metadata
  scripts/           # Executable scripts (optional)
  references/        # Reference documentation (optional)
  assets/            # Supporting files (optional)
\`\`\`

## Syncing

This repository is automatically synced to:
- \`~/.agents/skills/\` - Universal agent skills
- \`~/.claude/skills/\` - Claude-specific skills

Skills copied to project directories can optionally auto-sync from this repository.
`;

      await fs.writeFile(readmePath, readmeContent, 'utf-8');

      // Create initial commit
      await git.raw(['add', '.'], { cwd: localPath });
      await git.raw(['commit', '-m', 'Initial commit: Initialize skills repository'], { cwd: localPath });

      console.log('[SkillsGit] Repository initialized successfully');
      return true;
    } catch (error) {
      console.error('[SkillsGit] Error initializing repository:', error);
      return false;
    }
  }

  /**
   * Add and commit skills to the repository
   * Used during migration to commit all skills at once
   */
  async commitSkills(message: string = 'Add migrated skills'): Promise<boolean> {
    const config = await this.configService.getConfig();

    try {
      const localPath = await this.configService.getLocalPath();
      const git = await GitClientFactory.getClient(localPath);

      // Add all files
      await git.raw(['add', '.'], { cwd: localPath });

      // Commit
      await git.raw(['commit', '-m', message], { cwd: localPath });

      console.log('[SkillsGit] Skills committed successfully');
      return true;
    } catch (error) {
      console.error('[SkillsGit] Error committing skills:', error);
      return false;
    }
  }

  /**
   * Set remote for the repository
   * Allows pushing to a remote Git hosting service
   */
  async setRemote(remoteUrl: string, remoteName: string = 'origin'): Promise<boolean> {
    const config = await this.configService.getConfig();

    try {
      const localPath = await this.configService.getLocalPath();
      const git = await GitClientFactory.getClient(localPath);

      // Remove existing remote if it exists
      try {
        await git.raw(['remote', 'remove', remoteName], { cwd: localPath });
      } catch {
        // Remote doesn't exist, that's fine
      }

      // Add new remote
      await git.raw(['remote', 'add', remoteName, remoteUrl], { cwd: localPath });

      console.log(`[SkillsGit] Remote '${remoteName}' set to ${remoteUrl}`);
      return true;
    } catch (error) {
      console.error('[SkillsGit] Error setting remote:', error);
      return false;
    }
  }

  /**
   * Push to remote repository
   * @param force - If true, force push (use for initial setup when remote has diverged)
   */
  async pushToRemote(remoteName: string = 'origin', branch: string = 'main', force: boolean = false): Promise<boolean> {
    const config = await this.configService.getConfig();

    try {
      const localPath = await this.configService.getLocalPath();
      const git = await GitClientFactory.getClient(localPath);

      // Build push command
      const pushArgs = ['push', '-u', remoteName, branch];
      if (force) {
        pushArgs.push('--force');
      }

      // Push to remote
      await git.raw(pushArgs, { cwd: localPath });

      console.log(`[SkillsGit] Pushed to ${remoteName}/${branch}${force ? ' (forced)' : ''}`);
      return true;
    } catch (error) {
      console.error('[SkillsGit] Error pushing to remote:', error);

      // If push failed due to diverged histories and we haven't tried force yet, suggest it
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (!force && errorMsg.includes('rejected')) {
        console.log('[SkillsGit] Push rejected, may need force push for initial setup');
      }

      return false;
    }
  }

  /**
   * Helper method to recursively copy a directory
   */
  private async copyDirectory(source: string, target: string): Promise<void> {
    await fs.mkdir(target, { recursive: true });

    const entries = await fs.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const targetPath = path.join(target, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(sourcePath, targetPath);
      } else {
        await fs.copyFile(sourcePath, targetPath);
      }
    }
  }
}
