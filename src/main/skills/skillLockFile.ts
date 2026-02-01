import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  SkillLockFile,
  SkillLockEntry,
  AddSkillToLockOptions,
  UpdateSkillInLockOptions,
  InstalledSkillInfo,
} from '../../shared/main-process-api-interfaces/SkillLockAPI';
import {
  SKILL_LOCK_VERSION,
  SKILL_LOCK_PATH,
  createEmptyLockFile,
} from '../../shared/main-process-api-interfaces/SkillLockAPI';

/**
 * Service for managing the skill lock file (~/.agents/.skill-lock.json)
 *
 * Implements the add-skill lock file convention for tracking installed skills
 * and their versions. This replaces per-skill .metadata.json files.
 */
export class SkillLockFileService {
  private lockFilePath: string;
  private cache: SkillLockFile | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor() {
    const homeDir = app.getPath('home');
    this.lockFilePath = path.join(homeDir, SKILL_LOCK_PATH);
  }

  /**
   * Initialize the service and ensure the lock file directory exists
   */
  async initialize(): Promise<void> {
    const lockDir = path.dirname(this.lockFilePath);

    try {
      await fs.mkdir(lockDir, { recursive: true });
      console.log(`[SkillLockFile] Lock file directory initialized: ${lockDir}`);
    } catch (error) {
      console.error('[SkillLockFile] Failed to create lock file directory:', error);
      throw error;
    }
  }

  /**
   * Get the path to the lock file
   */
  getLockFilePath(): string {
    return this.lockFilePath;
  }

