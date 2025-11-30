import { ipcRenderer } from 'electron';
import type {
  ExtensionAPI,
  DiscoveredExtension,
  LoadedExtension,
} from '../../shared/main-process-api-interfaces/ExtensionAPI';
import { ExtensionAPIEvents } from '../../shared/main-process-api-interfaces/ExtensionAPI';

export const extensionAPI: ExtensionAPI = {
  discoverExtensions: async (): Promise<DiscoveredExtension[]> => {
    return await ipcRenderer.invoke(ExtensionAPIEvents.DISCOVER_EXTENSIONS);
  },

  getExtensionsDirectory: async (): Promise<string> => {
    return await ipcRenderer.invoke(ExtensionAPIEvents.GET_EXTENSIONS_DIRECTORY);
  },

  loadExtension: async (packageName: string): Promise<LoadedExtension | null> => {
    return await ipcRenderer.invoke(ExtensionAPIEvents.LOAD_EXTENSION, packageName);
  },

  fetchExtensionBundle: async (packageName: string): Promise<string | null> => {
    return await ipcRenderer.invoke(ExtensionAPIEvents.FETCH_EXTENSION_BUNDLE, packageName);
  },

  enableExtension: async (packageName: string): Promise<void> => {
    return await ipcRenderer.invoke(ExtensionAPIEvents.ENABLE_EXTENSION, packageName);
  },

  disableExtension: async (packageName: string): Promise<void> => {
    return await ipcRenderer.invoke(ExtensionAPIEvents.DISABLE_EXTENSION, packageName);
  },

  uninstallExtension: async (packageName: string): Promise<void> => {
    return await ipcRenderer.invoke(ExtensionAPIEvents.UNINSTALL_EXTENSION, packageName);
  },

  onExtensionsChanged: (callback: (extensions: DiscoveredExtension[]) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, extensions: DiscoveredExtension[]) => {
      callback(extensions);
    };

    ipcRenderer.on(ExtensionAPIEvents.EXTENSIONS_CHANGED, handler);

    return () => {
      ipcRenderer.removeListener(ExtensionAPIEvents.EXTENSIONS_CHANGED, handler);
    };
  },
};
