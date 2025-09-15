import { ipcRenderer } from 'electron';
import { ClipboardAPI, ClipboardAPIEvent } from '../../shared/main-process-api-interfaces/ClipboardAPI';

export const clipboardAPI: ClipboardAPI = {
  writeText: async (text: string) => {
    return ipcRenderer.invoke(ClipboardAPIEvent.WRITE_TEXT, text);
  },
  readText: async () => {
    return ipcRenderer.invoke(ClipboardAPIEvent.READ_TEXT);
  },
  isAvailable: async () => {
    return ipcRenderer.invoke(ClipboardAPIEvent.IS_AVAILABLE);
  },
  removeFullscreenChangedListener: () => {
    // This method is implemented in windowManagerAPI
  },
};
