/**
 * IPC API interface for Workspace management
 */

import type {
  Workspace,
  WorkspaceMembership,
  AlexandriaEntry,
  Purl,
} from '@principal-ai/alexandria-core-library';

export enum WorkspaceAPIEvent {
  // Workspace CRUD
  CREATE_WORKSPACE = 'workspace:create',
  GET_WORKSPACE = 'workspace:get',
  GET_ALL_WORKSPACES = 'workspace:get-all',
  UPDATE_WORKSPACE = 'workspace:update',
  DELETE_WORKSPACE = 'workspace:delete',

  // Membership Management
  ADD_REPOSITORY_TO_WORKSPACE = 'workspace:add-repository',
  REMOVE_REPOSITORY_FROM_WORKSPACE = 'workspace:remove-repository',
  GET_WORKSPACE_MEMBERSHIPS = 'workspace:get-memberships',
  GET_REPOSITORY_WORKSPACES = 'workspace:get-repository-workspaces',

  // Queries
  GET_REPOSITORIES_IN_WORKSPACE = 'workspace:get-repositories',
  IS_REPOSITORY_IN_WORKSPACE = 'workspace:is-repository-in',

  // Default Workspace
  GET_DEFAULT_WORKSPACE = 'workspace:get-default',
  SET_DEFAULT_WORKSPACE = 'workspace:set-default',

  // Repository Location
  MOVE_REPOSITORY_TO_CONVENTIONAL_PATH = 'workspace:move-repository-to-conventional-path',

  // Events
  WORKSPACE_ADDED = 'workspace:added',
  WORKSPACE_UPDATED = 'workspace:updated',
  WORKSPACE_DELETED = 'workspace:deleted',
  MEMBERSHIP_CHANGED = 'workspace:membership-changed',
}

export interface WorkspaceChangeEvent {
  type: 'added' | 'updated' | 'deleted' | 'membership-changed';
  workspace?: Workspace;
  workspaceId?: string;
  repositoryId?: string;
}

export interface WorkspaceAPI {
  /**
   * Subscribe to workspace change events
   * @param callback - Function to call when workspaces change
   * @returns Unsubscribe function
   */
  onWorkspaceChange(
    callback: (event: WorkspaceChangeEvent) => void,
  ): () => void;

  // ===== Workspace CRUD =====

  /**
   * Create a new workspace
   */
  createWorkspace(
    workspace: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Workspace>;

  /**
   * Get a specific workspace by ID
   */
  getWorkspace(id: string): Promise<Workspace | null>;

  /**
   * Get all workspaces
   */
  getWorkspaces(): Promise<Workspace[]>;

  /**
   * Update an existing workspace
   */
  updateWorkspace(
    id: string,
    updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>,
  ): Promise<Workspace>;

  /**
   * Delete a workspace
   */
  deleteWorkspace(id: string): Promise<boolean>;

  // ===== Membership Management =====

  /**
   * Add a repository to a workspace
   */
  addRepositoryToWorkspace(
    repository: AlexandriaEntry | Purl,
    workspaceId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void>;

  /**
   * Remove a repository from a workspace
   */
  removeRepositoryFromWorkspace(
    repository: AlexandriaEntry | Purl,
    workspaceId: string,
  ): Promise<void>;

  /**
   * Get all memberships for a workspace
   */
  getWorkspaceMemberships(workspaceId: string): Promise<WorkspaceMembership[]>;

  /**
   * Get all workspaces that contain a specific repository
   */
  getRepositoryWorkspaces(
    repository: AlexandriaEntry | Purl,
  ): Promise<Workspace[]>;

  // ===== Query Methods =====

  /**
   * Get all repositories in a workspace
   */
  getRepositoriesInWorkspace(workspaceId: string): Promise<AlexandriaEntry[]>;

  /**
   * Check if a repository is in a workspace
   */
  isRepositoryInWorkspace(
    repository: AlexandriaEntry | Purl,
    workspaceId: string,
  ): Promise<boolean>;

  // ===== Default Workspace =====

  /**
   * Get the default workspace
   */
  getDefaultWorkspace(): Promise<Workspace | null>;

  /**
   * Set the default workspace
   */
  setDefaultWorkspace(workspaceId: string): Promise<void>;

  // ===== Repository Location Management =====

  /**
   * Move a repository into the canonical `{baseDir}/{owner}/{repo}` layout,
   * preserving its folder name and entry metadata.
   * @returns The new path of the repository after moving
   * @throws Error if no owner/baseDefaultDirectory is set or if move fails
   */
  moveRepositoryToConventionalPath(
    repository: AlexandriaEntry,
    owner: string,
  ): Promise<string>;
}
