/**
 * Goodbye Screen - Shown before app quits for update installation
 * Provides a pleasant transition while closing windows and installing updates
 */

import { BrowserWindow, screen, ipcMain, app } from 'electron';
import path from 'path';
import log from 'electron-log';
import { resolveHtmlPath } from '../util';
import { applicationWindows } from './types';
import { autoUpdater } from 'electron-updater';

interface GoodbyeScreenData {
  newVersion: string;
}

class GoodbyeScreen {
  private goodbyeWindow: BrowserWindow | null = null;
  private isActive = false;
  private pendingVersion: string = '';

  /**
   * Show the goodbye screen before update installation
   * @param newVersion The version being installed
   */
  public show(newVersion: string): void {
    if (this.isActive) {
      log.info('[Goodbye Screen] Already showing');
      return;
    }

    this.pendingVersion = newVersion;
    this.isActive = true;
    this.createGoodbyeWindow();

    log.info(`[Goodbye Screen] Showing for version ${newVersion}`);
  }

  /**
   * Create the goodbye screen overlay window
   */
  private createGoodbyeWindow(): void {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workArea;

    // Use the goodbye screen specific preload
    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'preload-goodbye-screen.js')
      : path.join(__dirname, '../../.erb/dll/preload-goodbye-screen.js');

    log.info(`[Goodbye Screen] Preload path: ${preloadPath}`);
    log.info(`[Goodbye Screen] Screen bounds: ${width}x${height}`);

    this.goodbyeWindow = new BrowserWindow({
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

    const targetUrl = resolveHtmlPath('goodbye-screen.html');

    log.info(`[Goodbye Screen] Loading URL: ${targetUrl}`);

    this.goodbyeWindow.loadURL(targetUrl).catch((err) => {
      log.error('[Goodbye Screen] Failed to load renderer:', err);
      log.error('[Goodbye Screen] Attempted URL:', targetUrl);
      // If we can't show the goodbye screen, just proceed with the update
      this.proceedWithUpdate();
    });

    // Send data once the page is ready
    this.goodbyeWindow.webContents.on('did-finish-load', () => {
      log.info('[Goodbye Screen] HTML loaded successfully');
      this.sendData();
    });

    // Log any console messages from the renderer
    this.goodbyeWindow.webContents.on(
      'console-message',
      (_event, _level, message, line, _sourceId) => {
        log.info(`[Goodbye Screen Renderer] ${message} (line ${line})`);
      },
    );

    // Handle window closed unexpectedly
    this.goodbyeWindow.on('closed', () => {
      this.goodbyeWindow = null;
      // If we close before completing, still proceed with update
      if (this.isActive) {
        this.isActive = false;
        this.proceedWithUpdate();
      }
    });

    // Show and focus the window
    this.goodbyeWindow.show();
    this.goodbyeWindow.focus();

    // Force focus and bring to front
    this.goodbyeWindow.setAlwaysOnTop(true, 'screen-saver');
    this.goodbyeWindow.moveTop();
  }

  /**
   * Send goodbye screen data to renderer
   */
  private sendData(): void {
    if (!this.goodbyeWindow || this.goodbyeWindow.isDestroyed()) return;

    const data: GoodbyeScreenData = {
      newVersion: this.pendingVersion,
    };

    this.goodbyeWindow.webContents.send('goodbye-screen:data', data);
  }

  /**
   * Called by renderer when animation is complete
   * Closes all other windows and proceeds with update
   */
  public onAnimationComplete(): void {
    log.info('[Goodbye Screen] Animation complete, closing other windows...');

    // Close all application windows (except the goodbye screen)
    this.closeAllApplicationWindows().then(() => {
      log.info('[Goodbye Screen] All windows closed, proceeding with update');
      this.proceedWithUpdate();
    });
  }

  /**
   * Close all application windows
   */
  private async closeAllApplicationWindows(): Promise<void> {
    const windowsToClose = Array.from(applicationWindows.values());

    if (windowsToClose.length === 0) {
      return;
    }

    const closePromises = windowsToClose.map((appWindow) => {
      return new Promise<void>((resolve) => {
        if (appWindow && appWindow.window && !appWindow.window.isDestroyed()) {
          appWindow.window.once('closed', () => {
            resolve();
          });
          appWindow.window.close();
        } else {
          resolve();
        }
      });
    });

    await Promise.all(closePromises);
    applicationWindows.clear();
  }

  /**
   * Proceed with the update installation
   */
  private proceedWithUpdate(): void {
    this.isActive = false;

    // Close goodbye window if it's still open
    if (this.goodbyeWindow && !this.goodbyeWindow.isDestroyed()) {
      this.goodbyeWindow.close();
      this.goodbyeWindow = null;
    }

    log.info('[Goodbye Screen] Calling quitAndInstall');
    autoUpdater.quitAndInstall();
  }

  /**
   * Check if goodbye screen is currently active
   */
  public isShowing(): boolean {
    return this.isActive;
  }
}

// Export singleton instance
export const goodbyeScreen = new GoodbyeScreen();

/**
 * Setup IPC handlers for goodbye screen
 */
export function setupGoodbyeScreenHandlers(): void {
  // Handle animation complete signal from renderer
  ipcMain.on('goodbye-screen:animation-complete', () => {
    log.info('[Goodbye Screen] Received animation complete signal');
    goodbyeScreen.onAnimationComplete();
  });

  // Handle get data request
  ipcMain.on('goodbye-screen:get-data', (_event) => {
    // This is handled by the window's did-finish-load event
    // but we can respond here too if needed
    log.info('[Goodbye Screen] Get data request received');
  });

  log.info('Goodbye screen IPC handlers registered');
}
