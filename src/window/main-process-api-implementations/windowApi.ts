/**
 * WindowAPI preload implementation
 * Provides type-safe access to window management operations
 */

import { ipcRenderer } from 'electron';
import type {
  WindowAPI,
  StoreViewerOptions,
  OpenLocalFilesRequest,
  OpenRemoteFilesRequest,
  RepositoryWindowState,
} from '../../shared/main-process-api-interfaces/WindowAPI';
import type { AlexandriaEntry } from '@a24z/core-library';
import { WindowEvent } from '../../shared/ipc-events/WindowEvents';

/**
 * Window API implementation for preload script
 */
export const windowAPI: WindowAPI = {
  /**
   * Open Store Viewer window
   */
  openStoreViewer: (options?: StoreViewerOptions) =>
    ipcRenderer.invoke(WindowEvent.OPEN_STORE_VIEWER, options),

  /**
   * Open an editor window for local files
   */
  openLocalFiles: (request: OpenLocalFilesRequest) =>
    ipcRenderer.invoke(WindowEvent.OPEN_LOCAL_FILES, request),

  /**
   * Open an editor window for remote GitHub files
   */
  openRemoteFiles: (request: OpenRemoteFilesRequest) =>
    ipcRenderer.invoke(WindowEvent.OPEN_REMOTE_FILES, request),

  /**
   * Open a markdown viewer window for a single file path
   */
  openMarkdownView: (
    filePath: string,
    projectName: string,
    options?: { viewMode?: 'single' | 'book' },
  ) =>
    ipcRenderer.invoke(
      WindowEvent.OPEN_MARKDOWN_VIEW,
      filePath,
      projectName,
      options,
    ),

  /**
   * Open Repository Dashboard for Alexandria repositories
   */
  openRepositoryDashboard: (repository: AlexandriaEntry) =>
    ipcRenderer.invoke(WindowEvent.OPEN_REPOSITORY_DASHBOARD, repository),

  /**
   * Open Pattern Discovery (Callimachus) window
   */
  openCallimachusWindow: () =>
    ipcRenderer.invoke(WindowEvent.OPEN_CALLIMACHUS_WINDOW),

  /**
   * Open Alexandria Workspace Manager window
   */
  openAlexandriaWorkspace: () =>
    ipcRenderer.invoke(WindowEvent.OPEN_ALEXANDRIA_WORKSPACE),

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
};
