/**
 * WindowAPI preload implementation
 * Provides type-safe access to window management operations
 */

import { ipcRenderer } from 'electron';
import type {
  WindowAPI,
  RepositoryWindowState,
  DevWorkspaceOptions,
  ExtensionWindowOptions,
  AlexandriaWorkspaceOptions,
} from '../../shared/main-process-api-interfaces/WindowAPI';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';
import { WindowEvent } from '../../shared/ipc-events/WindowEvents';

/**
 * Window API implementation for preload script
 */
export const windowAPI: WindowAPI = {
  /**
   * Open Alexandria Workspace window
   */
  openAlexandriaWorkspace: (options: AlexandriaWorkspaceOptions) =>
    ipcRenderer.invoke(WindowEvent.OPEN_ALEXANDRIA_WORKSPACE, options),

  /**
   * Focus the main window if it exists, otherwise create it
   */
  focusOrCreateMainWindow: () =>
    ipcRenderer.invoke(WindowEvent.FOCUS_OR_CREATE_MAIN_WINDOW),

  /**
   * Focus a window by its ID
   */
  focusWindowById: (windowId: number) =>
    ipcRenderer.invoke(WindowEvent.FOCUS_WINDOW_BY_ID, windowId),

  /**
   * Get the unique ID of the current window
   */
  getWindowId: () => ipcRenderer.invoke(WindowEvent.GET_WINDOW_ID),

  /**
   * Check if a repository window is already open
   */
  isRepositoryWindowOpen: (repository: AlexandriaEntry) =>
    ipcRenderer.invoke(WindowEvent.IS_REPOSITORY_WINDOW_OPEN, repository),

  /**
   * Listen for repository windows state changes
   */
  onRepositoryWindowsChanged: (
    callback: (repoWindows: RepositoryWindowState[]) => void,
  ) => {
    ipcRenderer.on(
      WindowEvent.REPOSITORY_WINDOWS_CHANGED,
      (_event, repoWindows: RepositoryWindowState[]) => {
        callback(repoWindows);
      },
    );
  },

  /**
   * Open a dev workspace window with the panel framework
   */
  openDevWorkspace: (options: DevWorkspaceOptions) =>
    ipcRenderer.invoke(WindowEvent.OPEN_DEV_WORKSPACE, options),

  /**
   * Open the extension browser window
   */
  openExtensionWindow: (options?: ExtensionWindowOptions) =>
    ipcRenderer.invoke(WindowEvent.OPEN_EXTENSION_WINDOW, options),

  // Thread operations (ephemeral multi-repository sessions)

  /**
   * Add a repository to the current thread window
   */
  addRepositoryToThread: async (repositoryPath: string) => {
    const windowId = await ipcRenderer.invoke(WindowEvent.GET_WINDOW_ID);
    if (!windowId) {
      return { success: false, error: 'Could not get window ID' };
    }
    return ipcRenderer.invoke(WindowEvent.ADD_REPOSITORY_TO_THREAD, {
      windowId,
      repositoryPath,
    });
  },

  /**
   * Remove a repository from the current thread window
   */
  removeRepositoryFromThread: async (repositoryPath: string) => {
    const windowId = await ipcRenderer.invoke(WindowEvent.GET_WINDOW_ID);
    if (!windowId) {
      return { success: false, error: 'Could not get window ID' };
    }
    return ipcRenderer.invoke(WindowEvent.REMOVE_REPOSITORY_FROM_THREAD, {
      windowId,
      repositoryPath,
    });
  },

  /**
   * Listen for thread repository changes
   */
  onThreadRepositoriesChanged: (
    callback: (event: {
      repositoryPaths: string[];
      addedPath?: string;
      removedPath?: string;
    }) => void,
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { repositoryPaths: string[]; addedPath?: string; removedPath?: string },
    ) => {
      callback(data);
    };
    ipcRenderer.on(WindowEvent.THREAD_REPOSITORIES_CHANGED, handler);
    return () => {
      ipcRenderer.removeListener(WindowEvent.THREAD_REPOSITORIES_CHANGED, handler);
    };
  },

  /**
   * Focus the main window and navigate to updates settings
   */
  navigateToUpdates: () =>
    ipcRenderer.invoke(WindowEvent.NAVIGATE_TO_UPDATES),

  /**
   * Listen for navigate to updates events
   */
  onNavigateToUpdates: (callback: () => void) => {
    const handler = () => {
      callback();
    };
    ipcRenderer.on(WindowEvent.NAVIGATE_TO_UPDATES, handler);
    return () => {
      ipcRenderer.removeListener(WindowEvent.NAVIGATE_TO_UPDATES, handler);
    };
  },
};
