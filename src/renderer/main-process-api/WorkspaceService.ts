/**
 * Renderer-side service for Workspace management
 * Communicates with main process via IPC using window.mainProcess
 */

import type {
  Workspace,
  WorkspaceMembership,
  AlexandriaEntry,
} from '@principal-ai/alexandria-core-library/types';
import type { Purl } from '@principal-ai/alexandria-core-library';
import type { WorkspaceChangeEvent } from '../../shared/main-process-api-interfaces/WorkspaceAPI';

export class WorkspaceService {
  // Event subscription
  static onWorkspaceChange(
    callback: (event: WorkspaceChangeEvent) => void,
  ): () => void {
    return window.mainProcess.workspace.onWorkspaceChange(callback);
  }

  // ===== Workspace CRUD =====

  static async createWorkspace(
    workspace: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Workspace> {
    return window.mainProcess.workspace.createWorkspace(workspace);
  }

  static async getWorkspace(id: string): Promise<Workspace | null> {
    return window.mainProcess.workspace.getWorkspace(id);
  }

  static async getWorkspaces(): Promise<Workspace[]> {
    return window.mainProcess.workspace.getWorkspaces();
  }

  static async updateWorkspace(
    id: string,
    updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>,
  ): Promise<Workspace> {
    return window.mainProcess.workspace.updateWorkspace(id, updates);
  }

  static async deleteWorkspace(id: string): Promise<boolean> {
    return window.mainProcess.workspace.deleteWorkspace(id);
  }

  // ===== Membership Management =====

  static async addRepositoryToWorkspace(
    repository: AlexandriaEntry | Purl,
    workspaceId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    return window.mainProcess.workspace.addRepositoryToWorkspace(
      repository,
      workspaceId,
      metadata,
    );
  }

  static async removeRepositoryFromWorkspace(
    repository: AlexandriaEntry | Purl,
    workspaceId: string,
  ): Promise<void> {
    return window.mainProcess.workspace.removeRepositoryFromWorkspace(
      repository,
      workspaceId,
    );
  }

  static async getWorkspaceMemberships(
    workspaceId: string,
  ): Promise<WorkspaceMembership[]> {
    return window.mainProcess.workspace.getWorkspaceMemberships(workspaceId);
  }

  static async getRepositoryWorkspaces(
    repository: AlexandriaEntry | Purl,
  ): Promise<Workspace[]> {
    return window.mainProcess.workspace.getRepositoryWorkspaces(repository);
  }

  // ===== Query Methods =====

  static async getRepositoriesInWorkspace(
    workspaceId: string,
  ): Promise<AlexandriaEntry[]> {
    return window.mainProcess.workspace.getRepositoriesInWorkspace(workspaceId);
  }

  static async isRepositoryInWorkspace(
    repository: AlexandriaEntry | Purl,
    workspaceId: string,
  ): Promise<boolean> {
    return window.mainProcess.workspace.isRepositoryInWorkspace(
      repository,
      workspaceId,
    );
  }

  // ===== Default Workspace =====

  static async getDefaultWorkspace(): Promise<Workspace | null> {
    return window.mainProcess.workspace.getDefaultWorkspace();
  }

  static async setDefaultWorkspace(workspaceId: string): Promise<void> {
    return window.mainProcess.workspace.setDefaultWorkspace(workspaceId);
  }

  // ===== Repository Location Management =====

  static async isRepositoryInWorkspaceDirectory(
    repository: AlexandriaEntry,
    workspaceId: string,
  ): Promise<boolean | null> {
    return window.mainProcess.workspace.isRepositoryInWorkspaceDirectory(
      repository,
      workspaceId,
    );
  }

  static async moveRepositoryToWorkspaceDirectory(
    repository: AlexandriaEntry,
    workspaceId: string,
  ): Promise<string> {
    return window.mainProcess.workspace.moveRepositoryToWorkspaceDirectory(
      repository,
      workspaceId,
    );
  }

  static async moveRepositoryToDefaultDirectory(
    repository: AlexandriaEntry,
  ): Promise<string> {
    return window.mainProcess.workspace.moveRepositoryToDefaultDirectory(
      repository,
    );
  }

  static async moveRepositoryToConventionalPath(
    repository: AlexandriaEntry,
    owner: string,
  ): Promise<string> {
    return window.mainProcess.workspace.moveRepositoryToConventionalPath(
      repository,
      owner,
    );
  }
}
