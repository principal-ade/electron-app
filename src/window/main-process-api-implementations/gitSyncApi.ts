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

  // Events (from main to renderer)
  ON_MESSAGE = 'git-sync:message',
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
};
