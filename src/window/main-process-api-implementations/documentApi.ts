import { ipcRenderer } from 'electron';
import {
  DocumentEvent,
  type DocumentAPI,
  type OpenDocumentEnvelope,
} from '../../shared/main-process-api-interfaces/DocumentAPI';

export const documentAPI: DocumentAPI = {
  onOpenDocument: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      envelope: OpenDocumentEnvelope,
    ) => callback(envelope);
    ipcRenderer.on(DocumentEvent.OPEN_DOCUMENT, handler);
    return () => {
      ipcRenderer.removeListener(DocumentEvent.OPEN_DOCUMENT, handler);
    };
  },
};
