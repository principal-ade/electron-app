/**
 * Document Search API implementation for preload/renderer
 */

import { ipcRenderer } from 'electron';
import { DocumentSearchChannel } from '../../shared/ipc/DocumentSearchIPC';

import type {
  DocumentSearchAPI,
  InitializeSearchRequest,
  IndexRepositoryRequest,
  IndexRepositoryResponse,
  IndexMultipleRepositoriesResponse,
  SearchDocumentsRequest,
  SearchDocumentsResponse,
  GetIndexStatusResponse,
  GetDocumentRequest,
  GetDocumentResponse,
  IndexUpdateEvent,
  DocumentChangedEvent,
  IndexErrorEvent,
  RepositoryIndexStatus,
} from '../../shared/ipc/DocumentSearchIPC';

export const documentSearchAPI: DocumentSearchAPI = {
  // Commands
  initialize: async (options?: InitializeSearchRequest): Promise<void> => {
    await ipcRenderer.invoke(DocumentSearchChannel.INITIALIZE, options);
  },

  indexRepository: async (
    request: IndexRepositoryRequest,
  ): Promise<IndexRepositoryResponse> => {
    return await ipcRenderer.invoke(
      DocumentSearchChannel.INDEX_REPOSITORY,
      request,
    );
  },

  indexMultipleRepositories: async (
    repositories: Array<{ path: string; name?: string }>,
  ): Promise<IndexMultipleRepositoriesResponse> => {
    return await ipcRenderer.invoke(
      DocumentSearchChannel.INDEX_MULTIPLE,
      repositories,
    );
  },

  removeRepository: async (id: string): Promise<void> => {
    await ipcRenderer.invoke(DocumentSearchChannel.REMOVE_REPOSITORY, id);
  },

  search: async (
    request: SearchDocumentsRequest,
  ): Promise<SearchDocumentsResponse> => {
    return await ipcRenderer.invoke(DocumentSearchChannel.SEARCH, request);
  },

  getStatus: async (): Promise<GetIndexStatusResponse> => {
    return await ipcRenderer.invoke(DocumentSearchChannel.GET_STATUS);
  },

  getDocument: async (
    request: GetDocumentRequest,
  ): Promise<GetDocumentResponse> => {
    return await ipcRenderer.invoke(
      DocumentSearchChannel.GET_DOCUMENT,
      request,
    );
  },

  refreshIndex: async (repositoryId?: string): Promise<void> => {
    await ipcRenderer.invoke(DocumentSearchChannel.REFRESH_INDEX, repositoryId);
  },

  clearIndex: async (): Promise<void> => {
    await ipcRenderer.invoke(DocumentSearchChannel.CLEAR_INDEX);
  },

  // Event listeners
  onIndexUpdate: (
    callback: (event: IndexUpdateEvent) => void,
  ): (() => void) => {
    const handler = (_event: any, data: IndexUpdateEvent) => callback(data);
    ipcRenderer.on(DocumentSearchChannel.INDEX_UPDATE, handler);
    return () => {
      ipcRenderer.removeListener(DocumentSearchChannel.INDEX_UPDATE, handler);
    };
  },

  onDocumentChanged: (
    callback: (event: DocumentChangedEvent) => void,
  ): (() => void) => {
    const handler = (_event: any, data: DocumentChangedEvent) => callback(data);
    ipcRenderer.on(DocumentSearchChannel.DOCUMENT_CHANGED, handler);
    return () => {
      ipcRenderer.removeListener(
        DocumentSearchChannel.DOCUMENT_CHANGED,
        handler,
      );
    };
  },

  onIndexError: (callback: (event: IndexErrorEvent) => void): (() => void) => {
    const handler = (_event: any, data: IndexErrorEvent) => callback(data);
    ipcRenderer.on(DocumentSearchChannel.INDEX_ERROR, handler);
    return () => {
      ipcRenderer.removeListener(DocumentSearchChannel.INDEX_ERROR, handler);
    };
  },

  onSearchReady: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on(DocumentSearchChannel.SEARCH_READY, handler);
    return () => {
      ipcRenderer.removeListener(DocumentSearchChannel.SEARCH_READY, handler);
    };
  },

  onRepositoryIndexed: (
    callback: (repo: RepositoryIndexStatus) => void,
  ): (() => void) => {
    const handler = (_event: any, data: RepositoryIndexStatus) =>
      callback(data);
    ipcRenderer.on(DocumentSearchChannel.REPOSITORY_INDEXED, handler);
    return () => {
      ipcRenderer.removeListener(
        DocumentSearchChannel.REPOSITORY_INDEXED,
        handler,
      );
    };
  },
};
