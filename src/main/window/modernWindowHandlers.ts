/**
 * Modern Window IPC Handlers using the modernWindowManager
 * Handles all window creation requests from renderer process
 */

import { ipcMain, BrowserWindow } from 'electron';
import {
  createSpecialWindow,
  focusExistingSpecialWindow,
  focusOrCreateMainWindow,
} from './modernWindowManager';
import { resolveHtmlPath } from '../util';
import { WindowEvent } from '../../shared/ipc-events/WindowEvents';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';
import type {
  IModernApplicationWindow,
  WindowMetadata,
  TabTransferData,
} from './types';
import { PrimaryWindowType } from './types';
import { getManager as getMonitoringManager } from '../repository-monitoring/ipcHandlers';

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
 * Open Alexandria workspace window, reduced to the bits the home view needs
 * to mark which topics currently have a window open.
 */
export interface WorkspaceWindowState {
  workspaceId?: string;
  topicIds: string[];
}

/**
 * Get list of open Alexandria workspace windows with their workspace/topic ids.
 * Driven off window metadata (`workspaceId` + `topicIds`), which is mirrored
 * from the workspace registry at open time.
 */
function getOpenWorkspaceWindows(): WorkspaceWindowState[] {
  const { getApplicationWindows } = require('./modernWindowManager');
  const applicationWindows = getApplicationWindows();

  const workspaceWindows: WorkspaceWindowState[] = [];
  applicationWindows.forEach((appWindow: IModernApplicationWindow) => {
    if (!appWindow.window || appWindow.window.isDestroyed()) return;
    if (appWindow.metadata?.primaryType !== PrimaryWindowType.WORKSPACE) return;
    workspaceWindows.push({
      workspaceId: appWindow.metadata.workspaceId,
      topicIds: appWindow.metadata.topicIds ?? [],
    });
  });
  return workspaceWindows;
}

/**
 * Broadcast workspace windows changed event to all windows
 */
export function broadcastWorkspaceWindowsChanged(): void {
  const { getApplicationWindows } = require('./modernWindowManager');
  const applicationWindows = getApplicationWindows();
  const openWorkspaceWindows = getOpenWorkspaceWindows();

  applicationWindows.forEach((appWindow: IModernApplicationWindow) => {
    if (appWindow.window && !appWindow.window.isDestroyed()) {
      appWindow.window.webContents.send(
        WindowEvent.WORKSPACE_WINDOWS_CHANGED,
        openWorkspaceWindows,
      );
    }
  });
}

/**
 * Register all modern window IPC handlers
 */
