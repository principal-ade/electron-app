/**
 * Modern Window IPC Handlers using the modernWindowManager
 * Handles all window creation requests from renderer process
 */

import { ipcMain, dialog, screen } from 'electron';
import path from 'path';
import {
  createSpecialWindow,
  ModernApplicationWindow,
} from './modernWindowManager';
import { resolveHtmlPath } from '../util';
import { WindowEvent } from '../../shared/ipc-events/WindowEvents';
import type { AlexandriaEntry } from '@a24z/core-library';

/**
 * Register all modern window IPC handlers
 */
export function registerModernWindowHandlers(): void {
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
          mcpToolsAdapter: true,
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
      const windowName = `file-editor-${request.windowId}`;

      // Get screen dimensions for left-half positioning
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } =
        primaryDisplay.workAreaSize;

      const window = createSpecialWindow(
        windowName,
        {
          width: Math.floor(screenWidth / 2),
          height: screenHeight,
          x: 0,
          y: 0,
          minWidth: 1000,
          minHeight: 600,
          title: request.windowTitle || `File Editor`,
        },
        {
          fileSystemAdapter: true,
          contentSecurityPolicy: true,
          externalLinkHandler: true,
          menu: true,
        },
      );

      if (!window) return;

      // Pass the request data with a type indicator
      const payload = {
        ...request,
        editorType: 'local',
      };

      // Encode the payload as JSON in the URL
      const encoded = encodeURIComponent(JSON.stringify(payload));
      const url = `${resolveHtmlPath('index.html')}#multi-file-editor/${encoded}`;

      window.window.loadURL(url);
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
      const windowName = `file-editor-${request.windowId}`;

      // Get screen dimensions for left-half positioning
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } =
        primaryDisplay.workAreaSize;

      const window = createSpecialWindow(
        windowName,
        {
          width: Math.floor(screenWidth / 2),
          height: screenHeight,
          x: 0,
          y: 0,
          minWidth: 1000,
          minHeight: 600,
          title: request.windowTitle || `File Editor - ${request.owner}/${request.repo}`,
        },
        {
          fileSystemAdapter: true,
          githubAdapter: true,
          contentSecurityPolicy: true,
          externalLinkHandler: true,
          menu: true,
        },
      );

      if (!window) return;

      // Pass the request data with a type indicator
      const payload = {
        ...request,
        editorType: 'remote',
      };

      // Encode the payload as JSON in the URL
      const encoded = encodeURIComponent(JSON.stringify(payload));
      const url = `${resolveHtmlPath('index.html')}#multi-file-editor/${encoded}`;

      window.window.loadURL(url);
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
          mcpToolsAdapter: true,
          githubAdapter: true,
          contentSecurityPolicy: true,
          externalLinkHandler: true,
          menu: true,
          maximizeOnShow: true,
        },
      );

      if (!window) return;

      // Build URL with the mapped repository data
      const payload = { repository: repoData };
      const encodedData = encodeURIComponent(JSON.stringify(payload));
      const url = `${resolveHtmlPath('index.html')}#repository-maps/${encodedData}`;

      // Wait for adapters to initialize before loading URL
      setTimeout(() => {
        console.log(
          '[ModernWindow] Loading repository dashboard URL after adapter init delay:',
          url,
        );
        window.window.loadURL(url);
      }, 200);
    },
  );

  // Session Details Window
  ipcMain.handle(
    WindowEvent.OPEN_SESSION_DETAILS,
    async (
      _event,
      data: {
        sessionId?: string;
        directory?: string;
      },
    ) => {
      const { sessionId, directory } = data || {};
      const windowName = `session-details-${sessionId || 'default'}`;

      const window = createSpecialWindow(
        windowName,
        {
          width: 1200,
          height: 800,
          title: `Session Details${sessionId ? ` - ${sessionId.slice(0, 8)}` : ''}`,
        },
        {
          fileSystemAdapter: true,
          mcpToolsAdapter: true,
          contentSecurityPolicy: true,
        },
      );

      if (!window) return;

      // Load with session data
      const encodedData = encodeURIComponent(
        JSON.stringify({
          mode: 'session-details',
          sessionId,
          directory,
        }),
      );
      const url = `${resolveHtmlPath('index.html')}#session-details/${encodedData}`;

      window.window.loadURL(url);
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
  ipcMain.handle(WindowEvent.OPEN_MARKDOWN_VIEW, async (_event, filePath: string, projectName: string) => {
    if (!filePath || typeof filePath !== 'string') return;

    try {
      const fileName = path.basename(filePath);
      const windowName = `markdown-${filePath}`;

      const window = createSpecialWindow(
        windowName,
        {
          width: 1200,
          height: 800,
          title: `${projectName}: ${fileName}`,
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
          projectName,
        }),
      );
      const url = `${resolveHtmlPath('index.html')}#markdown-view/${encodedData}`;

      window.window.loadURL(url);
    } catch (err) {
      console.error('[modernWindowHandlers] OPEN_MARKDOWN_VIEW error:', err);
    }
  });

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

  // Search Window for Alexandria Repository Search
  ipcMain.handle(WindowEvent.OPEN_SEARCH_WINDOW, async () => {
    const windowName = 'alexandria-search';

    const window = createSpecialWindow(
      windowName,
      {
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: 'Alexandria Search',
      },
      {
        fileSystemAdapter: true,
        contentSecurityPolicy: true,
        externalLinkHandler: true,
        windowManagerAdapter: true,
      },
    );

    if (!window) return;

    const url = `${resolveHtmlPath('index.html')}#/search`;
    window.window.loadURL(url);
  });
}
