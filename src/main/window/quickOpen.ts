/**
 * Quick Open - Search and open repositories and workspaces
 * Command+O keyboard shortcut
 */

import { BrowserWindow, screen, ipcMain, app } from 'electron';
import path from 'path';
import log from 'electron-log';
import { resolveHtmlPath } from '../util';
import {
  PrimaryWindowType,
  getWindowsByType,
  getRepositoryUrl,
  getRepositoryLocalPath,
} from './types';
import { openDevWorkspaceWindow } from './devWorkspaceWindowHandlers';
import { gitHubAPICore } from '../version-control-providers/github/apiCore';
import { authService } from '../services/AuthService';
import { WindowEvent } from '../../shared/ipc-events/WindowEvents';
import type {
  OpenTerminalTabPayload,
  OpenRepositoryExplorerPayload,
} from '../../shared/main-process-api-interfaces/WindowAPI';
import { focusOrCreateMainWindow } from './modernWindowManager';
import { collectOwnerDirectories } from './ownerDirectories';
import type { QuickOpenItem } from '../../shared/quickOpen';

interface GitHubSearchResult {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  owner: {
    login: string;
    avatar_url: string;
  };
  stargazers_count: number;
  clone_url: string;
  html_url: string;
}

class QuickOpen {
  private quickOpenWindow: BrowserWindow | null = null;
  private isActive = false;

  /**
   * Show the quick open overlay
   */
  public async show(): Promise<void> {
    log.info('[Quick Open] Showing quick open dialog');

    // Check if window exists and is valid
    if (this.quickOpenWindow && !this.quickOpenWindow.isDestroyed()) {
      log.info('[Quick Open] Window exists, focusing');
      this.quickOpenWindow.show();
      this.quickOpenWindow.focus();
      this.quickOpenWindow.webContents.focus();
      this.isActive = true;
      return;
    }

    // Window doesn't exist or was destroyed, create new one
    log.info('[Quick Open] Creating new quick open window');
    this.isActive = true;
    this.quickOpenWindow = null; // Reset reference

    try {
      await this.createQuickOpenWindow();
      // Note: loadItems() will be called when renderer requests via 'quick-open:request-items'
    } catch (error) {
      log.error('[Quick Open] Error showing quick open:', error);
      this.isActive = false;
      this.quickOpenWindow = null;
    }
  }

  /**
   * Hide the quick open overlay
   */
  public hide(): void {
    log.info('[Quick Open] Hiding quick open dialog');

    this.isActive = false;

    // Close the quick open window
    if (this.quickOpenWindow && !this.quickOpenWindow.isDestroyed()) {
      this.quickOpenWindow.close();
    }

    this.quickOpenWindow = null;
    log.info('[Quick Open] Hidden and cleaned up');
  }

