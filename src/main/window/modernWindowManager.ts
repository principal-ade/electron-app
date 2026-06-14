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
  screen,
} from 'electron';
import path from 'path';
import log from 'electron-log';
import { resolveHtmlPath } from '../util';
import { getTracer } from '../telemetry';
import { ElectronFileSystemAdapter } from '../file-system/fileSystemHandlers';
import { ElectronWindowManagerAdapter } from './windowManagerHandlers';
import { GitHubAdapter } from '../version-control-providers/githubHandlers';
import MenuBuilder from '../menu';
import { getAppVersionManagerInstance } from '../app-version';
import { gitSyncWebSocketManager } from '../services/GitSyncWebSocketManager';
import { orbitWebSocketManager } from '../services/OrbitWebSocketManager';
import { splashScreen } from './splashScreen';

// Import shared types and data structures
import {
  WindowFeatures,
  IModernApplicationWindow,
  WindowMetadata,
  PrimaryWindowType,
  applicationWindows,
  specialWindows,
  WINDOW_FEATURES,
  setMainWindowId,
  getMainWindowId,
} from './types';

import { WindowEvent } from '../../shared/ipc-events/WindowEvents';

// Re-export for backward compatibility
export { applicationWindows, specialWindows } from './types';
export type { WindowFeatures } from './types';

// Track if titlebar IPC handlers have been registered
let titlebarHandlersRegistered = false;

// Set once the user has confirmed an app-wide quit. The workspace window's
// close interceptor (below) steps aside while this is true, so quitting closes
// every window instead of being blocked by the per-window status prompt.
let appQuitting = false;
export function markAppQuitting(): void {
  appQuitting = true;
}

/**
 * Modern Application Window class
 */
export class ModernApplicationWindow implements IModernApplicationWindow {
  public window: BrowserWindow;
  public features: WindowFeatures;
  public metadata: WindowMetadata;

  // Optional adapters
  public fileSystemAdapter?: ElectronFileSystemAdapter;
  public windowManagerAdapter?: ElectronWindowManagerAdapter;
  public githubAdapter?: GitHubAdapter;
  private menuBuilder?: MenuBuilder;

  // Set true once the renderer has confirmed a workspace-window close (after
  // the pre-dismiss status prompt). Lets the next `close` event through instead
  // of re-prompting. See the `close` interceptor in setupWindowBehaviors.
  private allowClose = false;

