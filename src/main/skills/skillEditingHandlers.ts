/**
 * IPC Handlers for Skill Editing Operations
 *
 * Handles permission checking, file operations, and GitHub commits for skill editing.
 */

import { ipcMain, app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getSkillLockFileService } from './skillLockFile';
import { initializeSkillPermissionService } from '../services/SkillPermissionService';
import { GitHubAdapter } from '../version-control-providers/githubHandlers';
import { GitHubAPICore } from '../version-control-providers/github/apiCore';
import { getFileContentWithSha, commitFile } from '../version-control-providers/github/repository';
import { sendToAllWindows } from '../window/modernWindowManager';
import {
  SkillLockAPIEvent,
  SkillCommitOptions,
  SkillCommitResult,
  SkillEditPermissionResult,
} from '../../shared/main-process-api-interfaces/SkillLockAPI';

/**
 * Global GitHubAdapter instance for skill editing operations
 * Skill editing doesn't need per-window context - owner/repo comes from skill lock file
 */
const globalAdapter = new GitHubAdapter();

/**
 * Recursively read directory and return file paths
 */
async function readDirRecursive(dir: string, baseDir: string = dir): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip .git and node_modules
      if (entry.name === '.git' || entry.name === 'node_modules') {
        continue;
      }

      if (entry.isDirectory()) {
        const subFiles = await readDirRecursive(fullPath, baseDir);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        // Return path relative to base directory
        const relativePath = path.relative(baseDir, fullPath);
        files.push(relativePath);
      }
    }
  } catch (error) {
    console.error(`[SkillEditing] Error reading directory ${dir}:`, error);
  }

  return files;
}

/**
 * Register all skill editing IPC handlers
 */