  /**
   * Toggle the quick open overlay
   */
  public toggle(): void {
    if (this.isActive) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Check if quick open is currently active
   */
  public isShowing(): boolean {
    return this.isActive;
  }

  /**
   * Get the quick open window instance
   */
  public getWindow(): BrowserWindow | null {
    return this.quickOpenWindow;
  }

  /**
   * Create the quick open overlay window
   */
  private async createQuickOpenWindow(): Promise<void> {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workArea;

    // Use the Quick Open specific preload (minimal dependencies)
    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'preload-quick-open.js')
      : path.join(__dirname, '../../.erb/dll/preload-quick-open.js');

    log.info(`[Quick Open] Preload path: ${preloadPath}`);
    log.info(`[Quick Open] Screen bounds: ${width}x${height}`);

    this.quickOpenWindow = new BrowserWindow({
      width,
      height,
      x: 0,
      y: 0,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      hasShadow: false,
      focusable: true,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    // Handle window closed
    this.quickOpenWindow.on('closed', () => {
      this.isActive = false;
      this.quickOpenWindow = null;
      log.info('[Quick Open] Window closed');
    });

    // Handle blur - close when app loses focus (switching to another app)
    // We use setImmediate to let focus settle, then check if any app window has focus
    // This avoids closing when clicking items within the window
    this.quickOpenWindow.on('blur', () => {
      setImmediate(() => {
        const focusedWindow = BrowserWindow.getFocusedWindow();
        if (!focusedWindow) {
          // No window in our app has focus = user switched to another app
          log.info('[Quick Open] App lost focus, closing');
          this.hide();
        }
      });
    });

    // Load the quick open HTML
    const targetUrl = resolveHtmlPath('quick-open.html');
    log.info(`[Quick Open] Loading URL: ${targetUrl}`);

    this.quickOpenWindow.loadURL(targetUrl).catch((err) => {
      log.error('[Quick Open] Failed to load renderer:', err);
      log.error('[Quick Open] Attempted URL:', targetUrl);
    });

    // Items will be loaded when renderer requests them via 'quick-open:request-items'
    this.quickOpenWindow.webContents.on('did-finish-load', () => {
      log.info('[Quick Open] HTML loaded successfully');
    });

    // Log any console messages from the renderer
    this.quickOpenWindow.webContents.on(
      'console-message',
      (event, level, message, line, _sourceId) => {
        log.info(`[Quick Open Renderer] ${message} (line ${line})`);
      },
    );

    // Show and focus the window
    this.quickOpenWindow.show();
    this.quickOpenWindow.focus();

    // Force focus and bring to front (same as window switcher)
    this.quickOpenWindow.setAlwaysOnTop(true, 'screen-saver');
    this.quickOpenWindow.moveTop();

    // Focus webContents to ensure keyboard input works (critical for packaged builds)
    this.quickOpenWindow.webContents.focus();

    log.info('[Quick Open] Window shown and focused');
  }

  /**
   * Load registered repositories
   */
  private async loadItems(): Promise<void> {
    try {
      const items: QuickOpenItem[] = [];

      // Get currently open windows
      const openRepoWindowIds = getWindowsByType(PrimaryWindowType.REPOSITORY);

      const openRepoWindows = openRepoWindowIds.map((id) => ({
        id,
        url: getRepositoryUrl(id),
        localPath: getRepositoryLocalPath(id),
      }));


      // Load registered repositories from Alexandria.
      const {
        AlexandriaRegistryService,
      } = require('../stores/AlexandriaRegistryService');
      const service = AlexandriaRegistryService.getInstance();
      const repositories = await service.getRepositories();

      // Add repositories to items
      for (const repo of repositories) {
        // Skip repos without remoteUrl - they can't be used in Quick Open
        if (!repo.remoteUrl) {
          continue;
        }

        const openRepo = openRepoWindows.find((r) =>
          repo.path ? r.localPath === repo.path : r.url === repo.remoteUrl,
        );
        // Build avatar URL from GitHub owner (GitHub's reliable avatar endpoint)
        const owner = repo.github?.owner;
        const avatarUrl = owner
          ? `https://github.com/${owner}.png?size=80`
          : undefined;

        items.push({
          id: repo.path || repo.remoteUrl,
          type: 'repository',
          name: repo.name,
          description: repo.github?.description || repo.path,
          remoteUrl: repo.remoteUrl,
          localPath: repo.path,
          isOpen: !!openRepo,
          openWindowId: openRepo?.id,
          avatarUrl,
          alexandriaEntry: repo,
          lastOpenedAt: repo.lastOpenedAt,
        });
      }

      // Owner directories — the folders holding this owner's checkouts
      // (`<base>/<owner>/<repo>`), so the palette can offer "clone here"
      // targets. Selecting one opens a terminal rooted at the folder.
      for (const ownerDir of collectOwnerDirectories(repositories)) {
        items.push({
          id: `owner-directory:${ownerDir.directory}`,
          type: 'ownerDirectory',
          name: ownerDir.label,
          description: ownerDir.directory,
          localPath: ownerDir.directory,
          isOpen: false,
          avatarUrl: `https://github.com/${ownerDir.ownerLogin}.png?size=80`,
          cloneCount: ownerDir.cloneCount,
        });
      }

      // Sort items: open windows first, then by lastOpenedAt (most recent first)
      items.sort((a, b) => {
        // Open items come first
        if (a.isOpen && !b.isOpen) return -1;
        if (!a.isOpen && b.isOpen) return 1;

        // Then sort by lastOpenedAt (most recent first)
        const aTime = a.lastOpenedAt ? new Date(a.lastOpenedAt).getTime() : 0;
        const bTime = b.lastOpenedAt ? new Date(b.lastOpenedAt).getTime() : 0;
        return bTime - aTime;
      });

      log.info(
        `[Quick Open] Loaded ${items.length} repositories`,
      );

      // Send items to renderer
      if (this.quickOpenWindow && !this.quickOpenWindow.isDestroyed()) {
        this.quickOpenWindow.webContents.send('quick-open:items', items);
      }
    } catch (error) {
      log.error('[Quick Open] Failed to load items:', error);
    }
  }
}

// Export singleton instance
export const quickOpen = new QuickOpen();

/**
 * Resolve the Quick Open destination preference. Defaults to opening a
 * dedicated project window (historical behavior).
 */
async function getQuickOpenTarget(): Promise<'window' | 'terminal'> {
  try {
    const {
      UserPreferencesHandler,
    } = require('../stores/userPreferencesHandler');
    const prefsService = UserPreferencesHandler.getInstance();
    const preferences = await prefsService.getUserPreferences();
    return preferences.quickOpenTarget === 'terminal' ? 'terminal' : 'window';
  } catch (error) {
    log.error('[Quick Open] Failed to read quickOpenTarget preference:', error);
    return 'window';
  }
}

/**
 * Focus/create the principal window and ask its renderer to open a terminal
 * tab at `directory`. Waits for the renderer to finish loading when the
 * principal window was just created, so the IPC isn't dropped.
 */
async function openTerminalTabInPrincipal(
  directory: string,
  label?: string,
): Promise<void> {
  const principal = await focusOrCreateMainWindow();
  if (!principal || principal.window.isDestroyed()) {
    log.error('[Quick Open] No principal window available for terminal tab');
    return;
  }

  const payload: OpenTerminalTabPayload = { directory, label };
  const send = () => {
    if (principal.window.isDestroyed()) return;
    principal.window.webContents.send(WindowEvent.OPEN_TERMINAL_TAB, payload);
    log.info(
      `[Quick Open] Sent open-terminal-tab for ${label ?? directory} → principal`,
    );
  };

  if (principal.window.webContents.isLoading()) {
    principal.window.webContents.once('did-finish-load', send);
  } else {
    send();
  }
}

/**
 * Setup IPC handlers for quick open
 */
export function setupQuickOpenHandlers(): void {
  // Handle item selection from renderer
  ipcMain.on('quick-open:select', async (_event, item: QuickOpenItem) => {
    log.info(
      `[Quick Open] Item selected: ${item.type} - ${item.name} (isOpen: ${item.isOpen})`,
    );

    // Close the overlay immediately for instant feedback
    quickOpen.hide();

    if (item.type === 'github') {
      const [owner, name] = (item.fullName || item.name).split('/');
      if (!owner || !name) return;

      const principal = await focusOrCreateMainWindow();
      if (!principal || principal.window.isDestroyed()) return;

      const payload: OpenRepositoryExplorerPayload = {
        owner,
        name,
        description: item.description,
        stars: item.stars,
      };
      const send = () => {
        if (principal.window.isDestroyed()) return;
        principal.window.webContents.send(
          WindowEvent.OPEN_REPOSITORY_EXPLORER,
          payload,
        );
      };
      if (principal.window.webContents.isLoading()) {
        principal.window.webContents.once('did-finish-load', send);
      } else {
        send();
      }
      return;
    }

    // Owner directories always open a terminal rooted at the folder, whatever
    // the Quick Open destination preference is — the point is to land in the
    // folder, ready to clone a sibling repo.
    if (item.type === 'ownerDirectory' && item.localPath) {
      await openTerminalTabInPrincipal(item.localPath, item.name);
      return;
    }

    const openTarget = await getQuickOpenTarget();

    // Terminal mode opens a terminal tab in the principal window.
    if (
      openTarget === 'terminal' &&
      item.type === 'repository' &&
      item.localPath
    ) {
      await openTerminalTabInPrincipal(item.localPath, item.name);
      return;
    }

    if (item.isOpen && item.openWindowId) {
      // Focus existing window
      const { applicationWindows } = require('./types');
      const appWindow = applicationWindows.get(item.openWindowId);
      if (appWindow && !appWindow.window.isDestroyed()) {
        if (appWindow.window.isMinimized()) {
          appWindow.window.restore();
        }
        appWindow.window.show();
        appWindow.window.focus();
        log.info(`[Quick Open] Focused existing window ${item.openWindowId}`);
      }
    } else {
      // Open new window
      if (item.type === 'repository' && item.alexandriaEntry) {
        // Open dev workspace with panel framework
        await openDevWorkspaceWindow({
          alexandriaEntry: item.alexandriaEntry,
        });
        log.info(`[Quick Open] Opening dev workspace for ${item.name}`);
      }
    }
  });

  // Handle request for items from renderer
  ipcMain.on('quick-open:request-items', () => {
    quickOpen['loadItems'](); // Access private method
  });

  // Handle close request from renderer
  ipcMain.on('quick-open:close', () => {
    log.info('[Quick Open] Close requested');
    quickOpen.hide();
  });

  // Handle show request from renderer.
  ipcMain.on('quick-open:show', () => {
    log.info('[Quick Open] Show requested from renderer');
    void quickOpen.show();
  });

  // Check if user is authenticated with GitHub
  ipcMain.handle('quick-open:is-authenticated', async () => {
    try {
      const token = await authService.getValidToken();
      return !!token;
    } catch (error) {
      log.error('[Quick Open] Failed to check auth status:', error);
      return false;
    }
  });

  // Search GitHub repositories
  ipcMain.handle(
    'quick-open:search-github',
    async (_event, query: string): Promise<GitHubSearchResult[]> => {
      if (!query || query.trim().length < 2) {
        return [];
      }

      log.info(`[Quick Open] Searching GitHub for: ${query}`);

      try {
        const result = await gitHubAPICore.makeGitHubAPICall(
          `/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=10`,
        );

        if (!result.success || !result.data) {
          log.error('[Quick Open] GitHub search failed:', result.error);
          return [];
        }

        const data = result.data as { items: GitHubSearchResult[] };
        log.info(`[Quick Open] Found ${data.items?.length || 0} repositories`);
        return data.items || [];
      } catch (error) {
        log.error('[Quick Open] GitHub search error:', error);
        return [];
      }
    },
  );

  log.info('[Quick Open] IPC handlers registered');
}
