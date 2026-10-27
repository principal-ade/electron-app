/**
 * Move a registered repository into the app's clone-path convention:
 * `<baseDefaultDirectory>/<owner>/<repoName>`.
 *
 * Extracted from the retired workspace handler — relocating a clone was never a
 * workspace concern, it is a filesystem + registry operation. Used by the
 * relocate actions on the Projects list and the repository About card.
 *
 * Ordering matters: the move releases the git watch, unregisters from the
 * monitoring server, moves files, re-keys the registry, then restores shared
 * metadata that a fresh register would otherwise drop.
 */
import path from 'path';
import fs from 'fs-extra';
import { AlexandriaRegistryService } from '../stores/AlexandriaRegistryService';
import { UserPreferencesHandler } from '../stores/userPreferencesHandler';
import { getManager as getMonitoringManager } from '../repository-monitoring/ipcHandlers';
import { joinClonePath, baseName } from '../../shared/utils/clonePath';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';

const SERVICE = AlexandriaRegistryService.getInstance();

/** Is a repository (project) window currently open for this entry? */
function isRepositoryWindowOpen(repository: AlexandriaEntry): boolean {
  let owner = repository.github?.owner;
  let repoName = repository.name;
  let remoteUrl = repository.remoteUrl;

  // If still no owner, try to parse from the name (might be in format owner/repo)
  if (!owner && repository.name.includes('/')) {
    const parts = repository.name.split('/');
    owner = parts[0];
    repoName = parts[1];
  }

  if (!owner) {
    owner = 'unknown';
  }
  if (!remoteUrl) {
    remoteUrl = `https://github.com/${owner}/${repoName}`;
  }

  const windowName = `repository-maps-${remoteUrl}`;

  const {
    getSpecialWindows,
    getApplicationWindows,
  } = require('../window/modernWindowManager');
  const specialWindows = getSpecialWindows();
  const applicationWindows = getApplicationWindows();
  const existingWindowId = specialWindows.get(windowName);
  const windowEntry = existingWindowId
    ? applicationWindows.get(existingWindowId)
    : undefined;

  return !!windowEntry && !windowEntry.window.isDestroyed();
}

/** Was git watching enabled for this repository before the move? */
async function isGitWatchingEnabled(repoPath: string): Promise<boolean> {
  try {
    const monitoringManager = getMonitoringManager();
    const status = await monitoringManager.getMonitoringStatus();
    const repoInfo = status.repositories.find((r) => r.path === repoPath);
    return repoInfo?.isWatching || false;
  } catch (error) {
    console.error('[Alexandria] Failed to check git watching status:', error);
    return false;
  }
}

export interface MoveToConventionalPathResult {
  targetPath: string;
  /** Registry entry at the new path, after metadata restoration. */
  entry: AlexandriaEntry;
}

/**
 * Move `repository` under `<baseDefaultDirectory>/<owner>/<repoName>`.
 *
 * @throws when no base directory is configured, the repo has an open project
 * window, the target already exists, or the move/rollback fails.
 */
export async function moveRepositoryToConventionalPath(
  repository: AlexandriaEntry,
  owner: string,
): Promise<MoveToConventionalPathResult> {
  if (!owner || !owner.trim()) {
    throw new Error('Cannot move repository: no owner was provided.');
  }

  const preferences = await UserPreferencesHandler.getInstance().getUserPreferences();
  if (!preferences.baseDefaultDirectory) {
    throw new Error(
      'No base directory configured. Please set a base directory in settings.',
    );
  }

  if (isRepositoryWindowOpen(repository)) {
    throw new Error(
      `Cannot move repository "${repository.name}" while it has an open window. ` +
        'Please close the repository window first.',
    );
  }

  const repoName = baseName(repository.path);
  const targetPath = joinClonePath(
    preferences.baseDefaultDirectory,
    owner.trim(),
    repoName,
  );

  if (await fs.pathExists(targetPath)) {
    throw new Error(`Target path ${targetPath} already exists`);
  }

  const oldPath = repository.path as string;

  // Capture metadata a fresh re-register would lose. `registerRepository` only
  // forwards path + remoteUrl. `registeredAt` is intentionally NOT preserved —
  // it is not writable via updateRepository.
  const preservedMetadata: Partial<
    Omit<AlexandriaEntry, 'path' | 'registeredAt'>
  > = {};
  if (repository.bookColor !== undefined) preservedMetadata.bookColor = repository.bookColor;
  if (repository.theme !== undefined) preservedMetadata.theme = repository.theme;
  if (repository.lastOpenedAt !== undefined) preservedMetadata.lastOpenedAt = repository.lastOpenedAt;
  if (repository.lastChecked !== undefined) preservedMetadata.lastChecked = repository.lastChecked;

  const wasGitWatching = await isGitWatchingEnabled(oldPath);

  try {
    const monitoringManager = getMonitoringManager();

    if (wasGitWatching) {
      await monitoringManager.releaseWatch(
        oldPath,
        'conventional-path-move-handler',
      );
    }

    await monitoringManager.unregisterRepository(oldPath);
    await fs.ensureDir(path.dirname(targetPath));
    await fs.move(oldPath, targetPath, { overwrite: false });

    await SERVICE.removeRepository(oldPath, false);
    let updatedEntry = await SERVICE.registerRepository(
      targetPath,
      repository.remoteUrl,
    );

    if (Object.keys(preservedMetadata).length > 0) {
      try {
        updatedEntry = await SERVICE.updateRepository(
          targetPath,
          preservedMetadata,
        );
      } catch (error) {
        console.error(
          '[Alexandria] Failed to restore preserved metadata after move:',
          error,
        );
      }
    }

    await monitoringManager.registerRepository(targetPath);

    if (wasGitWatching) {
      await monitoringManager.acquireWatch(
        targetPath,
        'conventional-path-move-handler',
      );
    }

    console.log(
      `[Alexandria] Moved repository ${repository.name} to ${targetPath}`,
    );
    return { targetPath, entry: updatedEntry };
  } catch (error) {
    // If files already moved, put them back so the registry and disk agree.
    if (await fs.pathExists(targetPath)) {
      console.error(
        '[Alexandria] Move to conventional path failed, attempting rollback...',
      );
      try {
        await fs.move(targetPath, oldPath);
        const monitoringManager = getMonitoringManager();
        await monitoringManager.registerRepository(oldPath);
        if (wasGitWatching) {
          await monitoringManager.acquireWatch(
            oldPath,
            'conventional-path-move-handler',
          );
        }
      } catch (rollbackError) {
        throw new Error(
          `Failed to move repository and rollback also failed. ` +
            `Repository may be in an inconsistent state. ` +
            `Original error: ${error instanceof Error ? error.message : String(error)}. ` +
            `Rollback error: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
        );
      }
    }

    throw new Error(
      `Failed to move repository to conventional path: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
