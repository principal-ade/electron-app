import { ipcRenderer } from 'electron';
import {
  FileCitySequenceEvent,
  SequenceDiagramShareError,
  type FileCitySequenceAPI,
  type FileCitySequenceFetchSharedResult,
  type FileCitySequenceShareResult,
  type SequenceDiagramIndexEntry,
  type SequenceDiagramListSharedOptions,
  type SequenceDiagramListSharedResult,
  type SequenceDiagramPayload,
  type SequenceDiagramShareEnvelope,
  type SequenceDiagramShareOptions,
  type SequenceNote,
  type SequenceNoteDraft,
} from '../../shared/main-process-api-interfaces/FileCitySequenceAPI';

const unwrapShare = <T>(envelope: SequenceDiagramShareEnvelope<T>): T => {
  if (envelope.ok) return envelope.value;
  throw new SequenceDiagramShareError(
    envelope.code,
    envelope.message,
    envelope.details,
  );
};

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

  share: async (
    id: string,
    options?: SequenceDiagramShareOptions,
  ): Promise<FileCitySequenceShareResult> => {
    const envelope: SequenceDiagramShareEnvelope<FileCitySequenceShareResult> =
      await ipcRenderer.invoke(FileCitySequenceEvent.SHARE, id, options ?? null);
    return unwrapShare(envelope);
  },

  listShared: async (
    options?: SequenceDiagramListSharedOptions,
  ): Promise<SequenceDiagramListSharedResult> => {
    const envelope: SequenceDiagramShareEnvelope<SequenceDiagramListSharedResult> =
      await ipcRenderer.invoke(
        FileCitySequenceEvent.LIST_SHARED,
        options ?? null,
      );
    return unwrapShare(envelope);
  },

  fetchShared: async (
    owner: string,
    repo: string,
    id: string,
  ): Promise<FileCitySequenceFetchSharedResult> => {
    const envelope: SequenceDiagramShareEnvelope<FileCitySequenceFetchSharedResult> =
      await ipcRenderer.invoke(
        FileCitySequenceEvent.FETCH_SHARED,
        owner,
        repo,
        id,
      );
    return unwrapShare(envelope);
  },

  setTransient: async (payload: SequenceDiagramPayload): Promise<void> => {
    await ipcRenderer.invoke(FileCitySequenceEvent.SET_TRANSIENT, payload);
  },
};
