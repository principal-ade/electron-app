/**
 * Dev Workspace Window Handlers
 *
 * IPC handlers for the dev-workspace window (panel framework).
 * This window uses a minimal preload with only the APIs it needs.
 */

import { ipcMain, app, screen } from 'electron';
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
import { AlexandriaRegistryService } from '../stores/AlexandriaRegistryService';
import { getTracer } from '../telemetry';
import { SpanStatusCode } from '@opentelemetry/api';
import { presenceWindowBridge } from '../services/PresenceWindowBridge';
import { GitClientFactory } from '../utils/gitClientFactory';

/**
 * Parse owner/repo from a GitHub remote URL
 * Supports: https://github.com/owner/repo.git, git@github.com:owner/repo.git
 */
function parseGitHubRemoteUrl(
  remoteUrl: string | undefined,
): { owner: string; repo: string } | null {
  if (!remoteUrl) return null;

  // HTTPS format: https://github.com/owner/repo.git
  const httpsMatch = remoteUrl.match(
    /github\.com\/([^/]+)\/([^/.]+)(?:\.git)?/,
  );
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  // SSH format: git@github.com:owner/repo.git
  const sshMatch = remoteUrl.match(/github\.com:([^/]+)\/([^/.]+)(?:\.git)?/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  return null;
}

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
  const tracer = getTracer('principal-ade-main');

  // Update lastOpenedAt timestamp for the repository (fire-and-forget)
  // This is done centrally here so ALL entry points (quick open, deep links, etc.) update the timestamp
  const updateSpan = tracer.startSpan(
    'alexandria.dev_workspace.update_last_opened',
  );
  updateSpan.setAttributes({
    repository_name: alexandriaEntry.name,
    repository_path: alexandriaEntry.path,
  });

  AlexandriaRegistryService.getInstance()
    .updateLastOpened(alexandriaEntry.name)
    .then(() => {
      updateSpan.setStatus({ code: SpanStatusCode.OK });
      updateSpan.end();
    })
    .catch((error) => {
      console.error(
        '[DevWorkspaceWindow] Failed to update lastOpenedAt:',
        error,
      );
      updateSpan.recordException(
        error instanceof Error ? error : new Error(String(error)),
      );
      updateSpan.setStatus({ code: SpanStatusCode.ERROR });
      updateSpan.end();
      // Don't block opening the window if update fails
    });

  // Refresh GitHub metadata for the repository (fire-and-forget)
  // This ensures we have up-to-date description, stars, topics, etc.
  const refreshSpan = tracer.startSpan(
    'alexandria.dev_workspace.refresh_github_metadata',
  );
  refreshSpan.setAttributes({
    repository_name: alexandriaEntry.name,
    repository_path: alexandriaEntry.path,
  });

  AlexandriaRegistryService.getInstance()
    .refreshRepository(alexandriaEntry.name)
    .then((updatedEntry) => {
      if (updatedEntry) {
        console.log(
          `[DevWorkspaceWindow] Refreshed GitHub metadata for ${alexandriaEntry.name}`,
        );
      }
      refreshSpan.setStatus({ code: SpanStatusCode.OK });
      refreshSpan.end();
    })
    .catch((error) => {
      console.error(
        '[DevWorkspaceWindow] Failed to refresh GitHub metadata:',
        error,
      );
      refreshSpan.recordException(
        error instanceof Error ? error : new Error(String(error)),
      );
      refreshSpan.setStatus({ code: SpanStatusCode.ERROR });
      refreshSpan.end();
      // Don't block opening the window if refresh fails
    });

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
    alexandriaEntry,
  };

  // Get primary display dimensions for full-screen size
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } =
    primaryDisplay.workAreaSize;

  // Create the window with terminal and file system support
  const appWindow = createSpecialWindow(
    windowName,
    {
      width: screenWidth,
      height: screenHeight,
      x: primaryDisplay.workArea.x,
      y: primaryDisplay.workArea.y,
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

  // Track repository for presence system
  const presenceWindowId = `dev-workspace:${appWindow.window.id}`;
  const githubInfo = parseGitHubRemoteUrl(alexandriaEntry.remoteUrl);

  if (githubInfo) {
    // Get current branch for presence tracking
    GitClientFactory.getCurrentBranch(repoPath)
      .then((branch) => {
        const branchName = branch || 'main';
        console.log(
          `[DevWorkspaceWindow] Tracking presence for ${githubInfo.owner}/${githubInfo.repo}@${branchName}`,
        );
        return presenceWindowBridge.trackRepositoryOpened(
          presenceWindowId,
          githubInfo.owner,
          githubInfo.repo,
          branchName,
          repoPath,
        );
      })
      .then(() => {
        // Setup focus tracking
        presenceWindowBridge.setupWindowFocusTracking(
          appWindow.window,
          presenceWindowId,
        );
      })
      .catch((error) => {
        console.error(
          '[DevWorkspaceWindow] Failed to track repository for presence:',
          error,
        );
      });
  } else {
    console.log(
      `[DevWorkspaceWindow] No GitHub remote found for ${alexandriaEntry.name}, skipping presence tracking`,
    );
  }

  // Release watch and broadcast when window closes
  appWindow.window.once('closed', () => {
    broadcastRepositoryWindowsChanged();

    // Release watch for the repository
    try {
      const monitoringManager = getMonitoringManager();
      monitoringManager
        .releaseWatch(repoPath, watchReferenceId)
        .catch((err: unknown) => {
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

    // Track repository closed for presence system
    if (githubInfo) {
      presenceWindowBridge.trackRepositoryClosed(presenceWindowId).catch((err) => {
        console.error(
          '[DevWorkspaceWindow] Failed to track repository closed:',
          err,
        );
      });
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
      if (!options) {
        throw new Error('DevWorkspace options are required');
      }
      return openDevWorkspaceWindow(options);
    },
  );

  console.log('[DevWorkspaceWindow] IPC handlers registered');
}
