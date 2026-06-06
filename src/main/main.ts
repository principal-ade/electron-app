/* eslint no-console: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import fs from 'fs';
import { app, protocol, ipcMain, dialog, BrowserWindow, nativeImage } from 'electron';
import log from 'electron-log';
import { windowSwitcher } from './window/windowSwitcher';
import { quickOpen } from './window/quickOpen';
import { splashScreen } from './window/splashScreen';
import { getPostUpdateDetector } from './app-version/postUpdateDetection';
import {
  createWindow,
  applicationWindows,
  getIsRestarting,
  handleAppRestart,
} from './window/modernWindowManager';
// import { registerWindowHandlers } from './services/ipc/window/windowHandlers'; // Replaced by modernWindowHandlers
import { initializeServices, shutdownServices } from './initialization';
import { verifyRequiredAssets } from './util';
// Defer SecureTokenIPC initialization to avoid early keychain access

// Configure electron-log to use app-specific directory
log.transports.file.resolvePathFn = () => {
  return path.join(app.getPath('logs'), 'main.log');
};
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

// Log app startup
log.info(`[Main] Starting ${app.getName()} v${app.getVersion()}`);
log.info(`[Main] Log file: ${log.transports.file.getFile().path}`);

// NOTE: electron-reload was removed - it conflicts with electronmon which is already
// used in start:main to handle hot reloading. Having both caused infinite process spawning.

// Ensure only one instance of the app runs
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running, quit this one
  console.log('[Main Process] Another instance is already running. Exiting...');
  app.exit(0);
} else {
  // Handle when another instance tries to start (also handles deep links on Windows/Linux)
  app.on('second-instance', (_event, commandLine, _workingDirectory) => {
    // Check if this was triggered by a deep link
    const deepLinkUrl = commandLine.find((arg) =>
      arg.startsWith(`${PROTOCOL_NAME}://`),
    );
    if (deepLinkUrl) {
      handleDeepLink(deepLinkUrl);
      return;
    }

    // Otherwise, just focus the existing window
    const windows = Array.from(applicationWindows.values());
    if (windows.length > 0 && windows[0].window) {
      if (windows[0].window.isMinimized()) windows[0].window.restore();
      windows[0].window.focus();
    }
  });
}

/**
 * Handle deep link URLs from principal-ade:// protocol
 * Format: principal-ade://open-workspace?path=/path/to/repo&name=RepoName
 * Format: principal-ade://open-workspace?owner=github-owner&repo=repo-name
 */
async function handleDeepLink(url: string): Promise<void> {
  console.log(`[Main] Handling deep link: ${url}`);

  try {
    const parsedUrl = new URL(url);
    const command = parsedUrl.hostname;

    if (command === 'open-workspace') {
      const params = parsedUrl.searchParams;
      const path = params.get('path');
      const owner = params.get('owner');
      const repo = params.get('repo');

      // Import the dev workspace handler dynamically to avoid circular deps
      const { openDevWorkspaceWindow } =
        await import('./window/devWorkspaceWindowHandlers');

      if (path) {
        // Open local workspace by path - look up Alexandria entry first
        const decodedPath = decodeURIComponent(path);
        console.log(`[Main] Opening dev workspace at path: ${decodedPath}`);

        // Look up the Alexandria entry for this path
        const { AlexandriaRegistryService } =
          await import('./stores/AlexandriaRegistryService');
        const service = AlexandriaRegistryService.getInstance();
        const alexandriaEntry = await service.getRepositoryByPath(decodedPath);

        if (alexandriaEntry) {
          await openDevWorkspaceWindow({ alexandriaEntry });
        } else {
          console.warn(
            `[Main] No Alexandria entry found for path: ${decodedPath}`,
          );
        }
      } else if (owner && repo) {
        // Look up Alexandria entry by owner/repo
        const { AlexandriaRegistryService } =
          await import('./stores/AlexandriaRegistryService');
        const service = AlexandriaRegistryService.getInstance();
        const repositories = await service.getRepositories();
        const alexandriaEntry = repositories.find(
          (r) => r.github?.owner === owner && r.name === repo,
        );

        if (alexandriaEntry) {
          await openDevWorkspaceWindow({ alexandriaEntry });
        } else {
          console.warn(`[Main] No Alexandria entry found for ${owner}/${repo}`);
        }
      }
    } else {
      console.warn(`[Main] Unknown deep link command: ${command}`);
    }
  } catch (error) {
    console.error('[Main] Failed to handle deep link:', error);
  }
}

