/**
 * Dev Workspace Window Handlers
 *
 * IPC handlers for the dev-workspace window (panel framework).
 * This window uses a minimal preload with only the APIs it needs.
 */

import { ipcMain, app } from 'electron';
import path from 'path';
import { resolveHtmlPath } from '../util';
import {
  createSpecialWindow,
  applicationWindows,
  specialWindows,
} from './modernWindowManager';
import { PrimaryWindowType, WindowMetadata } from './types';
import { WindowEvent } from '../../shared/ipc-events/WindowEvents';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { broadcastRepositoryWindowsChanged } from './modernWindowHandlers';
import { getManager as getMonitoringManager } from '../repository-monitoring/ipcHandlers';

const DEV_WORKSPACE_PURPOSE = 'dev-workspace';

/**
 * Options for opening a dev-workspace window
 */
export interface DevWorkspaceOptions {
  /** Full Alexandria entry with repository metadata */
  alexandriaEntry: AlexandriaEntry;
}

/**
 * Get the preload path for dev-workspace windows
 */
function getDevWorkspacePreloadPath(): string {
  return app.isPackaged
    ? path.join(__dirname, 'preload-dev-workspace.js')
    : path.join(__dirname, '../../.erb/dll/preload-dev-workspace.js');
}

/**
 * Open a dev-workspace window
 */
export async function openDevWorkspaceWindow(
  options: DevWorkspaceOptions,
): Promise<{ windowId: number } | null> {
  const { alexandriaEntry } = options;
  const windowName = `${DEV_WORKSPACE_PURPOSE}-${alexandriaEntry.path}`;

  // Check if window already exists
  const existingId = specialWindows.get(windowName);
  if (existingId) {
    const existing = applicationWindows.get(existingId);
    if (existing && !existing.window.isDestroyed()) {
      existing.window.focus();
      if (existing.window.isMinimized()) {
        existing.window.restore();
      }
      return { windowId: existing.window.id };
    }
    // Clean up stale reference
    specialWindows.delete(windowName);
  }

  // Get the dev-workspace preload path
  const preloadPath = getDevWorkspacePreloadPath();
  console.log(`[DevWorkspaceWindow] Using preload: ${preloadPath}`);

  // Create metadata (include remoteUrl for window state tracking)
  const metadata: WindowMetadata = {
    primaryType: PrimaryWindowType.DEV_WORKSPACE,
    displayName: alexandriaEntry.name,
    localPath: alexandriaEntry.path,
    remoteUrl: alexandriaEntry.remoteUrl,
    purpose: windowName,
  };

  // Create the window with terminal and file system support
  const appWindow = createSpecialWindow(
    windowName,
    {
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      title: `${alexandriaEntry.name} - Dev Workspace`,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false, // Required for terminal MessagePort
      },
    },
    {
      // Dev workspace needs file system adapter for panel file reading
      fileSystemAdapter: true,
      terminalManager: true,
      menu: true,
      devTools: true,
      contentSecurityPolicy: true,
      externalLinkHandler: true,
      errorHandlers: true,
      maximizeOnShow: true,
    },
    metadata,
  );

  if (!appWindow) {
    console.error('[DevWorkspaceWindow] Failed to create window');
    return null;
  }

  // Load the dev-workspace HTML - pass the full Alexandria entry
  const encodedData = encodeURIComponent(JSON.stringify(alexandriaEntry));
  const url = `${resolveHtmlPath('dev-workspace.html')}#init/${encodedData}`;

  console.log(
    `[DevWorkspaceWindow] Window ${appWindow.window.id} loading: ${url}`,
  );
  appWindow.window.loadURL(url);

  // Broadcast window state change (opening)
  broadcastRepositoryWindowsChanged();

  // Broadcast when window becomes visible (ready)
  appWindow.window.once('show', () => {
    broadcastRepositoryWindowsChanged();
  });

  // Acquire watch for the repository when window opens (acquireWatch auto-registers if needed)
  const repoPath = alexandriaEntry.path as string;
  const watchReferenceId = `dev-workspace:${appWindow.window.id}`;

  try {
    const monitoringManager = getMonitoringManager();
    await monitoringManager.acquireWatch(repoPath, watchReferenceId);
    console.log(
      `[DevWorkspaceWindow] Acquired watch for ${repoPath} (reference: ${watchReferenceId})`,
    );
  } catch (error) {
    console.error(
      `[DevWorkspaceWindow] Failed to acquire watch for ${repoPath}:`,
      error,
    );
  }

  // Release watch and broadcast when window closes
  appWindow.window.once('closed', () => {
    broadcastRepositoryWindowsChanged();

    // Release watch for the repository
    try {
      const monitoringManager = getMonitoringManager();
      monitoringManager.releaseWatch(repoPath, watchReferenceId).catch((err: unknown) => {
        console.error(
          `[DevWorkspaceWindow] Failed to release watch for ${repoPath}:`,
          err,
        );
      });
      console.log(
        `[DevWorkspaceWindow] Released watch for ${repoPath} (reference: ${watchReferenceId})`,
      );
    } catch (error) {
      console.error(
        `[DevWorkspaceWindow] Failed to release watch for ${repoPath}:`,
        error,
      );
    }
  });

  return { windowId: appWindow.window.id };
}

/**
 * Register IPC handlers for dev-workspace windows
 */
export function registerDevWorkspaceWindowHandlers(): void {
  // Open dev-workspace window
  ipcMain.handle(
    WindowEvent.OPEN_DEV_WORKSPACE,
    async (_event, options?: DevWorkspaceOptions) => {
      return openDevWorkspaceWindow(options);
    },
  );

  console.log('[DevWorkspaceWindow] IPC handlers registered');
}
