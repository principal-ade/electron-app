/**
 * Preload script for the Splash Screen.
 *
 * This is a minimal preload that only exposes the APIs required for Splash Screen:
 * - electronAPI: Update info and close signal
 */
console.info('[Preload-SplashScreen] Script starting...');

import { contextBridge, ipcRenderer } from 'electron';

console.info('[Preload-SplashScreen] Electron imports successful');

interface SplashScreenData {
  isPostUpdate: boolean;
  currentVersion: string;
  previousVersion: string | null;
}

// Expose Splash Screen specific electronAPI
try {
  contextBridge.exposeInMainWorld('electronAPI', {
    // Listen for splash screen data
    onData: (callback: (data: SplashScreenData) => void) => {
      const listener = (_: Electron.IpcRendererEvent, data: SplashScreenData) =>
        callback(data);
      ipcRenderer.on('splash-screen:data', listener);
      return () => {
        ipcRenderer.removeListener('splash-screen:data', listener);
      };
    },

    // Listen for close signal (to trigger fade out)
    onClose: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('splash-screen:close', listener);
      return () => {
        ipcRenderer.removeListener('splash-screen:close', listener);
      };
    },

    // Request data (in case we miss the initial send)
    requestData: () => ipcRenderer.send('splash-screen:get-data'),
  });
  console.info('[Preload-SplashScreen] electronAPI exposed');
} catch (error) {
  console.error(
    '[Preload-SplashScreen] Failed to expose electronAPI:',
    error,
  );
}

// Expose app name
try {
  contextBridge.exposeInMainWorld('appName', 'Principal ADE - Splash Screen');
  console.info('[Preload-SplashScreen] appName exposed');
} catch (error) {
  console.error('[Preload-SplashScreen] Failed to expose appName:', error);
}

console.info('[Preload-SplashScreen] Preload script executed successfully');
