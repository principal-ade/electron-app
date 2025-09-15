import { ipcRenderer } from 'electron';
import { type RepositoryAPI, RepositoryAPIEvent } from '../../shared/main-process-api-interfaces/RepositoryAPI';
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
    metadata?: Repository['metadata'];
  }) => ipcRenderer.invoke(RepositoryAPIEvent.ADD, params),
  
  updateRepository: (remoteUrl: string, updates: Partial<Omit<Repository, 'remoteUrl' | 'owner' | 'name'>>) => 
    ipcRenderer.invoke(RepositoryAPIEvent.UPDATE, remoteUrl, updates),
  
  updateRepositoryAccess: (remoteUrl: string) => 
    ipcRenderer.invoke(RepositoryAPIEvent.UPDATE_ACCESS, remoteUrl),
  
  removeRepository: (remoteUrl: string) => 
    ipcRenderer.invoke(RepositoryAPIEvent.REMOVE, remoteUrl),
  
  getRecentRepositories: (limit?: number) => 
    ipcRenderer.invoke(RepositoryAPIEvent.GET_RECENT, limit),
  
  // Local clone management
  addLocalClone: (remoteUrl: string, localPath: string) => 
    ipcRenderer.invoke(RepositoryAPIEvent.ADD_LOCAL_CLONE, remoteUrl, localPath),
  
  removeLocalClone: (remoteUrl: string, localPath: string) => 
    ipcRenderer.invoke(RepositoryAPIEvent.REMOVE_LOCAL_CLONE, remoteUrl, localPath),
  
  updateLocalCloneAccess: (remoteUrl: string, localPath: string) => 
    ipcRenderer.invoke(RepositoryAPIEvent.UPDATE_LOCAL_CLONE_ACCESS, remoteUrl, localPath),
  
  getRepositoryByLocalPath: (localPath: string) => 
    ipcRenderer.invoke(RepositoryAPIEvent.GET_BY_LOCAL_PATH, localPath),
  
  getLocalRepositories: () => 
    ipcRenderer.invoke(RepositoryAPIEvent.GET_LOCAL),
  
  refreshRepositoryMetadata: (remoteUrl: string) =>
    ipcRenderer.invoke(RepositoryAPIEvent.REFRESH_METADATA, remoteUrl),
  
  // Avatar management
  setRepositoryAvatar: (remoteUrl: string, imageBase64: string) =>
    ipcRenderer.invoke(RepositoryAPIEvent.SET_REPOSITORY_AVATAR, remoteUrl, imageBase64),
  
  setCloneAvatar: (remoteUrl: string, clonePath: string, imageBase64: string) =>
    ipcRenderer.invoke(RepositoryAPIEvent.SET_CLONE_AVATAR, remoteUrl, clonePath, imageBase64),
  
  removeRepositoryAvatar: (remoteUrl: string) =>
    ipcRenderer.invoke(RepositoryAPIEvent.REMOVE_REPOSITORY_AVATAR, remoteUrl),
  
  removeCloneAvatar: (remoteUrl: string, clonePath: string) =>
    ipcRenderer.invoke(RepositoryAPIEvent.REMOVE_CLONE_AVATAR, remoteUrl, clonePath),
  
  getAvatarUrl: (avatarPath: string) =>
    ipcRenderer.invoke(RepositoryAPIEvent.GET_AVATAR_URL, avatarPath),
  
  // GitHub search
  searchGitHubRepositories: (query: string, options?: { 
    sort?: 'stars' | 'forks' | 'updated'; 
    order?: 'asc' | 'desc';
    perPage?: number;
  }) => ipcRenderer.invoke(RepositoryAPIEvent.SEARCH_GITHUB_REPOSITORIES, query, options),
};