// Security: Disable remote module
app.commandLine.appendSwitch('disable-site-isolation-trials');

// Dev-only: enable Chrome DevTools Protocol so memory/CPU can be inspected via curl/CDP.
// Renderer side uses Chromium's remote-debugging-port; main process uses Node's inspector.
// Set ELECTRON_DEBUG_PORT / ELECTRON_INSPECT_PORT to override.
if (process.env.NODE_ENV === 'development') {
  const debugPort = process.env.ELECTRON_DEBUG_PORT ?? '9222';
  app.commandLine.appendSwitch('remote-debugging-port', debugPort);

  const inspectPort = Number(process.env.ELECTRON_INSPECT_PORT ?? '9223');
  const { open: openInspector } = require('node:inspector') as typeof import('node:inspector');
  try {
    openInspector(inspectPort);
    console.info(`[Main] Node inspector listening on ws://localhost:${inspectPort}`);
  } catch (err) {
    console.warn('[Main] Could not open inspector:', err);
  }
}

// Register as the default protocol handler for principal-ade:// URLs
// This allows web-ade to open the desktop app with deep links
const PROTOCOL_NAME = 'principal-ade';
if (process.defaultApp) {
  // In development, we need to register with the path to electron
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL_NAME, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  // In production, just register the protocol
  app.setAsDefaultProtocolClient(PROTOCOL_NAME);
}
console.log(`[Main] Registered as handler for ${PROTOCOL_NAME}:// URLs`);

// Apply production constraints in development if requested
if (process.env.NODE_ENV_PACKAGED_SIMULATION === 'true') {
  console.log(
    '[Main] Running with production constraints (packaged simulation)',
  );
  // NOTE: Sandbox enforcement removed because it breaks secondary windows with adapters
  // The sandbox is now controlled per-window based on their features
  // app.commandLine.appendSwitch('enable-sandbox');
  // app.commandLine.appendSwitch('no-sandbox-fallback');

  // Log which constraints are active
  console.log('[Main] Constraints applied:');
  console.log('  - Per-window sandbox control (not globally enforced)');
  console.log('  - Production paths forced');
  console.log('  - Security warnings enabled');
}

// AppUpdater class moved to ./updater.ts

// Add a new IPC handler for restarting the app
ipcMain.on('restart-app', handleAppRestart);

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

