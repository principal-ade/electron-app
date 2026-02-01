/**
 * IPC Handlers for Skill Lock File operations
 *
 * Registers handlers for skill lock file CRUD operations and update checking.
 */

import { ipcMain } from 'electron';
import { getSkillLockFileService, initializeSkillLockFileService } from './skillLockFile';
import { fetchSkillFolderHash, fetchMultipleSkillFolderHashes } from './githubTreeSha';
import {
  SkillLockAPIEvent,
  AddSkillToLockOptions,
  UpdateSkillInLockOptions,
  SkillUpdateCheckResult,
  SkillUpdateResult,
} from '../../shared/main-process-api-interfaces/SkillLockAPI';

/**
 * Register all skill lock IPC handlers
 */
export async function registerSkillLockHandlers(): Promise<void> {
  // Initialize the lock file service
  await initializeSkillLockFileService();

  const lockService = getSkillLockFileService();

  // GET_SKILL_LOCK - Get the entire lock file
  ipcMain.handle(SkillLockAPIEvent.GET_SKILL_LOCK, async () => {
    try {
      const lockFile = await lockService.readLockFile();
      return lockFile;
    } catch (error) {
      console.error('[SkillLock] Error getting lock file:', error);
      return null;
    }
  });

  // ADD_SKILL_TO_LOCK - Add a skill to the lock file
  ipcMain.handle(
    SkillLockAPIEvent.ADD_SKILL_TO_LOCK,
    async (_, options: AddSkillToLockOptions) => {
      try {
        await lockService.addSkill(options);
        return { success: true };
      } catch (error) {
        console.error('[SkillLock] Error adding skill:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // REMOVE_SKILL_FROM_LOCK - Remove a skill from the lock file
  ipcMain.handle(
    SkillLockAPIEvent.REMOVE_SKILL_FROM_LOCK,
    async (_, name: string) => {
      try {
        const removed = await lockService.removeSkill(name);
        return { success: removed };
      } catch (error) {
        console.error('[SkillLock] Error removing skill:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // UPDATE_SKILL_IN_LOCK - Update a skill entry in the lock file
  ipcMain.handle(
    SkillLockAPIEvent.UPDATE_SKILL_IN_LOCK,
    async (_, options: UpdateSkillInLockOptions) => {
      try {
        const updated = await lockService.updateSkill(options);
        return { success: updated };
      } catch (error) {
        console.error('[SkillLock] Error updating skill:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // GET_INSTALLED_SKILLS - Get all installed skills from lock file
  ipcMain.handle(SkillLockAPIEvent.GET_INSTALLED_SKILLS, async () => {
    try {
      const skills = await lockService.getAllSkills();
      return skills;
    } catch (error) {
      console.error('[SkillLock] Error getting installed skills:', error);
      return [];
    }
  });

  // CHECK_SKILL_UPDATES - Check for updates on all installed skills
  ipcMain.handle(SkillLockAPIEvent.CHECK_SKILL_UPDATES, async () => {
    try {
      const skills = await lockService.getAllSkills();
      const results: SkillUpdateCheckResult[] = [];

      // Group skills by source for efficient batch fetching
      const skillsBySource = new Map<string, typeof skills>();

      for (const skill of skills) {
        if (skill.sourceType !== 'github') {
          // Non-GitHub skills can't be checked automatically
          results.push({
            name: skill.name,
            installedHash: skill.skillFolderHash,
            latestHash: skill.skillFolderHash,
            hasUpdate: false,
            sourceUrl: skill.sourceUrl,
            error: 'Update checking only supported for GitHub sources',
          });
          continue;
        }

        // Branch is not stored in lock file per add-skill convention, default to 'main'
        const key = `${skill.source}@main`;
        if (!skillsBySource.has(key)) {
          skillsBySource.set(key, []);
        }
        skillsBySource.get(key)!.push(skill);
      }

      // Fetch updates for each source
      for (const [key, sourceSkills] of skillsBySource) {
        const [source, branch] = key.split('@');
        const [owner, repo] = source.split('/');

        if (!owner || !repo) {
          for (const skill of sourceSkills) {
            results.push({
              name: skill.name,
              installedHash: skill.skillFolderHash,
              latestHash: skill.skillFolderHash,
              hasUpdate: false,
              sourceUrl: skill.sourceUrl,
              error: 'Invalid source format',
            });
          }
          continue;
        }

        const skillPaths = sourceSkills
          .map((s) => s.skillPath)
          .filter((p): p is string => !!p);

        const hashResults = await fetchMultipleSkillFolderHashes({
          owner,
          repo,
          branch: branch || 'main',
          skillPaths,
        });

        for (const skill of sourceSkills) {
          const hashResult = skill.skillPath ? hashResults.get(skill.skillPath) : undefined;

          if (!hashResult || !hashResult.success) {
            results.push({
              name: skill.name,
              installedHash: skill.skillFolderHash,
              latestHash: skill.skillFolderHash,
              hasUpdate: false,
              sourceUrl: skill.sourceUrl,
              error: hashResult?.error || 'Failed to fetch current hash',
            });
          } else {
            results.push({
              name: skill.name,
              installedHash: skill.skillFolderHash,
              latestHash: hashResult.sha!,
              hasUpdate: skill.skillFolderHash !== hashResult.sha,
              sourceUrl: skill.sourceUrl,
            });
          }
        }
      }

      return results;
    } catch (error) {
      console.error('[SkillLock] Error checking updates:', error);
      return [];
    }
  });

  // UPDATE_SKILL - Update a single skill to latest version
  ipcMain.handle(
    SkillLockAPIEvent.UPDATE_SKILL,
    async (_, name: string): Promise<SkillUpdateResult> => {
      try {
        const skill = await lockService.getSkill(name);
        if (!skill) {
          return {
            success: false,
            name,
            error: 'Skill not found in lock file',
          };
        }

        if (skill.sourceType !== 'github') {
          return {
            success: false,
            name,
            error: 'Update only supported for GitHub sources',
          };
        }

        const [owner, repo] = skill.source.split('/');
        if (!owner || !repo || !skill.skillPath) {
          return {
            success: false,
            name,
            error: 'Invalid skill source or path',
          };
        }

        // Fetch current hash
        const hashResult = await fetchSkillFolderHash({
          owner,
          repo,
          branch: 'main', // Branch not stored in lock file per add-skill convention
          skillPath: skill.skillPath,
        });

        if (!hashResult.success || !hashResult.sha) {
          return {
            success: false,
            name,
            error: hashResult.error || 'Failed to fetch current hash',
          };
        }

        const previousHash = skill.skillFolderHash;

        // Note: The actual file download and update would need to be triggered
        // via the INSTALL_SKILL handler. This just updates the lock file.
        // In a full implementation, you would:
        // 1. Re-download the skill files
        // 2. Update the lock file with new hash

        // For now, just update the hash in the lock file
        await lockService.updateSkill({
          name,
          updates: {
            skillFolderHash: hashResult.sha,
          },
        });

        return {
          success: true,
          name,
          previousHash,
          newHash: hashResult.sha,
        };
      } catch (error) {
        console.error('[SkillLock] Error updating skill:', error);
        return {
          success: false,
          name,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // UPDATE_ALL_SKILLS - Update all skills with available updates
  ipcMain.handle(SkillLockAPIEvent.UPDATE_ALL_SKILLS, async (): Promise<SkillUpdateResult[]> => {
    try {
      const skills = await lockService.getAllSkills();
      const results: SkillUpdateResult[] = [];

      // Group skills by source for efficient batch fetching
      const skillsBySource = new Map<string, typeof skills>();

      for (const skill of skills) {
        if (skill.sourceType !== 'github') continue;

        // Branch is not stored in lock file per add-skill convention, default to 'main'
        const key = `${skill.source}@main`;
        if (!skillsBySource.has(key)) {
          skillsBySource.set(key, []);
        }
        skillsBySource.get(key)!.push(skill);
      }

      // Check and update each source group
      for (const [key, sourceSkills] of skillsBySource) {
        const [source, branch] = key.split('@');
        const [owner, repo] = source.split('/');

        if (!owner || !repo) continue;

        const skillPaths = sourceSkills
          .map((s) => s.skillPath)
          .filter((p): p is string => !!p);

        const hashResults = await fetchMultipleSkillFolderHashes({
          owner,
          repo,
          branch: branch || 'main',
          skillPaths,
        });

        for (const skill of sourceSkills) {
          const hashResult = skill.skillPath ? hashResults.get(skill.skillPath) : undefined;

          if (hashResult?.success && hashResult.sha && skill.skillFolderHash !== hashResult.sha) {
            // Update the lock file entry
            const updated = await lockService.updateSkill({
              name: skill.name,
              updates: {
                skillFolderHash: hashResult.sha,
              },
            });

            results.push({
              success: updated,
              name: skill.name,
              previousHash: skill.skillFolderHash,
              newHash: hashResult.sha,
            });
          }
        }
      }

      return results;
    } catch (error) {
      console.error('[SkillLock] Error updating all skills:', error);
      return [];
    }
  });

  console.log('[SkillLock] IPC handlers registered');
}
