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

  disconnectFromPresence: () =>
    ipcRenderer.invoke(PresenceEvent.DISCONNECT),

  onPresenceEvent: (callback) => {
    const subscription = (_event: unknown, message: unknown) =>
      callback(message as import('../../shared/main-process-api-interfaces/PresenceAPI').PresenceEvent);
    ipcRenderer.on(PresenceEvent.ON_PRESENCE_EVENT, subscription);
    return () =>
      ipcRenderer.removeListener(PresenceEvent.ON_PRESENCE_EVENT, subscription);
  },
};
