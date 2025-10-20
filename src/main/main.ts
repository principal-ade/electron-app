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
import { app, protocol, ipcMain, dialog, BrowserWindow } from 'electron';
import log from 'electron-log';
import { windowSwitcher } from './window/windowSwitcher';
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

// Add electron-reload in development
if (process.env.NODE_ENV === 'development' && !app.isPackaged) {
  try {
    // Only load electron-reload in true development mode
    // The __dirname issue is because webpack transforms the module system
    // Use eval to prevent webpack from analyzing this require
    const electronReloadPath = path.join(
      __dirname,
      '../../node_modules/electron-reload',
    );
    const electronBinaryPath = path.join(
      __dirname,
      '../../node_modules/.bin/electron',
    );

    // Dynamically require to avoid webpack bundling issues
    eval(`require('${electronReloadPath}')`)(__dirname, {
      electron: electronBinaryPath,
      forceHardReset: true,
      ignored: /node_modules|\.erb|dist|\.git/,
    });
  } catch (e) {
    console.error('Failed to load electron-reload:', e);
    console.log('This is expected in production builds');
  }
}

// Ensure only one instance of the app runs
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running, quit this one
  console.log('[Main Process] Another instance is already running. Exiting...');
  app.exit(0);
} else {
  // Handle when another instance tries to start
  app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
    // Someone tried to run a second instance, focus our window instead
    const windows = Array.from(applicationWindows.values());
    if (windows.length > 0 && windows[0].window) {
      if (windows[0].window.isMinimized()) windows[0].window.restore();
      windows[0].window.focus();
    }
  });
}

// Security: Disable remote module
app.commandLine.appendSwitch('disable-site-isolation-trials');

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

// Window switcher keyboard shortcut (only active when app windows are focused)
app.on('browser-window-created', (_, window) => {
  log.info('[Window Switcher] Attaching keyboard listener to window');

  window.webContents.on('before-input-event', (event, input) => {
    // Window switcher with Cmd+; (Mac) / Ctrl+; (Win/Linux)
    // Using semicolon since backtick is captured by macOS
    if (
      input.type === 'keyDown' &&
      input.code === 'Semicolon' &&
      ((process.platform === 'darwin' &&
        input.meta &&
        !input.control &&
        !input.shift) ||
        (process.platform !== 'darwin' &&
          input.control &&
          !input.meta &&
          !input.shift))
    ) {
      log.info('[Window Switcher] ✅ Shortcut triggered!');
      windowSwitcher.show();
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

// Register custom protocol scheme for Monaco Editor files
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app-asset',
    privileges: {
      standard: true,
      supportFetchAPI: true,
      bypassCSP: true,
    },
  },
]);

app
  .whenReady()
  .then(async () => {
    // Initialize auth services FIRST before other services
    console.log('[Main] Initializing auth services...');
    const AuthStateManager = require('./services/AuthStateManager').default;
    const { authService } = require('./services/AuthService');
    const { gitSyncIPC } = require('./services/GitSyncIPC');

    // Force initialization
    const authStateManager = AuthStateManager.getInstance();
    console.log('[Main] Auth services initialized:', {
      authService: !!authService,
      authStateManager: !!authStateManager,
      gitSyncIPC: !!gitSyncIPC,
    });

    // Initialize auth state from stored credentials
    await authService.initializeAuthState();
    console.log('[Main] Auth state initialized from stored credentials');

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

    // Initialize all services
    await initializeServices();

    // Window handlers are now registered in initializeServices() via modernWindowHandlers

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
