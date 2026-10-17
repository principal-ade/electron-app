import { ipcRenderer } from 'electron';
import {
  BrowserEvent,
  type BrowserAPI,
  type OpenBrowserEnvelope,
} from '../../shared/main-process-api-interfaces/BrowserAPI';

export const browserAPI: BrowserAPI = {
  onOpenBrowser: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      envelope: OpenBrowserEnvelope,
    ) => callback(envelope);
    ipcRenderer.on(BrowserEvent.OPEN, handler);
    return () => ipcRenderer.removeListener(BrowserEvent.OPEN, handler);
  },
  acknowledgeOpen: (requestId, tabId) =>
    ipcRenderer.send(BrowserEvent.OPENED, { requestId, tabId }),
};
