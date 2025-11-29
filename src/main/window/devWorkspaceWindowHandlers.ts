/**
 * Dev Workspace Window Handlers
 *
 * IPC handlers for the dev-workspace window (panel framework).
 * This window uses a minimal preload with only the APIs it needs.
 */

import { ipcMain, app } from 'electron';
import path from 'path';
import { resolveHtmlPath } from '../util';
import { createSpecialWindow, applicationWindows, specialWindows } from './modernWindowManager';
import { PrimaryWindowType, WindowMetadata } from './types';
import { WindowEvent } from '../../shared/ipc-events/WindowEvents';

const DEV_WORKSPACE_PURPOSE = 'dev-workspace';

/**
 * Options for opening a dev-workspace window
 */
export interface DevWorkspaceOptions {
  /** Path to the repository (for terminal working directory) */
  repositoryPath?: string;
  /** Name to display in window title */
  repositoryName?: string;
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
  options?: DevWorkspaceOptions,
): Promise<{ windowId: number } | null> {
  const windowName = options?.repositoryPath
    ? `${DEV_WORKSPACE_PURPOSE}-${options.repositoryPath}`
    : DEV_WORKSPACE_PURPOSE;

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

  // Create metadata
  const metadata: WindowMetadata = {
    primaryType: PrimaryWindowType.DEV_WORKSPACE,
    displayName: options?.repositoryName || 'Dev Workspace',
    localPath: options?.repositoryPath,
    purpose: windowName,
  };

  // Create the window with minimal features (terminal support only)
  const appWindow = createSpecialWindow(
    windowName,
    {
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      title: options?.repositoryName
        ? `${options.repositoryName} - Dev Workspace`
        : 'Dev Workspace',
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false, // Required for terminal MessagePort
      },
    },
    {
      // Minimal features - no file system adapter, window manager adapter, or GitHub adapter
      // These would require the full preload, which we don't want
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

  // Load the dev-workspace HTML
  const payload = {
    repositoryPath: options?.repositoryPath,
    repositoryName: options?.repositoryName,
  };
  const encodedData = encodeURIComponent(JSON.stringify(payload));
  const url = `${resolveHtmlPath('dev-workspace.html')}#init/${encodedData}`;

  console.log(`[DevWorkspaceWindow] Window ${appWindow.window.id} loading: ${url}`);
  appWindow.window.loadURL(url);

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
