import { ipcRenderer } from 'electron';
import {
  LinksAPI,
  LinksEvents,
  LinkStoreRequest,
  LinkOperationResult,
  LinkMetadata,
  RepositoryLink,
} from '../../shared/main-process-api-interfaces/LinksAPI';

export const linksAPI: LinksAPI = {
  store: (request: LinkStoreRequest): Promise<LinkOperationResult> => {
    return ipcRenderer.invoke(LinksEvents.STORE, request);
  },

  delete: (repoId: string): Promise<LinkOperationResult> => {
    return ipcRenderer.invoke(LinksEvents.DELETE, repoId);
  },

  exists: (repoId: string): Promise<boolean> => {
    return ipcRenderer.invoke(LinksEvents.EXISTS, repoId);
  },

  list: (): Promise<LinkMetadata[]> => {
    return ipcRenderer.invoke(LinksEvents.LIST);
  },

  get: (repoId: string): Promise<RepositoryLink[]> => {
    return ipcRenderer.invoke(LinksEvents.GET, repoId);
  },

  addLink: (
    repoId: string,
    link: Omit<RepositoryLink, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<LinkOperationResult> => {
    return ipcRenderer.invoke(LinksEvents.ADD_LINK, repoId, link);
  },

  updateLink: (
    repoId: string,
    linkId: string,
    updates: Partial<RepositoryLink>,
  ): Promise<LinkOperationResult> => {
    return ipcRenderer.invoke(LinksEvents.UPDATE_LINK, repoId, linkId, updates);
  },

  removeLink: (
    repoId: string,
    linkId: string,
  ): Promise<LinkOperationResult> => {
    return ipcRenderer.invoke(LinksEvents.REMOVE_LINK, repoId, linkId);
  },

  openLink: (url: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke(LinksEvents.OPEN_LINK, url);
  },

  copyLink: (url: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke(LinksEvents.COPY_LINK, url);
  },
};
