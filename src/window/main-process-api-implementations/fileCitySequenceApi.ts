import { ipcRenderer } from 'electron';
import {
  FileCitySequenceEvent,
  type FileCitySequenceAPI,
  type SequenceDiagramIndexEntry,
  type SequenceDiagramPayload,
  type SequenceNote,
  type SequenceNoteDraft,
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

  list: async (
    repositoryPath?: string,
  ): Promise<{
    entries: SequenceDiagramIndexEntry[];
    activeId: string | null;
  }> => {
    return ipcRenderer.invoke(FileCitySequenceEvent.LIST, repositoryPath);
  },

  load: async (id: string): Promise<SequenceDiagramPayload | null> => {
    return ipcRenderer.invoke(FileCitySequenceEvent.LOAD, id);
  },

  activate: async (id: string): Promise<void> => {
    await ipcRenderer.invoke(FileCitySequenceEvent.ACTIVATE, id);
  },

  delete: async (id: string): Promise<void> => {
    await ipcRenderer.invoke(FileCitySequenceEvent.DELETE, id);
  },

  onLibraryChanged: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      info: { repositoryPath?: string },
    ) => callback(info);
    ipcRenderer.on(FileCitySequenceEvent.LIBRARY_CHANGED, handler);
    return () => {
      ipcRenderer.removeListener(
        FileCitySequenceEvent.LIBRARY_CHANGED,
        handler,
      );
    };
  },

  createNote: async (
    payloadId: string,
    draft: SequenceNoteDraft,
  ): Promise<SequenceNote> => {
    return ipcRenderer.invoke(
      FileCitySequenceEvent.NOTE_CREATE,
      payloadId,
      draft,
    );
  },

  updateNote: async (
    payloadId: string,
    noteId: string,
    body: string,
  ): Promise<SequenceNote> => {
    return ipcRenderer.invoke(
      FileCitySequenceEvent.NOTE_UPDATE,
      payloadId,
      noteId,
      body,
    );
  },

  deleteNote: async (payloadId: string, noteId: string): Promise<void> => {
    await ipcRenderer.invoke(
      FileCitySequenceEvent.NOTE_DELETE,
      payloadId,
      noteId,
    );
  },
};
