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
import { GitBranchService } from '../version-control-providers/gitBranchService';

/**
 * Repository window state
 */
export interface RepositoryWindowState {
  remoteUrl: string;
  state: 'opening' | 'ready';
}

/**
 * Get list of open repository windows with their states
 */
function getOpenRepositoryWindows(): RepositoryWindowState[] {
  const { getSpecialWindows, getApplicationWindows } = require('./modernWindowManager');
  const specialWindows = getSpecialWindows();
  const applicationWindows = getApplicationWindows();

  const repoWindows: RepositoryWindowState[] = [];

  for (const [windowName, windowId] of specialWindows.entries()) {
    if (windowName.startsWith('repository-maps-')) {
      const appWindow = applicationWindows.get(windowId);
      if (appWindow && !appWindow.window.isDestroyed()) {
        // Extract the remoteUrl from the window name
        const remoteUrl = windowName.replace('repository-maps-', '');
        // Check if window is ready (has been shown)
        const state = appWindow.window.isVisible() ? 'ready' : 'opening';
        repoWindows.push({ remoteUrl, state });
      }
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

      // Get current branch if we have a local path
      let currentBranch: string | undefined;
      if (repository.path) {
        try {
          const branchService = new GitBranchService();
          const branchInfo = await branchService.getBranchInfo(repository.path);
          currentBranch = branchInfo?.currentBranch;
          console.log(
            '[modernWindowHandlers] Retrieved branch info:',
            currentBranch,
          );
        } catch (error) {
          console.error(
            '[modernWindowHandlers] Failed to get branch info:',
            error,
          );
        }
      }

      // Try to get the full repository from the database which includes avatarUrl and vcsType
      const { RepositoryApiEventHandler } = require('../stores/RepositoryApiEventHandler');
      const repositoryHandler = new RepositoryApiEventHandler();
      let existingRepo = await repositoryHandler.getRepository(remoteUrl);

      // Determine VCS type from remote URL
      let vcsType: 'github' | 'gitlab' | 'bitbucket' | 'generic' = 'generic';
      if (remoteUrl.includes('github.com')) {
        vcsType = 'github';
      } else if (remoteUrl.includes('gitlab.com')) {
        vcsType = 'gitlab';
      } else if (remoteUrl.includes('bitbucket.org')) {
        vcsType = 'bitbucket';
      }

      // If repository doesn't have avatar but is a GitHub repo, fetch metadata
      if (existingRepo && !existingRepo.avatarUrl && vcsType === 'github') {
        console.log('[modernWindowHandlers] Fetching avatar for repository:', remoteUrl);
        try {
          existingRepo = await repositoryHandler.refreshRepositoryMetadata(remoteUrl);
        } catch (error) {
          console.error('[modernWindowHandlers] Failed to refresh metadata:', error);
        }
      }

      // Create the repository object in the format expected by Repository Maps
      const repoData = {
        owner,
        name: repoName,
        remoteUrl,
        vcsType: existingRepo?.vcsType || vcsType,
        avatarUrl: existingRepo?.avatarUrl,
        description: existingRepo?.description || repository.github?.description,
        localClones: repository.path
          ? [{ path: repository.path, currentBranch, addedAt: Date.now() }]
          : existingRepo?.localClones || [],
        addedAt: existingRepo?.addedAt || Date.now(),
        // Add other metadata that might be useful
        metadata: {
          stars: repository.github?.stars || existingRepo?.metadata?.stars,
          description: repository.github?.description || existingRepo?.metadata?.description,
          topics: repository.github?.topics || existingRepo?.metadata?.topics,
          license: repository.github?.license || existingRepo?.metadata?.license,
          defaultBranch: existingRepo?.metadata?.defaultBranch,
          isPrivate: existingRepo?.metadata?.isPrivate,
        },
      };

      const windowName = `repository-maps-${remoteUrl}`;

      // Check if window already exists before creating
      const {
        getSpecialWindows,
        getApplicationWindows,
      } = require('./modernWindowManager');
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
        // Broadcast immediately that window is opening
        broadcastRepositoryWindowsChanged();

        // Listen for when window is ready to show, then broadcast again
        window.window.once('ready-to-show', () => {
          console.log('[ModernWindow] Repository dashboard window ready to show');
          // Broadcast that window is now ready
          broadcastRepositoryWindowsChanged();
        });

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
}
