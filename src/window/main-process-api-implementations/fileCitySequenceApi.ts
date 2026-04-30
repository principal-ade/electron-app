import { ipcRenderer } from 'electron';
import {
  FileCitySequenceEvent,
  type FileCitySequenceAPI,
  type SequenceDiagramPayload,
} from '../../shared/main-process-api-interfaces/FileCitySequenceAPI';

export const fileCitySequenceAPI: FileCitySequenceAPI = {
  getCurrent: async (
    repositoryPath?: string,
  ): Promise<SequenceDiagramPayload | null> => {
    return ipcRenderer.invoke(
      FileCitySequenceEvent.GET_CURRENT,
      repositoryPath,
    );
  },

  onPayloadSet: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: SequenceDiagramPayload,
    ) => callback(payload);
    ipcRenderer.on(FileCitySequenceEvent.PAYLOAD_SET, handler);
    return () => {
      ipcRenderer.removeListener(FileCitySequenceEvent.PAYLOAD_SET, handler);
    };
  },

  onPayloadCleared: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      info: { repositoryPath?: string },
    ) => callback(info);
    ipcRenderer.on(FileCitySequenceEvent.PAYLOAD_CLEARED, handler);
    return () => {
      ipcRenderer.removeListener(
        FileCitySequenceEvent.PAYLOAD_CLEARED,
        handler,
      );
    };
  },
};
