/**
 * Modern Window IPC Handlers using the modernWindowManager
 * Handles all window creation requests from renderer process
 */

import { ipcMain, BrowserWindow } from 'electron';
import { focusOrCreateMainWindow } from './modernWindowManager';
import { WindowEvent } from '../../shared/ipc-events/WindowEvents';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';
import type {
  IModernApplicationWindow,
  TabTransferData,
} from './types';
import { PrimaryWindowType } from './types';

/**
 * Repository window state
 */
export interface RepositoryWindowState {
  remoteUrl: string;
  /** Local path for dev-workspace windows */
  localPath?: string;
  state: 'opening' | 'ready';
}

/**
 * Get list of open repository windows with their states
 * Includes both legacy repo-manager windows and new dev-workspace windows
 */
function getOpenRepositoryWindows(): RepositoryWindowState[] {
  const {
    getSpecialWindows,
    getApplicationWindows,
  } = require('./modernWindowManager');
  const specialWindows = getSpecialWindows();
  const applicationWindows = getApplicationWindows();

  const repoWindows: RepositoryWindowState[] = [];

  for (const [windowName, windowId] of specialWindows.entries()) {
    const appWindow = applicationWindows.get(windowId);
    if (!appWindow || appWindow.window.isDestroyed()) {
      continue;
    }

    // Check if window is ready (has been shown)
    const state = appWindow.window.isVisible() ? 'ready' : 'opening';

    // Legacy repo-manager windows (repository-maps-{remoteUrl})
    if (windowName.startsWith('repository-maps-')) {
      const remoteUrl = windowName.replace('repository-maps-', '');
      repoWindows.push({ remoteUrl, state });
    }
    // Dev-workspace windows (dev-workspace-{localPath})
    else if (windowName.startsWith('dev-workspace-')) {
      const localPath = windowName.replace('dev-workspace-', '');
      // Get remoteUrl from window metadata if available
      const metadata = appWindow.metadata;
      const remoteUrl = metadata?.remoteUrl || '';
      repoWindows.push({ remoteUrl, localPath, state });
    }
  }

  return repoWindows;
}

/**
 * Broadcast repository windows changed event to all windows
 */
export function broadcastRepositoryWindowsChanged(): void {
  const { getApplicationWindows } = require('./modernWindowManager');
  const applicationWindows = getApplicationWindows();
  const openRepoWindows = getOpenRepositoryWindows();

  applicationWindows.forEach((appWindow: IModernApplicationWindow) => {
    if (appWindow.window && !appWindow.window.isDestroyed()) {
      appWindow.window.webContents.send(
        WindowEvent.REPOSITORY_WINDOWS_CHANGED,
        openRepoWindows,
      );
    }
  });
}

/**
 * Register all modern window IPC handlers
 */
export function registerModernWindowHandlers(): void {
  // Check if repository window is already open
  ipcMain.handle(
    WindowEvent.IS_REPOSITORY_WINDOW_OPEN,
    async (_event, repository: AlexandriaEntry) => {
      // Extract repository info to build window name (same logic as OPEN_REPOSITORY_DASHBOARD)
      let owner = repository.github?.owner;
      let repoName = repository.name;
      let remoteUrl = repository.remoteUrl;

      // If still no owner, try to parse from the name (might be in format owner/repo)
      if (!owner && repository.name.includes('/')) {
        const parts = repository.name.split('/');
        owner = parts[0];
        repoName = parts[1];
      }

      // Default to 'unknown' if we still couldn't find an owner
      if (!owner) {
        owner = 'unknown';
      }

      // Ensure we have a remoteUrl
      if (!remoteUrl) {
        remoteUrl = `https://github.com/${owner}/${repoName}`;
      }

      const windowName = `repository-maps-${remoteUrl}`;

      // Check if window exists and is not destroyed
      const {
        getSpecialWindows,
        getApplicationWindows,
      } = require('./modernWindowManager');
      const specialWindows = getSpecialWindows();
      const applicationWindows = getApplicationWindows();
      const existingWindowId = specialWindows.get(windowName);
      const windowExists =
        existingWindowId &&
        applicationWindows.get(existingWindowId) &&
        !applicationWindows.get(existingWindowId).window.isDestroyed();

      return !!windowExists;
    },
  );

  // Get list of open repository / dev-workspace windows
  ipcMain.handle(WindowEvent.GET_OPEN_REPOSITORY_WINDOWS, async () => {
    return getOpenRepositoryWindows();
  });

  // Focus or create main window
  ipcMain.handle(WindowEvent.FOCUS_OR_CREATE_MAIN_WINDOW, async () => {
    const window = await focusOrCreateMainWindow();
    return window !== null;
  });

  // Focus a window by its ID
  ipcMain.handle(
    WindowEvent.FOCUS_WINDOW_BY_ID,
    async (_event, windowId: number) => {
      const window = BrowserWindow.fromId(windowId);
      if (window && !window.isDestroyed()) {
        if (window.isMinimized()) {
          window.restore();
        }
        window.focus();
        return true;
      }
      return false;
    },
  );

  // Get the current window's ID
  ipcMain.handle(WindowEvent.GET_WINDOW_ID, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
      return window.id;
    }
    return null;
  });

  // Navigate to updates in the main window
  ipcMain.handle(WindowEvent.NAVIGATE_TO_UPDATES, async () => {
    const appWindow = await focusOrCreateMainWindow();
    if (appWindow && appWindow.window && !appWindow.window.isDestroyed()) {
      // Send event to the main window to navigate to updates
      appWindow.window.webContents.send(WindowEvent.NAVIGATE_TO_UPDATES);
      return true;
    }
    return false;
  });

  // Cross-window tab transfer
  ipcMain.handle(
    WindowEvent.SEND_TAB_TO_WINDOW,
    async (_event, data: TabTransferData) => {
      const { getApplicationWindows } = require('./modernWindowManager');
      const { getMainWindowId } = require('./types');
      const applicationWindows = getApplicationWindows();

      let targetWindow: Electron.BrowserWindow | undefined;

      if (data.direction === 'to-principal') {
        const mainId = getMainWindowId();
        if (mainId != null) {
          const aw = applicationWindows.get(mainId);
          if (aw && !aw.window.isDestroyed()) {
            targetWindow = aw.window;
          }
        }
      } else if (data.direction === 'to-dev-workspace') {
        // The cwd field holds the target repository localPath
        const targetPath = data.cwd || '';
        for (const [, aw] of applicationWindows) {
          if (aw.window.isDestroyed()) continue;
          const meta = aw.metadata;
          if (
            meta?.primaryType === PrimaryWindowType.DEV_WORKSPACE &&
            meta.localPath === targetPath
          ) {
            targetWindow = aw.window;
            break;
          }
        }
      }

      if (targetWindow) {
        data.targetWindowId = targetWindow.id;
        targetWindow.webContents.send(WindowEvent.TAB_RECEIVED, data);
        targetWindow.focus();
      }
    },
  );
}
