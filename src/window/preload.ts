console.info('[Preload] Script starting...');

import { contextBridge, ipcRenderer } from 'electron';

console.info('[Preload] Electron imports successful');

import type { MainProcessAPI } from '../shared/main-process-api-interfaces/index';

console.info('[Preload] Type imports successful');

import { actRunnerAPI } from './main-process-api-implementations/actRunnerApi';
import { actWorkflowAPI } from './main-process-api-implementations/actWorkflowApi';
import { terminalAPI } from './main-process-api-implementations/terminalApi';
import { typeExtractionApi } from './main-process-api-implementations/typeExtractionApi';
import { typeSchemaApi } from './main-process-api-implementations/typeSchemaApi';
import { packageManagerApi } from './main-process-api-implementations/packageManagerApi';
import { agentConfigAPI } from './main-process-api-implementations/agentConfigApi';
import { agentSessionApi } from './main-process-api-implementations/agentSessionApi';
import { agentSessionSDKApi } from './main-process-api-implementations/agentSessionSDKApi';
import { agentInstallationAPI } from './main-process-api-implementations/agentInstallationApi';
import { agentSessionEventsAPI } from './main-process-api-implementations/agentSessionEventsApi';
import { authenticationAPI } from './main-process-api-implementations/authenticationApi';
import { clipboardAPI } from './main-process-api-implementations/clipboardApi';
import { fileSystemAPI } from './main-process-api-implementations/fileSystemApi';
import { gitAPI } from './main-process-api-implementations/gitApi';
import { githubAPI } from './main-process-api-implementations/githubApi';
import { storeAPI } from './main-process-api-implementations/storeApi';
import { alexandriaAPI } from './main-process-api-implementations/alexandriaApi';
import { alexandriaDocsAPI } from './main-process-api-implementations/alexandriaDocsApi';
import { workspaceApi } from './main-process-api-implementations/workspaceApi';
import { shellAPI } from './main-process-api-implementations/shellApi';
import { systemAPI } from './main-process-api-implementations/systemApi';
import { userPreferencesAPI } from './main-process-api-implementations/userPreferencesApi';
import { windowManagerAPI } from './main-process-api-implementations/windowManagerApi';
import { a24zAPI } from './main-process-api-implementations/a24zApi';
import { repositoryMonitoringAPI } from './main-process-api-implementations/repositoryMonitoringApi';
import { secretsAPI } from './main-process-api-implementations/secretsApi';
import { linksAPI } from './main-process-api-implementations/linksApi';
import { apiProxyApi } from './main-process-api-implementations/apiProxyApi';
import { appVersionManagerApi } from './main-process-api-implementations/appVersionManagerApi';
import { orbitAPI } from './main-process-api-implementations/orbitApi';
import { dockerAPI } from './main-process-api-implementations/dockerApi';
import { gitSyncAPI } from './main-process-api-implementations/gitSyncApi';
import { presenceAPI } from './main-process-api-implementations/presenceApi';
import { sshSetupAPI } from './main-process-api-implementations/sshSetupApi';
import { windowAPI } from './main-process-api-implementations/windowApi';
import { principalAPI } from './main-process-api-implementations/principalApi';
import { feedbackAPI } from './main-process-api-implementations/feedbackApi';
import { testDebugAPI } from './main-process-api-implementations/testDebugApi';
import { documentSearchAPI } from './main-process-api-implementations/documentSearchApi';
import { observabilityAPI } from './main-process-api-implementations/observabilityApi';
import { remoteAgentWindowAPI } from './main-process-api-implementations/remoteAgentWindowApi';
import { localhostDetectionAPI } from './main-process-api-implementations/localhostDetectionApi';
// Removed mermaid import - it uses 'debug' which isn't available in preload context
// import mermaid from 'mermaid';

// Define watch options type
export interface WatchOptions {
  directoryPath: string;
  fileTypes?: string[];
  currentFilePath?: string;
}

// Define file watch options type
export interface FileWatchOptions {
  filePath: string;
}

// Define file change event type
export interface FileChangeEvent {
  type: string;
  path: string;
  extension?: string;
  stats?: Record<string, unknown>;
  isCurrentFile?: boolean;
}

// Define markdown file options
export interface MarkdownFileOptions {
  depth?: number;
  loadChildren?: boolean;
}

// Wrap all exposures in try-catch for debugging
console.info('[Preload] Starting API exposure...');

