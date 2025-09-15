import { ipcRenderer } from 'electron';
import { ClipboardAPIEvent } from '../../shared/main-process-api-interfaces/ClipboardAPI';
export const clipboardAPI = {
    writeText: async (text) => {
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
