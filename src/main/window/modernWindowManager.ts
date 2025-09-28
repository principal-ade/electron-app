/**
 * Modern Window Manager - Bridge between old and new window systems
 * Provides clean window creation while maintaining compatibility
 */

import {
  BrowserWindow,
  BrowserWindowConstructorOptions,
  app,
  shell,
  ipcMain,
} from 'electron';
import path from 'path';
import log from 'electron-log';
import { resolveHtmlPath } from '../util';
import { EnvironmentConfig } from '../utils/environmentConfig';
import { ElectronFileSystemAdapter } from '../file-system/fileSystemHandlers';
import { ElectronWindowManagerAdapter } from './windowManagerHandlers';
import { McpToolsAdapter } from '../principal-mcp/mcpToolsHandlers';
import { GitHubAdapter } from '../version-control-providers/githubHandlers';
import MenuBuilder from '../menu';
import AppVersionManager from '../AppVersionManager';

// Import shared types and data structures
import {
  WindowFeatures,
  IModernApplicationWindow,
  applicationWindows,
  specialWindows,
  WINDOW_FEATURES,
} from './types';

// Re-export for backward compatibility
export { applicationWindows, specialWindows } from './types';
export type { WindowFeatures } from './types';

// Track if titlebar IPC handlers have been registered
let titlebarHandlersRegistered = false;

/**
 * Modern Application Window class
 */
export class ModernApplicationWindow implements IModernApplicationWindow {
  public window: BrowserWindow;
  public features: WindowFeatures;

  // Optional adapters
  public fileSystemAdapter?: ElectronFileSystemAdapter;
  public windowManagerAdapter?: ElectronWindowManagerAdapter;
  public mcpToolsAdapter?: McpToolsAdapter;
  public githubAdapter?: GitHubAdapter;
  private menuBuilder?: MenuBuilder;

  constructor(
    options?: BrowserWindowConstructorOptions,
    windowType: keyof typeof WINDOW_FEATURES = 'main',
    customFeatures?: Partial<WindowFeatures>,
  ) {
    // Determine features for this window
    this.features = {
      ...WINDOW_FEATURES[windowType],
      ...customFeatures,
    };

    console.log(
      `[ModernWindow] Creating ${windowType} window with features:`,
      this.features,
    );

    // Build default options
    const defaultOptions = this.getDefaultOptions();

    // Deep merge webPreferences to preserve our sandbox setting
    const mergedOptions = {
      ...defaultOptions,
      ...options,
      webPreferences: {
        ...defaultOptions.webPreferences,
        ...(options?.webPreferences || {}),
        // CRITICAL: Force sandbox to be disabled for windows with adapters
        // Override any other settings that might have been passed
        sandbox: defaultOptions.webPreferences?.sandbox,
        // Also ensure contextIsolation and other critical settings aren't overridden
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        preload: defaultOptions.webPreferences?.preload,
      },
    };

    console.log(
      `[ModernWindow] Final webPreferences:`,
      mergedOptions.webPreferences,
    );
    console.log(
      `[ModernWindow] Sandbox explicitly set to:`,
      mergedOptions.webPreferences.sandbox,
    );

    // Create the window
    this.window = new BrowserWindow(mergedOptions);

    console.log(`[ModernWindow] Window created with ID: ${this.window.id}`);

    // Setup behaviors FIRST (includes ready-to-show handler)
    this.setupWindowBehaviors();

    // Track the window
    applicationWindows.set(this.window.id, this);

    // Initialize features AFTER basic setup
    // For windows with adapters, delay initialization slightly to ensure renderer is ready
    if (
      this.features.fileSystemAdapter ||
      this.features.windowManagerAdapter ||
      this.features.mcpToolsAdapter ||
      this.features.githubAdapter
    ) {
      console.log(
        `[ModernWindow] Delaying adapter initialization for window ${this.window.id}`,
      );
      // Use setImmediate to defer adapter initialization to next tick
      setImmediate(() => {
        console.log(
          `[ModernWindow] Initializing adapters for window ${this.window.id}`,
        );
        this.initializeFeatures();
      });
    } else {
      // For windows without adapters, initialize immediately
      this.initializeFeatures();
    }

    // Handle cleanup on close
    this.window.on('closed', () => {
      console.log(`[ModernWindow] Window ${this.window.id} closed`);
      applicationWindows.delete(this.window.id);

      // Clean up special window tracking
      for (const [purpose, windowId] of specialWindows.entries()) {
        if (windowId === this.window.id) {
          specialWindows.delete(purpose);
        }
      }
    });
  }