// Expose the new mainProcess API
const mainProcessExposure: MainProcessAPI = {
  actRunner: actRunnerAPI,
  actWorkflow: actWorkflowAPI,
  agentInstallation: agentInstallationAPI,
  agentConfig: agentConfigAPI,
  alexandria: alexandriaAPI,
  alexandriaDocs: alexandriaDocsAPI,
  workspace: workspaceApi,
  agentSession: agentSessionApi,
  agentSessionSDK: agentSessionSDKApi,
  agentSessionEvents: agentSessionEventsAPI,
  appVersionManager: appVersionManagerApi,
  authentication: authenticationAPI,
  clipboard: clipboardAPI,
  github: githubAPI,
  git: gitAPI,
  fileSystem: fileSystemAPI,
  store: storeAPI,
  repositoryMonitoring: repositoryMonitoringAPI,
  secrets: secretsAPI,
  links: linksAPI,
  shell: shellAPI,
  system: systemAPI,
  terminal: terminalAPI,
  userPreferences: userPreferencesAPI,
  apiProxy: apiProxyApi,
  windowManager: windowManagerAPI,
  orbit: orbitAPI,
  a24z: a24zAPI,
  packageManager: packageManagerApi,
  typeExtraction: typeExtractionApi,
  typeSchema: typeSchemaApi,
  docker: dockerAPI,
  gitSync: gitSyncAPI,
  presence: presenceAPI,
  sshSetup: sshSetupAPI,
  window: windowAPI,
  principal: principalAPI,
  feedback: feedbackAPI,
  testDebug: testDebugAPI,
  documentSearch: documentSearchAPI,
  observability: observabilityAPI,
  remoteAgentWindow: remoteAgentWindowAPI,
  localhostDetection: localhostDetectionAPI,
};

// Mermaid removed from preload - will be loaded in renderer instead
// try {
//   contextBridge.exposeInMainWorld('mermaid', mermaid);
//   console.info('[Preload] ✅ Mermaid exposed');
// } catch (error) {
//   console.error('[Preload] ❌ Failed to expose mermaid:', error);
// }

try {
  contextBridge.exposeInMainWorld('mainProcess', mainProcessExposure);
  console.info('[Preload] ✅ MainProcess API exposed');
} catch (error) {
  console.error('[Preload] ❌ Failed to expose mainProcess API:', error);
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
  console.info('[Preload] ✅ Electron Titlebar API exposed');
} catch (error) {
  console.error('[Preload] ❌ Failed to expose titlebar API:', error);
}

// Expose window switcher and quick open API combined
interface WindowListData {
  windows: Array<{ id: number; title: string }>;
  selectedIndex: number;
}

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
  console.info('[Preload] ✅ Window Switcher & Quick Open API exposed');
} catch (error) {
  console.error('[Preload] ❌ Failed to expose API:', error);
}

try {
  contextBridge.exposeInMainWorld('appName', 'Principal ADE');
  console.info('[Preload] ✅ AppName exposed');
} catch (error) {
  console.error('[Preload] ❌ Failed to expose appName:', error);
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
    console.warn('[preload] Received terminal:port event without a port');
    return;
  }

  console.log(`[preload] Received MessagePort for session ${sessionId}`);

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
      console.log(`[preload] Terminal session ${sessionId} exited`);
      terminalPorts.delete(sessionId);
      terminalSubscribers.delete(sessionId);
    }
  };

  // Check if there are already subscribers waiting for this port
  const existingSubscribers = terminalSubscribers.get(sessionId);
  if (existingSubscribers && existingSubscribers.size > 0) {
    console.log(
      `[preload] Port ready, ${existingSubscribers.size} subscriber(s) waiting for session ${sessionId}`,
    );
  }
});

// Listen for ownership lost events from main process
ipcRenderer.on(
  'terminal:ownershipLost',
  (_event, data: { sessionId: string; newOwnerWindowId: number }) => {
    console.log(
      `[preload] Ownership lost for session ${data.sessionId}, new owner: ${data.newOwnerWindowId}`,
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
        `[preload] Subscribed to terminal data for session ${sessionId}`,
      );

      // Return unsubscribe function
      return () => {
        const subscribers = terminalSubscribers.get(sessionId);
        if (subscribers) {
          subscribers.delete(callback);
          console.log(
            `[preload] Unsubscribed from terminal data for session ${sessionId}`,
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
      console.log('[preload] Subscribed to ownership lost events');

      return () => {
        ownershipLostSubscribers.delete(callback);
        console.log('[preload] Unsubscribed from ownership lost events');
      };
    },
  });
  console.info('[Preload] ✅ TIPC + Terminal APIs exposed');
} catch (error) {
  console.error('[Preload] ❌ Failed to expose TIPC + Terminal APIs:', error);
}

// Enhanced debugging for preload issues
try {
  // Test if contextBridge is working
  const testObj = { test: 'working' };
  contextBridge.exposeInMainWorld('__preloadTest', testObj);

  console.info('[Preload] ✅ Context bridge is working');
  console.info('[Preload] ✅ Exposed APIs:', {
    mainProcess: Object.keys(mainProcessExposure),
    appName: 'Principal ADE',
  });
  console.info(
    '[Preload] 🚀 Preload script executed successfully - APIs exposed to renderer',
  );
} catch (error) {
  console.error('[Preload] ❌ Failed to expose APIs:', error);
  console.error('[Preload] Stack trace:', (error as Error).stack);
}
