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
} from '../../shared/main-process-api-interfaces/WindowAPI';
import type { AlexandriaEntry } from '@a24z/core-library';

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
   * Open Repository Dashboard for Alexandria repositories
   * @param repository - Alexandria repository from @a24z/core-library package
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
   * Toggle main window minimize/restore
   * @param shouldMinimize - true to minimize, false to restore
   */
  static async toggleMainWindowMinimize(
    shouldMinimize: boolean,
  ): Promise<void> {
    try {
      await window.mainProcess.window.toggleMainWindowMinimize(shouldMinimize);
    } catch (error) {
      console.error(
        '[WindowService] Failed to toggle main window minimize:',
        error,
      );
      throw new Error('Failed to toggle main window minimize state');
    }
  }

  /**
   * Listen for main window minimize state changes
   * @param callback - Called when the main window minimize state changes
   */
  static onMainWindowMinimizeStateChange(
    callback: (isMinimized: boolean) => void,
  ): void {
    try {
      window.mainProcess.window.onMainWindowMinimizeStateChange(callback);
    } catch (error) {
      console.error(
        '[WindowService] Failed to register minimize state listener:',
        error,
      );
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
}
