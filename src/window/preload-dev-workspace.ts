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
import { localhostDetectionAPI } from './main-process-api-implementations/localhostDetectionApi';
import { otelCollectorApi } from './main-process-api-implementations/otelCollectorApi';

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
  localhostDetection: localhostDetectionAPI,
  otelCollector: otelCollectorApi,
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
// Port ready callbacks - for delivering MessagePort directly to components
const portReadyCallbacks = new Set<
  (data: { sessionId: string; writable: boolean }, port: MessagePort) => void
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

  // Store the port for writes
  terminalPorts.set(sessionId, port);

  // Start the port to enable messaging
  port.start();

  // Notify port ready callbacks (for direct MessagePort access)
  if (portReadyCallbacks.size > 0) {
    portReadyCallbacks.forEach((cb) => cb({ sessionId, writable: true }, port));
  }

  // Route incoming data to subscribers (fallback for components not using direct port)
  port.onmessage = (e: MessageEvent) => {
    if (e.data?.type === 'DATA') {
      const subscribers = terminalSubscribers.get(sessionId);
      if (subscribers) {
        subscribers.forEach((cb) => cb(e.data.data));
      }
    } else if (e.data?.type === 'EXIT') {
      terminalPorts.delete(sessionId);
      terminalSubscribers.delete(sessionId);
    }
  };
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

// ============================================
// OTEL Collector MessagePort Management
// ============================================

// OTEL collector port storage
const otelPorts = new Map<string, MessagePort>(); // key: windowId:sourceUrl
// Message subscribers - for receiving trace data
const otelMessageSubscribers = new Map<string, Set<(data: any) => void>>();

// Listen for MessagePort delivery from main process (same pattern as terminal)
ipcRenderer.on('otel-collector:port', (event, data: { windowId: string; sourceUrl: string }) => {
  console.log('[preload-dev-workspace] 📨 Received otel-collector:port event', data);

  const [port] = event.ports;
  if (!port) {
    console.warn('[preload-dev-workspace] ❌ Received otel-collector:port event without a port');
    return;
  }

  const key = `${data.windowId}:${data.sourceUrl}`;

  // Store the port
  otelPorts.set(key, port);

  // Start the port to enable messaging
  port.start();
  console.info(`[preload-dev-workspace] ✅ OTEL port started for ${key}`);

  // Set up message handler to route to subscribers
  port.onmessage = (e: MessageEvent) => {
    console.log(`[preload-dev-workspace] OTEL port message for ${key}:`, e.data?.type || e.data);
    const subscribers = otelMessageSubscribers.get(key);
    if (subscribers && subscribers.size > 0) {
      subscribers.forEach((cb) => cb(e.data));
    } else {
      console.warn(`[preload-dev-workspace] No subscribers for OTEL messages on ${key}`);
    }
  };

  console.info(`[preload-dev-workspace] ✅ OTEL port ready for ${key}`);
});

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

    // Fast terminal write using MessagePort (no IPC round-trip)
    writeToTerminalPort: (sessionId: string, data: string): boolean => {
      const port = terminalPorts.get(sessionId);
      if (port) {
        port.postMessage({ type: 'WRITE', data });
        return true;
      }
      return false;
    },

    // Check if MessagePort is available for a session
    hasTerminalPort: (sessionId: string): boolean => {
      return terminalPorts.has(sessionId);
    },

    // Subscribe to port ready events (for direct MessagePort access)
    onPortReady: (
      callback: (
        data: { sessionId: string; writable: boolean },
        port: MessagePort,
      ) => void,
    ): (() => void) => {
      portReadyCallbacks.add(callback);
      return () => {
        portReadyCallbacks.delete(callback);
      };
    },

    // Subscribe to OTEL messages (abstracts MessagePort)
    onOtelMessage: (
      windowId: string,
      sourceUrl: string,
      callback: (data: any) => void,
    ): (() => void) => {
      const key = `${windowId}:${sourceUrl}`;
      console.log(`[preload-dev-workspace] 📝 Subscribing to OTEL messages for ${key}`);

      // Initialize subscriber set for this key if needed
      if (!otelMessageSubscribers.has(key)) {
        otelMessageSubscribers.set(key, new Set());
      }

      // Add the callback to subscribers
      otelMessageSubscribers.get(key)!.add(callback);

      // Return unsubscribe function
      return () => {
        const subscribers = otelMessageSubscribers.get(key);
        if (subscribers) {
          subscribers.delete(callback);
          console.log(`[preload-dev-workspace] 🗑️ Unsubscribed from OTEL messages for ${key}`);

          // Clean up empty subscriber sets
          if (subscribers.size === 0) {
            otelMessageSubscribers.delete(key);
          }
        }
      };
    },

    // Send message to OTEL port
    sendOtelMessage: (windowId: string, sourceUrl: string, data: any): boolean => {
      const key = `${windowId}:${sourceUrl}`;
      const port = otelPorts.get(key);
      if (port) {
        try {
          port.postMessage(data);
          console.log(`[preload-dev-workspace] 📤 Sent message to OTEL port ${key}`);
          return true;
        } catch (err) {
          console.error(`[preload-dev-workspace] Error sending to OTEL port ${key}:`, err);
          return false;
        }
      }
      console.warn(`[preload-dev-workspace] No OTEL port found for ${key}`);
      return false;
    },

    // Helper to check if OTEL port is available
    hasOtelPort: (windowId: string, sourceUrl: string): boolean => {
      const key = `${windowId}:${sourceUrl}`;
      return otelPorts.has(key);
    },

    // Helper to remove OTEL port on cleanup
    removeOtelPort: (windowId: string, sourceUrl: string): void => {
      const key = `${windowId}:${sourceUrl}`;
      const port = otelPorts.get(key);
      if (port) {
        try {
          port.close();
        } catch (err) {
          console.warn(`[preload-dev-workspace] Error closing OTEL port ${key}:`, err);
        }
        otelPorts.delete(key);
        otelMessageSubscribers.delete(key);
        console.log(`[preload-dev-workspace] 🗑️ Removed OTEL port ${key}`);
      }
    },
  });
  console.info('[Preload-DevWorkspace] ✅ TIPC + Terminal + OTEL APIs exposed');
} catch (error) {
  console.error(
    '[Preload-DevWorkspace] ❌ Failed to expose TIPC + Terminal APIs:',
    error,
  );
}

console.info(
  '[Preload-DevWorkspace] 🚀 Preload script executed successfully - minimal APIs exposed',
);