// Manual implementation of electron-debug features
if (isDebug) {
  // Enable DevTools keyboard shortcuts
  app.on('browser-window-created', (_, window) => {
    window.webContents.on('before-input-event', (event, input) => {
      // Toggle DevTools with F12 or Cmd+Alt+I (Mac) / Ctrl+Shift+I (Win/Linux)
      if (
        input.key === 'F12' ||
        (process.platform === 'darwin' &&
          input.meta &&
          input.alt &&
          input.key.toLowerCase() === 'i') ||
        (process.platform !== 'darwin' &&
          input.control &&
          input.shift &&
          input.key.toLowerCase() === 'i')
      ) {
        window.webContents.toggleDevTools();
        event.preventDefault();
      }

      // Reload with F5 or Cmd+R (Mac) / Ctrl+R (Win/Linux)
      if (
        input.key === 'F5' ||
        (process.platform === 'darwin' &&
          input.meta &&
          input.key.toLowerCase() === 'r') ||
        (process.platform !== 'darwin' &&
          input.control &&
          input.key.toLowerCase() === 'r')
      ) {
        window.webContents.reload();
        event.preventDefault();
      }

      // Force reload with Shift+F5 or Cmd+Shift+R (Mac) / Ctrl+Shift+R (Win/Linux)
      if (
        (input.shift && input.key === 'F5') ||
        (process.platform === 'darwin' &&
          input.meta &&
          input.shift &&
          input.key.toLowerCase() === 'r') ||
        (process.platform !== 'darwin' &&
          input.control &&
          input.shift &&
          input.key.toLowerCase() === 'r')
      ) {
        window.webContents.reloadIgnoringCache();
        event.preventDefault();
      }

      // Open DevTools and inspect element with Cmd+Shift+C (Mac) / Ctrl+Shift+C (Win/Linux)
      if (
        (process.platform === 'darwin' &&
          input.meta &&
          input.shift &&
          input.key.toLowerCase() === 'c') ||
        (process.platform !== 'darwin' &&
          input.control &&
          input.shift &&
          input.key.toLowerCase() === 'c')
      ) {
        window.webContents.inspectElement(0, 0);
        event.preventDefault();
      }
    });
  });
}

// Window switcher keyboard shortcuts (per-window listeners)
app.on('browser-window-created', (_, window) => {
  log.info('[Window Switcher] Attaching keyboard listener to window');

  window.webContents.on('before-input-event', (event, input) => {
    // Command+' (or Ctrl+') - Toggle mode
    if (
      input.type === 'keyDown' &&
      input.code === 'Quote' &&
      ((process.platform === 'darwin' &&
        input.meta &&
        !input.control &&
        !input.shift) ||
        (process.platform !== 'darwin' &&
          input.control &&
          !input.meta &&
          !input.shift))
    ) {
      log.info("[Window Switcher] Toggle shortcut triggered (Command+')");
      windowSwitcher.toggle();
      event.preventDefault();
    }

    // Command+O (or Ctrl+O) - Quick Open (repos/workspaces)
    if (
      input.type === 'keyDown' &&
      input.code === 'KeyO' &&
      ((process.platform === 'darwin' &&
        input.meta &&
        !input.control &&
        !input.shift &&
        !input.alt) ||
        (process.platform !== 'darwin' &&
          input.control &&
          !input.meta &&
          !input.shift &&
          !input.alt))
    ) {
      log.info(
        '[Quick Open] Command+O triggered - Opening repo/workspace picker',
      );
      quickOpen.show();
      event.preventDefault();
    }

    // Detect when Command/Ctrl is released while switcher is showing in cycle mode
    if (
      input.type === 'keyUp' &&
      windowSwitcher.isShowing() &&
      windowSwitcher.isCycleMode() &&
      ((process.platform === 'darwin' &&
        (input.code === 'MetaLeft' || input.code === 'MetaRight')) ||
        (process.platform !== 'darwin' &&
          (input.code === 'ControlLeft' || input.code === 'ControlRight')))
    ) {
      log.info(
        '[Window Switcher] Modifier key released, activating selected window',
      );
      windowSwitcher.activateSelectedAndHide();
      event.preventDefault();
    }
  });
});

