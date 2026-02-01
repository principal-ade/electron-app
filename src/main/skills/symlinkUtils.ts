/**
 * Symlink Utilities for Skill Installation
 *
 * Provides utilities for creating and managing symlinks between the canonical
 * skill directory (~/.agents/skills/) and agent-specific directories.
 */

import { symlink, lstat, rm, readlink, mkdir } from 'fs/promises';
import { dirname, relative, resolve } from 'path';
import { platform } from 'os';

/**
 * Check if a path is a symbolic link
 */
export async function isSymlink(targetPath: string): Promise<boolean> {
  try {
    const stats = await lstat(targetPath);
    return stats.isSymbolicLink();
  } catch (error) {
    // Path doesn't exist or can't be accessed
    return false;
  }
}

/**
 * Get the target of a symbolic link
 */
export async function getSymlinkTarget(linkPath: string): Promise<string | null> {
  try {
    const target = await readlink(linkPath);
    // Resolve relative to the link's directory
    return resolve(dirname(linkPath), target);
  } catch {
    return null;
  }
}

/**
 * Create a symbolic link from an agent directory to the canonical skill location.
 *
 * @param canonicalPath - The canonical skill directory (source of truth)
 * @param agentPath - The agent-specific directory where the symlink will be created
 * @throws Error if symlink creation fails (no fallback to copy)
 */
export async function createSkillSymlink(
  canonicalPath: string,
  agentPath: string
): Promise<void> {
  const resolvedCanonical = resolve(canonicalPath);
  const resolvedAgent = resolve(agentPath);

  // Don't create symlink to self
  if (resolvedCanonical === resolvedAgent) {
    console.log('[Symlink] Skipping symlink creation - paths are identical');
    return;
  }

  // Check if symlink already exists and points to correct target
  try {
    const stats = await lstat(resolvedAgent);

    if (stats.isSymbolicLink()) {
      const existingTarget = await getSymlinkTarget(resolvedAgent);
      if (existingTarget === resolvedCanonical) {
        console.log(`[Symlink] Symlink already exists and is correct: ${resolvedAgent}`);
        return;
      }
      // Symlink exists but points to wrong target - remove it
      console.log(`[Symlink] Removing incorrect symlink: ${resolvedAgent}`);
      await rm(resolvedAgent);
    } else {
      // Regular file/directory exists - remove it
      console.log(`[Symlink] Removing existing file/directory: ${resolvedAgent}`);
      await rm(resolvedAgent, { recursive: true });
    }
  } catch (error) {
    // Path doesn't exist - that's fine, we'll create it
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      // Handle ELOOP (circular symlink) by trying to remove
      if ((error as NodeJS.ErrnoException).code === 'ELOOP') {
        try {
          await rm(resolvedAgent, { force: true });
        } catch {
          throw new Error(`Failed to remove broken symlink at ${resolvedAgent}`);
        }
      }
    }
  }

  // Create parent directory if needed
  const parentDir = dirname(resolvedAgent);
  await mkdir(parentDir, { recursive: true });

  // Create relative symlink for portability
  const relativeTarget = relative(parentDir, resolvedCanonical);

  // Use junction on Windows (works without admin privileges)
  const symlinkType = platform() === 'win32' ? 'junction' : undefined;

  try {
    await symlink(relativeTarget, resolvedAgent, symlinkType);
    console.log(`[Symlink] Created: ${resolvedAgent} -> ${relativeTarget}`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(
      `Failed to create symlink from ${resolvedAgent} to ${resolvedCanonical}: ${errMsg}`
    );
  }
}

/**
 * Remove a symbolic link (does not remove the target directory)
 *
 * @param linkPath - The path to the symlink to remove
 * @throws Error if the path is not a symlink or removal fails
 */
export async function removeSkillSymlink(linkPath: string): Promise<void> {
  const resolvedPath = resolve(linkPath);

  // Verify it's actually a symlink before removing
  const isLink = await isSymlink(resolvedPath);
  if (!isLink) {
    throw new Error(`Path is not a symlink: ${resolvedPath}`);
  }

  try {
    await rm(resolvedPath);
    console.log(`[Symlink] Removed symlink: ${resolvedPath}`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to remove symlink at ${resolvedPath}: ${errMsg}`);
  }
}

/**
 * Remove all symlinks pointing to a canonical skill directory
 *
 * @param canonicalPath - The canonical skill directory
 * @param agentPaths - Array of agent paths that might have symlinks
 */
export async function removeAllSymlinksToCanonical(
  canonicalPath: string,
  agentPaths: string[]
): Promise<void> {
  const resolvedCanonical = resolve(canonicalPath);

  for (const agentPath of agentPaths) {
    try {
      const isLink = await isSymlink(agentPath);
      if (isLink) {
        const target = await getSymlinkTarget(agentPath);
        if (target === resolvedCanonical) {
          await rm(agentPath);
          console.log(`[Symlink] Removed symlink: ${agentPath}`);
        }
      }
    } catch {
      // Ignore errors - path might not exist
    }
  }
}