  /**
   * Read the lock file from disk
   * Returns an empty lock file if it doesn't exist
   */
  async readLockFile(): Promise<SkillLockFile> {
    if (this.cache) {
      return this.cache;
    }

    try {
      const data = await fs.readFile(this.lockFilePath, 'utf-8');
      const parsed = JSON.parse(data) as SkillLockFile;

      // Validate version and migrate if necessary
      if (parsed.version !== SKILL_LOCK_VERSION) {
        console.log(`[SkillLockFile] Migrating lock file from v${parsed.version} to v${SKILL_LOCK_VERSION}`);
        this.cache = this.migrateLockFile(parsed);
        await this.writeLockFile(this.cache);
      } else {
        this.cache = parsed;
      }

      return this.cache;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Lock file doesn't exist, return empty
        console.log('[SkillLockFile] No existing lock file found, creating empty');
        this.cache = createEmptyLockFile();
        return this.cache;
      }
      console.error('[SkillLockFile] Error reading lock file:', error);
      throw error;
    }
  }

  /**
   * Write the lock file to disk atomically
   * Uses a temp file + rename for atomic writes
   */
  async writeLockFile(lockFile: SkillLockFile): Promise<void> {
    // Queue writes to prevent race conditions
    this.writeQueue = this.writeQueue.then(async () => {
      const tempPath = `${this.lockFilePath}.tmp`;

      try {
        const data = JSON.stringify(lockFile, null, 2);
        await fs.writeFile(tempPath, data, 'utf-8');
        await fs.rename(tempPath, this.lockFilePath);
        this.cache = lockFile;
        console.log('[SkillLockFile] Lock file written successfully');
      } catch (error) {
        console.error('[SkillLockFile] Error writing lock file:', error);
        // Clean up temp file if it exists
        try {
          await fs.unlink(tempPath);
        } catch {
          // Ignore cleanup errors
        }
        throw error;
      }
    });

    await this.writeQueue;
  }

  /**
   * Add a skill to the lock file
   */
  async addSkill(options: AddSkillToLockOptions): Promise<void> {
    const lockFile = await this.readLockFile();
    const now = new Date().toISOString();

    const entry: SkillLockEntry = {
      ...options.entry,
      installedAt: now,
      updatedAt: now,
    };

    lockFile.skills[options.name] = entry;

    await this.writeLockFile(lockFile);
    console.log(`[SkillLockFile] Added skill: ${options.name}`);
  }

  /**
   * Remove a skill from the lock file
   */
  async removeSkill(name: string): Promise<boolean> {
    const lockFile = await this.readLockFile();

    if (!lockFile.skills[name]) {
      console.log(`[SkillLockFile] Skill not found: ${name}`);
      return false;
    }

    delete lockFile.skills[name];

    // Also remove from dismissed if present
    if (lockFile.dismissed?.[name]) {
      delete lockFile.dismissed[name];
    }

    await this.writeLockFile(lockFile);
    console.log(`[SkillLockFile] Removed skill: ${name}`);
    return true;
  }

  /**
   * Update a skill entry in the lock file
   */
  async updateSkill(options: UpdateSkillInLockOptions): Promise<boolean> {
    const lockFile = await this.readLockFile();

    if (!lockFile.skills[options.name]) {
      console.log(`[SkillLockFile] Skill not found for update: ${options.name}`);
      return false;
    }

    lockFile.skills[options.name] = {
      ...lockFile.skills[options.name],
      ...options.updates,
      updatedAt: new Date().toISOString(),
    };

    await this.writeLockFile(lockFile);
    console.log(`[SkillLockFile] Updated skill: ${options.name}`);
    return true;
  }

  /**
   * Get a skill entry by name
   */
  async getSkill(name: string): Promise<SkillLockEntry | undefined> {
    const lockFile = await this.readLockFile();
    return lockFile.skills[name];
  }

  /**
   * Get all installed skills
   */
  async getAllSkills(): Promise<InstalledSkillInfo[]> {
    const lockFile = await this.readLockFile();

    return Object.entries(lockFile.skills).map(([name, entry]) => ({
      name,
      source: entry.source,
      sourceType: entry.sourceType,
      sourceUrl: entry.sourceUrl,
      skillPath: entry.skillPath,
      skillFolderHash: entry.skillFolderHash,
      installedAt: entry.installedAt,
      updatedAt: entry.updatedAt,
      canonicalPath: entry.canonicalPath,
    }));
  }

  /**
   * Check if a skill is installed
   */
  async isSkillInstalled(name: string): Promise<boolean> {
    const lockFile = await this.readLockFile();
    return name in lockFile.skills;
  }

  /**
   * Get skills installed from a specific source
   */
  async getSkillsBySource(source: string): Promise<InstalledSkillInfo[]> {
    const allSkills = await this.getAllSkills();
    return allSkills.filter((skill) => skill.source === source);
  }

  /**
   * Dismiss an update prompt for a skill
   */
  async dismissUpdate(name: string): Promise<void> {
    const lockFile = await this.readLockFile();

    if (!lockFile.dismissed) {
      lockFile.dismissed = {};
    }

    lockFile.dismissed[name] = new Date().toISOString();
    await this.writeLockFile(lockFile);
    console.log(`[SkillLockFile] Dismissed update for: ${name}`);
  }

  /**
   * Check if an update has been dismissed for a skill
   */
  async isUpdateDismissed(name: string): Promise<boolean> {
    const lockFile = await this.readLockFile();
    return !!lockFile.dismissed?.[name];
  }

  /**
   * Clear dismissed updates (e.g., when checking again after some time)
   */
  async clearDismissedUpdates(): Promise<void> {
    const lockFile = await this.readLockFile();
    lockFile.dismissed = {};
    await this.writeLockFile(lockFile);
    console.log('[SkillLockFile] Cleared all dismissed updates');
  }

  /**
   * Set last selected agents (UI preference)
   */
  async setLastSelectedAgents(agents: string[]): Promise<void> {
    const lockFile = await this.readLockFile();
    lockFile.lastSelectedAgents = agents;
    await this.writeLockFile(lockFile);
  }

  /**
   * Get last selected agents
   */
  async getLastSelectedAgents(): Promise<string[]> {
    const lockFile = await this.readLockFile();
    return lockFile.lastSelectedAgents ?? [];
  }

  /**
   * Clear the in-memory cache to force re-read from disk
   */
  clearCache(): void {
    this.cache = null;
  }

  /**
   * Migrate lock file from older versions
   */
  private migrateLockFile(oldLockFile: SkillLockFile): SkillLockFile {
    // Currently only v3 is supported
    // Future migrations would go here

    const migrated: SkillLockFile = {
      version: SKILL_LOCK_VERSION,
      skills: oldLockFile.skills || {},
      dismissed: oldLockFile.dismissed,
      lastSelectedAgents: oldLockFile.lastSelectedAgents,
    };

    return migrated;
  }
}

// Singleton instance
let instance: SkillLockFileService | null = null;

/**
 * Get the singleton instance of SkillLockFileService
 */
export function getSkillLockFileService(): SkillLockFileService {
  if (!instance) {
    instance = new SkillLockFileService();
  }
  return instance;
}

/**
 * Initialize the skill lock file service
 * Should be called during app startup
 */
export async function initializeSkillLockFileService(): Promise<SkillLockFileService> {
  const service = getSkillLockFileService();
  await service.initialize();
  return service;
}
