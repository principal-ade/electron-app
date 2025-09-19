/**
 * WindowAPI preload implementation
 * Provides type-safe access to window management operations
 */

import { ipcRenderer } from 'electron';
import type {
  WindowAPI,
  StoreViewerOptions,
  MultiFileEditorOptions,
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
   * Open Multi-File Editor window
   */
  openMultiFileEditor: (options: MultiFileEditorOptions) =>
    ipcRenderer.invoke(WindowEvent.OPEN_MULTI_FILE_EDITOR, options),

  /**
   * Open Repository Dashboard for Alexandria repositories
   */
  openRepositoryDashboard: (repository: AlexandriaEntry) =>
    ipcRenderer.invoke(WindowEvent.OPEN_REPOSITORY_DASHBOARD, repository),
};