  constructor(
    options?: BrowserWindowConstructorOptions,
    windowType: keyof typeof WINDOW_FEATURES = 'main',
    customFeatures?: Partial<WindowFeatures>,
    metadata?: WindowMetadata,
  ) {
    const tracer = getTracer('principal-ade-main');
    const constructorSpan = tracer.startSpan('window.constructor', {
      attributes: {
        'window.type': windowType,
        'window.primaryType': metadata?.primaryType ?? PrimaryWindowType.UNKNOWN,
        'window.displayName': metadata?.displayName ?? 'Untitled Window',
      },
    });

    // Determine features for this window
    this.features = {
      ...WINDOW_FEATURES[windowType],
      ...customFeatures,
    };

    // Set metadata (with defaults for unknown windows)
    this.metadata = metadata ?? {
      primaryType: PrimaryWindowType.UNKNOWN,
      displayName: 'Untitled Window',
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
        // Allow custom preload if provided, otherwise use default
        preload:
          options?.webPreferences?.preload ||
          defaultOptions.webPreferences?.preload,
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
    console.log(`[ModernWindow] Final window dimensions:`, {
      width: mergedOptions.width,
      height: mergedOptions.height,
      x: mergedOptions.x,
      y: mergedOptions.y,
    });

    // Create the window
    this.window = new BrowserWindow(mergedOptions);

    constructorSpan.setAttribute('window.id', this.window.id);
    console.log(`[ModernWindow] Window created with ID: ${this.window.id}`);

    // Setup behaviors FIRST (includes ready-to-show handler)
    this.setupWindowBehaviors();

    // Track the window
    applicationWindows.set(this.window.id, this);

    // End constructor span - window is created and tracked
    constructorSpan.end();

    // Initialize features AFTER basic setup
    // For windows with adapters, delay initialization slightly to ensure renderer is ready
    if (
      this.features.fileSystemAdapter ||
      this.features.windowManagerAdapter ||
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
    this.window.on('closed', async () => {
      console.log(`[ModernWindow] Window ${this.window.id} closed`);

      // Check if this was a repository window before cleanup
      let wasRepositoryWindow = false;
      for (const [purpose, windowId] of specialWindows.entries()) {
        if (
          windowId === this.window.id &&
          purpose.startsWith('repository-maps-')
        ) {
          wasRepositoryWindow = true;
          break;
        }
      }

      // Capture before the map entry is removed below.
      const wasWorkspaceWindow =
        this.metadata?.primaryType === PrimaryWindowType.WORKSPACE;

      // Clean up file system watchers before removing from map
      if (this.fileSystemAdapter) {
        console.log(
          `[ModernWindow] Cleaning up file system watchers for window ${this.window.id}`,
        );
        try {
          await this.fileSystemAdapter.stopWatching();
        } catch (error) {
          console.error(
            `[ModernWindow] Error stopping file system watchers:`,
            error,
          );
        }
      }

      // Clean up git-sync connections for this window
      try {
        gitSyncWebSocketManager.disconnectForWindow(this.window.id);
      } catch (error) {
        console.error(
          `[ModernWindow] Error disconnecting git-sync connections:`,
          error,
        );
      }

      // Clean up orbit P2P connections for this window
      try {
        orbitWebSocketManager.disconnectForWindow(this.window.id);
      } catch (error) {
        console.error(
          `[ModernWindow] Error disconnecting orbit connections:`,
          error,
        );
      }

      applicationWindows.delete(this.window.id);

      // Clean up special window tracking
      for (const [purpose, windowId] of specialWindows.entries()) {
        if (windowId === this.window.id) {
          specialWindows.delete(purpose);
        }
      }

      // Broadcast repository window change if this was a repository window
      if (wasRepositoryWindow) {
        // Track repository closed in presence system
        import('../services/PresenceWindowBridge')
          .then((module) => {
            module.presenceWindowBridge.trackRepositoryClosed(
              String(this.window.id),
            );
          })
          .catch((error) => {
            console.error(
              '[ModernWindow] Error tracking presence closure:',
              error,
            );
          });

        // Import and call broadcast function from modernWindowHandlers
        import('./modernWindowHandlers')
          .then((module) => {
            if (module.broadcastRepositoryWindowsChanged) {
              module.broadcastRepositoryWindowsChanged();
            }
          })
          .catch((error) => {
            console.error(
              '[ModernWindow] Error broadcasting window change:',
              error,
            );
          });
      }

      // Tell the home view a topic window closed so it can drop the "open"
      // indicator on the matching topic card.
      if (wasWorkspaceWindow) {
        import('./modernWindowHandlers')
          .then((module) => {
            module.broadcastWorkspaceWindowsChanged?.();
          })
          .catch((error) => {
            console.error(
              '[ModernWindow] Error broadcasting workspace window change:',
              error,
            );
          });
      }
    });
  }

  private getDefaultOptions(): BrowserWindowConstructorOptions {
    // For secondary windows with full adapters, we need to disable sandbox
    // because the adapters require IPC communication that sandbox blocks
    const needsSandboxDisabled =
      this.features.fileSystemAdapter ||
      this.features.githubAdapter ||
      this.features.windowManagerAdapter;

    const sandboxValue = !needsSandboxDisabled;

    console.log(`[ModernWindow] Sandbox configuration:`, {
      needsSandboxDisabled,
      sandboxValue,
      features: {
        fileSystem: this.features.fileSystemAdapter,
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
      webviewTag: true, // Enable webview tag for localhost browser panels
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
    // Note: acceptsFirstMouse is an undocumented Electron feature
    (webPreferences as Record<string, unknown>).acceptsFirstMouse = true;

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
      };
    } else if (isLinux) {
      // Linux: Remove frame entirely for full control
      titleBarOptions.frame = false;
    }

    // Get primary display dimensions for maximized-like size
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } =
      primaryDisplay.workAreaSize;

    console.log(`[ModernWindow] Screen dimensions:`, {
      screenWidth,
      screenHeight,
      x: primaryDisplay.workArea.x,
      y: primaryDisplay.workArea.y,
      fullBounds: primaryDisplay.bounds,
      workArea: primaryDisplay.workArea,
    });

    return {
      width: screenWidth,
      height: screenHeight,
      x: primaryDisplay.workArea.x,
      y: primaryDisplay.workArea.y,
      minWidth: 800,
      minHeight: 600,
      icon: iconPath,
      show: false, // Prevent white flash
      backgroundColor: '#00000000', // Transparent to prevent color flash
      acceptFirstMouse: true, // Allow hover interactions without focusing window
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
      console.log(
        `[ModernWindow] Attempting to initialize terminal manager for window ${this.window.id}`,
      );
      import('../terminalWrapper')
        .then(({ getTerminalManager }) => {
          console.log(
            `[ModernWindow] Terminal wrapper imported, getting manager...`,
          );
          const terminalManager = getTerminalManager();
          console.log(
            `[ModernWindow] Terminal manager retrieved:`,
            !!terminalManager,
          );
          if (terminalManager) {
            terminalManager.setMainWindow(this.window);
            console.log(
              `[ModernWindow] Terminal manager initialized for window ${this.window.id}`,
            );
          } else {
            console.warn(`[ModernWindow] Terminal manager is null/undefined`);
          }
        })
        .catch((e) => {
          console.error(`[ModernWindow] Terminal manager not available:`, e);
        });
    }

    // Content Security Policy
    if (this.features.contentSecurityPolicy) {
      this.setupContentSecurityPolicy();
    }

    // Menu
    if (this.features.menu) {
      this.menuBuilder = new MenuBuilder(this.window, focusOrCreateMainWindow);
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
        // Don't override CSP for localhost URLs (e.g., webview content like Storybook)
        // Let those servers control their own CSP
        const url = new URL(details.url);
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
          callback({ responseHeaders: details.responseHeaders });
          return;
        }

        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              "default-src 'self';",
              process.env.NODE_ENV !== 'production'
                ? "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' 'unsafe-inline' blob:;"
                : "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' blob:;",
              "style-src 'self' 'unsafe-inline';",
              "img-src 'self' data: blob: https:;",
              "font-src 'self' data:;",
              "connect-src 'self' data: ws: wss: http://localhost:* https://localhost:* https://principle-md.com https://registry.npmjs.org https://api.github.com https://raw.githubusercontent.com https://openrouter.ai https://cdn.jsdelivr.net;",
              "worker-src 'self' blob:;",
              "media-src 'self';",
              "object-src 'none';",
              "base-uri 'self';",
              "form-action 'self';",
              'frame-src http://localhost:* https://localhost:*;',
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
    const windowId = this.window.id;
    const tracer = getTracer('principal-ade-main');

    // Prevent white flash
    this.window.once('ready-to-show', () => {
      const showSpan = tracer.startSpan('window.ready-to-show', {
        attributes: {
          'window.id': windowId,
        },
      });

      // Maximize before show so the window doesn't briefly render at its
      // constructed bounds and then animate outward from the top-left.
      if (this.features.maximizeOnShow && !process.env.START_MINIMIZED) {
        this.window.maximize();
      }

      this.window.show();
      showSpan.end();

      // Close splash screen when main window is ready
      if (splashScreen.isShowing()) {
        splashScreen.close();
      }
    });

    // Workspace windows prompt for a status update before they're dismissed:
    // hold the close, ask the renderer to surface the info modal, and wait for
    // it to confirm (which flips `allowClose` and closes again). Skipped during
    // an app-wide quit or restart, and for every non-workspace window, which
    // close normally.
    this.window.on('close', (event) => {
      if (
        this.allowClose ||
        appQuitting ||
        isRestarting ||
        this.metadata?.primaryType !== PrimaryWindowType.WORKSPACE
      ) {
        return;
      }
      event.preventDefault();
      if (!this.window.isDestroyed()) {
        this.window.webContents.send(WindowEvent.WORKSPACE_BEFORE_CLOSE);
      }
    });

    // Setup titlebar IPC handlers for this window
    this.setupTitlebarHandlers();
  }

  /**
   * Allow the next `close` to proceed and trigger it. Called from the
   * renderer's confirm-close path once the user has finished with the
   * pre-dismiss status prompt.
   */
  public confirmClose(): void {
    this.allowClose = true;
    if (!this.window.isDestroyed()) {
      this.window.close();
    }
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

      // Window close with confirmation
      ipcMain.handle('window-close-with-confirmation', async (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return false;

        const { dialog } = require('electron');
        const choice = await dialog.showMessageBox(win, {
          type: 'question',
          buttons: ['Cancel', 'Close'],
          defaultId: 0,
          cancelId: 0,
          title: 'Close Repository',
          message: 'Are you sure you want to close this repository?',
          detail: 'Any unsaved work may be lost.',
        });

        if (choice.response === 1) {
          win.close();
          return true;
        }
        return false;
      });

      // Check if maximized
      ipcMain.handle('window-is-maximized', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        return win ? win.isMaximized() : false;
      });

      // Confirm a workspace-window close after the pre-dismiss status prompt.
      // The renderer invokes this once the user picks "Close window"; we flip
      // the originating window's `allowClose` and close it for real.
      ipcMain.handle(WindowEvent.WORKSPACE_CONFIRM_CLOSE, (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return false;
        applicationWindows.get(win.id)?.confirmClose();
        return true;
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
  mainOptions?: { openTrailId?: string },
): Promise<ModernApplicationWindow | null> {
  const tracer = getTracer('principal-ade-main');
  const isMainWindow = !options || Object.keys(options).length === 0;
  const windowType = isMainWindow ? 'main' : 'secondary';

  const span = tracer.startSpan('window.create', {
    attributes: {
      'window.type': windowType,
      'window.isMain': isMainWindow,
    },
  });

  console.log(`[ModernWindow] Creating ${windowType} window`);

  try {
    // Create metadata for main window
    const metadata: WindowMetadata = isMainWindow
      ? {
          primaryType: PrimaryWindowType.MAIN,
          displayName: 'Main',
        }
      : {
          primaryType: PrimaryWindowType.UNKNOWN,
          displayName: 'Secondary Window',
        };

    const appWindow = new ModernApplicationWindow(
      options,
      windowType,
      undefined,
      metadata,
    );

    span.setAttribute('window.id', appWindow.window.id);

    // Track main window ID
    if (isMainWindow) {
      setMainWindowId(appWindow.window.id);
      console.log(`[ModernWindow] Set main window ID: ${appWindow.window.id}`);
    }

    // Load content - use principal.html for main window
    const htmlFileName = isMainWindow ? 'principal.html' : 'index.html';
    const baseHtmlPath = resolveHtmlPath(htmlFileName);
    const openTrailSuffix =
      isMainWindow && mainOptions?.openTrailId
        ? `#openTrailId=${encodeURIComponent(mainOptions.openTrailId)}`
        : '';
    const htmlPath = `${baseHtmlPath}${openTrailSuffix}`;
    appWindow.window.loadURL(htmlPath);
    console.log(`[ModernWindow] Window ${appWindow.id} loading: ${htmlPath}`);

    // Initialize updater for first window only
    if (applicationWindows.size === 1) {
      log.info('[ModernWindow] Initializing AppUpdater for first window');
      try {
        const updater = getAppVersionManagerInstance();
        updater.initializeUpdater(appWindow.window);
        log.info('[ModernWindow] AppUpdater initialized successfully');
      } catch (error) {
        log.error('[ModernWindow] Failed to initialize AppUpdater:', error);
      }
    }

    span.end();
    return appWindow;
  } catch (error) {
    span.recordException(error as Error);
    span.end();
    console.error('[ModernWindow] Failed to create window:', error);
    return null;
  }
}

/**
 * Look up a special window by `purpose` and bring it to the front.
 * Returns the existing window, or `null` when none is live for that key.
 *
 * On hit: restores from minimize, shows, focuses, and `moveTop`s — the
 * `show()` + `moveTop()` pair is needed because `focus()` alone doesn't
 * pull a window forward when it's on another macOS Space or behind a
 * fullscreen app.
 *
 * On a stale registry entry (window destroyed since it was registered),
 * deletes the entry and returns null so the caller falls through to
 * createSpecialWindow.
 *
 * Always call this before `createSpecialWindow`; that function throws on
 * a duplicate `purpose`.
 */
export function focusExistingSpecialWindow(
  purpose: string,
): IModernApplicationWindow | null {
  const existingId = specialWindows.get(purpose);
  if (!existingId) return null;
  const existing = applicationWindows.get(existingId);
  if (!existing || existing.window.isDestroyed()) {
    specialWindows.delete(purpose);
    return null;
  }
  if (existing.window.isMinimized()) {
    existing.window.restore();
  }
  existing.window.show();
  existing.window.focus();
  existing.window.moveTop();
  return existing;
}

/**
 * Create a special purpose window. The `purpose` key must be unique among
 * live windows — callers must dedup with `focusExistingSpecialWindow()`
 * first. A silent-reuse fallback here would force callers to re-run
 * `loadURL` and other post-create setup against a window that already has
 * renderer state, wiping it.
 */
export function createSpecialWindow(
  purpose: string,
  options: BrowserWindowConstructorOptions,
  features?: Partial<WindowFeatures>,
  metadata?: WindowMetadata,
): IModernApplicationWindow | null {
  const tracer = getTracer('principal-ade-main');
  const span = tracer.startSpan('window.createSpecial', {
    attributes: {
      'window.purpose': purpose,
    },
  });

  const existingId = specialWindows.get(purpose);
  if (existingId) {
    const existing = applicationWindows.get(existingId);
    if (existing && !existing.window.isDestroyed()) {
      span.setAttribute('window.duplicate-purpose', true);
      span.end();
      throw new Error(
        `createSpecialWindow: a window with purpose '${purpose}' is already registered. ` +
          `Call focusExistingSpecialWindow('${purpose}') first and early-return on a hit.`,
      );
    }
    // Stale registry entry — window was destroyed since registration.
    specialWindows.delete(purpose);
  }

  try {
    // Determine window type based on features
    // If it has adapters, use 'secondary' type instead of 'minimal'
    const hasAdapters =
      features?.fileSystemAdapter ||
      features?.windowManagerAdapter ||
      features?.githubAdapter;

    const windowType = hasAdapters ? 'secondary' : 'minimal';
    span.setAttribute('window.type', windowType);

    console.log(
      `[ModernWindow] Creating special window '${purpose}' with type '${windowType}'`,
    );

    // Use provided metadata or create default with purpose
    const windowMetadata: WindowMetadata = metadata ?? {
      primaryType: PrimaryWindowType.UNKNOWN,
      displayName: options.title || 'Special Window',
      purpose,
    };

    const appWindow = new ModernApplicationWindow(
      options,
      windowType,
      features,
      windowMetadata,
    );

    span.setAttribute('window.id', appWindow.id);

    // DON'T load any URL here - let the handler do it after window is ready
    // This avoids race conditions with adapter initialization
    console.log(
      `[ModernWindow] Special window ${appWindow.id} created, waiting for handler to load URL`,
    );

    specialWindows.set(purpose, appWindow.id);
    span.end();
    return appWindow;
  } catch (error) {
    span.recordException(error as Error);
    span.end();
    console.error(
      `[ModernWindow] Failed to create special window ${purpose}:`,
      error,
    );
    return null;
  }
}

/**
 * Focus the main window if it exists, otherwise create it
 * This is useful for "new window" operations that should show the main window
 *
 * When `openTrailId` is provided it is baked into the principal.html URL as
 * `#openTrailId=<id>` on cold start so `IntegratedShell` can switch to the
 * Trails view at first render. Warm starts (existing main window) ignore the
 * arg — broadcasts (`LIBRARY_CHANGED`) are the warm-path delivery mechanism.
 */
export async function focusOrCreateMainWindow(
  options?: { openTrailId?: string },
): Promise<IModernApplicationWindow | null> {
  const mainId = getMainWindowId();

  // If main window exists, focus it
  if (mainId !== null) {
    const mainWindow = applicationWindows.get(mainId);
    if (mainWindow && !mainWindow.window.isDestroyed()) {
      console.log('[ModernWindow] Focusing existing main window');

      // Restore if minimized
      if (mainWindow.window.isMinimized()) {
        mainWindow.window.restore();
      }

      // Show and focus
      mainWindow.window.show();
      mainWindow.window.focus();

      return mainWindow;
    }

    // Main window ID is stale, clear it
    console.log('[ModernWindow] Main window ID is stale, clearing');
    setMainWindowId(null);
  }

  // No main window exists, create one
  console.log('[ModernWindow] No main window exists, creating new one');
  return await createWindow(undefined, options);
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

/**
 * Helper method to send messages to all windows
 */
export function sendToAllWindows(channel: string, ...args: unknown[]): void {
  applicationWindows.forEach((appWindow) => {
    if (appWindow && appWindow.window && !appWindow.window.isDestroyed()) {
      appWindow.window.webContents.send(channel, ...args);
    }
  });
}
