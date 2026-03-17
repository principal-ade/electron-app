/**
 * Splash Screen - Shown on app startup
 * Provides a pleasant loading experience, especially after updates
 */

import { BrowserWindow, screen, ipcMain, app } from 'electron';
import path from 'path';
import log from 'electron-log';
import { resolveHtmlPath } from '../util';
import { getPostUpdateDetector } from '../app-version/postUpdateDetection';

interface SplashScreenData {
  isPostUpdate: boolean;
  currentVersion: string;
  previousVersion: string | null;
}

class SplashScreen {
  private splashWindow: BrowserWindow | null = null;
  private isActive = false;
  private splashData: SplashScreenData | null = null;

  /**
   * Show the splash screen on app startup
   * Returns a promise that resolves when splash is ready to be displayed
   */
  public async show(): Promise<void> {
    if (this.isActive) {
      log.info('[Splash Screen] Already showing');
      return;
    }

    // Get update info
    const updateInfo = getPostUpdateDetector().getUpdateInfo();
    this.splashData = {
      isPostUpdate: updateInfo.isPostUpdate,
      currentVersion: updateInfo.currentVersion,
      previousVersion: updateInfo.previousVersion,
    };

    this.isActive = true;
    await this.createSplashWindow();

    log.info(
      `[Splash Screen] Showing (isPostUpdate: ${this.splashData.isPostUpdate}, version: ${this.splashData.currentVersion})`,
    );
  }

  /**
   * Create the splash screen window
   */
  private async createSplashWindow(): Promise<void> {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workArea;

    // Use the splash screen specific preload
    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'preload-splash-screen.js')
      : path.join(__dirname, '../../.erb/dll/preload-splash-screen.js');

    log.info(`[Splash Screen] Preload path: ${preloadPath}`);
    log.info(`[Splash Screen] Screen bounds: ${width}x${height}`);

    this.splashWindow = new BrowserWindow({
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
      focusable: false, // Don't steal focus from main window
      backgroundColor: '#00000000',
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const targetUrl = resolveHtmlPath('splash-screen.html');

    log.info(`[Splash Screen] Loading URL: ${targetUrl}`);

    return new Promise((resolve) => {
      if (!this.splashWindow) {
        resolve();
        return;
      }

      this.splashWindow.loadURL(targetUrl).catch((err) => {
        log.error('[Splash Screen] Failed to load renderer:', err);
        log.error('[Splash Screen] Attempted URL:', targetUrl);
        // If we can't show the splash screen, just continue
        this.close();
        resolve();
      });

      // Send data once the page is ready
      this.splashWindow.webContents.on('did-finish-load', () => {
        log.info('[Splash Screen] HTML loaded successfully');
        this.sendData();
        resolve();
      });

      // Log any console messages from the renderer
      this.splashWindow.webContents.on(
        'console-message',
        (_event, _level, message, line, _sourceId) => {
          log.info(`[Splash Screen Renderer] ${message} (line ${line})`);
        },
      );

      // Handle window closed unexpectedly
      this.splashWindow.on('closed', () => {
        this.splashWindow = null;
        this.isActive = false;
      });

      // Show the window (but don't focus since focusable is false)
      this.splashWindow.show();

      // Force to front
      this.splashWindow.setAlwaysOnTop(true, 'screen-saver');
      this.splashWindow.moveTop();
    });
  }

  /**
   * Send splash screen data to renderer
   */
  private sendData(): void {
    if (!this.splashWindow || this.splashWindow.isDestroyed()) return;
    if (!this.splashData) return;

    this.splashWindow.webContents.send('splash-screen:data', this.splashData);
  }

  /**
   * Close the splash screen
   * Called when main window is ready
   */
  public close(): void {
    if (!this.isActive) return;

    log.info('[Splash Screen] Closing');
    this.isActive = false;

    if (this.splashWindow && !this.splashWindow.isDestroyed()) {
      // Send close signal to allow fade out animation
      this.splashWindow.webContents.send('splash-screen:close');

      // Close after a short delay for animation
      setTimeout(() => {
        if (this.splashWindow && !this.splashWindow.isDestroyed()) {
          this.splashWindow.close();
          this.splashWindow = null;
        }
      }, 300);
    }

    // Mark version as launched
    getPostUpdateDetector().markVersionLaunched();
  }

  /**
   * Check if splash screen is currently active
   */
  public isShowing(): boolean {
    return this.isActive;
  }
}

// Export singleton instance
export const splashScreen = new SplashScreen();

/**
 * Setup IPC handlers for splash screen
 */
export function setupSplashScreenHandlers(): void {
  // Handle get data request
  ipcMain.on('splash-screen:get-data', (_event) => {
    log.info('[Splash Screen] Get data request received');
    // Data is sent via did-finish-load, but we could re-send here if needed
  });

  log.info('Splash screen IPC handlers registered');
}
