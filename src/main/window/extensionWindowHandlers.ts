/**
 * Extension Window Handlers
 *
 * IPC handlers for the extension browser window.
 * This window allows users to browse and launch panel extensions.
 */

import { ipcMain, app } from 'electron';
import path from 'path';
import { resolveHtmlPath } from '../util';
import {
  createSpecialWindow,
  focusExistingSpecialWindow,
} from './modernWindowManager';
import { PrimaryWindowType, WindowMetadata } from './types';
import { WindowEvent } from '../../shared/ipc-events/WindowEvents';

const EXTENSION_WINDOW_PURPOSE = 'extension-browser';

/**
 * Options for opening an extension window
 */
export interface ExtensionWindowOptions {
  /** Optional: pre-select a panel to display */
  panelId?: string;
}

/**
 * Get the preload path for extension windows
 */
function getExtensionWindowPreloadPath(): string {
  return app.isPackaged
    ? path.join(__dirname, 'preload-extension-window.js')
    : path.join(__dirname, '../../.erb/dll/preload-extension-window.js');
}

/**
 * Open the extension browser window
 */
export async function openExtensionWindow(
  options?: ExtensionWindowOptions,
): Promise<{ windowId: number } | null> {
  const windowName = EXTENSION_WINDOW_PURPOSE;

  const existing = focusExistingSpecialWindow(windowName);
  if (existing) {
    return { windowId: existing.window.id };
  }

  // Get the extension window preload path
  const preloadPath = getExtensionWindowPreloadPath();
  console.log(`[ExtensionWindow] Using preload: ${preloadPath}`);

  // Create metadata
  const metadata: WindowMetadata = {
    primaryType: PrimaryWindowType.EXTENSION,
    displayName: 'Extensions',
    purpose: windowName,
  };

  // Create the window
  const appWindow = createSpecialWindow(
    windowName,
    {
      width: 1000,
      height: 700,
      minWidth: 600,
      minHeight: 400,
      title: 'Extensions',
      alwaysOnTop: true,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    },
    {
      menu: true,
      devTools: true,
      contentSecurityPolicy: true,
      externalLinkHandler: true,
      errorHandlers: true,
    },
    metadata,
  );

  if (!appWindow) {
    console.error('[ExtensionWindow] Failed to create window');
    return null;
  }

  // Load the extension window HTML
  const payload = {
    panelId: options?.panelId,
  };
  const encodedData = encodeURIComponent(JSON.stringify(payload));
  const url = `${resolveHtmlPath('extension-window.html')}#init/${encodedData}`;

  console.log(
    `[ExtensionWindow] Window ${appWindow.window.id} loading: ${url}`,
  );
  appWindow.window.loadURL(url);

  return { windowId: appWindow.window.id };
}

/**
 * Register IPC handlers for extension windows
 */
export function registerExtensionWindowHandlers(): void {
  // Open extension window
  ipcMain.handle(
    WindowEvent.OPEN_EXTENSION_WINDOW,
    async (_event, options?: ExtensionWindowOptions) => {
      return openExtensionWindow(options);
    },
  );

  console.log('[ExtensionWindow] IPC handlers registered');
}