  private getDefaultOptions(): BrowserWindowConstructorOptions {
    // For secondary windows with full adapters, we need to disable sandbox
    // because the adapters require IPC communication that sandbox blocks
    const needsSandboxDisabled =
      this.features.fileSystemAdapter ||
      this.features.mcpToolsAdapter ||
      this.features.githubAdapter ||
      this.features.windowManagerAdapter;

    const sandboxValue = !needsSandboxDisabled;

    console.log(`[ModernWindow] Sandbox configuration:`, {
      needsSandboxDisabled,
      sandboxValue,
      features: {
        fileSystem: this.features.fileSystemAdapter,
        mcp: this.features.mcpToolsAdapter,
        github: this.features.githubAdapter,
        windowManager: this.features.windowManagerAdapter,
      },
    });

    // Get the correct assets path
    const rootPath = app.isPackaged
      ? process.resourcesPath
      : path.join(__dirname, '../../../..');

    const iconPath =
      process.platform === 'darwin'
        ? path.join(rootPath, 'assets', 'icon.icns')
        : process.platform === 'win32'
          ? path.join(rootPath, 'assets', 'icon.ico')
          : undefined; // Linux doesn't need icon in BrowserWindow

    console.log(`[ModernWindow] Icon path: ${iconPath}`);

    const preloadPath = app.isPackaged
      ? path.join(__dirname, 'preload.js')
      : path.join(__dirname, '../../.erb/dll/preload.js');

    console.log(`[ModernWindow] Preload path: ${preloadPath}`);
    console.log(
      `[ModernWindow] Preload exists: ${require('fs').existsSync(preloadPath)}`,
    );

    // For windows with adapters, we need to completely disable sandbox
    // Some Electron versions have issues with sandbox: false, so we use additional flags
    const webPreferences: Electron.WebPreferences = {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: sandboxValue,
      webSecurity: true,
    };

    // Additional sandbox workaround for problematic Electron versions
    if (!sandboxValue) {
      // Explicitly disable all sandbox features
      webPreferences.contextIsolation = true; // Keep context isolation even without sandbox
      webPreferences.nodeIntegrationInWorker = false;
      webPreferences.nodeIntegrationInSubFrames = false;
      webPreferences.experimentalFeatures = false;
    }

    // Add acceptsFirstMouse to webPreferences for better mouse interaction
    // This helps with mouse events on unfocused windows
    (webPreferences as any).acceptsFirstMouse = true;

    // Platform-specific titlebar configuration
    const isMac = process.platform === 'darwin';
    const isWindows = process.platform === 'win32';
    const isLinux = !isMac && !isWindows;

    const titleBarOptions: Partial<BrowserWindowConstructorOptions> = {};

    if (isMac) {
      // macOS: Hide title bar but keep traffic lights
      titleBarOptions.titleBarStyle = 'hiddenInset';
      // Position traffic lights centered in the 32px custom titlebar
      titleBarOptions.trafficLightPosition = { x: 12, y: 10 };
    } else if (isWindows) {
      // Windows: Use titleBarOverlay for native controls in custom position
      titleBarOptions.titleBarStyle = 'hidden';
      titleBarOptions.titleBarOverlay = {
        color: 'rgb(31, 41, 55)', // Match app's background color (top of gradient)
        symbolColor: '#ffffff', // White window control icons
        height: 48, // Height of custom title bar area
      } as any;
    } else if (isLinux) {
      // Linux: Remove frame entirely for full control
      titleBarOptions.frame = false;
    }

    return {
      width: 1024,
      height: 768,
      minWidth: 800,
      minHeight: 600,
      icon: iconPath,
      show: false, // Prevent white flash
      backgroundColor: '#1e1e1e',
      acceptsFirstMouse: true, // Allow hover interactions without focusing window
      webPreferences,
      ...titleBarOptions, // Apply platform-specific titlebar settings
    };
  }