export function registerModernWindowHandlers(): void {
  // Alexandria Workspace Window
  ipcMain.handle(
    WindowEvent.OPEN_ALEXANDRIA_WORKSPACE,
    async (
      _event,
      options: {
        workspaceId?: string;
        repositoryPath?: string;
        repositoryId?: string;
        additionalRepositoryPaths?: string[];
        openEmptyThread?: boolean;
      },
    ) => {
      const {
        workspaceId,
        repositoryPath,
        repositoryId,
        additionalRepositoryPaths,
        openEmptyThread,
      } = options;

      // Thread mode: repositoryPath without workspaceId, or explicitly opening empty thread
      const isThread = !workspaceId && (!!repositoryPath || openEmptyThread);

      // Determine window name and display name
      let windowName: string;
      let workspaceName: string;
      let topicIds: string[] | undefined;

      if (workspaceId) {
        // Standard workspace mode
        windowName = `alexandria-workspace-${workspaceId}`;

        // Fetch workspace name from the registry
        workspaceName = 'Alexandria Workspace';
        try {
          const {
            AlexandriaRegistryService,
          } = require('../stores/AlexandriaRegistryService');
          const service = AlexandriaRegistryService.getInstance();
          const workspace = await service.getWorkspace(workspaceId);
          if (workspace?.name) {
            workspaceName = workspace.name;
          }
          if (workspace?.topicIds && workspace.topicIds.length > 0) {
            topicIds = [...workspace.topicIds];
          }
        } catch (error) {
          console.error(
            '[modernWindowHandlers] Failed to fetch workspace name:',
            error,
          );
        }
      } else if (repositoryPath || repositoryId) {
        // Temp workspace mode (single repository)
        const repoIdentifier =
          repositoryId || repositoryPath || `temp-${Date.now()}`;
        // Sanitize for window name (remove special characters)
        const sanitized = repoIdentifier.replace(/[^a-zA-Z0-9-_]/g, '-');
        windowName = `alexandria-workspace-temp-${sanitized}`;

        // Extract repo name from path or ID for display
        if (repositoryPath) {
          const pathParts = repositoryPath.split('/');
          workspaceName =
            pathParts[pathParts.length - 1] || 'Repository Workspace';
        } else if (repositoryId) {
          const idParts = repositoryId.split('/');
          workspaceName = idParts[idParts.length - 1] || 'Repository Workspace';
        } else {
          workspaceName = 'Repository Workspace';
        }
      } else if (openEmptyThread) {
        // Empty thread mode - no initial repositories
        windowName = `alexandria-thread-${Date.now()}`;
        workspaceName = 'New Thread';
      } else {
        console.error(
          '[modernWindowHandlers] OPEN_ALEXANDRIA_WORKSPACE called without workspaceId or repository info',
        );
        return;
      }

      // If a window with this purpose is already live, focus it and stop.
      // The post-create setup below (loadURL, terminalManager rebind, watch
      // re-acquisition) would otherwise tear down the existing renderer.
      const existing = focusExistingSpecialWindow(windowName);
      if (existing) {
        return;
      }

      // Collect all repository paths for thread mode
      const allRepositoryPaths: string[] = [];
      if (repositoryPath) {
        allRepositoryPaths.push(repositoryPath);
      }
      if (additionalRepositoryPaths) {
        allRepositoryPaths.push(...additionalRepositoryPaths);
      }

      // Create metadata for workspace window
      const metadata: WindowMetadata = {
        primaryType: PrimaryWindowType.WORKSPACE,
        displayName: workspaceName,
        workspaceId: workspaceId || undefined,
        topicIds,
        purpose: windowName,
        // Thread-specific metadata
        isThread,
        threadRepositoryPaths: isThread ? allRepositoryPaths : undefined,
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

      // Let the home view (and any other window) mark this topic as open.
      broadcastWorkspaceWindowsChanged();

      // Register window with terminal manager to receive terminal events
      const { terminalManager } = await import('../terminal');
      terminalManager?.setMainWindow(window.window);
      console.log(
        `[modernWindowHandlers] Registered Alexandria Workspace window ${window.window.id} with terminal manager`,
      );

      // Acquire watches for repositories (in parallel, non-blocking)
      const watchReferenceId = `alexandria-workspace:${window.window.id}`;
      const registeredRepoPaths: string[] = [];

      // Fire off watch acquisition in background - don't block window loading
      (async () => {
        try {
          const monitoringManager = getMonitoringManager();

          if (workspaceId) {
            // Workspace mode - watch all repositories in the workspace
            const {
              AlexandriaRegistryService,
            } = require('../stores/AlexandriaRegistryService');
            const service = AlexandriaRegistryService.getInstance();
            const repositories =
              await service.getRepositoriesInWorkspace(workspaceId);

            // Filter repos with valid paths
            const reposWithPaths = repositories.filter(
              (
                repo: AlexandriaEntry,
              ): repo is AlexandriaEntry & { path: string } => !!repo.path,
            );

            // Acquire watches in parallel (acquireWatch auto-registers if needed)
            const results = await Promise.allSettled(
              reposWithPaths.map(async (repo: { path: string }) => {
                const repoPath = repo.path;
                await monitoringManager.acquireWatch(
                  repoPath,
                  watchReferenceId,
                );
                return repoPath;
              }),
            );

            // Track successful registrations for cleanup on window close
            for (const result of results) {
              if (result.status === 'fulfilled') {
                registeredRepoPaths.push(result.value);
                console.log(
                  `[modernWindowHandlers] Acquired watch for ${result.value} (reference: ${watchReferenceId})`,
                );
              } else {
                console.error(
                  `[modernWindowHandlers] Failed to acquire watch:`,
                  result.reason,
                );
              }
            }

            console.log(
              `[modernWindowHandlers] Acquired watches for ${registeredRepoPaths.length}/${reposWithPaths.length} repositories`,
            );
          } else if (allRepositoryPaths.length > 0) {
            // Thread mode - watch all repositories in the thread
            const results = await Promise.allSettled(
              allRepositoryPaths.map(async (repoPath: string) => {
                await monitoringManager.acquireWatch(
                  repoPath,
                  watchReferenceId,
                );
                return repoPath;
              }),
            );

            for (const result of results) {
              if (result.status === 'fulfilled') {
                registeredRepoPaths.push(result.value);
                console.log(
                  `[modernWindowHandlers] Acquired watch for thread repository: ${result.value} (reference: ${watchReferenceId})`,
                );
              } else {
                console.error(
                  `[modernWindowHandlers] Failed to acquire watch for thread repository:`,
                  result.reason,
                );
              }
            }

            console.log(
              `[modernWindowHandlers] Thread: acquired watches for ${registeredRepoPaths.length}/${allRepositoryPaths.length} repositories`,
            );
          }
        } catch (error) {
          console.error(
            '[modernWindowHandlers] Failed to acquire watches for repositories:',
            error,
          );
        }
      })();

      // Release watches when window closes
      window.window.once('closed', () => {
        const monitoringManager = getMonitoringManager();
        for (const repoPath of registeredRepoPaths) {
          monitoringManager
            .releaseWatch(repoPath, watchReferenceId)
            .catch((err: unknown) => {
              console.error(
                `[modernWindowHandlers] Failed to release watch for ${repoPath}:`,
                err,
              );
            });
        }
        console.log(
          `[modernWindowHandlers] Released watches for ${registeredRepoPaths.length} repositories (reference: ${watchReferenceId})`,
        );
      });

      // Pass parameters to the window via URL
      const urlParams = new URLSearchParams();
      if (workspaceId) {
        urlParams.set('workspaceId', workspaceId);
      }
      if (repositoryPath) {
        urlParams.set('repositoryPath', repositoryPath);
      }
      if (repositoryId) {
        urlParams.set('repositoryId', repositoryId);
      }
      // Pass additional repository paths for thread mode
      if (additionalRepositoryPaths && additionalRepositoryPaths.length > 0) {
        urlParams.set(
          'additionalRepositoryPaths',
          additionalRepositoryPaths.join(','),
        );
      }
      // Mark as empty thread if opened without repositories
      if (openEmptyThread) {
        urlParams.set('emptyThread', 'true');
      }

      const url = `${resolveHtmlPath('alexandria-workspace.html')}?${urlParams.toString()}`;
      window.window.loadURL(url);
    },
  );

  // Add repository to an existing thread window
  ipcMain.handle(
    WindowEvent.ADD_REPOSITORY_TO_THREAD,
    async (_event, options: { windowId: number; repositoryPath: string }) => {
      const { windowId, repositoryPath } = options;

      const { getApplicationWindows } = require('./modernWindowManager');
      const applicationWindows = getApplicationWindows();
      const appWindow = applicationWindows.get(windowId);

      if (!appWindow || appWindow.window.isDestroyed()) {
        return { success: false, error: 'Window not found' };
      }

      // Check if this is a thread window
      if (!appWindow.metadata.isThread) {
        return { success: false, error: 'Window is not a thread' };
      }

      // Check if repository is already in the thread
      const currentPaths = appWindow.metadata.threadRepositoryPaths || [];
      if (currentPaths.includes(repositoryPath)) {
        return { success: false, error: 'Repository already in thread' };
      }

      // Update metadata
      currentPaths.push(repositoryPath);
      appWindow.metadata.threadRepositoryPaths = currentPaths;

      // Acquire watch for new repository
      const watchReferenceId = `alexandria-workspace:${windowId}`;
      try {
        const monitoringManager = getMonitoringManager();
        await monitoringManager.acquireWatch(repositoryPath, watchReferenceId);
        console.log(
          `[modernWindowHandlers] Added repository to thread: ${repositoryPath} (window: ${windowId})`,
        );
      } catch (error) {
        console.error(
          `[modernWindowHandlers] Failed to acquire watch for added repository:`,
          error,
        );
        // Still continue - the repository was added to metadata
      }

      // Notify renderer of change
      appWindow.window.webContents.send(
        WindowEvent.THREAD_REPOSITORIES_CHANGED,
        {
          repositoryPaths: currentPaths,
          addedPath: repositoryPath,
        },
      );

      return { success: true };
    },
  );

  // Remove repository from a thread window
  ipcMain.handle(
    WindowEvent.REMOVE_REPOSITORY_FROM_THREAD,
    async (_event, options: { windowId: number; repositoryPath: string }) => {
      const { windowId, repositoryPath } = options;

      const { getApplicationWindows } = require('./modernWindowManager');
      const applicationWindows = getApplicationWindows();
      const appWindow = applicationWindows.get(windowId);

      if (!appWindow || appWindow.window.isDestroyed()) {
        return { success: false, error: 'Window not found' };
      }

      if (!appWindow.metadata.isThread) {
        return { success: false, error: 'Window is not a thread' };
      }

      const currentPaths = appWindow.metadata.threadRepositoryPaths || [];
      const index = currentPaths.indexOf(repositoryPath);
      if (index === -1) {
        return { success: false, error: 'Repository not in thread' };
      }

      // Don't allow removing the last repository
      if (currentPaths.length <= 1) {
        return {
          success: false,
          error: 'Cannot remove last repository from thread',
        };
      }

      // Update metadata
      currentPaths.splice(index, 1);
      appWindow.metadata.threadRepositoryPaths = currentPaths;

      // Release watch for removed repository
      const watchReferenceId = `alexandria-workspace:${windowId}`;
      try {
        const monitoringManager = getMonitoringManager();
        await monitoringManager.releaseWatch(repositoryPath, watchReferenceId);
        console.log(
          `[modernWindowHandlers] Removed repository from thread: ${repositoryPath} (window: ${windowId})`,
        );
      } catch (error) {
        console.error(
          `[modernWindowHandlers] Failed to release watch for removed repository:`,
          error,
        );
      }

      // Notify renderer of change
      appWindow.window.webContents.send(
        WindowEvent.THREAD_REPOSITORIES_CHANGED,
        {
          repositoryPaths: currentPaths,
          removedPath: repositoryPath,
        },
      );

      return { success: true };
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

  // Get list of open Alexandria workspace windows
  ipcMain.handle(WindowEvent.GET_OPEN_WORKSPACE_WINDOWS, async () => {
    return getOpenWorkspaceWindows();
  });

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
