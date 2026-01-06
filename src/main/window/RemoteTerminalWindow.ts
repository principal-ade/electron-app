/**
 * Remote Terminal Window
 *
 * A special window that connects to terminals via WebSocket (like a browser client)
 * instead of using IPC. Used for testing the terminal streaming functionality.
 */

import { BrowserWindow, screen, app } from 'electron';
import path from 'path';
import { resolveHtmlPath } from '../util';

export class RemoteTerminalWindow {
  private window: BrowserWindow | null = null;

  create(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.focus();
      return;
    }

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    // Get the correct preload path for remote terminal viewer
    // Use specialized preload script with minimal dependencies
    console.log('[RemoteTerminalWindow] __dirname:', __dirname);
    console.log('[RemoteTerminalWindow] app.isPackaged:', app.isPackaged);

    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'preload-remote-terminal-viewer.js')
      : path.join(__dirname, 'preload-remote-terminal-viewer.bundle.dev.js');

    console.log('[RemoteTerminalWindow] Computed preload path:', preloadPath);

    this.window = new BrowserWindow({
      show: false,
      width: Math.min(1200, width * 0.9),
      height: Math.min(800, height * 0.9),
      title: 'Remote Terminal Viewer',
      icon: path.join(__dirname, '../../../assets/icon.png'),
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        // Allow WebSocket connections to production Control Tower server
        webSecurity: process.env.NODE_ENV === 'development' ? false : true,
      },
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      frame: process.platform !== 'darwin',
    });

    // Certificate errors are now handled at the app level in main.ts

    // Load remote terminal viewer page
    this.window.loadURL(`${resolveHtmlPath('index.html')}#/remote-terminal-viewer`);

    this.window.on('ready-to-show', () => {
      if (!this.window) {
        throw new Error('"remoteTerminalWindow" is not defined');
      }
      if (process.env.START_MINIMIZED) {
        this.window.minimize();
      } else {
        this.window.show();
      }
    });

    this.window.on('closed', () => {
      this.window = null;
    });

    // Always open dev tools for debugging
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
    ) {
      this.window.webContents.openDevTools();
    }

    console.log('[RemoteTerminalWindow] Created window');
  }

  close(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.close();
    }
  }

  isOpen(): boolean {
    return this.window !== null && !this.window.isDestroyed();
  }

  focus(): void {
    if (this.window && !this.window.isDestroyed()) {
      if (this.window.isMinimized()) {
        this.window.restore();
      }
      this.window.focus();
    }
  }

  getWindow(): BrowserWindow | null {
    return this.window;
  }
}

// Singleton instance
let remoteTerminalWindowInstance: RemoteTerminalWindow | null = null;

export function getRemoteTerminalWindow(): RemoteTerminalWindow {
  if (!remoteTerminalWindowInstance) {
    remoteTerminalWindowInstance = new RemoteTerminalWindow();
  }
  return remoteTerminalWindowInstance;
}
