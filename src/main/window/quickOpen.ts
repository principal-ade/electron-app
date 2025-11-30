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

interface QuickOpenItem {
  id: string;
  type: 'repository' | 'workspace';
  name: string;
  description?: string;
  remoteUrl?: string;
  localPath?: string;
  isOpen: boolean;
  openWindowId?: number;
  // Full AlexandriaEntry for repositories (so we can pass complete data when opening)
  alexandriaEntry?: AlexandriaEntry;
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

    // Use the correct preload path based on whether app is packaged or in development
    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'preload.js')
      : path.join(__dirname, '../../.erb/dll/preload.js');

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

    // Handle blur - close when focus is lost
    // TODO: Re-enable this once we fix the focus issues
    // For now, let Escape key handle closing
    // this.quickOpenWindow.on('blur', () => {
    //   log.info('[Quick Open] Lost focus, closing');
    //   this.hide();
    // });

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
        .filter((item): item is { id: number; url: string } => item.url !== null);

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
        service.getRepositories(true), // Skip git info loading (Quick Open doesn't display it)
        service.getWorkspaces(),
      ]);

      // Add repositories to items
      for (const repo of repositories) {
        // Skip repos without remoteUrl - they can't be used in Quick Open
        if (!repo.remoteUrl) {
          continue;
        }

        const openRepo = openRepoUrls.find((r) => r.url === repo.remoteUrl);
        items.push({
          id: repo.remoteUrl,
          type: 'repository',
          name: repo.name,
          description: repo.github?.description || repo.path,
          remoteUrl: repo.remoteUrl,
          localPath: repo.path,
          isOpen: !!openRepo,
          openWindowId: openRepo?.id,
          alexandriaEntry: repo,
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
        });
      }

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
  ipcMain.on(
    'quick-open:select',
    async (_event, item: QuickOpenItem) => {
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
          const {
            createSpecialWindow,
          } = require('./modernWindowManager');
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
            log.error(
              '[Quick Open] Failed to fetch workspace name:',
              error,
            );
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
    },
  );

  // Handle request for items from renderer
  ipcMain.on('quick-open:request-items', () => {
    quickOpen['loadItems'](); // Access private method
  });

  // Handle close request from renderer
  ipcMain.on('quick-open:close', () => {
    log.info('[Quick Open] Close requested');
    quickOpen.hide();
  });

  log.info('[Quick Open] IPC handlers registered');
}
