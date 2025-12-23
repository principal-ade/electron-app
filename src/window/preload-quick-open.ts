/**
 * Preload script for the Quick Open window.
 *
 * This is a minimal preload that only exposes the APIs required for Quick Open:
 * - electronAPI: Quick Open IPC (items, selection, close)
 * - mainProcess.userPreferences: For theme loading
 */
console.info('[Preload-QuickOpen] Script starting...');

import { contextBridge, ipcRenderer } from 'electron';

console.info('[Preload-QuickOpen] Electron imports successful');

// Import only the required API
import { userPreferencesAPI } from './main-process-api-implementations/userPreferencesApi';

console.info('[Preload-QuickOpen] API imports successful');

// Expose minimal mainProcess API (only what Quick Open needs for theming)
try {
  contextBridge.exposeInMainWorld('mainProcess', {
    userPreferences: userPreferencesAPI,
  });
  console.info('[Preload-QuickOpen] mainProcess.userPreferences API exposed');
} catch (error) {
  console.error(
    '[Preload-QuickOpen] Failed to expose mainProcess API:',
    error,
  );
}

// Expose Quick Open specific electronAPI
try {
  contextBridge.exposeInMainWorld('electronAPI', {
    // Quick Open API
    onQuickOpenItems: (callback: (event: any, items: any[]) => void) => {
      const listener = (event: Electron.IpcRendererEvent, items: any[]) =>
        callback(event, items);
      ipcRenderer.on('quick-open:items', listener);
      return () => {
        ipcRenderer.removeListener('quick-open:items', listener);
      };
    },
    requestQuickOpenItems: () => ipcRenderer.send('quick-open:request-items'),
    selectQuickOpenItem: (item: any) =>
      ipcRenderer.send('quick-open:select', item),
    closeQuickOpen: () => ipcRenderer.send('quick-open:close'),
  });
  console.info('[Preload-QuickOpen] electronAPI exposed');
} catch (error) {
  console.error('[Preload-QuickOpen] Failed to expose electronAPI:', error);
}

// Expose app name
try {
  contextBridge.exposeInMainWorld('appName', 'Principal ADE - Quick Open');
  console.info('[Preload-QuickOpen] appName exposed');
} catch (error) {
  console.error('[Preload-QuickOpen] Failed to expose appName:', error);
}

console.info('[Preload-QuickOpen] Preload script executed successfully');
