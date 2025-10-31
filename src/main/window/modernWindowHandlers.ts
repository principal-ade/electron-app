/**
 * Modern Window IPC Handlers using the modernWindowManager
 * Handles all window creation requests from renderer process
 */

import { ipcMain, dialog, screen } from 'electron';
import path from 'path';
import { createSpecialWindow } from './modernWindowManager';
import { resolveHtmlPath } from '../util';
import { WindowEvent } from '../../shared/ipc-events/WindowEvents';
import type { AlexandriaEntry } from '@a24z/core-library';
import type { IModernApplicationWindow } from './types';

/**
 * Register all modern window IPC handlers
 */
export function registerModernWindowHandlers(): void {
  const multiFileEditorDisabledMessage =
    'The multi-file editor is temporarily unavailable while we migrate to the new Monaco experience.';

  // Toggle main window minimize/restore
  ipcMain.handle(
    WindowEvent.TOGGLE_MAIN_WINDOW_MINIMIZE,
    async (_event, shouldMinimize: boolean) => {
      const { getMainWindowId } = require('./types');
      const { applicationWindows } = require('./types');

      const mainWindowId = getMainWindowId();
      if (!mainWindowId) {
        console.warn('[modernWindowHandlers] Main window ID not set');
        return;
      }

      const mainAppWindow = applicationWindows.get(mainWindowId);
      if (!mainAppWindow?.window || mainAppWindow.window.isDestroyed()) {
        console.warn(
          '[modernWindowHandlers] Main window not found or destroyed',
        );
        return;
      }

      if (shouldMinimize) {
        mainAppWindow.window.minimize();
      } else {
        mainAppWindow.window.restore();
      }

      // Broadcast the state change to all windows
      applicationWindows.forEach((appWindow: IModernApplicationWindow) => {
        if (appWindow.window && !appWindow.window.isDestroyed()) {
          appWindow.window.webContents.send(
            WindowEvent.MAIN_WINDOW_MINIMIZE_STATE_CHANGED,
            shouldMinimize,
          );
        }
      });
    },
  );

  // Store Viewer Window
  ipcMain.handle(
    WindowEvent.OPEN_STORE_VIEWER,
    async (
      _event,
      options?: {
        agent?: string;
        namespace?: string;
      },
    ) => {
      const windowName = 'store-viewer';

      const window = createSpecialWindow(
        windowName,
        {
          width: 1200,
          height: 800,
          minWidth: 800,
          minHeight: 600,
          title: 'Store Viewer',
        },
        {
          fileSystemAdapter: true,
          contentSecurityPolicy: true,
        },
      );

      if (!window) return;

      // Build URL with query parameters
      let url = `${resolveHtmlPath('index.html')}#store-viewer`;
      if (options) {
        const params = new URLSearchParams();
        if (options.agent) params.append('agent', options.agent);
        if (options.namespace) params.append('namespace', options.namespace);
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
      }

      window.window.loadURL(url);
    },
  );

  // Open Local Files in Editor Window
  ipcMain.handle(
    WindowEvent.OPEN_LOCAL_FILES,
    async (
      _event,
      request: {
        windowId: string;
        windowTitle?: string;
        files: Array<{
          path: string;
          relativePath?: string;
        }>;
      },
    ) => {
      await dialog.showMessageBox({
        type: 'info',
        message: multiFileEditorDisabledMessage,
      });

      if (process.env.NODE_ENV === 'development') {
        console.warn(
          '[modernWindowHandlers] OPEN_LOCAL_FILES intercepted; multi-file editor disabled.',
          request,
        );
      }
    },
  );

  // Open Remote Files in Editor Window
  ipcMain.handle(
    WindowEvent.OPEN_REMOTE_FILES,
    async (
      _event,
      request: {
        windowId: string;
        windowTitle?: string;
        files: Array<{
          path: string;
        }>;
        owner: string;
        repo: string;
        branch?: string;
      },
    ) => {
      await dialog.showMessageBox({
        type: 'info',
        message: multiFileEditorDisabledMessage,
      });

      if (process.env.NODE_ENV === 'development') {
        console.warn(
          '[modernWindowHandlers] OPEN_REMOTE_FILES intercepted; multi-file editor disabled.',
          request,
        );
      }
    },
  );

  // Repository Dashboard Window (for Alexandria repositories)
  ipcMain.handle(
    WindowEvent.OPEN_REPOSITORY_DASHBOARD,
    async (_event, repository: AlexandriaEntry) => {
      // Log the received repository to see what properties it actually has
      console.log(
        '[modernWindowHandlers] OPEN_REPOSITORY_DASHBOARD received:',
        {
          name: repository.name,
          hasPath: 'path' in repository,
          path: repository.path,
          keys: Object.keys(repository),
          fullObject: repository,
        },
      );

      // Extract owner from github data or parse from name
      let owner = repository.github?.owner;
      let repoName = repository.name;
      let remoteUrl = repository.remoteUrl;

      // No need to parse from githubUrl as it doesn't exist in AlexandriaEntry

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

      // Create the repository object in the format expected by Repository Maps
      const repoData = {
        owner,
        name: repoName,
        remoteUrl,
        localClones: repository.path ? [{ path: repository.path }] : [],
        // Add other metadata that might be useful
        metadata: {
          stars: repository.github?.stars,
          description: repository.github?.description,
          topics: repository.github?.topics,
          license: repository.github?.license,
        },
      };

      const windowName = `repository-maps-${remoteUrl}`;

      // Check if window already exists before creating
      const { getSpecialWindows, getApplicationWindows } =
        require('./modernWindowManager');
      const specialWindows = getSpecialWindows();
      const applicationWindows = getApplicationWindows();
      const existingWindowId = specialWindows.get(windowName);
      const windowAlreadyExists =
        existingWindowId &&
        applicationWindows.get(existingWindowId) &&
        !applicationWindows.get(existingWindowId).window.isDestroyed();

      const window = createSpecialWindow(
        windowName,
        {
          width: 1600,
          height: 1000,
          minWidth: 1200,
          minHeight: 800,
          title: `${repoName} - Code City Map`,
        },
        {
          fileSystemAdapter: true,
          windowManagerAdapter: true,
          githubAdapter: true,
          terminalManager: true,
          contentSecurityPolicy: true,
          externalLinkHandler: true,
          menu: true,
          maximizeOnShow: true,
        },
      );

      if (!window) return;

      // Only load URL for newly created windows, not existing ones
      if (!windowAlreadyExists) {
        // Build URL with the mapped repository data
        const payload = { repository: repoData };
        const encodedData = encodeURIComponent(JSON.stringify(payload));
        const url = `${resolveHtmlPath('repo-manager.html')}#repository-maps/${encodedData}`;

        // Wait for adapters to initialize before loading URL
        setTimeout(() => {
          console.log(
            '[ModernWindow] Loading repository dashboard URL after adapter init delay:',
            url,
          );
          window.window.loadURL(url);
        }, 200);
      } else {
        console.log(
          '[ModernWindow] Window already exists, focusing without reload:',
          windowName,
        );
      }
    },
  );

  // Markdown File Dialog and Window
  ipcMain.handle(WindowEvent.OPEN_MARKDOWN_FILE_DIALOG, async (_event) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Markdown Files', extensions: ['md', 'markdown'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const fileName = path.basename(filePath);
      const windowName = `markdown-${filePath}`;

      const window = createSpecialWindow(
        windowName,
        {
          width: 1200,
          height: 800,
          title: `Markdown: ${fileName}`,
        },
        {
          fileSystemAdapter: true,
          contentSecurityPolicy: true,
          externalLinkHandler: true,
        },
      );

      if (!window) return;

      // Load with file data
      const encodedData = encodeURIComponent(
        JSON.stringify({
          mode: 'markdown-view',
          filePath,
        }),
      );
      const url = `${resolveHtmlPath('index.html')}#markdown-view/${encodedData}`;

      window.window.loadURL(url);
    }
  });

  // Open a markdown view window for a specific file path (renderer can call this directly)
  ipcMain.handle(
    WindowEvent.OPEN_MARKDOWN_VIEW,
    async (
      _event,
      filePath: string,
      projectName: string,
      options?: { viewMode?: 'single' | 'book' },
    ) => {
      if (!filePath || typeof filePath !== 'string') return;

      try {
        const fileName = path.basename(filePath);
        const windowName = `markdown-${filePath}`;

        // Get screen dimensions for full-size window
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width: screenWidth, height: screenHeight } =
          primaryDisplay.workAreaSize;

        // If viewMode is 'single', position window on right half of screen
        const isRightHalf = options?.viewMode === 'single';
        const windowConfig = isRightHalf
          ? {
              width: Math.floor(screenWidth / 2),
              height: screenHeight,
              x: Math.floor(screenWidth / 2),
              y: 0,
              minWidth: 600,
              minHeight: 400,
              title: `${projectName}: ${fileName}`,
            }
          : {
              width: 1200,
              height: 800,
              minWidth: 800,
              minHeight: 600,
              title: `${projectName}: ${fileName}`,
            };

        const window = createSpecialWindow(windowName, windowConfig, {
          fileSystemAdapter: true,
          contentSecurityPolicy: true,
          externalLinkHandler: true,
          maximizeOnShow: !isRightHalf, // Don't maximize if positioning on right half
        });

        if (!window) return;

        // Load with file data
        const encodedData = encodeURIComponent(
          JSON.stringify({
            mode: 'markdown-view',
            filePath,
            projectName,
            viewMode: options?.viewMode,
          }),
        );
        const url = `${resolveHtmlPath('index.html')}#markdown-view/${encodedData}`;

        window.window.loadURL(url);
      } catch (err) {
        console.error('[modernWindowHandlers] OPEN_MARKDOWN_VIEW error:', err);
      }
    },
  );

  // Callimachus Pattern Discovery Window
  ipcMain.handle(WindowEvent.OPEN_CALLIMACHUS_WINDOW, async () => {
    const windowName = 'callimachus-pattern-discovery';

    const window = createSpecialWindow(
      windowName,
      {
        width: 1000,
        height: 700,
        minWidth: 800,
        minHeight: 500,
        title: 'Pattern Discovery - Callimachus',
      },
      {
        fileSystemAdapter: true,
        contentSecurityPolicy: true,
        externalLinkHandler: true,
      },
    );

    if (!window) return;

    const url = `${resolveHtmlPath('index.html')}#/callimachus`;
    window.window.loadURL(url);
  });

  // Palace Room Workspace Window
  ipcMain.handle(WindowEvent.OPEN_PALACE_ROOM_WORKSPACE, async () => {
    const windowName = 'palace-room-workspace';

    const window = createSpecialWindow(
      windowName,
      {
        width: 1280,
        height: 832,
        minWidth: 1024,
        minHeight: 720,
        title: 'Palace Room Workspace',
      },
      {
        fileSystemAdapter: true,
        windowManagerAdapter: true,
        githubAdapter: true,
        contentSecurityPolicy: true,
        externalLinkHandler: true,
        menu: true,
      },
    );

    if (!window) return;

    const url = resolveHtmlPath('palace-room-workspace.html');
    window.window.loadURL(url);
  });
}
