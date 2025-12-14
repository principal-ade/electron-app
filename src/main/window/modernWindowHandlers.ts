/**
 * Modern Window IPC Handlers using the modernWindowManager
 * Handles all window creation requests from renderer process
 */

import { ipcMain, dialog, screen } from 'electron';
import path from 'path';
import {
  createSpecialWindow,
  focusOrCreateMainWindow,
} from './modernWindowManager';
import { resolveHtmlPath } from '../util';
import { WindowEvent } from '../../shared/ipc-events/WindowEvents';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';
import type { IModernApplicationWindow, WindowMetadata } from './types';
import { PrimaryWindowType } from './types';
import { gitStatusService } from '../services/GitStatusService';

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
  const multiFileEditorDisabledMessage =
    'The multi-file editor is temporarily unavailable while we migrate to the new Monaco experience.';

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

  // Open a markdown view window with relative path from repository
  ipcMain.handle(
    WindowEvent.OPEN_MARKDOWN_VIEW_FROM_REPOSITORY,
    async (
      _event,
      relativeFilePath: string,
      repositoryPath: string,
      options?: { viewMode?: 'single' | 'book' },
    ) => {
      if (!relativeFilePath || typeof relativeFilePath !== 'string') return;
      if (!repositoryPath || typeof repositoryPath !== 'string') return;

      try {
        // Resolve the relative path against the repository path
        const absoluteFilePath = path.join(repositoryPath, relativeFilePath);

        // Use the existing OPEN_MARKDOWN_VIEW handler logic
        const fileName = path.basename(absoluteFilePath);
        const windowName = `markdown-${absoluteFilePath}`;

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
              title: `${path.basename(repositoryPath)}: ${fileName}`,
            }
          : {
              width: 1200,
              height: 800,
              minWidth: 800,
              minHeight: 600,
              title: `${path.basename(repositoryPath)}: ${fileName}`,
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
            filePath: absoluteFilePath,
            projectName: repositoryPath,
            viewMode: options?.viewMode,
          }),
        );
        const url = `${resolveHtmlPath('index.html')}#markdown-view/${encodedData}`;

        window.window.loadURL(url);
      } catch (err) {
        console.error(
          '[modernWindowHandlers] OPEN_MARKDOWN_VIEW_FROM_REPOSITORY error:',
          err,
        );
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

  // Alexandria Workspace Window
  ipcMain.handle(
    WindowEvent.OPEN_ALEXANDRIA_WORKSPACE,
    async (_event, workspaceId: string) => {
      if (!workspaceId) {
        console.error(
          '[modernWindowHandlers] OPEN_ALEXANDRIA_WORKSPACE called without workspaceId',
        );
        return;
      }

      const windowName = `alexandria-workspace-${workspaceId}`;

      // Fetch workspace name from the registry
      let workspaceName = 'Alexandria Workspace';
      try {
        const {
          AlexandriaRegistryService,
        } = require('../stores/AlexandriaRegistryService');
        const service = AlexandriaRegistryService.getInstance();
        const workspace = await service.getWorkspace(workspaceId);
        if (workspace?.name) {
          workspaceName = workspace.name;
        }
      } catch (error) {
        console.error(
          '[modernWindowHandlers] Failed to fetch workspace name:',
          error,
        );
      }

      // Create metadata for workspace window
      const metadata: WindowMetadata = {
        primaryType: PrimaryWindowType.WORKSPACE,
        displayName: workspaceName,
        workspaceId,
        purpose: windowName,
      };

      const window = createSpecialWindow(
        windowName,
        {
          width: 1280,
          height: 832,
          minWidth: 1024,
          minHeight: 720,
          title: workspaceName,
        },
        {
          fileSystemAdapter: true,
          windowManagerAdapter: true,
          githubAdapter: true,
          contentSecurityPolicy: true,
          externalLinkHandler: true,
          menu: true,
          maximizeOnShow: true,
        },
        metadata,
      );

      if (!window) return;

      // Register window with terminal manager to receive terminal events
      const { terminalManager } = await import('../terminal');
      terminalManager?.setMainWindow(window.window);
      console.log(
        `[modernWindowHandlers] Registered Alexandria Workspace window ${window.window.id} with terminal manager`,
      );

      // Pass workspace ID to the window via URL parameter
      const encodedWorkspaceId = encodeURIComponent(workspaceId);
      const url = `${resolveHtmlPath('alexandria-workspace.html')}?workspaceId=${encodedWorkspaceId}`;
      window.window.loadURL(url);
    },
  );

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

  // Focus or create main window
  ipcMain.handle(WindowEvent.FOCUS_OR_CREATE_MAIN_WINDOW, async () => {
    const window = await focusOrCreateMainWindow();
    return window !== null;
  });
}
