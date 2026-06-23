/**
 * IPC Handlers for Skill Lock File operations
 *
 * Registers handlers for skill lock file CRUD operations and update checking.
 */

import { app, ipcMain } from 'electron';
import * as path from 'path';
import { getSkillLockFileService, initializeSkillLockFileService } from './skillLockFile';
import { fetchMultipleSkillTrees } from './githubTreeSha';
import { readLocalSkillBlobs, blobMapsEqual } from './localSkillHash';
import {
  SkillLockAPIEvent,
  AddSkillToLockOptions,
  UpdateSkillInLockOptions,
  SkillUpdateCheckResult,
} from '../../shared/main-process-api-interfaces/SkillLockAPI';
import { sendToAllWindows } from '../window/modernWindowManager';

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
        if (removed) {
          // Broadcast to all windows that a skill was uninstalled
          sendToAllWindows(SkillLockAPIEvent.SKILL_UNINSTALLED, { skillName: name });
          console.log(`[SkillLock] Broadcasted skill:uninstalled to all windows for: ${name}`);
        }
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
        let sourceSkillsArray = skillsBySource.get(key);
        if (!sourceSkillsArray) {
          sourceSkillsArray = [];
          skillsBySource.set(key, sourceSkillsArray);
        }
        sourceSkillsArray.push(skill);
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

        const treeResults = await fetchMultipleSkillTrees({
          owner,
          repo,
          branch: branch || 'main',
          skillPaths,
        });

        const homeDir = app.getPath('home');

        for (const skill of sourceSkills) {
          const treeResult = skill.skillPath ? treeResults.get(skill.skillPath) : undefined;

          if (!treeResult || !treeResult.success || !treeResult.folderSha) {
            results.push({
              name: skill.name,
              installedHash: skill.skillFolderHash,
              latestHash: skill.skillFolderHash,
              hasUpdate: false,
              sourceUrl: skill.sourceUrl,
              error: treeResult?.error || 'Failed to fetch current tree',
            });
            continue;
          }

          // Detect staleness from what's actually on disk, not the recorded
          // hash. A past no-op "Update" could advance skillFolderHash to the
          // latest SHA without re-downloading files; comparing the on-disk blob
          // SHAs against the source's current blobs surfaces that drift (and any
          // manual edits or missing/partial installs) so the existing Update
          // badge can offer the fix.
          const localDir =
            skill.canonicalPath ||
            path.join(homeDir, '.agents', 'skills', skill.name);

          let hasUpdate: boolean;
          if (treeResult.blobs) {
            const localBlobs = await readLocalSkillBlobs(localDir);
            // Missing files on disk => needs reinstall.
            hasUpdate = localBlobs === null || !blobMapsEqual(localBlobs, treeResult.blobs);
          } else {
            // Truncated tree: fall back to folder-SHA comparison.
            hasUpdate = skill.skillFolderHash !== treeResult.folderSha;
          }

          results.push({
            name: skill.name,
            installedHash: skill.skillFolderHash,
            latestHash: treeResult.folderSha,
            hasUpdate,
            sourceUrl: skill.sourceUrl,
          });
        }
      }

      return results;
    } catch (error) {
      console.error('[SkillLock] Error checking updates:', error);
      return [];
    }
  });

  // NOTE: Skill updates are handled renderer-side via the INSTALL_SKILL flow
  // (see HomeView's installSkillsByName / SkillBrowserView), which actually
  // re-downloads the skill's files. The previous UPDATE_SKILL / UPDATE_ALL_SKILLS
  // handlers here only stamped the lock hash without re-downloading, which made
  // them silent no-ops that concealed staleness — so they were removed.

  console.log('[SkillLock] IPC handlers registered');
}
