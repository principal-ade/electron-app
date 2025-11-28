/**
 * WindowService - Service layer for window management operations
 *
 * This service encapsulates all window.mainProcess.window calls to maintain
 * clean architecture and separation of concerns.
 *
 * ALL calls to window.mainProcess.window MUST be made through this service.
 */

import type {
  StoreViewerOptions,
  OpenLocalFilesRequest,
  OpenRemoteFilesRequest,
  RepositoryWindowState,
  DevWorkspaceOptions,
} from '../../shared/main-process-api-interfaces/WindowAPI';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';

// Re-export for convenience
export type { RepositoryWindowState };

/**
 * Service for managing application windows
 */
export class WindowService {
  /**
   * Open Store Viewer window with optional configuration
   * @param options - Optional agent and namespace parameters
   */
  static async openStoreViewer(options?: StoreViewerOptions): Promise<void> {
    try {
      await window.mainProcess.window.openStoreViewer(options);
    } catch (error) {
      console.error('[WindowService] Failed to open store viewer:', error);
      throw new Error('Failed to open store viewer window');
    }
  }

  /**
   * Open an editor window for local files
   * @param request - Request containing local file paths and window configuration
   */
  static async openLocalFiles(request: OpenLocalFilesRequest): Promise<void> {
    window.alert(
      'The multi-file editor is temporarily unavailable while we migrate to the new Monaco experience.',
    );

    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[WindowService] openLocalFiles call intercepted because the multi-file editor has been disabled.',
        request,
      );
    }
  }

  /**
   * Open an editor window for remote GitHub files
   * @param request - Request containing repository info and file paths
   */
  static async openRemoteFiles(request: OpenRemoteFilesRequest): Promise<void> {
    window.alert(
      'The multi-file editor is temporarily unavailable while we migrate to the new Monaco experience.',
    );

    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[WindowService] openRemoteFiles call intercepted because the multi-file editor has been disabled.',
        request,
      );
    }
  }

  /**
   * Open a markdown viewer window for a single file path.
   * This calls the main process to open the special markdown-view window
   * with the given absolute file path.
   * @param filePath - Absolute path to the markdown file to open
   * @param projectName - Name of the project/repository this file belongs to
   * @param options - Optional configuration for the markdown viewer
   */
  static async openMarkdownView(
    filePath: string,
    projectName: string,
    options?: { viewMode?: 'single' | 'book' },
  ): Promise<void> {
    try {
      await window.mainProcess.window.openMarkdownView(
        filePath,
        projectName,
        options,
      );
    } catch (error) {
      console.error('[WindowService] Failed to open markdown view:', error);
      throw new Error('Failed to open markdown view window');
    }
  }

  /**
   * Open a markdown viewer window with a relative file path
   * The main process will resolve the relative path against the repository path
   * @param relativeFilePath - Path to the markdown file relative to the repository
   * @param repositoryPath - Absolute path to the repository
   * @param options - Optional configuration for the markdown viewer
   */
  static async openMarkdownViewFromRepository(
    relativeFilePath: string,
    repositoryPath: string,
    options?: { viewMode?: 'single' | 'book' },
  ): Promise<void> {
    try {
      await window.mainProcess.window.openMarkdownViewFromRepository(
        relativeFilePath,
        repositoryPath,
        options,
      );
    } catch (error) {
      console.error('[WindowService] Failed to open markdown view from repository:', error);
      throw new Error('Failed to open markdown view window');
    }
  }

  /**
   * Open Repository Dashboard for Alexandria repositories
   * @param repository - Alexandria repository from @principal-ai/alexandria-core-library package
   */
  static async openRepositoryDashboard(
    repository: AlexandriaEntry,
  ): Promise<void> {
    try {
      await window.mainProcess.window.openRepositoryDashboard(repository);
    } catch (error) {
      console.error(
        '[WindowService] Failed to open repository dashboard:',
        error,
      );
      throw new Error('Failed to open repository dashboard window');
    }
  }

  /**
   * Open Pattern Discovery (Callimachus) window
   * Opens a dedicated window for semantic code pattern search and discovery
   */
  static async openCallimachusWindow(): Promise<void> {
    try {
      await window.mainProcess.window.openCallimachusWindow();
    } catch (error) {
      console.error(
        '[WindowService] Failed to open Callimachus window:',
        error,
      );
      throw new Error('Failed to open Pattern Discovery window');
    }
  }

  /**
   * Open Alexandria Workspace window for a specific workspace
   * Opens a dedicated window for managing a single workspace and its repository members
   * @param workspaceId - The ID of the workspace to open
   */
  static async openAlexandriaWorkspace(workspaceId: string): Promise<void> {
    try {
      await window.mainProcess.window.openAlexandriaWorkspace(workspaceId);
    } catch (error) {
      console.error(
        '[WindowService] Failed to open Alexandria Workspace window:',
        error,
      );
      throw new Error('Failed to open Alexandria Workspace window');
    }
  }

  /**
   * Check if a repository window is already open
   * @param repository - Alexandria repository entry to check
   * @returns True if the repository window is open, false otherwise
   */
  static async isRepositoryWindowOpen(
    repository: AlexandriaEntry,
  ): Promise<boolean> {
    try {
      return await window.mainProcess.window.isRepositoryWindowOpen(repository);
    } catch (error) {
      console.error(
        '[WindowService] Failed to check repository window status:',
        error,
      );
      return false;
    }
  }

  /**
   * Listen for repository windows state changes
   * @param callback - Called with array of repository window states when state changes
   */
  static onRepositoryWindowsChanged(
    callback: (repoWindows: RepositoryWindowState[]) => void,
  ): void {
    try {
      window.mainProcess.window.onRepositoryWindowsChanged(callback);
    } catch (error) {
      console.error(
        '[WindowService] Failed to register repository windows listener:',
        error,
      );
    }
  }

  /**
   * Open a dev workspace window with the panel framework
   * @param options - Repository path and name
   * @returns Window ID if successful, null otherwise
   */
  static async openDevWorkspace(
    options: DevWorkspaceOptions,
  ): Promise<{ windowId: number } | null> {
    try {
      return await window.mainProcess.window.openDevWorkspace(options);
    } catch (error) {
      console.error('[WindowService] Failed to open dev workspace:', error);
      throw new Error('Failed to open dev workspace window');
    }
  }
}
