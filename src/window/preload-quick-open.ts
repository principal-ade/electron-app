/**
 * Preload script for the Quick Open window.
 *
 * This is a minimal preload that only exposes the APIs required for Quick Open:
 * - electronAPI: Quick Open IPC (items, selection, close)
 * - mainProcess.userPreferences: For theme loading
 */
console.info('[Preload-QuickOpen] Script starting...');

import { contextBridge, ipcRenderer, clipboard } from 'electron';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';

console.info('[Preload-QuickOpen] Electron imports successful');

// Import only the required API
import { userPreferencesAPI } from './main-process-api-implementations/userPreferencesApi';

// QuickOpenItem type definition (matches the one in quickOpen.ts)
interface QuickOpenItem {
  id: string;
  type: 'repository' | 'workspace';
  name: string;
  description?: string;
  remoteUrl?: string;
  localPath?: string;
  isOpen: boolean;
  openWindowId?: number;
  avatarUrl?: string;
  alexandriaEntry?: AlexandriaEntry;
}

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
    onQuickOpenItems: (
      callback: (
        event: Electron.IpcRendererEvent,
        items: QuickOpenItem[],
      ) => void,
    ) => {
      const listener = (
        event: Electron.IpcRendererEvent,
        items: QuickOpenItem[],
      ) => callback(event, items);
      ipcRenderer.on('quick-open:items', listener);
      return () => {
        ipcRenderer.removeListener('quick-open:items', listener);
      };
    },
    requestQuickOpenItems: () => ipcRenderer.send('quick-open:request-items'),
    selectQuickOpenItem: (item: QuickOpenItem) =>
      ipcRenderer.send('quick-open:select', item),
    closeQuickOpen: () => ipcRenderer.send('quick-open:close'),
    copyToClipboard: (text: string) => clipboard.writeText(text),
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
