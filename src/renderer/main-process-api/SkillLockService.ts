/**
 * Renderer-side service for interacting with the skill lock file
 *
 * Provides a convenient API for managing installed skills and checking for updates.
 */

import type {
  SkillLockFile,
  AddSkillToLockOptions,
  UpdateSkillInLockOptions,
  SkillUpdateCheckResult,
  InstalledSkillInfo,
  SkillLockEntry,
  SkillInstalledPayload,
  SkillUninstalledPayload,
  SkillUpdatedPayload,
  SkillEditPermissionResult,
  SkillCommitOptions,
  SkillCommitResult,
} from '../../shared/main-process-api-interfaces/SkillLockAPI';

export class SkillLockService {
  /**
   * Get the entire lock file
   */
  static async getLockFile(): Promise<SkillLockFile | null> {
    return window.mainProcess.skillLock.getSkillLock();
  }

  /**
   * Add a skill to the lock file
   */
  static async addSkill(options: AddSkillToLockOptions): Promise<{ success: boolean; error?: string }> {
    return window.mainProcess.skillLock.addSkillToLock(options);
  }

  /**
   * Remove a skill from the lock file
   */
  static async removeSkill(name: string): Promise<{ success: boolean; error?: string }> {
    return window.mainProcess.skillLock.removeSkillFromLock(name);
  }

  /**
   * Update a skill entry in the lock file
   */
  static async updateSkill(options: UpdateSkillInLockOptions): Promise<{ success: boolean; error?: string }> {
    return window.mainProcess.skillLock.updateSkillInLock(options);
  }

  /**
   * Check for updates on all installed skills
   */
  static async checkUpdates(): Promise<SkillUpdateCheckResult[]> {
    return window.mainProcess.skillLock.checkSkillUpdates();
  }

  /**
   * Get list of all installed skills from lock file
   */
  static async getInstalledSkills(): Promise<InstalledSkillInfo[]> {
    return window.mainProcess.skillLock.getInstalledSkills();
  }

  /**
   * Check if a skill is installed (by name)
   */
  static async isSkillInstalled(name: string): Promise<boolean> {
    const lockFile = await this.getLockFile();
    if (!lockFile) return false;
    return name in lockFile.skills;
  }

  /**
   * Get skill entry by name
   */
  static async getSkillEntry(name: string): Promise<SkillLockEntry | null> {
    const lockFile = await this.getLockFile();
    if (!lockFile) return null;
    return lockFile.skills[name] || null;
  }

  /**
   * Get skills from a specific source (e.g., "anthropics/skills")
   */
  static async getSkillsBySource(source: string): Promise<InstalledSkillInfo[]> {
    const skills = await this.getInstalledSkills();
    return skills.filter((skill) => skill.source === source);
  }

  /**
   * Check if a specific skill has an update available
   */
  static async checkSkillUpdate(name: string): Promise<SkillUpdateCheckResult | null> {
    const updates = await this.checkUpdates();
    return updates.find((u) => u.name === name) || null;
  }

  /**
   * Get count of skills with available updates
   */
  static async getUpdateCount(): Promise<number> {
    const updates = await this.checkUpdates();
    return updates.filter((u) => u.hasUpdate).length;
  }

  /**
   * Listen for skill installed events (broadcast from main process to all windows)
   * @returns Unsubscribe function
   */
  static onSkillInstalled(callback: (payload: SkillInstalledPayload) => void): () => void {
    return window.mainProcess.skillLock.onSkillInstalled(callback);
  }

  /**
   * Listen for skill uninstalled events (broadcast from main process to all windows)
   * @returns Unsubscribe function
   */
  static onSkillUninstalled(callback: (payload: SkillUninstalledPayload) => void): () => void {
    return window.mainProcess.skillLock.onSkillUninstalled(callback);
  }

  /**
   * Listen for skill updated events (broadcast from main process to all windows)
   * @returns Unsubscribe function
   */
  static onSkillUpdated(callback: (payload: SkillUpdatedPayload) => void): () => void {
    return window.mainProcess.skillLock.onSkillUpdated(callback);
  }

  // ============================================================================
  // Skill Editing Methods
  // ============================================================================

  /**
   * Check if user can edit a skill (has push permission)
   */
  static async checkEditPermission(skillName: string): Promise<SkillEditPermissionResult> {
    return window.mainProcess.skillLock.checkEditPermission(skillName);
  }

  /**
   * Get list of files in a skill folder
   */
  static async getSkillFiles(skillName: string): Promise<string[]> {
    return window.mainProcess.skillLock.getSkillFiles(skillName);
  }

  /**
   * Get content of a skill file
   */
  static async getSkillFileContent(
    skillName: string,
    filePath: string
  ): Promise<{ content: string; isLocal: boolean }> {
    return window.mainProcess.skillLock.getSkillFileContent(skillName, filePath);
  }

  /**
   * Commit a skill file to GitHub
   */
  static async commitSkillFile(options: SkillCommitOptions): Promise<SkillCommitResult> {
    return window.mainProcess.skillLock.commitSkillFile(options);
  }
}
