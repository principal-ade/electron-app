import { ipcRenderer, IpcRendererEvent } from 'electron';
import type {
  Workspace,
  WorkspaceMembership,
  AlexandriaEntry,
} from '@principal-ai/alexandria-core-library';
import {
  WorkspaceAPIEvent,
  type WorkspaceAPI,
  type WorkspaceChangeEvent,
} from '../../shared/main-process-api-interfaces/WorkspaceAPI';

export const workspaceApi: WorkspaceAPI = {
  // Event subscription
  onWorkspaceChange(
    callback: (event: WorkspaceChangeEvent) => void,
  ): () => void {
    const listener = (_event: IpcRendererEvent, data: WorkspaceChangeEvent) => {
      callback(data);
    };

    // Subscribe to all workspace events
    ipcRenderer.on(WorkspaceAPIEvent.WORKSPACE_ADDED, listener);
    ipcRenderer.on(WorkspaceAPIEvent.WORKSPACE_UPDATED, listener);
    ipcRenderer.on(WorkspaceAPIEvent.WORKSPACE_DELETED, listener);
    ipcRenderer.on(WorkspaceAPIEvent.MEMBERSHIP_CHANGED, listener);

    // Return unsubscribe function
    return () => {
      ipcRenderer.off(WorkspaceAPIEvent.WORKSPACE_ADDED, listener);
      ipcRenderer.off(WorkspaceAPIEvent.WORKSPACE_UPDATED, listener);
      ipcRenderer.off(WorkspaceAPIEvent.WORKSPACE_DELETED, listener);
      ipcRenderer.off(WorkspaceAPIEvent.MEMBERSHIP_CHANGED, listener);
    };
  },

  // Workspace CRUD
  createWorkspace(
    workspace: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Workspace> {
    return ipcRenderer.invoke(WorkspaceAPIEvent.CREATE_WORKSPACE, workspace);
  },

  getWorkspace(id: string): Promise<Workspace | null> {
    return ipcRenderer.invoke(WorkspaceAPIEvent.GET_WORKSPACE, id);
  },

  getWorkspaces(): Promise<Workspace[]> {
    return ipcRenderer.invoke(WorkspaceAPIEvent.GET_ALL_WORKSPACES);
  },

  updateWorkspace(
    id: string,
    updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>,
  ): Promise<Workspace> {
    return ipcRenderer.invoke(WorkspaceAPIEvent.UPDATE_WORKSPACE, id, updates);
  },

  deleteWorkspace(id: string): Promise<boolean> {
    return ipcRenderer.invoke(WorkspaceAPIEvent.DELETE_WORKSPACE, id);
  },

  // Membership Management
  addRepositoryToWorkspace(
    repository: AlexandriaEntry | string,
    workspaceId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    return ipcRenderer.invoke(
      WorkspaceAPIEvent.ADD_REPOSITORY_TO_WORKSPACE,
      repository,
      workspaceId,
      metadata,
    );
  },

  removeRepositoryFromWorkspace(
    repository: AlexandriaEntry | string,
    workspaceId: string,
  ): Promise<void> {
    return ipcRenderer.invoke(
      WorkspaceAPIEvent.REMOVE_REPOSITORY_FROM_WORKSPACE,
      repository,
      workspaceId,
    );
  },

  getWorkspaceMemberships(workspaceId: string): Promise<WorkspaceMembership[]> {
    return ipcRenderer.invoke(
      WorkspaceAPIEvent.GET_WORKSPACE_MEMBERSHIPS,
      workspaceId,
    );
  },

  getRepositoryWorkspaces(
    repository: AlexandriaEntry | string,
  ): Promise<Workspace[]> {
    return ipcRenderer.invoke(
      WorkspaceAPIEvent.GET_REPOSITORY_WORKSPACES,
      repository,
    );
  },

  // Queries
  getRepositoriesInWorkspace(workspaceId: string): Promise<AlexandriaEntry[]> {
    return ipcRenderer.invoke(
      WorkspaceAPIEvent.GET_REPOSITORIES_IN_WORKSPACE,
      workspaceId,
    );
  },

  isRepositoryInWorkspace(
    repository: AlexandriaEntry | string,
    workspaceId: string,
  ): Promise<boolean> {
    return ipcRenderer.invoke(
      WorkspaceAPIEvent.IS_REPOSITORY_IN_WORKSPACE,
      repository,
      workspaceId,
    );
  },

  // Default Workspace
  getDefaultWorkspace(): Promise<Workspace | null> {
    return ipcRenderer.invoke(WorkspaceAPIEvent.GET_DEFAULT_WORKSPACE);
  },

  setDefaultWorkspace(workspaceId: string): Promise<void> {
    return ipcRenderer.invoke(
      WorkspaceAPIEvent.SET_DEFAULT_WORKSPACE,
      workspaceId,
    );
  },

  // Repository Location Management
  isRepositoryInWorkspaceDirectory(
    repository: AlexandriaEntry,
    workspaceId: string,
  ): Promise<boolean | null> {
    return ipcRenderer.invoke(
      WorkspaceAPIEvent.IS_REPOSITORY_IN_WORKSPACE_DIRECTORY,
      repository,
      workspaceId,
    );
  },

  moveRepositoryToWorkspaceDirectory(
    repository: AlexandriaEntry,
    workspaceId: string,
  ): Promise<string> {
    return ipcRenderer.invoke(
      WorkspaceAPIEvent.MOVE_REPOSITORY_TO_WORKSPACE_DIRECTORY,
      repository,
      workspaceId,
    );
  },

  moveRepositoryToDefaultDirectory(repository: AlexandriaEntry): Promise<string> {
    return ipcRenderer.invoke(
      WorkspaceAPIEvent.MOVE_REPOSITORY_TO_DEFAULT_DIRECTORY,
      repository,
    );
  },

  moveRepositoryToConventionalPath(
    repository: AlexandriaEntry,
    owner: string,
  ): Promise<string> {
    return ipcRenderer.invoke(
      WorkspaceAPIEvent.MOVE_REPOSITORY_TO_CONVENTIONAL_PATH,
      repository,
      owner,
    );
  },
};