app.on('window-all-closed', async () => {
  // Services are stopped in 'will-quit' to support macOS behavior where the app can run without windows.

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Flag to track if quit confirmation is in progress
let isQuitting = false;

// Add a handler for 'before-quit' to show confirmation dialog
app.on('before-quit', async (event) => {
  // If already quitting or dialog already shown, don't show again
  if (isQuitting) {
    return;
  }

  // Prevent the default quit behavior
  event.preventDefault();

  // Set flag to prevent multiple dialogs
  isQuitting = true;

  try {
    // Get the focused window or any available window
    const focusedWindow = BrowserWindow.getFocusedWindow();
    const windows = Array.from(applicationWindows.values());
    const targetWindow =
      focusedWindow || (windows.length > 0 ? windows[0].window : null);

    if (targetWindow && !targetWindow.isDestroyed()) {
      const response = await dialog.showMessageBox(targetWindow, {
        type: 'question',
        buttons: ['Cancel', 'Quit'],
        defaultId: 0,
        title: 'Confirm Quit',
        message: 'Are you sure you want to quit?',
        detail: 'Any unsaved changes will be lost.',
      });

      if (response.response === 1) {
        // User confirmed, proceed with quit
        // Remove this listener to avoid infinite loop
        app.removeAllListeners('before-quit');
        app.quit();
      } else {
        // User cancelled, reset the flag
        isQuitting = false;
      }
    } else {
      // No window available, just quit
      app.removeAllListeners('before-quit');
      app.quit();
    }
  } catch (error) {
    console.error('[Main Process] Error showing quit confirmation:', error);
    isQuitting = false;
  }
});

// Add a handler for 'will-quit' to properly shut down services
app.on('will-quit', async (event) => {
  console.log('[Main Process] App is about to quit. Shutting down services.');

  // Prevent default quit to ensure cleanup completes
  event.preventDefault();

  try {
    await shutdownServices();

    // Close all windows
    applicationWindows.forEach((appWindow) => {
      if (appWindow.window && !appWindow.window.isDestroyed()) {
        appWindow.window.destroy();
      }
    });
    applicationWindows.clear();
  } catch (error) {
    console.error('[Main Process] Error during shutdown:', error);
  } finally {
    // Now actually quit
    app.exit(0);
  }
});

// Register custom protocol schemes
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app-asset',
    privileges: {
      standard: true,
      supportFetchAPI: true,
      bypassCSP: true,
    },
  },
  {
    // Protocol for loading local media files (images, videos) in renderer
    scheme: 'local-media',
    privileges: {
      standard: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true, // Required for video streaming
    },
  },
]);

// Allow self-signed certificates for Control Tower server in development
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  console.log('[Main] Certificate error event fired:', {
    url,
    error,
    hostname: new URL(url).hostname,
  });

  const hostname = new URL(url).hostname;

  // Allow certificates for production Control Tower server
  if (
    hostname.includes('amazonlightsail.com') ||
    hostname.includes('repository-traffic-controller') ||
    (process.env.NODE_ENV === 'development' && hostname === 'localhost')
  ) {
    console.log(`[Main] ✅ Bypassing certificate error for ${hostname}`);
    event.preventDefault();
    callback(true); // Trust the certificate
  } else {
    console.log(`[Main] ❌ Not bypassing certificate error for ${hostname}`);
    callback(false); // Use default verification
  }
});

// Handle deep links on macOS (open-url event)
// This must be set up before app is ready
app.on('open-url', (event, url) => {
  event.preventDefault();
  console.log(`[Main] Received open-url event: ${url}`);
  handleDeepLink(url);
});