  private initializeFeatures(): void {
    // Error handlers
    if (this.features.errorHandlers) {
      this.attachErrorHandlers();
    }

    // FileSystem Adapter
    if (this.features.fileSystemAdapter) {
      try {
        this.fileSystemAdapter = new ElectronFileSystemAdapter();
        this.fileSystemAdapter.setMainWindow(this.window);
        console.log(`[ModernWindow] FileSystemAdapter initialized`);
      } catch (e) {
        console.error(
          `[ModernWindow] Failed to initialize FileSystemAdapter:`,
          e,
        );
      }
    }

    // Window Manager Adapter
    if (this.features.windowManagerAdapter) {
      try {
        this.windowManagerAdapter = new ElectronWindowManagerAdapter();
        this.windowManagerAdapter.setMainWindow(this.window);
        console.log(`[ModernWindow] WindowManagerAdapter initialized`);
      } catch (e) {
        console.error(
          `[ModernWindow] Failed to initialize WindowManagerAdapter:`,
          e,
        );
      }
    }

    // MCP Tools Adapter
    if (this.features.mcpToolsAdapter) {
      try {
        this.mcpToolsAdapter = new McpToolsAdapter(this.window);
        console.log(`[ModernWindow] McpToolsAdapter initialized`);
      } catch (e) {
        console.error(
          `[ModernWindow] Failed to initialize McpToolsAdapter:`,
          e,
        );
      }
    }

    // GitHub Adapter
    if (this.features.githubAdapter) {
      try {
        this.githubAdapter = new GitHubAdapter();

        // Connect to FileSystemAdapter if both are present
        if (this.fileSystemAdapter) {
          this.fileSystemAdapter.setGitHubAdapter(this.githubAdapter);
          console.log(
            `[ModernWindow] Connected GitHubAdapter to FileSystemAdapter`,
          );
        }

        console.log(`[ModernWindow] GitHubAdapter initialized`);
      } catch (e) {
        console.error(`[ModernWindow] Failed to initialize GitHubAdapter:`, e);
      }
    }

    // Terminal Manager
    if (this.features.terminalManager) {
      import('../terminalWrapper')
        .then(({ getTerminalManager }) => {
          const terminalManager = getTerminalManager();
          if (terminalManager) {
            terminalManager.setMainWindow(this.window);
            console.log(`[ModernWindow] Terminal manager initialized`);
          }
        })
        .catch((e) => {
          console.log(`[ModernWindow] Terminal manager not available`, e);
        });
    }

    // Content Security Policy
    if (this.features.contentSecurityPolicy) {
      this.setupContentSecurityPolicy();
    }

    // Menu
    if (this.features.menu) {
      this.menuBuilder = new MenuBuilder(this.window, createWindow);
      this.menuBuilder.buildMenu();
    }

    // External Link Handler
    if (this.features.externalLinkHandler) {
      this.window.webContents.setWindowOpenHandler((edata) => {
        shell.openExternal(edata.url);
        return { action: 'deny' };
      });
    }
  }

