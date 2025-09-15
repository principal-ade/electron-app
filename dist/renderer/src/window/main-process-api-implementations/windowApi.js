/**
 * WindowAPI preload implementation
 * Provides type-safe access to window management operations
 */
import { ipcRenderer } from 'electron';
import { WindowEvent } from '../../shared/ipc-events/WindowEvents';
/**
 * Window API implementation for preload script
 */
export const windowAPI = {
    /**
     * Open Store Viewer window
     */
    openStoreViewer: (options) => ipcRenderer.invoke(WindowEvent.OPEN_STORE_VIEWER, options),
    /**
     * Open Multi-File Editor window
     */
    openMultiFileEditor: (options) => ipcRenderer.invoke(WindowEvent.OPEN_MULTI_FILE_EDITOR, options),
    /**
     * Open Repository Dashboard for Alexandria repositories
     */
    openRepositoryDashboard: (repository) => ipcRenderer.invoke(WindowEvent.OPEN_REPOSITORY_DASHBOARD, repository),
};
