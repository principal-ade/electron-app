import { BrowserWindow, screen } from 'electron';
import path from 'path';
import { resolveHtmlPath } from '../util';

export class CallimachusWindow {
  private window: BrowserWindow | null = null;

  constructor() {}

  create(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.focus();
      return;
    }

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    this.window = new BrowserWindow({
      show: false,
      width: Math.min(1000, width * 0.8),
      height: Math.min(700, height * 0.8),
      title: 'Pattern Discovery - Callimachus',
      icon: path.join(__dirname, '../../../assets/icon.png'),
      webPreferences: {
        preload: path.join(__dirname, '../preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      frame: process.platform !== 'darwin',
    });

    this.window.loadURL(`${resolveHtmlPath('index.html')}#/callimachus`);

    this.window.on('ready-to-show', () => {
      if (!this.window) {
        throw new Error('"callimachusWindow" is not defined');
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

    if (
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
    ) {
      this.window.webContents.openDevTools();
    }
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

let callimachusWindowInstance: CallimachusWindow | null = null;

export function getCallimachusWindow(): CallimachusWindow {
  if (!callimachusWindowInstance) {
    callimachusWindowInstance = new CallimachusWindow();
  }
  return callimachusWindowInstance;
}
