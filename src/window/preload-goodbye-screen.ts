/**
 * Preload script for the Goodbye Screen overlay.
 *
 * This is a minimal preload that only exposes the APIs required for Goodbye Screen:
 * - electronAPI: Version info and animation complete signal
 */
console.info('[Preload-GoodbyeScreen] Script starting...');

import { contextBridge, ipcRenderer } from 'electron';

console.info('[Preload-GoodbyeScreen] Electron imports successful');

interface GoodbyeScreenData {
  newVersion: string;
}

// Expose Goodbye Screen specific electronAPI
try {
  contextBridge.exposeInMainWorld('electronAPI', {
    // Signal that animation is complete and ready to proceed
    signalAnimationComplete: () =>
      ipcRenderer.send('goodbye-screen:animation-complete'),

    // Listen for goodbye screen data
    onData: (callback: (data: GoodbyeScreenData) => void) => {
      const listener = (_: Electron.IpcRendererEvent, data: GoodbyeScreenData) =>
        callback(data);
      ipcRenderer.on('goodbye-screen:data', listener);
      return () => {
        ipcRenderer.removeListener('goodbye-screen:data', listener);
      };
    },

    // Request data (in case we miss the initial send)
    requestData: () => ipcRenderer.send('goodbye-screen:get-data'),
  });
  console.info('[Preload-GoodbyeScreen] electronAPI exposed');
} catch (error) {
  console.error(
    '[Preload-GoodbyeScreen] Failed to expose electronAPI:',
    error,
  );
}

// Expose app name
try {
  contextBridge.exposeInMainWorld('appName', 'Principal ADE - Goodbye Screen');
  console.info('[Preload-GoodbyeScreen] appName exposed');
} catch (error) {
  console.error('[Preload-GoodbyeScreen] Failed to expose appName:', error);
}

console.info('[Preload-GoodbyeScreen] Preload script executed successfully');
