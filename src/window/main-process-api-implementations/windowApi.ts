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
  TabTransferData,
  OpenTerminalTabPayload,
} from '../../shared/main-process-api-interfaces/WindowAPI';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';
import { WindowEvent } from '../../shared/ipc-events/WindowEvents';

/**
 * Window API implementation for preload script
 */
export const windowAPI: WindowAPI = {
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
   * Get the currently open repository / dev-workspace windows
   */
  getOpenRepositoryWindows: () =>
    ipcRenderer.invoke(WindowEvent.GET_OPEN_REPOSITORY_WINDOWS),

  /**
   * Listen for repository windows state changes
   */
  onRepositoryWindowsChanged: (
    callback: (repoWindows: RepositoryWindowState[]) => void,
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      repoWindows: RepositoryWindowState[],
    ) => {
      callback(repoWindows);
    };
    ipcRenderer.on(WindowEvent.REPOSITORY_WINDOWS_CHANGED, handler);
    return () => {
      ipcRenderer.removeListener(
        WindowEvent.REPOSITORY_WINDOWS_CHANGED,
        handler,
      );
    };
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

  /**
   * Focus the main window and navigate to updates settings
   */
  navigateToUpdates: () => ipcRenderer.invoke(WindowEvent.NAVIGATE_TO_UPDATES),

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

  /**
   * Listen for open-terminal-tab events (Quick Open → principal window).
   */
  onOpenTerminalTab: (callback: (payload: OpenTerminalTabPayload) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: OpenTerminalTabPayload,
    ) => {
      callback(payload);
    };
    ipcRenderer.on(WindowEvent.OPEN_TERMINAL_TAB, handler);
    return () => {
      ipcRenderer.removeListener(WindowEvent.OPEN_TERMINAL_TAB, handler);
    };
  },

  sendTabToWindow: (data: TabTransferData) =>
    ipcRenderer.invoke(WindowEvent.SEND_TAB_TO_WINDOW, data),

  onTabReceived: (callback: (data: TabTransferData) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: TabTransferData,
    ) => {
      callback(data);
    };
    ipcRenderer.on(WindowEvent.TAB_RECEIVED, handler);
    return () => {
      ipcRenderer.removeListener(WindowEvent.TAB_RECEIVED, handler);
    };
  },
};
