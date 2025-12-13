import { ipcRenderer } from 'electron';
import { GitSyncAPI } from '../../shared/main-process-api-interfaces/GitSyncAPI';

export enum GitSyncEvent {
  CONNECT = 'git-sync:connect',
  DISCONNECT = 'git-sync:disconnect',
  GET_STATUS = 'git-sync:get-status',
  SEND_MESSAGE = 'git-sync:send-message',
  GET_ROOM_TOKEN = 'git-sync:get-room-token',
  GET_SERVER_URL = 'git-sync:get-server-url',
  CHECK_REPO_ACCESS = 'git-sync:check-repo-access',
  GET_ALL_CONNECTIONS = 'git-sync:get-all-connections',
  CHECK_SERVICE = 'git-sync:check-service',
  SET_ENVIRONMENT = 'git-sync:set-environment',
  GET_ENVIRONMENT = 'git-sync:get-environment',

  // Events (from main to renderer)
  ON_MESSAGE = 'git-sync:message',
  CONNECTION_ADDED = 'git-sync:connection-added',
  CONNECTION_REMOVED = 'git-sync:connection-removed',
  CONNECTION_STATUS_CHANGED = 'git-sync:connection-status-changed',
}

export const gitSyncAPI: GitSyncAPI = {
  connect: (config) => ipcRenderer.invoke(GitSyncEvent.CONNECT, config),

  disconnect: (connectionId) =>
    ipcRenderer.invoke(GitSyncEvent.DISCONNECT, connectionId),

  getStatus: (connectionId) =>
    ipcRenderer.invoke(GitSyncEvent.GET_STATUS, connectionId),

  sendMessage: (message) =>
    ipcRenderer.invoke(GitSyncEvent.SEND_MESSAGE, message),

  getRoomToken: (request) =>
    ipcRenderer.invoke(GitSyncEvent.GET_ROOM_TOKEN, request),

  getServerUrl: () => ipcRenderer.invoke(GitSyncEvent.GET_SERVER_URL),

  checkRepoAccess: (repoUrl, token) =>
    ipcRenderer.invoke(GitSyncEvent.CHECK_REPO_ACCESS, repoUrl, token),

  onMessage: (callback: (connectionKey: string, message: unknown) => void) => {
    const subscription = (
      _event: unknown,
      connectionKey: string,
      message: unknown,
    ) => callback(connectionKey, message);
    ipcRenderer.on(GitSyncEvent.ON_MESSAGE, subscription);
    return () =>
      ipcRenderer.removeListener(GitSyncEvent.ON_MESSAGE, subscription);
  },

  getAllConnections: () => ipcRenderer.invoke(GitSyncEvent.GET_ALL_CONNECTIONS),

  checkService: (url: string, serviceName: string) =>
    ipcRenderer.invoke(GitSyncEvent.CHECK_SERVICE, url, serviceName),

  setEnvironment: (environment: 'development' | 'production') =>
    ipcRenderer.invoke(GitSyncEvent.SET_ENVIRONMENT, environment),

  getEnvironment: () => ipcRenderer.invoke(GitSyncEvent.GET_ENVIRONMENT),

  onConnectionAdded: (callback: (connectionId: string) => void) => {
    const subscription = (_event: unknown, connectionId: string) =>
      callback(connectionId);
    ipcRenderer.on(GitSyncEvent.CONNECTION_ADDED, subscription);
    return () =>
      ipcRenderer.removeListener(GitSyncEvent.CONNECTION_ADDED, subscription);
  },

  onConnectionRemoved: (callback: (connectionId: string) => void) => {
    const subscription = (_event: unknown, connectionId: string) =>
      callback(connectionId);
    ipcRenderer.on(GitSyncEvent.CONNECTION_REMOVED, subscription);
    return () =>
      ipcRenderer.removeListener(GitSyncEvent.CONNECTION_REMOVED, subscription);
  },

  onConnectionStatusChanged: (callback: (connectionId: string) => void) => {
    const subscription = (_event: unknown, connectionId: string) =>
      callback(connectionId);
    ipcRenderer.on(GitSyncEvent.CONNECTION_STATUS_CHANGED, subscription);
    return () =>
      ipcRenderer.removeListener(
        GitSyncEvent.CONNECTION_STATUS_CHANGED,
        subscription,
      );
  },
};
