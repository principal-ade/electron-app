/**
 * IPC API interface for Alexandria repository management
 */

import type {
  AlexandriaEntry,
  CodebaseView,
} from '@principal-ai/alexandria-core-library';

export enum AlexandriaEventType {
  ADDED = 'added',
  UPDATED = 'updated',
  REMOVED = 'removed',
}

export interface AlexandriaChangeEvent {
  type: AlexandriaEventType;
  repository?: AlexandriaEntry;
  name?: string;
}

export enum AlexandriaAPIEvent {
  GET_ALL = 'alexandria:get-all',
  GET = 'alexandria:get',
  GET_BY_PATH = 'alexandria:get-by-path',
  REGISTER = 'alexandria:register',
  REMOVE = 'alexandria:remove',
  SEARCH = 'alexandria:search',
  GET_WITH_VIEWS = 'alexandria:get-with-views',
  REFRESH = 'alexandria:refresh',
  GET_COUNT = 'alexandria:get-count',
  GET_CODEBASE_VIEWS = 'alexandria:get-codebase-views',
  GET_CODEBASE_VIEW = 'alexandria:get-codebase-view',
  REPOSITORY_ADDED = 'alexandria:repository-added',
  REPOSITORY_UPDATED = 'alexandria:repository-updated',
  REPOSITORY_REMOVED = 'alexandria:repository-removed',
}

export interface AlexandriaAPI {
  /**
   * Subscribe to repository change events
   * @param callback - Function to call when repositories change
   * @returns Unsubscribe function
   */
  onRepositoryChange(
    callback: (event: AlexandriaChangeEvent) => void,
  ): () => void;

  /**
   * Get all registered repositories
   */
  getRepositories(): Promise<AlexandriaEntry[]>;

  /**
   * Get a specific repository by name
   */
  getRepository(name: string): Promise<AlexandriaEntry | null>;

  /**
   * Get a repository by its local path
   */
  getRepositoryByPath(path: string): Promise<AlexandriaEntry | null>;

  /**
   * Register a new repository with a local path
   */
  registerRepository(name: string, path: string): Promise<AlexandriaEntry>;

  /**
   * Remove a repository from the registry
   * @param name - Repository name to remove
   * @param deleteLocal - Whether to delete local files (optional)
   */
  removeRepository(name: string, deleteLocal?: boolean): Promise<boolean>;

  /**
   * Search repositories by query
   */
  searchRepositories(query: string): Promise<AlexandriaEntry[]>;

  /**
   * Get repositories that have codebase views
   */
  getRepositoriesWithViews(): Promise<AlexandriaEntry[]>;

  /**
   * Refresh repository metadata (re-scan for views, etc)
   */
  refreshRepository(name: string): Promise<AlexandriaEntry | null>;

  /**
   * Get total repository count
   */
  getRepositoryCount(): Promise<number>;

  /**
   * Get all CodebaseViews for a repository
   * @param repositoryPath - Local path to the repository
   */
  getCodebaseViews(repositoryPath: string): Promise<CodebaseView[]>;

  /**
   * Get a specific CodebaseView by ID
   * @param repositoryPath - Local path to the repository
   * @param viewId - ID of the view to retrieve
   */
  getCodebaseView(
    repositoryPath: string,
    viewId: string,
  ): Promise<CodebaseView | null>;
}