app
  .whenReady()
  .then(async () => {
    // Dev builds: badge the dock icon (macOS) so a dev app is visually
    // distinct from a production install. Packaged builds are untouched.
    if (!app.isPackaged && process.platform === 'darwin' && app.dock) {
      try {
        const devIconPath = path.join(app.getAppPath(), 'assets', 'icon-dev.png');
        if (fs.existsSync(devIconPath)) {
          app.dock.setIcon(nativeImage.createFromPath(devIconPath));
          console.log('[Main] Applied dev dock icon:', devIconPath);
        }
      } catch (err) {
        console.warn('[Main] Failed to apply dev dock icon:', err);
      }
    }

    // Register local-media protocol handler for loading local files in renderer
    protocol.handle('local-media', async (request) => {
      // URL format: local-media://localhost/absolute/path/to/file.png
      // Using explicit localhost host to prevent path being interpreted as hostname
      const url = new URL(request.url);
      const filePath = decodeURIComponent(url.pathname);

      try {
        const data = await require('fs/promises').readFile(filePath);
        const mimeTypes: Record<string, string> = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
          '.bmp': 'image/bmp',
          '.ico': 'image/x-icon',
          '.mp4': 'video/mp4',
          '.webm': 'video/webm',
          '.mov': 'video/quicktime',
          '.avi': 'video/x-msvideo',
          '.mkv': 'video/x-matroska',
          '.ogv': 'video/ogg',
        };
        const ext = require('path').extname(filePath).toLowerCase();
        const mimeType = mimeTypes[ext] || 'application/octet-stream';

        return new Response(data, {
          headers: { 'Content-Type': mimeType },
        });
      } catch (error) {
        console.error('[Main] local-media protocol error:', error);
        return new Response('File not found', { status: 404 });
      }
    });

    // Show splash screen IMMEDIATELY - before any heavy initialization
    const postUpdateDetector = getPostUpdateDetector();
    postUpdateDetector.checkForPostUpdate();
    await splashScreen.show();

    // Initialize auth services FIRST before other services
    console.log('[Main] Initializing auth services...');
    const AuthStateManager = require('./services/AuthStateManager').default;
    const { authService } = require('./services/AuthService');
    const { gitSyncIPC } = require('./services/GitSyncIPC');
    const { presenceIPC } = require('./services/PresenceIPC');
    const { orbitIPC } = require('./services/OrbitIPC');
    const { fastForwardIPC } = require('./services/FastForwardIPC');

    // Force initialization
    const authStateManager = AuthStateManager.getInstance();
    console.log('[Main] Auth services initialized:', {
      authService: !!authService,
      authStateManager: !!authStateManager,
      gitSyncIPC: !!gitSyncIPC,
      presenceIPC: !!presenceIPC,
      orbitIPC: !!orbitIPC,
      fastForwardIPC: !!fastForwardIPC,
    });

    // SecureTokenIPC will be initialized lazily on first use
    // No need to require it here anymore

    // Verify all required assets exist before starting
    const assetVerification = verifyRequiredAssets();
    if (!assetVerification.success) {
      console.error(
        '[Main] Critical: Missing required assets. Hook functionality may be impaired.',
      );
      console.error('[Main] Missing assets:', assetVerification.missing);
      // Continue startup but log the issues for debugging
    }

    // Initialize all services (this initializes UserPreferencesHandler)
    await initializeServices();

    // Check keychain consent before initializing auth
    // This prevents the macOS keychain prompt from appearing without user context
    // Note: Must be after initializeServices() which initializes UserPreferencesHandler
    const { UserPreferencesHandler } = require('./stores/userPreferencesHandler');
    const userPrefsHandler = UserPreferencesHandler.getInstance();
    const prefs = await userPrefsHandler.getUserPreferences();

    if (prefs.keychainConsent?.status === 'granted') {
      // User has granted consent - initialize auth (may trigger keychain access)
      await authService.initializeAuthState();
      console.log('[Main] Auth state initialized (keychain consent granted)');
    } else {
      // Consent pending or declined - skip keychain access
      console.log(
        '[Main] Skipping auth init - keychain consent:',
        prefs.keychainConsent?.status || 'pending',
      );
      // Ensure auth state manager is in unauthenticated state
      AuthStateManager.getInstance().clearAuthentication();
    }

    // Window handlers are now registered in initializeServices() via modernWindowHandlers

    // Note: Window switcher shortcuts are registered via per-window keyboard listeners below

    createWindow();

    app.on('activate', () => {
      if (applicationWindows.size === 0 && !getIsRestarting()) {
        console.log(
          '[Main Process] app.on("activate"): No windows open and not restarting, creating window.',
        );
        createWindow();
      } else if (getIsRestarting()) {
        console.log(
          '[Main Process] app.on("activate"): Restart in progress, not creating window.',
        );
      }
    });
  })
  .catch(console.log);
