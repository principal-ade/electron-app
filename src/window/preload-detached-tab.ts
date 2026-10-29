/**
 * Preload script for detached workspace-tab windows.
 *
 * Deliberately narrow: a detached window only needs to render a topic or
 * subsystem model, so it gets the transfer-window API, topic/alexandria
 * subscriptions, user preferences (theme/pins), TIPC invoke, and titlebar
 * controls. It must stay require()-free at runtime — these windows are
 * sandboxed, and a sandboxed preload cannot resolve external modules.
 */

console.info('[Preload-DetachedTab] Script starting...');

import { contextBridge, ipcRenderer } from 'electron';

import { windowAPI } from './main-process-api-implementations/windowApi';
import { topicAPI } from './main-process-api-implementations/topicApi';
import { alexandriaAPI } from './main-process-api-implementations/alexandriaApi';
import { userPreferencesAPI } from './main-process-api-implementations/userPreferencesApi';

import type { WindowAPI } from '../shared/main-process-api-interfaces/WindowAPI';
import type { TopicAPI } from '../shared/main-process-api-interfaces/TopicAPI';
import type { AlexandriaAPI } from '../shared/main-process-api-interfaces/AlexandriaAPI';
import type { UserPreferencesAPI } from '../shared/main-process-api-interfaces/UserPreferencesAPI';

interface DetachedTabMainProcessAPI {
  window: WindowAPI;
  topics: TopicAPI;
  alexandria: AlexandriaAPI;
  userPreferences: UserPreferencesAPI;
}

const mainProcessAPI: DetachedTabMainProcessAPI = {
  window: windowAPI,
  topics: topicAPI,
  alexandria: alexandriaAPI,
  userPreferences: userPreferencesAPI,
};

try {
  contextBridge.exposeInMainWorld('mainProcess', mainProcessAPI);
  console.info('[Preload-DetachedTab] ✅ mainProcess API exposed');
} catch (error) {
  console.error(
    '[Preload-DetachedTab] ❌ Failed to expose mainProcess API:',
    error,
  );
}

// TIPC clients (topics, subsystem models) invoke through this surface.
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
  });
  console.info('[Preload-DetachedTab] ✅ TIPC invoke surface exposed');
} catch (error) {
  console.error(
    '[Preload-DetachedTab] ❌ Failed to expose TIPC surface:',
    error,
  );
}

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
  console.info('[Preload-DetachedTab] ✅ Titlebar API exposed');
} catch (error) {
  console.error(
    '[Preload-DetachedTab] ❌ Failed to expose titlebar API:',
    error,
  );
}

try {
  contextBridge.exposeInMainWorld('appName', 'Principal ADE');
} catch (error) {
  console.error('[Preload-DetachedTab] ❌ Failed to expose appName:', error);
}

// Telemetry reads the version + resolved OTEL settings synchronously at startup.
try {
  const appVersion = ipcRenderer.sendSync('get-app-version');
  contextBridge.exposeInMainWorld('appVersion', appVersion);
} catch (error) {
  console.error('[Preload-DetachedTab] ❌ Failed to expose appVersion:', error);
  contextBridge.exposeInMainWorld('appVersion', 'unknown');
}

try {
  const readTelemetrySettings = (): { endpoint: string; enabled: boolean } =>
    ipcRenderer.sendSync('get-otel-endpoint');
  const telemetrySettings = readTelemetrySettings();
  contextBridge.exposeInMainWorld(
    'otelCollectorEndpoint',
    telemetrySettings.endpoint,
  );
  contextBridge.exposeInMainWorld(
    'telemetryExportEnabled',
    String(telemetrySettings.enabled),
  );
  contextBridge.exposeInMainWorld(
    'getTelemetrySettings',
    readTelemetrySettings,
  );
} catch (error) {
  console.error(
    '[Preload-DetachedTab] ❌ Failed to expose OTEL settings:',
    error,
  );
  contextBridge.exposeInMainWorld(
    'otelCollectorEndpoint',
    'http://localhost:4318',
  );
  contextBridge.exposeInMainWorld('telemetryExportEnabled', 'false');
}

console.info('[Preload-DetachedTab] 🚀 Preload script executed successfully');
