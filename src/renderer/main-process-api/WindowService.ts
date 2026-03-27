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
   * Focus the main window if it exists, otherwise create it
   * @returns True if successful, false if failed
   */
  static async focusOrCreateMainWindow(): Promise<boolean> {
    try {
      return await window.mainProcess.window.focusOrCreateMainWindow();
    } catch (error) {
      console.error('[WindowService] Failed to focus/create main window:', error);
      return false;
    }
  }

  /**
   * Focus the main window and navigate to updates settings
   * @returns True if successful, false if failed
   */
  static async navigateToUpdates(): Promise<boolean> {
    try {
      return await window.mainProcess.window.navigateToUpdates();
    } catch (error) {
      console.error('[WindowService] Failed to navigate to updates:', error);
      return false;
    }
  }

  /**
   * Listen for navigate to updates events (used by main window)
   * @param callback - Called when navigation to updates is requested
   * @returns Unsubscribe function
   */
  static onNavigateToUpdates(callback: () => void): () => void {
    try {
      return window.mainProcess.window.onNavigateToUpdates(callback);
    } catch (error) {
      console.error('[WindowService] Failed to register navigate to updates listener:', error);
      return () => {};
    }
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

  // Thread operations (ephemeral multi-repository sessions)

  /**
   * Open a thread for a single repository
   * Creates an ephemeral session that can be expanded with additional repositories
   * @param repositoryPath - Path to the repository
   */
  static async openThread(repositoryPath: string): Promise<void> {
    return this.openAlexandriaWorkspace({ repositoryPath });
  }

  /**
   * Add a repository to the current thread window
   * @param repositoryPath - Path to the repository to add
   * @returns Result indicating success or failure
   */
  static async addRepositoryToThread(
    repositoryPath: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      return await window.mainProcess.window.addRepositoryToThread(repositoryPath);
    } catch (error) {
      console.error('[WindowService] Failed to add repository to thread:', error);
      return { success: false, error: 'Failed to add repository to thread' };
    }
  }

  /**
   * Remove a repository from the current thread window
   * @param repositoryPath - Path to the repository to remove
   * @returns Result indicating success or failure
   */
  static async removeRepositoryFromThread(
    repositoryPath: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      return await window.mainProcess.window.removeRepositoryFromThread(repositoryPath);
    } catch (error) {
      console.error('[WindowService] Failed to remove repository from thread:', error);
      return { success: false, error: 'Failed to remove repository from thread' };
    }
  }

  /**
   * Listen for thread repository changes
   * @param callback - Called when repositories are added/removed from the thread
   * @returns Unsubscribe function
   */
  static onThreadRepositoriesChanged(
    callback: (event: {
      repositoryPaths: string[];
      addedPath?: string;
      removedPath?: string;
    }) => void,
  ): () => void {
    try {
      return window.mainProcess.window.onThreadRepositoriesChanged(callback);
    } catch (error) {
      console.error('[WindowService] Failed to register thread repositories listener:', error);
      return () => {};
    }
  }
}
