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
  private cycleMode = false; // true if opened with Command+;, false if opened with Command+'
  private selectedIndex = 0;
  private windowList: Array<{ id: number; title: string }> = [];

  /**
   * Show the window switcher overlay (toggle mode - Command+')
   */
  public show(): void {
    // Only show if one of our app windows is currently focused
    const focusedWindow = BrowserWindow.getFocusedWindow();
    const isOurAppFocused =
      focusedWindow && applicationWindows.has(focusedWindow.id);

    if (!isOurAppFocused) {
      log.info('[Window Switcher] Not showing - app is not currently focused');
      return;
    }

    this.updateWindowList();

    if (this.windowList.length === 0) {
      log.info('No windows to switch between');
      return;
    }

    // If already showing, do nothing (toggle will handle hide)
    if (
      this.isActive &&
      this.switcherWindow &&
      !this.switcherWindow.isDestroyed()
    ) {
      log.info(
        '[Window Switcher] Already showing, use toggle or hide to dismiss',
      );
      return;
    }

    this.isActive = true;
    this.cycleMode = false;
    this.createSwitcherWindow();

    // Start with first window selected
    this.selectedIndex = 0;
    this.sendWindowList();
  }

  /**
   * Show and cycle to next window (cycle mode - Command+;)
   */
  public showAndCycle(): void {
    // Only show if one of our app windows is currently focused
    const focusedWindow = BrowserWindow.getFocusedWindow();
    const isOurAppFocused =
      focusedWindow && applicationWindows.has(focusedWindow.id);

    if (!isOurAppFocused) {
      log.info('[Window Switcher] Not showing - app is not currently focused');
      return;
    }

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

    // If already showing in cycle mode, cycle to next
    if (
      this.isActive &&
      this.cycleMode &&
      this.switcherWindow &&
      !this.switcherWindow.isDestroyed()
    ) {
      this.selectNext();
      return;
    }

    // If showing in toggle mode, switch to cycle mode
    if (
      this.isActive &&
      !this.cycleMode &&
      this.switcherWindow &&
      !this.switcherWindow.isDestroyed()
    ) {
      this.cycleMode = true;
      this.selectNext();
      return;
    }

    // Not showing, create and show
    this.isActive = true;
    this.cycleMode = true;
    this.createSwitcherWindow();

    // Start with index 1 (second window) since user wants to switch from current
    this.selectedIndex = 1 % this.windowList.length;
    this.sendWindowList();
  }

  /**
   * Toggle the window switcher (show if hidden, hide if shown)
   */
  public toggle(): void {
    if (
      this.isActive &&
      this.switcherWindow &&
      !this.switcherWindow.isDestroyed()
    ) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Hide the switcher (without activating a window)
   */
  public hide(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.cycleMode = false;

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
   * Check if switcher is in cycle mode (Command+;)
   */
  public isCycleMode(): boolean {
    return this.cycleMode;
  }

  /**
   * Activate the selected window and hide the switcher (used in cycle mode)
   */
  public activateSelectedAndHide(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.cycleMode = false;

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
   * Update the list of available windows
   */
  private updateWindowList(): void {
    this.windowList = [];

    log.info(`[Window Switcher] applicationWindows.size: ${applicationWindows.size}`);
    log.info(`[Window Switcher] applicationWindows keys: ${Array.from(applicationWindows.keys()).join(', ')}`);

    // Get all application windows except the switcher itself
    for (const [id, appWindow] of applicationWindows.entries()) {
      if (appWindow.window && !appWindow.window.isDestroyed()) {
        // Simply use the metadata display name!
        const title = appWindow.metadata?.displayName ?? 'Untitled Window';

        log.info(`[Window Switcher] Window ${id} title: ${title} (type: ${appWindow.metadata?.primaryType})`);

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
    const { width, height } = primaryDisplay.workArea;

    // Use the correct preload path based on whether app is packaged or in development
    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'preload.js')
      : path.join(__dirname, '../../.erb/dll/preload.js');

    log.info(`[Window Switcher] Preload path: ${preloadPath}`);
    log.info(`[Window Switcher] Screen bounds: ${width}x${height}`);

    this.switcherWindow = new BrowserWindow({
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

    const targetUrl = resolveHtmlPath('window-switcher.html');

    log.info(`[Window Switcher] Loading URL: ${targetUrl}`);

    this.switcherWindow.loadURL(targetUrl).catch((err) => {
      log.error('[Window Switcher] Failed to load renderer:', err);
      log.error('[Window Switcher] Attempted URL:', targetUrl);
    });

    // DevTools disabled for window switcher to prevent focus issues
    // if (process.env.NODE_ENV === 'development') {
    //   this.switcherWindow.webContents.openDevTools({ mode: 'detach' });
    // }

    // Send window list once the page is ready
    this.switcherWindow.webContents.on('did-finish-load', () => {
      log.info('[Window Switcher] HTML loaded successfully');
      this.sendWindowList();
    });

    // Log any console messages from the renderer
    this.switcherWindow.webContents.on(
      'console-message',
      (event, level, message, line, _sourceId) => {
        log.info(`[Window Switcher Renderer] ${message} (line ${line})`);
      },
    );

    // Handle window closed
    this.switcherWindow.on('closed', () => {
      this.switcherWindow = null;
      this.isActive = false;
    });

    // Show and focus the window
    this.switcherWindow.show();
    this.switcherWindow.focus();

    // Force focus and bring to front
    this.switcherWindow.setAlwaysOnTop(true, 'screen-saver');
    this.switcherWindow.moveTop();

    // Add keyboard listener for modifier release in cycle mode
    this.switcherWindow.webContents.on('before-input-event', (event, input) => {
      // Detect when Command/Ctrl is released in cycle mode
      if (
        input.type === 'keyUp' &&
        this.cycleMode &&
        ((process.platform === 'darwin' &&
          (input.code === 'MetaLeft' || input.code === 'MetaRight')) ||
          (process.platform !== 'darwin' &&
            (input.code === 'ControlLeft' || input.code === 'ControlRight')))
      ) {
        log.info(
          '[Window Switcher] Modifier key released in switcher window, activating selected window',
        );
        this.activateSelectedAndHide();
        event.preventDefault();
      }
    });
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
   * Allow external callers to request the current list be sent again
   */
  public resendWindowList(): void {
    this.sendWindowList();
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
   * Update the selected index by window id
   */
  public setSelectedWindow(windowId: number): void {
    const index = this.windowList.findIndex((win) => win.id === windowId);
    if (index >= 0) {
      this.selectedIndex = index;
      this.sendUpdate();
    }
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
    log.info(`[Window Switcher] Selecting window ${windowId}`);
    windowSwitcher.setSelectedWindow(windowId);
    windowSwitcher.activateSelectedAndHide();
  });

  // Handle get window list request
  ipcMain.on('window-switcher:get-list', (_event) => {
    windowSwitcher.resendWindowList();
  });

  ipcMain.on(
    'window-switcher:cycle',
    (_event, direction: 'next' | 'previous') => {
      if (direction === 'next') {
        windowSwitcher.selectNext();
      } else if (direction === 'previous') {
        windowSwitcher.selectPrevious();
      }
    },
  );

  log.info('Window switcher IPC handlers registered');
}
