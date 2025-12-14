import { ipcRenderer } from 'electron';
import {
  type RepositoryAPI,
  RepositoryAPIEvent,
} from '../../shared/main-process-api-interfaces/RepositoryAPI';
import type { Repository } from '../../shared/types/repository.types';

export const repositoryAPI: RepositoryAPI = {
  getRepositories: () => ipcRenderer.invoke('repository:get-all'),

  getRepository: (remoteUrl: string) =>
    ipcRenderer.invoke('repository:get', remoteUrl),

  addRepository: (params: {
    remoteUrl: string;
    owner: string;
    name: string;
    localPath?: string;
    description?: string;
    avatarUrl?: string;
  }) => ipcRenderer.invoke(RepositoryAPIEvent.ADD, params),

  updateRepository: (
    remoteUrl: string,
    updates: Partial<Omit<Repository, 'remoteUrl' | 'owner' | 'name'>>,
  ) => ipcRenderer.invoke(RepositoryAPIEvent.UPDATE, remoteUrl, updates),

  removeRepository: (remoteUrl: string) =>
    ipcRenderer.invoke(RepositoryAPIEvent.REMOVE, remoteUrl),

  // Local clone management
  addLocalClone: (remoteUrl: string, localPath: string) =>
    ipcRenderer.invoke(
      RepositoryAPIEvent.ADD_LOCAL_CLONE,
      remoteUrl,
      localPath,
    ),

  removeLocalClone: (remoteUrl: string, localPath: string) =>
    ipcRenderer.invoke(
      RepositoryAPIEvent.REMOVE_LOCAL_CLONE,
      remoteUrl,
      localPath,
    ),

  getRepositoryByLocalPath: (localPath: string) =>
    ipcRenderer.invoke(RepositoryAPIEvent.GET_BY_LOCAL_PATH, localPath),

  getLocalRepositories: () => ipcRenderer.invoke(RepositoryAPIEvent.GET_LOCAL),
};
