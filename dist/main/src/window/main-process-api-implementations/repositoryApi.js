import { ipcRenderer } from 'electron';
import { RepositoryAPIEvent } from '../../shared/main-process-api-interfaces/RepositoryAPI';
export const repositoryAPI = {
    getRepositories: () => ipcRenderer.invoke('repository:get-all'),
    getRepository: (remoteUrl) => ipcRenderer.invoke('repository:get', remoteUrl),
    addRepository: (params) => ipcRenderer.invoke(RepositoryAPIEvent.ADD, params),
    updateRepository: (remoteUrl, updates) => ipcRenderer.invoke(RepositoryAPIEvent.UPDATE, remoteUrl, updates),
    updateRepositoryAccess: (remoteUrl) => ipcRenderer.invoke(RepositoryAPIEvent.UPDATE_ACCESS, remoteUrl),
    removeRepository: (remoteUrl) => ipcRenderer.invoke(RepositoryAPIEvent.REMOVE, remoteUrl),
    getRecentRepositories: (limit) => ipcRenderer.invoke(RepositoryAPIEvent.GET_RECENT, limit),
    // Local clone management
    addLocalClone: (remoteUrl, localPath) => ipcRenderer.invoke(RepositoryAPIEvent.ADD_LOCAL_CLONE, remoteUrl, localPath),
    removeLocalClone: (remoteUrl, localPath) => ipcRenderer.invoke(RepositoryAPIEvent.REMOVE_LOCAL_CLONE, remoteUrl, localPath),
    updateLocalCloneAccess: (remoteUrl, localPath) => ipcRenderer.invoke(RepositoryAPIEvent.UPDATE_LOCAL_CLONE_ACCESS, remoteUrl, localPath),
    getRepositoryByLocalPath: (localPath) => ipcRenderer.invoke(RepositoryAPIEvent.GET_BY_LOCAL_PATH, localPath),
    getLocalRepositories: () => ipcRenderer.invoke(RepositoryAPIEvent.GET_LOCAL),
    refreshRepositoryMetadata: (remoteUrl) => ipcRenderer.invoke(RepositoryAPIEvent.REFRESH_METADATA, remoteUrl),
    // Avatar management
    setRepositoryAvatar: (remoteUrl, imageBase64) => ipcRenderer.invoke(RepositoryAPIEvent.SET_REPOSITORY_AVATAR, remoteUrl, imageBase64),
    setCloneAvatar: (remoteUrl, clonePath, imageBase64) => ipcRenderer.invoke(RepositoryAPIEvent.SET_CLONE_AVATAR, remoteUrl, clonePath, imageBase64),
    removeRepositoryAvatar: (remoteUrl) => ipcRenderer.invoke(RepositoryAPIEvent.REMOVE_REPOSITORY_AVATAR, remoteUrl),
    removeCloneAvatar: (remoteUrl, clonePath) => ipcRenderer.invoke(RepositoryAPIEvent.REMOVE_CLONE_AVATAR, remoteUrl, clonePath),
    getAvatarUrl: (avatarPath) => ipcRenderer.invoke(RepositoryAPIEvent.GET_AVATAR_URL, avatarPath),
    // GitHub search
    searchGitHubRepositories: (query, options) => ipcRenderer.invoke(RepositoryAPIEvent.SEARCH_GITHUB_REPOSITORIES, query, options),
};
