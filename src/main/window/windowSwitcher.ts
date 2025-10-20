/**
 * Window Switcher - Visual window switching similar to macOS Command+Tab
 * Provides a visual overlay to cycle through open windows
 */

import { BrowserWindow, screen, ipcMain, app } from 'electron';
import path from 'path';
import log from 'electron-log';
import { resolveHtmlPath } from '../util';
import { applicationWindows } from './types';

class WindowSwitcher {
  private switcherWindow: BrowserWindow | null = null;
  private isActive = false;
  private selectedIndex = 0;
  private windowList: Array<{ id: number; title: string }> = [];

  /**
   * Show the window switcher overlay
   */
  public show(): void {
    this.updateWindowList();

    if (this.windowList.length === 0) {
      log.info('No windows to switch between');
      return;
    }

    if (this.windowList.length === 1) {
      // Only one window, just focus it
      log.info('Only one window available, focusing it directly');
      this.activateWindow(this.windowList[0].id);
      return;
    }

    if (
      this.isActive &&
      this.switcherWindow &&
      !this.switcherWindow.isDestroyed()
    ) {
      // Already showing, just cycle to next
      this.selectNext();
      return;
    }

    this.isActive = true;
    this.createSwitcherWindow();

    // Start with index 1 (second window) since user wants to switch from current
    this.selectedIndex = 1 % this.windowList.length;
    this.sendWindowList();
  }

  /**
   * Hide the switcher and activate selected window
   */
  public hide(): void {
    if (!this.isActive) return;

    this.isActive = false;

    // Activate the selected window
    if (
      this.windowList.length > 0 &&
      this.selectedIndex < this.windowList.length
    ) {
      const selectedWindowId = this.windowList[this.selectedIndex].id;
      this.activateWindow(selectedWindowId);
    }

    // Close the switcher window
    if (this.switcherWindow && !this.switcherWindow.isDestroyed()) {
      this.switcherWindow.close();
      this.switcherWindow = null;
    }
  }

  /**
   * Select next window in the list
   */
  public selectNext(): void {
    if (!this.isActive || this.windowList.length === 0) return;

    this.selectedIndex = (this.selectedIndex + 1) % this.windowList.length;
    this.sendUpdate();
  }

  /**
   * Select previous window in the list
   */
  public selectPrevious(): void {
    if (!this.isActive || this.windowList.length === 0) return;

    this.selectedIndex =
      (this.selectedIndex - 1 + this.windowList.length) %
      this.windowList.length;
    this.sendUpdate();
  }

  /**
   * Check if switcher is currently active
   */
  public isShowing(): boolean {
    return this.isActive;
  }

  /**
   * Update the list of available windows
   */
  private updateWindowList(): void {
    this.windowList = [];

    // Get all application windows except the switcher itself
    for (const [id, appWindow] of applicationWindows.entries()) {
      if (appWindow.window && !appWindow.window.isDestroyed()) {
        // Skip minimized windows optionally (you can change this behavior)
        const title = appWindow.window.getTitle() || 'Untitled Window';
        this.windowList.push({ id, title });
      }
    }

    log.info(`Window switcher found ${this.windowList.length} windows`);
  }

  /**
   * Create the switcher overlay window
   */
  private createSwitcherWindow(): void {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    this.switcherWindow = new BrowserWindow({
      width: Math.min(900, width - 100),
      height: Math.min(500, height - 100),
      center: true,
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
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        // This is safe since we control the content and it's not loading external URLs
      },
    });

    // Load the switcher HTML directly from file (not through dev server)
    const appPath = app.getAppPath();
    let htmlPath: string;

    if (process.env.NODE_ENV === 'development') {
      // In development, app path is in .erb/dll/, so go up to project root
      // appPath is like: /Users/griever/Developer/electron-app/.erb/dll
      const projectRoot = path.join(appPath, '../../');
      htmlPath = path.join(projectRoot, 'src/renderer/window-switcher.html');
    } else {
      // In production, it's in the dist/renderer folder
      htmlPath = path.join(appPath, 'dist/renderer/window-switcher.html');
    }

    log.info(`[Window Switcher] App path: ${appPath}`);
    log.info(`[Window Switcher] Loading HTML from: ${htmlPath}`);

    this.switcherWindow.loadFile(htmlPath).catch((err) => {
      log.error('[Window Switcher] Failed to load HTML:', err);
      log.error('[Window Switcher] Attempted path:', htmlPath);
    });

    // Send window list once the page is ready
    this.switcherWindow.webContents.on('did-finish-load', () => {
      this.sendWindowList();
    });

    // Handle window closed
    this.switcherWindow.on('closed', () => {
      this.switcherWindow = null;
      this.isActive = false;
    });

    // Handle blur - hide switcher when it loses focus
    this.switcherWindow.on('blur', () => {
      // Delay hiding to allow for window switching
      setTimeout(() => {
        if (this.isActive) {
          this.hide();
        }
      }, 100);
    });

    this.switcherWindow.show();
    this.switcherWindow.focus();
  }

  /**
   * Send window list to renderer
   */
  private sendWindowList(): void {
    if (!this.switcherWindow || this.switcherWindow.isDestroyed()) return;

    this.switcherWindow.webContents.send('window-switcher:update-list', {
      windows: this.windowList,
      selectedIndex: this.selectedIndex,
    });
  }

  /**
   * Send update to renderer (selected index changed)
   */
  private sendUpdate(): void {
    if (!this.switcherWindow || this.switcherWindow.isDestroyed()) return;

    // Send the full update with the new selected index
    this.switcherWindow.webContents.send('window-switcher:update-list', {
      windows: this.windowList,
      selectedIndex: this.selectedIndex,
    });
  }

  /**
   * Activate a window by ID
   */
  private activateWindow(windowId: number): void {
    const appWindow = applicationWindows.get(windowId);
    if (!appWindow || !appWindow.window || appWindow.window.isDestroyed()) {
      log.warn(
        `Cannot activate window ${windowId}: window not found or destroyed`,
      );
      return;
    }

    const win = appWindow.window;

    // Restore if minimized
    if (win.isMinimized()) {
      win.restore();
    }

    // Show and focus
    win.show();
    win.focus();

    log.info(`Activated window ${windowId}: ${win.getTitle()}`);
  }
}

// Export singleton instance
export const windowSwitcher = new WindowSwitcher();

/**
 * Setup IPC handlers for window switcher
 */
export function setupWindowSwitcherHandlers(): void {
  // Handle window selection from renderer
  ipcMain.on('window-switcher:select', (_event, windowId: number) => {
    windowSwitcher.hide();
    // The hide() method will activate the selected window
  });

  // Handle get window list request
  ipcMain.on('window-switcher:get-list', (event) => {
    // This is handled by the show() method sending the initial list
  });

  log.info('Window switcher IPC handlers registered');
}
