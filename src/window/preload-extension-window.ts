/**
 * Preload script for the extension browser window.
 *
 * This preload exposes only the APIs required for browsing and launching extensions:
 * - extension: Extension discovery and management
 * - userPreferences: User settings (for extensions directory)
 */
console.info('[Preload-ExtensionWindow] Script starting...');

import { contextBridge, ipcRenderer } from 'electron';

console.info('[Preload-ExtensionWindow] Electron imports successful');

// Import required APIs
import { extensionAPI } from './main-process-api-implementations/extensionApi';
import { userPreferencesAPI } from './main-process-api-implementations/userPreferencesApi';

console.info('[Preload-ExtensionWindow] API imports successful');

// Import the type definition
import type { ExtensionWindowMainProcessAPI } from '../shared/main-process-api-interfaces/ExtensionWindowAPI';

// Build the API surface
const extensionWindowAPI: ExtensionWindowMainProcessAPI = {
  extension: extensionAPI,
  userPreferences: userPreferencesAPI,
};

// Expose the mainProcess API
try {
  contextBridge.exposeInMainWorld('mainProcess', extensionWindowAPI);
  console.info(
    '[Preload-ExtensionWindow] ✅ MainProcess API exposed with keys:',
    Object.keys(extensionWindowAPI),
  );
} catch (error) {
  console.error(
    '[Preload-ExtensionWindow] ❌ Failed to expose mainProcess API:',
    error,
  );
}

// Expose custom titlebar API
try {
  contextBridge.exposeInMainWorld('electronTitlebar', {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    closeWithConfirmation: () =>
      ipcRenderer.invoke('window-close-with-confirmation'),
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
    onMaximizeChange: (callback: (isMaximized: boolean) => void) => {
      ipcRenderer.on('window-maximized-changed', (_, isMaximized) =>
        callback(isMaximized),
      );
    },
  });
  console.info('[Preload-ExtensionWindow] ✅ Electron Titlebar API exposed');
} catch (error) {
  console.error(
    '[Preload-ExtensionWindow] ❌ Failed to expose titlebar API:',
    error,
  );
}

// Expose app name
try {
  contextBridge.exposeInMainWorld('appName', 'Principal ADE - Extensions');
  console.info('[Preload-ExtensionWindow] ✅ AppName exposed');
} catch (error) {
  console.error(
    '[Preload-ExtensionWindow] ❌ Failed to expose appName:',
    error,
  );
}

console.info(
  '[Preload-ExtensionWindow] 🚀 Preload script executed successfully',
);
