/**
 * Preload script for the Window Switcher overlay.
 *
 * This is a minimal preload that only exposes the APIs required for Window Switcher:
 * - electronAPI: Window list, selection, and cycling
 */
console.info('[Preload-WindowSwitcher] Script starting...');

import { contextBridge, ipcRenderer } from 'electron';

console.info('[Preload-WindowSwitcher] Electron imports successful');

interface WindowListData {
  windows: Array<{ id: number; title: string }>;
  selectedIndex: number;
}

// Expose Window Switcher specific electronAPI
try {
  contextBridge.exposeInMainWorld('electronAPI', {
    // Window Switcher API
    getWindowList: () => ipcRenderer.send('window-switcher:get-list'),
    selectWindow: (windowId: number) =>
      ipcRenderer.send('window-switcher:select', windowId),
    onWindowListUpdate: (callback: (data: WindowListData) => void) => {
      const listener = (_: Electron.IpcRendererEvent, data: WindowListData) =>
        callback(data);
      ipcRenderer.on('window-switcher:update-list', listener);
      return () => {
        ipcRenderer.removeListener('window-switcher:update-list', listener);
      };
    },
    onSelectNext: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('window-switcher:select-next', listener);
      return () => {
        ipcRenderer.removeListener('window-switcher:select-next', listener);
      };
    },
    onSelectPrevious: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('window-switcher:select-previous', listener);
      return () => {
        ipcRenderer.removeListener('window-switcher:select-previous', listener);
      };
    },
    cycleSelection: (direction: 'next' | 'previous') =>
      ipcRenderer.send('window-switcher:cycle', direction),
  });
  console.info('[Preload-WindowSwitcher] electronAPI exposed');
} catch (error) {
  console.error(
    '[Preload-WindowSwitcher] Failed to expose electronAPI:',
    error,
  );
}

// Expose app name
try {
  contextBridge.exposeInMainWorld('appName', 'Principal ADE - Window Switcher');
  console.info('[Preload-WindowSwitcher] appName exposed');
} catch (error) {
  console.error('[Preload-WindowSwitcher] Failed to expose appName:', error);
}

console.info('[Preload-WindowSwitcher] Preload script executed successfully');