  private attachErrorHandlers(): void {
    this.window.webContents.on(
      'preload-error',
      (_event, preloadPath, error) => {
        console.error(
          `[ModernWindow] Preload error for ${preloadPath}:`,
          error,
        );
      },
    );

    this.window.webContents.on('render-process-gone', (_event, details) => {
      console.error(`[ModernWindow] Render process gone:`, details);
      console.error(`[ModernWindow] Crash reason: ${details.reason}`);
      console.error(`[ModernWindow] Exit code: ${details.exitCode}`);

      // Common crash reasons and their meanings
      if (details.reason === 'crashed') {
        console.error(
          `[ModernWindow] The renderer process crashed. This often happens due to:`,
        );
        console.error(`  - Sandbox misconfiguration with IPC handlers`);
        console.error(`  - Memory issues or infinite loops`);
        console.error(`  - Native module conflicts`);
      } else if (details.reason === 'oom') {
        console.error(`[ModernWindow] Out of memory error`);
      } else if (details.reason === 'launch-failed') {
        console.error(`[ModernWindow] Failed to launch renderer process`);
      }
    });

    this.window.webContents.on(
      'did-fail-load',
      (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        console.error(`[ModernWindow] Failed to load:`, {
          errorCode,
          errorDescription,
          validatedURL,
          isMainFrame,
        });
      },
    );

    // Add console message handler to see renderer errors
    this.window.webContents.on(
      'console-message',
      (_event, level, message, line, sourceId) => {
        if (level >= 2) {
          // Error level
          console.error(
            `[ModernWindow Renderer] ${message} (${sourceId}:${line})`,
          );
        }
      },
    );
  }

  private setupContentSecurityPolicy(): void {
    this.window.webContents.session.webRequest.onHeadersReceived(
      (details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              "default-src 'self';",
              process.env.NODE_ENV !== 'production'
                ? "script-src 'self' 'unsafe-eval' 'unsafe-inline';"
                : "script-src 'self' 'unsafe-eval';",
              "style-src 'self' 'unsafe-inline';",
              "img-src 'self' data: blob: https:;",
              "font-src 'self' data:;",
              "connect-src 'self' ws: wss: http://localhost:* https://localhost:* https://principle-md.com https://registry.npmjs.org https://api.github.com https://raw.githubusercontent.com https://openrouter.ai;",
              "worker-src 'self' blob:;",
              "media-src 'self';",
              "object-src 'none';",
              "base-uri 'self';",
              "form-action 'self';",
              "frame-ancestors 'none';",
              'upgrade-insecure-requests;',
            ]
              .filter(Boolean)
              .join(' '),
          },
        });
      },
    );
  }

  private setupWindowBehaviors(): void {
    // Prevent white flash
    this.window.once('ready-to-show', () => {
      this.window.show();

      // Maximize if configured
      if (this.features.maximizeOnShow) {
        if (!process.env.START_MINIMIZED) {
          this.window.maximize();
        }
      }
    });

    // Setup titlebar IPC handlers for this window
    this.setupTitlebarHandlers();
  }

  private setupTitlebarHandlers(): void {
    // Register global IPC handlers only once
    if (!titlebarHandlersRegistered) {
      titlebarHandlersRegistered = true;

      // Window minimize
      ipcMain.on('window-minimize', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) win.minimize();
      });

      // Window maximize/restore
      ipcMain.on('window-maximize', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) {
          if (win.isMaximized()) {
            win.restore();
          } else {
            win.maximize();
          }
        }
      });

      // Window close
      ipcMain.on('window-close', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) win.close();
      });

      // Check if maximized
      ipcMain.handle('window-is-maximized', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        return win ? win.isMaximized() : false;
      });
    }

    // Always set up window-specific maximize state change listeners
    this.window.on('maximize', () => {
      this.window.webContents.send('window-maximized-changed', true);
    });

    this.window.on('unmaximize', () => {
      this.window.webContents.send('window-maximized-changed', false);
    });
  }

  // Getters for compatibility
  public get id(): number {
    return this.window.id;
  }

  public get webContents(): Electron.WebContents {
    return this.window.webContents;
  }

  public close(): void {
    this.window.close();
  }
}

/**
 * Create a window (compatible with old createWindow signature)
 */
