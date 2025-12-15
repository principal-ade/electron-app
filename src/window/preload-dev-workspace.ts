/**
 * Minimal preload script for the dev-workspace window.
 *
 * This preload exposes only the APIs required by the panel framework:
 * - terminal: Terminal session management
 * - fileSystem: File read/write operations
 * - repositoryMonitoring: Git status and file tree
 * - userPreferences: User settings
 * - gitSync: Git-sync room connections
 * - authentication: Authentication status
 * - githubArtifact: GitHub Actions artifact fetching for quality metrics
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
import { shellAPI } from './main-process-api-implementations/shellApi';
import { windowAPI } from './main-process-api-implementations/windowApi';
import { alexandriaAPI } from './main-process-api-implementations/alexandriaApi';
import { gitSyncAPI } from './main-process-api-implementations/gitSyncApi';
import { authenticationAPI } from './main-process-api-implementations/authenticationApi';
import { agentSessionSDKApi } from './main-process-api-implementations/agentSessionSDKApi';
import { githubArtifactAPI } from './main-process-api-implementations/githubArtifactApi';

console.info('[Preload-DevWorkspace] API imports successful');

// Import the minimal type definition
import type { DevWorkspaceMainProcessAPI } from '../shared/main-process-api-interfaces/DevWorkspaceAPI';

// Build the minimal API surface
const devWorkspaceAPI: DevWorkspaceMainProcessAPI = {
  terminal: terminalAPI,
  fileSystem: fileSystemAPI,
  repositoryMonitoring: repositoryMonitoringAPI,
  userPreferences: userPreferencesAPI,
  shell: shellAPI,
  window: windowAPI,
  alexandria: alexandriaAPI,
  gitSync: gitSyncAPI,
  authentication: authenticationAPI,
  agentSessionSDK: agentSessionSDKApi,
  githubArtifact: githubArtifactAPI,
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

// ============================================
// TIPC Support + Terminal MessagePort Management
// ============================================

// Terminal MessagePort storage and subscription management
const terminalPorts = new Map<string, MessagePort>();
const terminalSubscribers = new Map<string, Set<(data: string) => void>>();
const ownershipLostSubscribers = new Set<
  (data: { sessionId: string; newOwnerWindowId: number }) => void
>();

// Listen for MessagePort delivery from main process (matching testing app pattern)
ipcRenderer.on('terminal:port', (event, sessionId: string) => {
  const [port] = event.ports;
  if (!port) {
    console.warn(
      '[preload-dev-workspace] Received terminal:port event without a port',
    );
    return;
  }

  console.log(
    `[preload-dev-workspace] Received MessagePort for session ${sessionId}`,
  );

  // Store the port
  terminalPorts.set(sessionId, port);

  // Start the port to enable messaging
  port.start();

  // Route incoming data to subscribers
  port.onmessage = (e: MessageEvent) => {
    if (e.data?.type === 'DATA') {
      const subscribers = terminalSubscribers.get(sessionId);
      if (subscribers) {
        subscribers.forEach((cb) => cb(e.data.data));
      }
    } else if (e.data?.type === 'EXIT') {
      console.log(
        `[preload-dev-workspace] Terminal session ${sessionId} exited`,
      );
      terminalPorts.delete(sessionId);
      terminalSubscribers.delete(sessionId);
    }
  };

  // Check if there are already subscribers waiting for this port
  const existingSubscribers = terminalSubscribers.get(sessionId);
  if (existingSubscribers && existingSubscribers.size > 0) {
    console.log(
      `[preload-dev-workspace] Port ready, ${existingSubscribers.size} subscriber(s) waiting for session ${sessionId}`,
    );
  }
});

// Listen for ownership lost events from main process
ipcRenderer.on(
  'terminal:ownershipLost',
  (_event, data: { sessionId: string; newOwnerWindowId: number }) => {
    console.log(
      `[preload-dev-workspace] Ownership lost for session ${data.sessionId}, new owner: ${data.newOwnerWindowId}`,
    );
    ownershipLostSubscribers.forEach((cb) => cb(data));
  },
);

try {
  contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
      invoke: ipcRenderer.invoke.bind(ipcRenderer),
      on: (channel: string, handler: (...args: unknown[]) => void) => {
        const subscription = (
          _event: Electron.IpcRendererEvent,
          ...args: unknown[]
        ) => handler(...args);
        ipcRenderer.on(channel, subscription);
        return () => ipcRenderer.removeListener(channel, subscription);
      },
      send: ipcRenderer.send.bind(ipcRenderer),
    },

    // Terminal data subscription (abstracts MessagePort) - matches testing app
    onTerminalData: (
      sessionId: string,
      callback: (data: string) => void,
    ): (() => void) => {
      // Initialize subscriber set for this session if needed
      if (!terminalSubscribers.has(sessionId)) {
        terminalSubscribers.set(sessionId, new Set());
      }

      // Add the callback to subscribers
      terminalSubscribers.get(sessionId)!.add(callback);

      console.log(
        `[preload-dev-workspace] Subscribed to terminal data for session ${sessionId}`,
      );

      // Return unsubscribe function
      return () => {
        const subscribers = terminalSubscribers.get(sessionId);
        if (subscribers) {
          subscribers.delete(callback);
          console.log(
            `[preload-dev-workspace] Unsubscribed from terminal data for session ${sessionId}`,
          );

          // Clean up empty subscriber sets
          if (subscribers.size === 0) {
            terminalSubscribers.delete(sessionId);
          }
        }
      };
    },

    // Ownership lost subscription - matches testing app
    onOwnershipLost: (
      callback: (data: { sessionId: string; newOwnerWindowId: number }) => void,
    ): (() => void) => {
      ownershipLostSubscribers.add(callback);
      console.log(
        '[preload-dev-workspace] Subscribed to ownership lost events',
      );

      return () => {
        ownershipLostSubscribers.delete(callback);
        console.log(
          '[preload-dev-workspace] Unsubscribed from ownership lost events',
        );
      };
    },
  });
  console.info('[Preload-DevWorkspace] ✅ TIPC + Terminal APIs exposed');
} catch (error) {
  console.error(
    '[Preload-DevWorkspace] ❌ Failed to expose TIPC + Terminal APIs:',
    error,
  );
}

console.info(
  '[Preload-DevWorkspace] 🚀 Preload script executed successfully - minimal APIs exposed',
);
