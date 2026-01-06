/**
 * Preload script for Remote Terminal Viewer
 * Minimal API surface - only what's needed for terminal viewing
 */

console.info('[RemoteTerminalViewer Preload] Script starting...');

import { contextBridge, ipcRenderer } from 'electron';
import { authenticationAPI } from './main-process-api-implementations/authenticationApi';
import { windowAPI } from './main-process-api-implementations/windowApi';

console.info('[RemoteTerminalViewer Preload] Imports successful');

// Expose minimal API needed for remote terminal viewer
try {
  contextBridge.exposeInMainWorld('mainProcess', {
    authentication: authenticationAPI,
    window: windowAPI,
  });
  console.info('[RemoteTerminalViewer Preload] ✅ Minimal API exposed');
} catch (error) {
  console.error('[RemoteTerminalViewer Preload] ❌ Failed to expose API:', error);
}

// Expose window controls
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
  console.info('[RemoteTerminalViewer Preload] ✅ Window controls exposed');
} catch (error) {
  console.error('[RemoteTerminalViewer Preload] ❌ Failed to expose window controls:', error);
}

try {
  contextBridge.exposeInMainWorld('appName', 'Principal ADE - Remote Terminal Viewer');
  console.info('[RemoteTerminalViewer Preload] ✅ AppName exposed');
} catch (error) {
  console.error('[RemoteTerminalViewer Preload] ❌ Failed to expose appName:', error);
}

console.info('[RemoteTerminalViewer Preload] 🚀 Preload script completed');
