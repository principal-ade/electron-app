/**
 * Main process handler for Workspace management
 */

import { ipcMain, BrowserWindow } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import path from 'path';
import fs from 'fs-extra';
import { WorkspaceAPIEvent, type WorkspaceAPI, type WorkspaceChangeEvent } from '../../shared/main-process-api-interfaces/WorkspaceAPI';
import { AlexandriaRegistryService } from './AlexandriaRegistryService';
import type { Workspace, WorkspaceMembership, AlexandriaEntry } from '@a24z/core-library';

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

    // Get the repository directory name
    const repoName = path.basename(repository.path);
    const targetPath = path.join(workspace.suggestedClonePath, repoName);

    // Check if target already exists
    if (await fs.pathExists(targetPath)) {
      throw new Error(`Target path ${targetPath} already exists`);
    }

    // Ensure the workspace directory exists
    await fs.ensureDir(workspace.suggestedClonePath);

    // Move the repository
    try {
      await fs.move(repository.path, targetPath, { overwrite: false });
      console.log(`[Workspace] Moved repository from ${repository.path} to ${targetPath}`);

      // Update the repository entry in the registry with the new path
      // Type assertion needed because path requires ValidatedRepositoryPath branded type
      await this.service.updateRepository(repository.name, { path: targetPath as typeof repository.path });

      // Broadcast workspace change event to notify UI components
      const repoId = repository.github?.id || repository.name;
      this.broadcastWorkspaceChange('membership-changed', undefined, workspaceId, repoId);

      return targetPath;
    } catch (error) {
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
