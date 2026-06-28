/**
 * Main process handler for Workspace management
 */

import { ipcMain, BrowserWindow } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import path from 'path';
import fs from 'fs-extra';
import {
  WorkspaceAPIEvent,
  type WorkspaceAPI,
  type WorkspaceChangeEvent,
} from '../../shared/main-process-api-interfaces/WorkspaceAPI';
import { AlexandriaAPIEvent } from '../../shared/main-process-api-interfaces/AlexandriaAPI';
import { AlexandriaRegistryService } from './AlexandriaRegistryService';
import { UserPreferencesHandler } from './userPreferencesHandler';
import type {
  Workspace,
  WorkspaceMembership,
  AlexandriaEntry,
  Purl,
} from '@principal-ai/alexandria-core-library';
import { getManager as getMonitoringManager } from '../repository-monitoring/ipcHandlers';
import { applicationWindows, PrimaryWindowType } from '../window/types';
import { joinClonePath, baseName } from '../../shared/utils/clonePath';

export class WorkspaceApiEventHandler implements WorkspaceAPI {
  private service: AlexandriaRegistryService;

  constructor() {
    this.service = AlexandriaRegistryService.getInstance();
  }

  // This is implemented in the preload/renderer side, not in main process
  onWorkspaceChange(): () => void {
    throw new Error('onWorkspaceChange is only available in renderer process');
  }

