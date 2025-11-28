/**
 * Minimal preload script for the dev-workspace window.
 *
 * This preload exposes only the APIs required by the panel framework:
 * - terminal: Terminal session management
 * - fileSystem: File read/write operations
 * - repositoryMonitoring: Git status and file tree
 * - userPreferences: User settings
 *
 * When adding new APIs, update DevWorkspaceMainProcessAPI in
 * src/shared/main-process-api-interfaces/DevWorkspaceAPI.ts
 */
console.info('[Preload-DevWorkspace] Script starting...');

import { contextBridge, ipcRenderer } from 'electron';

console.info('[Preload-DevWorkspace] Electron imports successful');

// Import only the required APIs from existing implementations
import { terminalAPI } from './main-process-api-implementations/terminalApi';
import { fileSystemAPI } from './main-process-api-implementations/fileSystemApi';
import { repositoryMonitoringAPI } from './main-process-api-implementations/repositoryMonitoringApi';
import { userPreferencesAPI } from './main-process-api-implementations/userPreferencesApi';
import { repositoryAPI } from './main-process-api-implementations/repositoryApi';

console.info('[Preload-DevWorkspace] API imports successful');

// Import the minimal type definition
import type { DevWorkspaceMainProcessAPI } from '../shared/main-process-api-interfaces/DevWorkspaceAPI';

// Build the minimal API surface
const devWorkspaceAPI: DevWorkspaceMainProcessAPI = {
  terminal: terminalAPI,
  fileSystem: fileSystemAPI,
  repositoryMonitoring: repositoryMonitoringAPI,
  userPreferences: userPreferencesAPI,
  repository: repositoryAPI,
};

// Expose the mainProcess API
try {
  contextBridge.exposeInMainWorld('mainProcess', devWorkspaceAPI);
  console.info(
    '[Preload-DevWorkspace] ✅ MainProcess API exposed with keys:',
    Object.keys(devWorkspaceAPI),
  );
} catch (error) {
  console.error(
    '[Preload-DevWorkspace] ❌ Failed to expose mainProcess API:',
    error,
  );
}

// Expose custom titlebar API (same as main preload)
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
  console.info('[Preload-DevWorkspace] ✅ Electron Titlebar API exposed');
} catch (error) {
  console.error(
    '[Preload-DevWorkspace] ❌ Failed to expose titlebar API:',
    error,
  );
}

// Expose app name
try {
  contextBridge.exposeInMainWorld('appName', 'Principal ADE - Dev Workspace');
  console.info('[Preload-DevWorkspace] ✅ AppName exposed');
} catch (error) {
  console.error('[Preload-DevWorkspace] ❌ Failed to expose appName:', error);
}

console.info(
  '[Preload-DevWorkspace] 🚀 Preload script executed successfully - minimal APIs exposed',
);