export async function createWindow(
  options?: BrowserWindowConstructorOptions,
): Promise<ModernApplicationWindow | null> {
  const isMainWindow = !options || Object.keys(options).length === 0;
  const windowType = isMainWindow ? 'main' : 'secondary';

  console.log(`[ModernWindow] Creating ${windowType} window`);

  try {
    const appWindow = new ModernApplicationWindow(options, windowType);

    // Load content - use principal.html for main window
    const htmlFileName = isMainWindow ? 'principal.html' : 'index.html';
    const htmlPath = resolveHtmlPath(htmlFileName);
    appWindow.window.loadURL(htmlPath);
    console.log(`[ModernWindow] Window ${appWindow.id} loading: ${htmlPath}`);

    // Initialize updater for first window only
    if (applicationWindows.size === 1) {
      log.info('[ModernWindow] Initializing AppUpdater for first window');
      try {
        const updater = new AppVersionManager();
        updater.initializeUpdater(appWindow.window);
        log.info('[ModernWindow] AppUpdater initialized successfully');
      } catch (error) {
        log.error('[ModernWindow] Failed to initialize AppUpdater:', error);
      }
    }

    return appWindow;
  } catch (error) {
    console.error('[ModernWindow] Failed to create window:', error);
    return null;
  }
}

/**
 * Create a special purpose window
 */
export function createSpecialWindow(
  purpose: string,
  options: BrowserWindowConstructorOptions,
  features?: Partial<WindowFeatures>,
): IModernApplicationWindow | null {
  // Check if window already exists
  const existingId = specialWindows.get(purpose);
  if (existingId) {
    const existing = applicationWindows.get(existingId);
    if (existing && !existing.window.isDestroyed()) {
      existing.window.focus();
      if (existing.window.isMinimized()) {
        existing.window.restore();
      }
      return existing;
    }
    // Clean up stale reference
    specialWindows.delete(purpose);
  }

  try {
    // Determine window type based on features
    // If it has adapters, use 'secondary' type instead of 'minimal'
    const hasAdapters =
      features?.fileSystemAdapter ||
      features?.windowManagerAdapter ||
      features?.mcpToolsAdapter ||
      features?.githubAdapter;

    const windowType = hasAdapters ? 'secondary' : 'minimal';

    console.log(
      `[ModernWindow] Creating special window '${purpose}' with type '${windowType}'`,
    );

    const appWindow = new ModernApplicationWindow(
      options,
      windowType,
      features,
    );

    // DON'T load any URL here - let the handler do it after window is ready
    // This avoids race conditions with adapter initialization
    console.log(
      `[ModernWindow] Special window ${appWindow.id} created, waiting for handler to load URL`,
    );

    specialWindows.set(purpose, appWindow.id);
    return appWindow;
  } catch (error) {
    console.error(
      `[ModernWindow] Failed to create special window ${purpose}:`,
      error,
    );
    return null;
  }
}

// Export compatibility functions
export const getApplicationWindows = () => applicationWindows;
export const getSpecialWindows = () => specialWindows;

// Handle app restart
let isRestarting = false;
export const handleAppRestart = () => {
  if (isRestarting) return;
  isRestarting = true;

  console.log('[ModernWindow] Restarting app...');

  const windowsToClose = Array.from(applicationWindows.values());
  if (windowsToClose.length === 0) {
    createWindow().finally(() => {
      isRestarting = false;
    });
    return;
  }

  let closedCount = 0;
  const totalWindows = windowsToClose.length;

  windowsToClose.forEach((appWindow) => {
    if (appWindow && appWindow.window && !appWindow.window.isDestroyed()) {
      appWindow.window.once('closed', () => {
        closedCount++;
        if (closedCount === totalWindows) {
          applicationWindows.clear();
          createWindow().finally(() => {
            isRestarting = false;
          });
        }
      });
      appWindow.window.close();
    }
  });
};

export const getIsRestarting = () => isRestarting;
export const setIsRestarting = (value: boolean) => {
  isRestarting = value;
};

// Type alias for compatibility
export type OldApplicationWindow = ModernApplicationWindow;
