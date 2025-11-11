/**
 * Main process handler for Workspace management
 */

import { ipcMain, BrowserWindow } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import path from 'path';
import fs from 'fs-extra';
import { WorkspaceAPIEvent, type WorkspaceAPI, type WorkspaceChangeEvent } from '../../shared/main-process-api-interfaces/WorkspaceAPI';
import { AlexandriaAPIEvent } from '../../shared/main-process-api-interfaces/AlexandriaAPI';
import { AlexandriaRegistryService } from './AlexandriaRegistryService';
import type { Workspace, WorkspaceMembership, AlexandriaEntry } from '@a24z/core-library';
import { getManager as getMonitoringManager } from '../repository-monitoring/ipcHandlers';

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
    repositoryId?: string
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
    data: AlexandriaEntry
  ): void {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send(eventType, data);
      }
    });
  }

  /**
   * Check if repository has git watching enabled
   */
  private async isGitWatchingEnabled(repoPath: string): Promise<boolean> {
    try {
      const monitoringManager = getMonitoringManager();
      const status = await monitoringManager.getMonitoringStatus();
      const repoInfo = status.repositories.find(r => r.path === repoPath);
      return repoInfo?.gitWatchingEnabled || false;
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

  async createWorkspace(workspace: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>): Promise<Workspace> {
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

  async updateWorkspace(id: string, updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>): Promise<Workspace> {
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
    repository: AlexandriaEntry | string,
    workspaceId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.service.addRepositoryToWorkspace(repository, workspaceId, metadata);
    const repoId = typeof repository === 'string' ? repository : repository.github?.id || repository.name;
    this.broadcastWorkspaceChange('membership-changed', undefined, workspaceId, repoId);
  }

  async removeRepositoryFromWorkspace(
    repository: AlexandriaEntry | string,
    workspaceId: string
  ): Promise<void> {
    await this.service.removeRepositoryFromWorkspace(repository, workspaceId);
    const repoId = typeof repository === 'string' ? repository : repository.github?.id || repository.name;
    this.broadcastWorkspaceChange('membership-changed', undefined, workspaceId, repoId);
  }

  async getWorkspaceMemberships(workspaceId: string): Promise<WorkspaceMembership[]> {
    return this.service.getWorkspaceMemberships(workspaceId);
  }

  async getRepositoryWorkspaces(repository: AlexandriaEntry | string): Promise<Workspace[]> {
    return this.service.getRepositoryWorkspaces(repository);
  }

  // ===== Query Methods =====

  async getRepositoriesInWorkspace(workspaceId: string): Promise<AlexandriaEntry[]> {
    return this.service.getRepositoriesInWorkspace(workspaceId);
  }

  async isRepositoryInWorkspace(
    repository: AlexandriaEntry | string,
    workspaceId: string
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

  async isRepositoryInWorkspaceDirectory(repository: AlexandriaEntry, workspaceId: string): Promise<boolean | null> {
    const workspace = await this.service.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    // If workspace doesn't have a suggested clone path, return null
    if (!workspace.suggestedClonePath) {
      return null;
    }

    // Normalize both paths for comparison
    const normalizedWorkspacePath = path.normalize(workspace.suggestedClonePath);
    const normalizedRepoPath = path.normalize(repository.path);

    // Check if the repository path starts with the workspace path
    // We add a separator to ensure we're checking for a directory boundary
    const workspacePathWithSep = normalizedWorkspacePath.endsWith(path.sep)
      ? normalizedWorkspacePath
      : normalizedWorkspacePath + path.sep;

    return normalizedRepoPath.startsWith(workspacePathWithSep);
  }

  async moveRepositoryToWorkspaceDirectory(repository: AlexandriaEntry, workspaceId: string): Promise<string> {
    const workspace = await this.service.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    if (!workspace.suggestedClonePath) {
      throw new Error(`Workspace ${workspace.name} does not have a suggested clone path configured`);
    }

    // CRITICAL: Check if repository has an open window - prevent move if true
    if (this.isRepositoryWindowOpen(repository)) {
      throw new Error(
        `Cannot move repository "${repository.name}" while it has an open window. ` +
        'Please close the repository window first.'
      );
    }

    // Get the repository directory name
    const repoName = path.basename(repository.path);
    const targetPath = path.join(workspace.suggestedClonePath, repoName);

    // Check if target already exists
    if (await fs.pathExists(targetPath)) {
      throw new Error(`Target path ${targetPath} already exists`);
    }

    const oldPath = repository.path as string;

    // Check if git watching is currently enabled (so we can restore it)
    const wasGitWatching = await this.isGitWatchingEnabled(oldPath);
    console.log(`[Workspace] Git watching ${wasGitWatching ? 'enabled' : 'disabled'} for ${oldPath}`);

    try {
      const monitoringManager = getMonitoringManager();

      // Step 1: Disable git watching if it was enabled
      if (wasGitWatching) {
        console.log(`[Workspace] Disabling git watching for ${oldPath}`);
        await monitoringManager.disableGitWatching(oldPath);
      }

      // Step 2: Unregister repository from monitoring server
      console.log(`[Workspace] Unregistering repository from monitoring server: ${oldPath}`);
      await monitoringManager.unregisterRepository(oldPath);

      // Step 3: Ensure the workspace directory exists
      await fs.ensureDir(workspace.suggestedClonePath);

      // Step 4: Move the repository files
      console.log(`[Workspace] Moving repository from ${oldPath} to ${targetPath}`);
      await fs.move(oldPath, targetPath, { overwrite: false });

      // Step 5: Update the repository entry in the registry with the new path
      console.log(`[Workspace] Updating Alexandria registry with new path: ${targetPath}`);
      await this.service.updateRepository(repository.name, { path: targetPath as typeof repository.path });

      // Step 6: Get updated entry from registry for event broadcasting
      const updatedEntry = await this.service.getRepository(repository.name);
      if (!updatedEntry) {
        throw new Error(`Failed to retrieve updated repository entry for ${repository.name}`);
      }

      // Step 7: Re-register repository with new path
      console.log(`[Workspace] Re-registering repository with new path: ${targetPath}`);
      await monitoringManager.registerRepository(targetPath);

      // Step 8: Re-enable git watching if it was enabled before
      if (wasGitWatching) {
        console.log(`[Workspace] Re-enabling git watching for ${targetPath}`);
        await monitoringManager.enableGitWatching(targetPath);
      }

      // Step 9: Broadcast REPOSITORY_UPDATED event (Alexandria) for Feed panels
      console.log(`[Workspace] Broadcasting REPOSITORY_UPDATED event for ${repository.name}`);
      this.broadcastAlexandriaEvent(AlexandriaAPIEvent.REPOSITORY_UPDATED, updatedEntry);

      // Step 10: Broadcast MEMBERSHIP_CHANGED event (Workspace) for workspace state
      const repoId = repository.github?.id || repository.name;
      console.log(`[Workspace] Broadcasting MEMBERSHIP_CHANGED event for workspace ${workspaceId}`);
      this.broadcastWorkspaceChange('membership-changed', undefined, workspaceId, repoId);

      console.log(`[Workspace] Successfully moved repository ${repository.name} to ${targetPath}`);
      return targetPath;
    } catch (error) {
      // If we fail after moving files, attempt to move them back
      if (await fs.pathExists(targetPath)) {
        console.error(`[Workspace] Move failed, attempting rollback...`);
        try {
          await fs.move(targetPath, oldPath);

          // Re-register with old path
          const monitoringManager = getMonitoringManager();
          await monitoringManager.registerRepository(oldPath);
          if (wasGitWatching) {
            await monitoringManager.enableGitWatching(oldPath);
          }

          console.log(`[Workspace] Successfully rolled back repository move`);
        } catch (rollbackError) {
          console.error(`[Workspace] CRITICAL: Failed to rollback repository move:`, rollbackError);
          throw new Error(
            `Failed to move repository and rollback also failed. ` +
            `Repository may be in an inconsistent state. ` +
            `Original error: ${error instanceof Error ? error.message : String(error)}. ` +
            `Rollback error: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`
          );
        }
      }

      console.error(`[Workspace] Failed to move repository:`, error);
      throw new Error(`Failed to move repository: ${error instanceof Error ? error.message : String(error)}`);
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
    ipcMain.removeHandler(WorkspaceAPIEvent.IS_REPOSITORY_IN_WORKSPACE_DIRECTORY);
    ipcMain.removeHandler(WorkspaceAPIEvent.MOVE_REPOSITORY_TO_WORKSPACE_DIRECTORY);
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
    (_event: IpcMainInvokeEvent, workspace: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>) =>
      handler.createWorkspace(workspace)
  );

  ipcMain.handle(
    WorkspaceAPIEvent.GET_WORKSPACE,
    (_event: IpcMainInvokeEvent, id: string) =>
      handler.getWorkspace(id)
  );

  ipcMain.handle(
    WorkspaceAPIEvent.GET_ALL_WORKSPACES,
    () => handler.getWorkspaces()
  );

  ipcMain.handle(
    WorkspaceAPIEvent.UPDATE_WORKSPACE,
    (_event: IpcMainInvokeEvent, id: string, updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>) =>
      handler.updateWorkspace(id, updates)
  );

  ipcMain.handle(
    WorkspaceAPIEvent.DELETE_WORKSPACE,
    (_event: IpcMainInvokeEvent, id: string) =>
      handler.deleteWorkspace(id)
  );

  // Membership Management
  ipcMain.handle(
    WorkspaceAPIEvent.ADD_REPOSITORY_TO_WORKSPACE,
    (_event: IpcMainInvokeEvent, repository: AlexandriaEntry | string, workspaceId: string, metadata?: Record<string, unknown>) =>
      handler.addRepositoryToWorkspace(repository, workspaceId, metadata)
  );

  ipcMain.handle(
    WorkspaceAPIEvent.REMOVE_REPOSITORY_FROM_WORKSPACE,
    (_event: IpcMainInvokeEvent, repository: AlexandriaEntry | string, workspaceId: string) =>
      handler.removeRepositoryFromWorkspace(repository, workspaceId)
  );

  ipcMain.handle(
    WorkspaceAPIEvent.GET_WORKSPACE_MEMBERSHIPS,
    (_event: IpcMainInvokeEvent, workspaceId: string) =>
      handler.getWorkspaceMemberships(workspaceId)
  );

  ipcMain.handle(
    WorkspaceAPIEvent.GET_REPOSITORY_WORKSPACES,
    (_event: IpcMainInvokeEvent, repository: AlexandriaEntry | string) =>
      handler.getRepositoryWorkspaces(repository)
  );

  // Queries
  ipcMain.handle(
    WorkspaceAPIEvent.GET_REPOSITORIES_IN_WORKSPACE,
    (_event: IpcMainInvokeEvent, workspaceId: string) =>
      handler.getRepositoriesInWorkspace(workspaceId)
  );

  ipcMain.handle(
    WorkspaceAPIEvent.IS_REPOSITORY_IN_WORKSPACE,
    (_event: IpcMainInvokeEvent, repository: AlexandriaEntry | string, workspaceId: string) =>
      handler.isRepositoryInWorkspace(repository, workspaceId)
  );

  // Default Workspace
  ipcMain.handle(
    WorkspaceAPIEvent.GET_DEFAULT_WORKSPACE,
    () => handler.getDefaultWorkspace()
  );

  ipcMain.handle(
    WorkspaceAPIEvent.SET_DEFAULT_WORKSPACE,
    (_event: IpcMainInvokeEvent, workspaceId: string) =>
      handler.setDefaultWorkspace(workspaceId)
  );

  // Repository Location Management
  ipcMain.handle(
    WorkspaceAPIEvent.IS_REPOSITORY_IN_WORKSPACE_DIRECTORY,
    (_event: IpcMainInvokeEvent, repository: AlexandriaEntry, workspaceId: string) =>
      handler.isRepositoryInWorkspaceDirectory(repository, workspaceId)
  );

  ipcMain.handle(
    WorkspaceAPIEvent.MOVE_REPOSITORY_TO_WORKSPACE_DIRECTORY,
    (_event: IpcMainInvokeEvent, repository: AlexandriaEntry, workspaceId: string) =>
      handler.moveRepositoryToWorkspaceDirectory(repository, workspaceId)
  );

  console.log('[Workspace] IPC handlers registered');
}