export async function registerSkillEditingHandlers(): Promise<void> {
  const lockService = getSkillLockFileService();

  console.log('[SkillEditing] Registering IPC handlers');

  // CHECK_SKILL_EDIT_PERMISSION - Check if user can edit skill
  ipcMain.handle(
    SkillLockAPIEvent.CHECK_SKILL_EDIT_PERMISSION,
    async (_event, skillName: string): Promise<SkillEditPermissionResult> => {
      try {
        // Use global adapter - skill editing doesn't need window context
        // Owner/repo information comes from the skill lock file
        const permissionService = initializeSkillPermissionService(globalAdapter);
        return await permissionService.checkSkillEditPermission(skillName);
      } catch (error) {
        console.error('[SkillEditing] Error checking edit permission:', error);
        return {
          canEdit: false,
          reason: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // GET_SKILL_FILES - Get list of files in skill folder
  ipcMain.handle(
    SkillLockAPIEvent.GET_SKILL_FILES,
    async (_, skillName: string): Promise<string[]> => {
      try {
        const skill = await lockService.getSkill(skillName);
        if (!skill) {
          console.warn(`[SkillEditing] Skill not found: ${skillName}`);
          return [];
        }

        const canonicalPath =
          skill.canonicalPath ||
          path.join(app.getPath('home'), '.agents', 'skills', skillName);

        // Check if directory exists
        try {
          await fs.access(canonicalPath);
        } catch {
          console.warn(`[SkillEditing] Skill directory not found: ${canonicalPath}`);
          return [];
        }

        const files = await readDirRecursive(canonicalPath);
        console.log(`[SkillEditing] Found ${files.length} files in ${skillName}`);
        return files;
      } catch (error) {
        console.error('[SkillEditing] Error getting skill files:', error);
        return [];
      }
    }
  );

  // GET_SKILL_FILE_CONTENT - Get content of a skill file
  ipcMain.handle(
    SkillLockAPIEvent.GET_SKILL_FILE_CONTENT,
    async (_, skillName: string, filePath: string): Promise<{ content: string; isLocal: boolean } | null> => {
      try {
        const skill = await lockService.getSkill(skillName);
        if (!skill) {
          console.warn(`[SkillEditing] Skill not found: ${skillName}`);
          return null;
        }

        const canonicalPath =
          skill.canonicalPath ||
          path.join(app.getPath('home'), '.agents', 'skills', skillName);

        const fullPath = path.join(canonicalPath, filePath);

        // Security check: ensure file is within skill directory
        const resolvedPath = path.resolve(fullPath);
        const resolvedCanonical = path.resolve(canonicalPath);
        if (!resolvedPath.startsWith(resolvedCanonical)) {
          console.error('[SkillEditing] Attempted path traversal:', filePath);
          return null;
        }

        const content = await fs.readFile(fullPath, 'utf-8');
        console.log(`[SkillEditing] Read file: ${filePath} (${content.length} bytes)`);
        return { content, isLocal: true };
      } catch (error) {
        console.error('[SkillEditing] Error reading file:', error);
        return null;
      }
    }
  );

  // COMMIT_SKILL_FILE - Commit file changes to GitHub
  ipcMain.handle(
    SkillLockAPIEvent.COMMIT_SKILL_FILE,
    async (_event, options: SkillCommitOptions): Promise<SkillCommitResult> => {
      const { skillName, filePath, content, message } = options;

      try {
        console.log(`[SkillEditing] Committing file: ${skillName}/${filePath}`);

        // Note: We use GitHubAPICore directly for commits, not the adapter
        // The adapter is only needed for permission checking

        // 1. Get skill from lock file
        const skill = await lockService.getSkill(skillName);
        if (!skill) {
          return {
            success: false,
            error: 'Skill not found in lock file',
          };
        }

        if (skill.sourceType !== 'github') {
          return {
            success: false,
            error: 'Only GitHub skills can be edited',
          };
        }

        // 2. Parse source to get owner/repo
        const [owner, repo] = skill.source.split('/');
        if (!owner || !repo) {
          return {
            success: false,
            error: 'Invalid skill source format',
          };
        }

        const branch = skill.branch || 'main';

        // 3. Get full path in repo (skillPath + filePath)
        const repoFilePath = skill.skillPath
          ? path.join(skill.skillPath, filePath).replace(/\\/g, '/')
          : filePath.replace(/\\/g, '/');

        console.log(`[SkillEditing] Repo file path: ${repoFilePath}`);

        // 4. Create GitHub API core instance
        const apiCore = new GitHubAPICore();

        // 5. Get current file SHA from GitHub
        const fileInfo = await getFileContentWithSha(
          apiCore,
          owner,
          repo,
          repoFilePath,
          branch
        );

        // 6. Commit via GitHub API
        const result = await commitFile(
          apiCore,
          owner,
          repo,
          repoFilePath,
          content,
          message,
          branch,
          fileInfo?.sha
        );

        if (!result.success) {
          console.error(`[SkillEditing] Commit failed: ${result.error}`);
          return result;
        }

        console.log(`[SkillEditing] Commit successful: ${result.commit?.sha}`);

        // 6. Write to local file
        const canonicalPath =
          skill.canonicalPath ||
          path.join(app.getPath('home'), '.agents', 'skills', skillName);

        const localPath = path.join(canonicalPath, filePath);

        // Security check: ensure file is within skill directory
        const resolvedPath = path.resolve(localPath);
        const resolvedCanonical = path.resolve(canonicalPath);
        if (!resolvedPath.startsWith(resolvedCanonical)) {
          console.error('[SkillEditing] Attempted path traversal:', filePath);
          return {
            success: false,
            error: 'Invalid file path',
          };
        }

        await fs.writeFile(localPath, content, 'utf-8');
        console.log(`[SkillEditing] Wrote local file: ${localPath}`);

        // 7. Update lock file
        await lockService.updateSkill({
          name: skillName,
          updates: {
            lastEditCommitSha: result.commit?.sha,
            updatedAt: new Date().toISOString(),
          },
        });

        // 8. Broadcast update event
        sendToAllWindows(SkillLockAPIEvent.SKILL_UPDATED, {
          skillName,
          commitSha: result.commit?.sha,
        });

        console.log(`[SkillEditing] Skill ${skillName} updated successfully`);

        return result;
      } catch (error) {
        console.error('[SkillEditing] Error committing file:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  console.log('[SkillEditing] IPC handlers registered');
}
