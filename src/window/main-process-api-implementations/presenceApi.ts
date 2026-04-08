import { ipcRenderer } from 'electron';
import { PresenceAPI } from '../../shared/main-process-api-interfaces/PresenceAPI';

export enum PresenceEvent {
  GET_USERS = 'presence:get-users',
  GET_USERS_IN_REPO = 'presence:get-users-in-repo',
  GET_USER = 'presence:get-user',
  SUBSCRIBE = 'presence:subscribe',
  UNSUBSCRIBE = 'presence:unsubscribe',
  CONNECT = 'presence:connect',
  DISCONNECT = 'presence:disconnect',

  // Write operations
  REPORT_REPO_OPENED = 'presence:report-repo-opened',
  REPORT_REPO_CLOSED = 'presence:report-repo-closed',
  REPORT_ACTIVE_REPO = 'presence:report-active-repo',
  REPORT_REPO_STATUS = 'presence:report-repo-status',
  UPDATE_STATUS = 'presence:update-status',
  SET_VISIBILITY = 'presence:set-visibility',
  SEND_HEARTBEAT = 'presence:send-heartbeat',

  // Events (from main to renderer)
  ON_PRESENCE_EVENT = 'presence:event',
}

export const presenceAPI: PresenceAPI = {
  getUsers: () => ipcRenderer.invoke(PresenceEvent.GET_USERS),

  getUsersInRepository: (owner, repo) =>
    ipcRenderer.invoke(PresenceEvent.GET_USERS_IN_REPO, owner, repo),

  getUser: (userId) => ipcRenderer.invoke(PresenceEvent.GET_USER, userId),

  subscribeToPresence: () => ipcRenderer.invoke(PresenceEvent.SUBSCRIBE),

  unsubscribeFromPresence: () => ipcRenderer.invoke(PresenceEvent.UNSUBSCRIBE),

  connectToPresence: (token: string) =>
    ipcRenderer.invoke(PresenceEvent.CONNECT, token),

  disconnectFromPresence: () => ipcRenderer.invoke(PresenceEvent.DISCONNECT),

  onPresenceEvent: (callback) => {
    const subscription = (_event: unknown, message: unknown) =>
      callback(
        message as import('../../shared/main-process-api-interfaces/PresenceAPI').PresenceEvent,
      );
    ipcRenderer.on(PresenceEvent.ON_PRESENCE_EVENT, subscription);
    return () =>
      ipcRenderer.removeListener(PresenceEvent.ON_PRESENCE_EVENT, subscription);
  },

  reportRepositoryOpened: (owner, repo, branch, localPath) =>
    ipcRenderer.invoke(
      PresenceEvent.REPORT_REPO_OPENED,
      owner,
      repo,
      branch,
      localPath,
    ),

  reportRepositoryClosed: (owner, repo) =>
    ipcRenderer.invoke(PresenceEvent.REPORT_REPO_CLOSED, owner, repo),

  reportActiveRepository: (owner, repo) =>
    ipcRenderer.invoke(PresenceEvent.REPORT_ACTIVE_REPO, owner, repo),

  reportRepositoryStatus: (owner, repo, gitStatus) =>
    ipcRenderer.invoke(PresenceEvent.REPORT_REPO_STATUS, owner, repo, gitStatus),

  updateStatus: (status, message) =>
    ipcRenderer.invoke(PresenceEvent.UPDATE_STATUS, status, message),

  setVisibility: (visible) =>
    ipcRenderer.invoke(PresenceEvent.SET_VISIBILITY, visible),

  sendHeartbeat: () => ipcRenderer.invoke(PresenceEvent.SEND_HEARTBEAT),

  getDeviceId: () => ipcRenderer.invoke('presence:get-device-id'),
};
