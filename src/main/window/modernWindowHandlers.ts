/**
 * Modern Window IPC Handlers using the modernWindowManager
 * Handles all window creation requests from renderer process
 */

import { ipcMain } from 'electron';
import {
  createSpecialWindow,
  focusOrCreateMainWindow,
} from './modernWindowManager';
import { resolveHtmlPath } from '../util';
import { WindowEvent } from '../../shared/ipc-events/WindowEvents';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';
import type { IModernApplicationWindow, WindowMetadata } from './types';
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
 * Register all modern window IPC handlers
 */
export function registerModernWindowHandlers(): void {
  // Alexandria Workspace Window
  ipcMain.handle(
    WindowEvent.OPEN_ALEXANDRIA_WORKSPACE,
    async (_event, options: { workspaceId?: string; repositoryPath?: string; repositoryId?: string }) => {
      const { workspaceId, repositoryPath, repositoryId } = options;

      // Determine window name and display name
      let windowName: string;
      let workspaceName: string;

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
        } catch (error) {
          console.error(
            '[modernWindowHandlers] Failed to fetch workspace name:',
            error,
          );
        }
      } else if (repositoryPath || repositoryId) {
        // Temp workspace mode (single repository)
        const repoIdentifier = repositoryId || repositoryPath || `temp-${Date.now()}`;
        // Sanitize for window name (remove special characters)
        const sanitized = repoIdentifier.replace(/[^a-zA-Z0-9-_]/g, '-');
        windowName = `alexandria-workspace-temp-${sanitized}`;

        // Extract repo name from path or ID for display
        if (repositoryPath) {
          const pathParts = repositoryPath.split('/');
          workspaceName = pathParts[pathParts.length - 1] || 'Repository Workspace';
        } else if (repositoryId) {
          const idParts = repositoryId.split('/');
          workspaceName = idParts[idParts.length - 1] || 'Repository Workspace';
        } else {
          workspaceName = 'Repository Workspace';
        }
      } else {
        console.error(
          '[modernWindowHandlers] OPEN_ALEXANDRIA_WORKSPACE called without workspaceId or repository info',
        );
        return;
      }

      // Create metadata for workspace window
      const metadata: WindowMetadata = {
        primaryType: PrimaryWindowType.WORKSPACE,
        displayName: workspaceName,
        workspaceId: workspaceId || undefined,
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
              (repo: AlexandriaEntry): repo is AlexandriaEntry & { path: string } =>
                !!repo.path,
            );

            // Acquire watches in parallel (acquireWatch auto-registers if needed)
            const results = await Promise.allSettled(
              reposWithPaths.map(async (repo: { path: string }) => {
                const repoPath = repo.path;
                await monitoringManager.acquireWatch(repoPath, watchReferenceId);
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
          } else if (repositoryPath) {
            // Temp mode - watch only the single repository
            await monitoringManager.acquireWatch(repositoryPath, watchReferenceId);
            registeredRepoPaths.push(repositoryPath);
            console.log(
              `[modernWindowHandlers] Acquired watch for single repository: ${repositoryPath} (reference: ${watchReferenceId})`,
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

      const url = `${resolveHtmlPath('alexandria-workspace.html')}?${urlParams.toString()}`;
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
