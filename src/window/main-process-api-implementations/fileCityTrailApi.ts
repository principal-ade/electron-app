import { ipcRenderer } from 'electron';
import {
  FileCityTrailEvent,
  TrailShareError,
  type FileCityTrailAPI,
  type FileCityTrailFetchSharedByIdResult,
  type FileCityTrailFetchSharedResult,
  type FileCityTrailShareResult,
  type TrailIndexEntry,
  type TrailListSharedOptions,
  type TrailListSharedResult,
  type TrailPayloadSetEnvelope,
  type TrailShareEnvelope,
  type TrailShareOptions,
  type TrailShowInPrincipalEnvelope,
} from '../../shared/main-process-api-interfaces/FileCityTrailAPI';
import type {
  TrailPayload,
  TrailNote,
  TrailNoteDraft,
} from '@industry-theme/file-city-panel';

const unwrapShare = <T>(envelope: TrailShareEnvelope<T>): T => {
  if (envelope.ok) return envelope.value;
  throw new TrailShareError(envelope.code, envelope.message, envelope.details);
};

export const fileCityTrailAPI: FileCityTrailAPI = {
  onPayloadSet: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      envelope: TrailPayloadSetEnvelope,
    ) => callback(envelope);
    ipcRenderer.on(FileCityTrailEvent.PAYLOAD_SET, handler);
    return () => {
      ipcRenderer.removeListener(FileCityTrailEvent.PAYLOAD_SET, handler);
    };
  },

  onPayloadCleared: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      envelope: { id: string; repositoryPath?: string },
    ) => callback(envelope);
    ipcRenderer.on(FileCityTrailEvent.PAYLOAD_CLEARED, handler);
    return () => {
      ipcRenderer.removeListener(FileCityTrailEvent.PAYLOAD_CLEARED, handler);
    };
  },

  list: async (
    repositoryPath?: string,
  ): Promise<{
    entries: TrailIndexEntry[];
  }> => {
    return ipcRenderer.invoke(FileCityTrailEvent.LIST, repositoryPath);
  },

  load: async (id: string): Promise<TrailPayload | null> => {
    return ipcRenderer.invoke(FileCityTrailEvent.LOAD, id);
  },

  getFilePath: async (id: string): Promise<string | null> => {
    return ipcRenderer.invoke(FileCityTrailEvent.FILE_PATH, id);
  },

  activate: async (
    id: string,
  ): Promise<{ payload: TrailPayload; repositoryPath?: string } | null> => {
    return ipcRenderer.invoke(FileCityTrailEvent.ACTIVATE, id);
  },

  delete: async (
    id: string,
  ): Promise<{
    found: boolean;
    repositoryPath?: string;
  }> => {
    return ipcRenderer.invoke(FileCityTrailEvent.DELETE, id);
  },

  onLibraryChanged: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      info: { repositoryPath?: string },
    ) => callback(info);
    ipcRenderer.on(FileCityTrailEvent.LIBRARY_CHANGED, handler);
    return () => {
      ipcRenderer.removeListener(FileCityTrailEvent.LIBRARY_CHANGED, handler);
    };
  },

  onShowInPrincipal: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      envelope: TrailShowInPrincipalEnvelope,
    ) => callback(envelope);
    ipcRenderer.on(FileCityTrailEvent.SHOW_IN_PRINCIPAL, handler);
    return () => {
      ipcRenderer.removeListener(
        FileCityTrailEvent.SHOW_IN_PRINCIPAL,
        handler,
      );
    };
  },

  createNote: async (
    payloadId: string,
    draft: TrailNoteDraft,
  ): Promise<TrailNote> => {
    return ipcRenderer.invoke(
      FileCityTrailEvent.NOTE_CREATE,
      payloadId,
      draft,
    );
  },

  updateNote: async (
    payloadId: string,
    noteId: string,
    body: string,
  ): Promise<TrailNote> => {
    return ipcRenderer.invoke(
      FileCityTrailEvent.NOTE_UPDATE,
      payloadId,
      noteId,
      body,
    );
  },

  deleteNote: async (payloadId: string, noteId: string): Promise<void> => {
    await ipcRenderer.invoke(FileCityTrailEvent.NOTE_DELETE, payloadId, noteId);
  },

  share: async (
    id: string,
    options?: TrailShareOptions,
  ): Promise<FileCityTrailShareResult> => {
    const envelope: TrailShareEnvelope<FileCityTrailShareResult> =
      await ipcRenderer.invoke(FileCityTrailEvent.SHARE, id, options ?? null);
    return unwrapShare(envelope);
  },

  listShared: async (
    options?: TrailListSharedOptions,
  ): Promise<TrailListSharedResult> => {
    const envelope: TrailShareEnvelope<TrailListSharedResult> =
      await ipcRenderer.invoke(
        FileCityTrailEvent.LIST_SHARED,
        options ?? null,
      );
    return unwrapShare(envelope);
  },

  fetchShared: async (
    owner: string,
    repo: string,
    id: string,
  ): Promise<FileCityTrailFetchSharedResult> => {
    const envelope: TrailShareEnvelope<FileCityTrailFetchSharedResult> =
      await ipcRenderer.invoke(
        FileCityTrailEvent.FETCH_SHARED,
        owner,
        repo,
        id,
      );
    return unwrapShare(envelope);
  },

  fetchSharedById: async (
    id: string,
  ): Promise<FileCityTrailFetchSharedByIdResult> => {
    const envelope: TrailShareEnvelope<FileCityTrailFetchSharedByIdResult> =
      await ipcRenderer.invoke(FileCityTrailEvent.FETCH_SHARED_BY_ID, id);
    return unwrapShare(envelope);
  },

  createSharedNote: async (
    id: string,
    draft: TrailNoteDraft,
  ): Promise<TrailNote> => {
    const envelope: TrailShareEnvelope<TrailNote> = await ipcRenderer.invoke(
      FileCityTrailEvent.SHARED_NOTE_CREATE,
      id,
      draft,
    );
    return unwrapShare(envelope);
  },

  setTransient: async (
    payload: TrailPayload,
    repositoryPath: string | undefined,
  ): Promise<void> => {
    await ipcRenderer.invoke(
      FileCityTrailEvent.SET_TRANSIENT,
      payload,
      repositoryPath,
    );
  },
};
