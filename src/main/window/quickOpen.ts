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
  getWorkspaceId,
} from './types';
import { openDevWorkspaceWindow } from './devWorkspaceWindowHandlers';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { gitHubAPICore } from '../version-control-providers/github/apiCore';
import { authService } from '../services/AuthService';
import { gitClientFactory } from '../utils/gitClientFactory';

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

interface QuickOpenItem {
  id: string;
  type: 'repository' | 'workspace' | 'github';
  name: string;
  description?: string;
  remoteUrl?: string;
  localPath?: string;
  isOpen: boolean;
  openWindowId?: number;
  // Avatar URL for display (GitHub owner avatar for repositories)
  avatarUrl?: string;
  // Full AlexandriaEntry for repositories (so we can pass complete data when opening)
  alexandriaEntry?: AlexandriaEntry;
  // Last opened timestamp for sorting and display
  lastOpenedAt?: string;
  // GitHub-specific fields
  fullName?: string;
  stars?: number;
  cloneUrl?: string;
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
   * Load repositories and workspaces
   */
  private async loadItems(): Promise<void> {
    try {
      const items: QuickOpenItem[] = [];

      // Get currently open windows
      const openRepoWindowIds = getWindowsByType(PrimaryWindowType.REPOSITORY);
      const openWorkspaceWindowIds = getWindowsByType(
        PrimaryWindowType.WORKSPACE,
      );

      const openRepoUrls = openRepoWindowIds
        .map((id) => ({ id, url: getRepositoryUrl(id) }))
        .filter(
          (item): item is { id: number; url: string } => item.url !== null,
        );

      const openWorkspaceIds = openWorkspaceWindowIds
        .map((id) => ({ windowId: id, workspaceId: getWorkspaceId(id) }))
        .filter(
          (item): item is { windowId: number; workspaceId: string } =>
            item.workspaceId !== null,
        );

      // Load repositories and workspaces from Alexandria in parallel
      const {
        AlexandriaRegistryService,
      } = require('../stores/AlexandriaRegistryService');
      const service = AlexandriaRegistryService.getInstance();

      // Load repos and workspaces in parallel for better performance
      const [repositories, workspaces] = await Promise.all([
        service.getRepositories(),
        service.getWorkspaces(),
      ]);

      // Add repositories to items
      for (const repo of repositories) {
        // Skip repos without remoteUrl - they can't be used in Quick Open
        if (!repo.remoteUrl) {
          continue;
        }

        const openRepo = openRepoUrls.find((r) => r.url === repo.remoteUrl);
        // Build avatar URL from GitHub owner (GitHub's reliable avatar endpoint)
        const owner = repo.github?.owner;
        const avatarUrl = owner
          ? `https://github.com/${owner}.png?size=80`
          : undefined;

        items.push({
          id: repo.remoteUrl,
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

      // Add workspaces to items
      for (const workspace of workspaces) {
        const openWorkspace = openWorkspaceIds.find(
          (w) => w.workspaceId === workspace.id,
        );
        items.push({
          id: workspace.id,
          type: 'workspace',
          name: workspace.name,
          description: workspace.description,
          isOpen: !!openWorkspace,
          openWindowId: openWorkspace?.windowId,
          lastOpenedAt: workspace.lastOpenedAt,
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
        `[Quick Open] Loaded ${items.length} items (${repositories.length} repos, ${workspaces.length} workspaces)`,
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
      } else if (item.type === 'workspace') {
        // Open workspace window directly from main process
        const { createSpecialWindow } = require('./modernWindowManager');
        const { resolveHtmlPath } = require('../util');
        const { PrimaryWindowType } = require('./types');

        const workspaceId = item.id;
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
          log.error('[Quick Open] Failed to fetch workspace name:', error);
        }

        // Create metadata for workspace window
        const metadata = {
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

        if (window) {
          // Register window with terminal manager to receive terminal events
          const { terminalManager } = await import('../terminal');
          terminalManager?.setMainWindow(window.window);
          log.info(
            `[Quick Open] Registered Alexandria Workspace window ${window.window.id} with terminal manager`,
          );

          // Pass workspace ID to the window via URL parameter
          const encodedWorkspaceId = encodeURIComponent(workspaceId);
          const url = `${resolveHtmlPath('alexandria-workspace.html')}?workspaceId=${encodedWorkspaceId}`;
          window.window.loadURL(url);
          log.info(`[Quick Open] Opening workspace window for ${item.name}`);
        }
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

  // Clone a GitHub repository
  ipcMain.handle(
    'quick-open:clone-github',
    async (
      _event,
      cloneUrl: string,
      repoName: string,
    ): Promise<{ success: boolean; path?: string; error?: string }> => {
      log.info(`[Quick Open] Cloning ${repoName} from ${cloneUrl}`);

      try {
        // Get user preferences for base directory
        const {
          UserPreferencesHandler,
        } = require('../stores/userPreferencesHandler');
        const prefsService = UserPreferencesHandler.getInstance();
        const preferences = await prefsService.getUserPreferences();
        const baseDir = preferences.baseDefaultDirectory;

        if (!baseDir) {
          return {
            success: false,
            error: 'No default directory set. Please set a base directory in preferences.',
          };
        }

        const targetPath = path.join(baseDir, repoName);

        // Check if directory already exists
        const fs = require('fs').promises;
        try {
          await fs.access(targetPath);
          // Directory exists - check if it's the same repo
          log.info(`[Quick Open] Directory already exists: ${targetPath}`);
          return {
            success: false,
            error: `Directory already exists: ${targetPath}`,
          };
        } catch {
          // Directory doesn't exist, proceed with clone
        }

        // Clone the repository
        const parentDir = path.dirname(targetPath);
        const git = await gitClientFactory.getClient(parentDir);

        // Set up environment for clone
        const cloneEnv: Record<string, string> = {};
        if (process.env.PATH) cloneEnv.PATH = process.env.PATH;
        if (process.env.HOME) cloneEnv.HOME = process.env.HOME;
        if (process.env.USER) cloneEnv.USER = process.env.USER;

        await git.raw(['clone', cloneUrl, targetPath], {
          env: cloneEnv,
          timeout: 120000, // 2 minute timeout
        });

        log.info(`[Quick Open] Clone successful: ${targetPath}`);

        // Register with Alexandria
        const {
          AlexandriaRegistryService,
        } = require('../stores/AlexandriaRegistryService');
        const alexandriaService = AlexandriaRegistryService.getInstance();
        const registeredRepo = await alexandriaService.registerRepository(
          repoName,
          targetPath,
        );

        log.info(`[Quick Open] Registered repository: ${registeredRepo.name}`);

        // Open the dev workspace for the cloned repo
        if (registeredRepo) {
          await openDevWorkspaceWindow({
            alexandriaEntry: registeredRepo,
          });
          log.info(`[Quick Open] Opened dev workspace for ${repoName}`);
        }

        return { success: true, path: targetPath };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        log.error(`[Quick Open] Clone failed: ${errorMessage}`);
        return { success: false, error: errorMessage };
      }
    },
  );

  log.info('[Quick Open] IPC handlers registered');
}