  /**
   * Broadcast workspace events to all windows
   */
  private broadcastWorkspaceChange(
    type: 'added' | 'updated' | 'deleted' | 'membership-changed',
    workspace?: Workspace,
    workspaceId?: string,
    repositoryId?: string,
  ): void {
    const event: WorkspaceChangeEvent = {
      type,
      workspace,
      workspaceId,
      repositoryId,
    };

    const eventName = {
      added: WorkspaceAPIEvent.WORKSPACE_ADDED,
      updated: WorkspaceAPIEvent.WORKSPACE_UPDATED,
      deleted: WorkspaceAPIEvent.WORKSPACE_DELETED,
      'membership-changed': WorkspaceAPIEvent.MEMBERSHIP_CHANGED,
    }[type];

    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send(eventName, event);
      }
    });
  }

  /**
   * Broadcast Alexandria events to all windows
   */
  private broadcastAlexandriaEvent(
    eventType: AlexandriaAPIEvent.REPOSITORY_UPDATED,
    data: AlexandriaEntry,
  ): void {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send(eventType, data);
      }
    });
  }

  /**
   * Get all open workspace windows for a given workspace ID
   */
  private getOpenWorkspaceWindows(workspaceId: string): number[] {
    const windowIds: number[] = [];
    for (const [id, appWindow] of applicationWindows.entries()) {
      if (
        appWindow.metadata?.primaryType === PrimaryWindowType.WORKSPACE &&
        appWindow.metadata?.workspaceId === workspaceId &&
        !appWindow.window.isDestroyed()
      ) {
        windowIds.push(id);
      }
    }
    return windowIds;
  }

  /**
   * Acquire watch for a repository on behalf of open workspace windows
   */
  private async acquireWatchForWorkspaceWindows(
    repoPath: string,
    workspaceId: string,
  ): Promise<void> {
    const openWindowIds = this.getOpenWorkspaceWindows(workspaceId);
    if (openWindowIds.length === 0) return;

    const monitoringManager = getMonitoringManager();

    for (const windowId of openWindowIds) {
      const watchReferenceId = `alexandria-workspace:${windowId}`;
      try {
        await monitoringManager.acquireWatch(repoPath, watchReferenceId);
        console.log(
          `[Workspace] Acquired watch for ${repoPath} on window ${windowId}`,
        );
      } catch (error) {
        console.error(
          `[Workspace] Failed to acquire watch for ${repoPath} on window ${windowId}:`,
          error,
        );
      }
    }
  }

  /**
   * Release watch for a repository from open workspace windows
   */
  private async releaseWatchForWorkspaceWindows(
    repoPath: string,
    workspaceId: string,
  ): Promise<void> {
    const openWindowIds = this.getOpenWorkspaceWindows(workspaceId);
    if (openWindowIds.length === 0) return;

    const monitoringManager = getMonitoringManager();

    for (const windowId of openWindowIds) {
      const watchReferenceId = `alexandria-workspace:${windowId}`;
      try {
        await monitoringManager.releaseWatch(repoPath, watchReferenceId);
        console.log(
          `[Workspace] Released watch for ${repoPath} on window ${windowId}`,
        );
      } catch (error) {
        console.error(
          `[Workspace] Failed to release watch for ${repoPath} on window ${windowId}:`,
          error,
        );
      }
    }
  }

  /**
   * Check if repository has git watching enabled
   */
  private async isGitWatchingEnabled(repoPath: string): Promise<boolean> {
    try {
      const monitoringManager = getMonitoringManager();
      const status = await monitoringManager.getMonitoringStatus();
      const repoInfo = status.repositories.find((r) => r.path === repoPath);
      return repoInfo?.isWatching || false;
    } catch (error) {
      console.error('[Workspace] Failed to check git watching status:', error);
      return false;
    }
  }

  /**
   * Check if repository window is currently open
   */
  private isRepositoryWindowOpen(repository: AlexandriaEntry): boolean {
    // Extract repository info to build window name (same logic as OPEN_REPOSITORY_DASHBOARD)
    let owner = repository.github?.owner;
    let repoName = repository.name;
    let remoteUrl = repository.remoteUrl;

    // If still no owner, try to parse from the name (might be in format owner/repo)
    if (!owner && repository.name.includes('/')) {
      const parts = repository.name.split('/');
      owner = parts[0];
      repoName = parts[1];
    }

    // Default to 'unknown' if we still couldn't find an owner
    if (!owner) {
      owner = 'unknown';
    }

    // Ensure we have a remoteUrl
    if (!remoteUrl) {
      remoteUrl = `https://github.com/${owner}/${repoName}`;
    }

    const windowName = `repository-maps-${remoteUrl}`;

    // Check if window exists and is not destroyed
    const {
      getSpecialWindows,
      getApplicationWindows,
    } = require('../window/modernWindowManager');
    const specialWindows = getSpecialWindows();
    const applicationWindows = getApplicationWindows();
    const existingWindowId = specialWindows.get(windowName);
    const windowExists =
      existingWindowId &&
      applicationWindows.get(existingWindowId) &&
      !applicationWindows.get(existingWindowId).window.isDestroyed();

    return !!windowExists;
  }

  // ===== Workspace CRUD =====

  async createWorkspace(
    workspace: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Workspace> {
    // Create the workspace folder if suggestedClonePath is provided
    if (workspace.suggestedClonePath) {
      await fs.ensureDir(workspace.suggestedClonePath);
    }

    const created = await this.service.createWorkspace(workspace);
    this.broadcastWorkspaceChange('added', created);
    return created;
  }

  async getWorkspace(id: string): Promise<Workspace | null> {
    return this.service.getWorkspace(id);
  }

  async getWorkspaces(): Promise<Workspace[]> {
    return this.service.getWorkspaces();
  }

  async updateWorkspace(
    id: string,
    updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>,
  ): Promise<Workspace> {
    const updated = await this.service.updateWorkspace(id, updates);
    this.broadcastWorkspaceChange('updated', updated);
    return updated;
  }

  async deleteWorkspace(id: string): Promise<boolean> {
    const result = await this.service.deleteWorkspace(id);
    if (result) {
      this.broadcastWorkspaceChange('deleted', undefined, id);
    }
    return result;
  }

  // ===== Membership Management =====

  async addRepositoryToWorkspace(
    repository: AlexandriaEntry | Purl,
    workspaceId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.service.addRepositoryToWorkspace(
      repository,
      workspaceId,
      metadata,
    );

    const repoEntry = typeof repository === 'string' ? null : repository;
    const repoId =
      repoEntry?.github?.id ||
      repoEntry?.name ||
      (typeof repository === 'string' ? repository : repository.name);

    // Acquire watch for any open workspace windows (non-blocking).
    // Skipped when called by purl alone — the registry has the path, but
    // resolving it would require choosing among multiple clones.
    if (repoEntry?.path) {
      this.acquireWatchForWorkspaceWindows(
        repoEntry.path as string,
        workspaceId,
      ).catch((error) =>
        console.error('[Workspace] Failed to acquire watches on add:', error),
      );
    }

    this.broadcastWorkspaceChange(
      'membership-changed',
      undefined,
      workspaceId,
      repoId,
    );
  }

  async removeRepositoryFromWorkspace(
    repository: AlexandriaEntry | Purl,
    workspaceId: string,
  ): Promise<void> {
    const repoEntry = typeof repository === 'string' ? null : repository;
    const repoId =
      repoEntry?.github?.id ||
      repoEntry?.name ||
      (typeof repository === 'string' ? repository : repository.name);

    // Release watch for any open workspace windows BEFORE removing.
    if (repoEntry?.path) {
      await this.releaseWatchForWorkspaceWindows(
        repoEntry.path as string,
        workspaceId,
      );
    }

    await this.service.removeRepositoryFromWorkspace(repository, workspaceId);

    this.broadcastWorkspaceChange(
      'membership-changed',
      undefined,
      workspaceId,
      repoId,
    );
  }

  async getWorkspaceMemberships(
    workspaceId: string,
  ): Promise<WorkspaceMembership[]> {
    return this.service.getWorkspaceMemberships(workspaceId);
  }

  async getRepositoryWorkspaces(
    repository: AlexandriaEntry | Purl,
  ): Promise<Workspace[]> {
    return this.service.getRepositoryWorkspaces(repository);
  }

  // ===== Query Methods =====

  async getRepositoriesInWorkspace(
    workspaceId: string,
  ): Promise<AlexandriaEntry[]> {
    return this.service.getRepositoriesInWorkspace(workspaceId);
  }

  async isRepositoryInWorkspace(
    repository: AlexandriaEntry | Purl,
    workspaceId: string,
  ): Promise<boolean> {
    return this.service.isRepositoryInWorkspace(repository, workspaceId);
  }

  // ===== Default Workspace =====

  async getDefaultWorkspace(): Promise<Workspace | null> {
    return this.service.getDefaultWorkspace();
  }

  async setDefaultWorkspace(workspaceId: string): Promise<void> {
    await this.service.setDefaultWorkspace(workspaceId);
    const workspace = await this.service.getWorkspace(workspaceId);
    if (workspace) {
      this.broadcastWorkspaceChange('updated', workspace);
    }
  }

  // ===== Repository Location Management =====

  /**
   * Move a repository into the canonical `{baseDir}/{owner}/{repo}` layout.
   *
   * Follows the teardown → move → re-key → rebuild → broadcast sequence (with
   * rollback), targeting the owner-grouped path and preserving the entry
   * metadata that a bare re-register would drop
   * (`registerRepository` only carries path + remoteUrl forward). The repo
   * folder name is preserved from the current path.
   */
  async moveRepositoryToConventionalPath(
    repository: AlexandriaEntry,
    owner: string,
  ): Promise<string> {
    if (!owner || !owner.trim()) {
      throw new Error('Cannot move repository: no owner was provided.');
    }

    const preferencesHandler = UserPreferencesHandler.getInstance();
    const preferences = await preferencesHandler.getUserPreferences();

    if (!preferences.baseDefaultDirectory) {
      throw new Error(
        'No base directory configured. Please set a base directory in settings.',
      );
    }

    // CRITICAL: Check if repository has an open window - prevent move if true
    if (this.isRepositoryWindowOpen(repository)) {
      throw new Error(
        `Cannot move repository "${repository.name}" while it has an open window. ` +
          'Please close the repository window first.',
      );
    }

    // Owner-grouped target; the repo folder name is preserved. Uses the
    // shared clone-path util so the move target matches the convention
    // predicate (getConventionStatus().expectedPath) exactly.
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

    // Capture metadata a fresh re-register would lose. `registerRepository`
    // only forwards path + remoteUrl, so without this the move resets these.
    // `registeredAt` is intentionally NOT preserved — it's not writable via
    // updateRepository, and the original registration date isn't worth special
    // handling here.
    const preservedMetadata: Partial<
      Omit<AlexandriaEntry, 'path' | 'registeredAt'>
    > = {};
    if (repository.bookColor !== undefined)
      preservedMetadata.bookColor = repository.bookColor;
    if (repository.theme !== undefined)
      preservedMetadata.theme = repository.theme;
    if (repository.lastOpenedAt !== undefined)
      preservedMetadata.lastOpenedAt = repository.lastOpenedAt;
    if (repository.lastChecked !== undefined)
      preservedMetadata.lastChecked = repository.lastChecked;

    const wasGitWatching = await this.isGitWatchingEnabled(oldPath);

    try {
      const monitoringManager = getMonitoringManager();

      // Step 1: Release watch if it was enabled
      if (wasGitWatching) {
        await monitoringManager.releaseWatch(
          oldPath,
          'conventional-path-move-handler',
        );
      }

      // Step 2: Unregister from monitoring server
      await monitoringManager.unregisterRepository(oldPath);

      // Step 3: Ensure the owner directory exists (not just the base dir)
      await fs.ensureDir(path.dirname(targetPath));

      // Step 4: Move the repository files
      console.log(
        `[Workspace] Moving repository from ${oldPath} to ${targetPath}`,
      );
      await fs.move(oldPath, targetPath, { overwrite: false });

      // Step 5: Re-key the registry (path is the immutable identity).
      await this.service.removeRepository(oldPath, false);
      let updatedEntry = await this.service.registerRepository(
        targetPath,
        repository.remoteUrl,
      );

      // Step 6: Re-apply preserved metadata that the fresh register dropped.
      if (Object.keys(preservedMetadata).length > 0) {
        try {
          updatedEntry = await this.service.updateRepository(
            targetPath,
            preservedMetadata,
          );
        } catch (error) {
          console.error(
            '[Workspace] Failed to restore preserved metadata after move:',
            error,
          );
        }
      }

      // Step 7: Re-register with monitoring server
      await monitoringManager.registerRepository(targetPath);

      // Step 8: Re-acquire watch if it was enabled before
      if (wasGitWatching) {
        await monitoringManager.acquireWatch(
          targetPath,
          'conventional-path-move-handler',
        );
      }

      // Step 9: Broadcast so panels re-render at the new (now canonical) path
      this.broadcastAlexandriaEvent(
        AlexandriaAPIEvent.REPOSITORY_UPDATED,
        updatedEntry,
      );

      console.log(
        `[Workspace] Successfully moved repository ${repository.name} to conventional path: ${targetPath}`,
      );
      return targetPath;
    } catch (error) {
      // If we fail after moving files, attempt to move them back
      if (await fs.pathExists(targetPath)) {
        console.error(
          '[Workspace] Move to conventional path failed, attempting rollback...',
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

  /**
   * Clean up handlers when shutting down
   */
  destroy(): void {
    // Remove all handlers using enum values
    ipcMain.removeHandler(WorkspaceAPIEvent.CREATE_WORKSPACE);
    ipcMain.removeHandler(WorkspaceAPIEvent.GET_WORKSPACE);
    ipcMain.removeHandler(WorkspaceAPIEvent.GET_ALL_WORKSPACES);
    ipcMain.removeHandler(WorkspaceAPIEvent.UPDATE_WORKSPACE);
    ipcMain.removeHandler(WorkspaceAPIEvent.DELETE_WORKSPACE);
    ipcMain.removeHandler(WorkspaceAPIEvent.ADD_REPOSITORY_TO_WORKSPACE);
    ipcMain.removeHandler(WorkspaceAPIEvent.REMOVE_REPOSITORY_FROM_WORKSPACE);
    ipcMain.removeHandler(WorkspaceAPIEvent.GET_WORKSPACE_MEMBERSHIPS);
    ipcMain.removeHandler(WorkspaceAPIEvent.GET_REPOSITORY_WORKSPACES);
    ipcMain.removeHandler(WorkspaceAPIEvent.GET_REPOSITORIES_IN_WORKSPACE);
    ipcMain.removeHandler(WorkspaceAPIEvent.IS_REPOSITORY_IN_WORKSPACE);
    ipcMain.removeHandler(WorkspaceAPIEvent.GET_DEFAULT_WORKSPACE);
    ipcMain.removeHandler(WorkspaceAPIEvent.SET_DEFAULT_WORKSPACE);
  }
}

/**
 * Register Workspace IPC handlers
 */
export function registerWorkspaceHandlers(): void {
  const handler = new WorkspaceApiEventHandler();

  // Workspace CRUD
  ipcMain.handle(
    WorkspaceAPIEvent.CREATE_WORKSPACE,
    (
      _event: IpcMainInvokeEvent,
      workspace: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>,
    ) => handler.createWorkspace(workspace),
  );

  ipcMain.handle(
    WorkspaceAPIEvent.GET_WORKSPACE,
    (_event: IpcMainInvokeEvent, id: string) => handler.getWorkspace(id),
  );

  ipcMain.handle(WorkspaceAPIEvent.GET_ALL_WORKSPACES, () =>
    handler.getWorkspaces(),
  );

  ipcMain.handle(
    WorkspaceAPIEvent.UPDATE_WORKSPACE,
    (
      _event: IpcMainInvokeEvent,
      id: string,
      updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>,
    ) => handler.updateWorkspace(id, updates),
  );

  ipcMain.handle(
    WorkspaceAPIEvent.DELETE_WORKSPACE,
    (_event: IpcMainInvokeEvent, id: string) => handler.deleteWorkspace(id),
  );

  // Membership Management
  ipcMain.handle(
    WorkspaceAPIEvent.ADD_REPOSITORY_TO_WORKSPACE,
    (
      _event: IpcMainInvokeEvent,
      repository: AlexandriaEntry | Purl,
      workspaceId: string,
      metadata?: Record<string, unknown>,
    ) => handler.addRepositoryToWorkspace(repository, workspaceId, metadata),
  );

  ipcMain.handle(
    WorkspaceAPIEvent.REMOVE_REPOSITORY_FROM_WORKSPACE,
    (
      _event: IpcMainInvokeEvent,
      repository: AlexandriaEntry | Purl,
      workspaceId: string,
    ) => handler.removeRepositoryFromWorkspace(repository, workspaceId),
  );

  ipcMain.handle(
    WorkspaceAPIEvent.GET_WORKSPACE_MEMBERSHIPS,
    (_event: IpcMainInvokeEvent, workspaceId: string) =>
      handler.getWorkspaceMemberships(workspaceId),
  );

  ipcMain.handle(
    WorkspaceAPIEvent.GET_REPOSITORY_WORKSPACES,
    (_event: IpcMainInvokeEvent, repository: AlexandriaEntry | Purl) =>
      handler.getRepositoryWorkspaces(repository),
  );

  // Queries
  ipcMain.handle(
    WorkspaceAPIEvent.GET_REPOSITORIES_IN_WORKSPACE,
    (_event: IpcMainInvokeEvent, workspaceId: string) =>
      handler.getRepositoriesInWorkspace(workspaceId),
  );

  ipcMain.handle(
    WorkspaceAPIEvent.IS_REPOSITORY_IN_WORKSPACE,
    (
      _event: IpcMainInvokeEvent,
      repository: AlexandriaEntry | Purl,
      workspaceId: string,
    ) => handler.isRepositoryInWorkspace(repository, workspaceId),
  );

  // Default Workspace
  ipcMain.handle(WorkspaceAPIEvent.GET_DEFAULT_WORKSPACE, () =>
    handler.getDefaultWorkspace(),
  );

  ipcMain.handle(
    WorkspaceAPIEvent.SET_DEFAULT_WORKSPACE,
    (_event: IpcMainInvokeEvent, workspaceId: string) =>
      handler.setDefaultWorkspace(workspaceId),
  );

  // Repository Location Management
  ipcMain.handle(
    WorkspaceAPIEvent.MOVE_REPOSITORY_TO_CONVENTIONAL_PATH,
    (_event: IpcMainInvokeEvent, repository: AlexandriaEntry, owner: string) =>
      handler.moveRepositoryToConventionalPath(repository, owner),
  );

  console.log('[Workspace] IPC handlers registered');
}
