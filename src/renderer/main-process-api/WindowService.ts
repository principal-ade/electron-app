/**
 * WindowService - Service layer for window management operations
 *
 * This service encapsulates all window.mainProcess.window calls to maintain
 * clean architecture and separation of concerns.
 *
 * ALL calls to window.mainProcess.window MUST be made through this service.
 */

import type {
  RepositoryWindowState,
  DevWorkspaceOptions,
  ExtensionWindowOptions,
  AlexandriaWorkspaceOptions,
} from '../../shared/main-process-api-interfaces/WindowAPI';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';

// Re-export for convenience
export type { RepositoryWindowState };

/**
 * Service for managing application windows
 */
export class WindowService {
  /**
   * Open Alexandria Workspace window
   * Opens a dedicated window for managing a workspace and its repository members
   * Can open with a specific workspace, or create a temporary workspace for a single repository
   * @param options - Options for opening the workspace (workspaceId, repositoryPath, etc.)
   */
  static async openAlexandriaWorkspace(options: AlexandriaWorkspaceOptions): Promise<void> {
    try {
      await window.mainProcess.window.openAlexandriaWorkspace(options);
    } catch (error) {
      console.error(
        '[WindowService] Failed to open Alexandria Workspace window:',
        error,
      );
      throw new Error('Failed to open Alexandria Workspace window');
    }
  }

  /**
   * Open Alexandria Workspace window from a repository
   * Creates a temporary single-repository workspace
   * @param repositoryPath - Path to the repository
   * @param repositoryId - Repository identifier (PURL or github.id)
   */
  static async openAlexandriaWorkspaceFromRepository(
    repositoryPath: string,
    repositoryId?: string,
  ): Promise<void> {
    return this.openAlexandriaWorkspace({
      repositoryPath,
      repositoryId,
    });
  }

  /**
   * Get the current window's ID
   * @returns The Electron BrowserWindow ID
   */
  static async getWindowId(): Promise<number> {
    return window.mainProcess.window.getWindowId();
  }

  /**
   * Focus a window by its ID
   * @param windowId - The Electron BrowserWindow ID to focus
   * @returns True if the window was found and focused, false otherwise
   */
  static async focusWindowById(windowId: number): Promise<boolean> {
    try {
      return await window.mainProcess.window.focusWindowById(windowId);
    } catch (error) {
      console.error('[WindowService] Failed to focus window:', error);
      return false;
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
   * @param options - Options containing the Alexandria entry for the repository
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

  /**
   * Open the extension browser window
   * @param options - Optional configuration
   * @returns Window ID if successful, null otherwise
   */
  static async openExtensionWindow(
    options?: ExtensionWindowOptions,
  ): Promise<{ windowId: number } | null> {
    try {
      return await window.mainProcess.window.openExtensionWindow(options);
    } catch (error) {
      console.error('[WindowService] Failed to open extension window:', error);
      throw new Error('Failed to open extension window');
    }
  }
}
