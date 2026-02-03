import { ipcRenderer } from 'electron';
import {
  FastForwardEvent,
  FastForwardAPI,
  PendingPull,
  PullResult,
  WebhookNotification,
  GetPendingPullsResponse,
  GetPullHistoryResponse,
  GetWebhookNotificationsResponse,
  DismissResponse,
} from '../../shared/main-process-api-interfaces/FastForwardAPI';

export const fastForwardAPI: FastForwardAPI = {
  getPendingPulls: async () => {
    const response: GetPendingPullsResponse = await ipcRenderer.invoke(
      FastForwardEvent.GET_PENDING_PULLS,
    );
    return response.pulls;
  },

  getPullHistory: async () => {
    const response: GetPullHistoryResponse = await ipcRenderer.invoke(
      FastForwardEvent.GET_PULL_HISTORY,
    );
    return response.history;
  },

  pullNow: (id: string) => ipcRenderer.invoke(FastForwardEvent.PULL_NOW, id),

  dismiss: async (id: string) => {
    const response: DismissResponse = await ipcRenderer.invoke(
      FastForwardEvent.DISMISS,
      id,
    );
    return response.success;
  },

  dismissAll: async () => {
    const response: DismissResponse = await ipcRenderer.invoke(
      FastForwardEvent.DISMISS_ALL,
    );
    return response.success;
  },

  // Webhook notification methods
  getWebhookNotifications: async () => {
    const response: GetWebhookNotificationsResponse = await ipcRenderer.invoke(
      FastForwardEvent.GET_WEBHOOK_NOTIFICATIONS,
    );
    return response.notifications;
  },

  dismissNotification: async (id: string) => {
    const response: DismissResponse = await ipcRenderer.invoke(
      FastForwardEvent.DISMISS_NOTIFICATION,
      id,
    );
    return response.success;
  },

  markNotificationRead: async (id: string) => {
    const response: DismissResponse = await ipcRenderer.invoke(
      FastForwardEvent.MARK_NOTIFICATION_READ,
      id,
    );
    return response.success;
  },

  onPendingPull: (callback: (pull: PendingPull) => void) => {
    const handler = (_event: unknown, pull: PendingPull) => callback(pull);
    ipcRenderer.on(FastForwardEvent.ON_PENDING_PULL, handler);
    return () =>
      ipcRenderer.removeListener(FastForwardEvent.ON_PENDING_PULL, handler);
  },

  onPullComplete: (callback: (result: PullResult) => void) => {
    const handler = (_event: unknown, result: PullResult) => callback(result);
    ipcRenderer.on(FastForwardEvent.ON_PULL_COMPLETE, handler);
    return () =>
      ipcRenderer.removeListener(FastForwardEvent.ON_PULL_COMPLETE, handler);
  },

  onPullFailed: (callback: (result: PullResult) => void) => {
    const handler = (_event: unknown, result: PullResult) => callback(result);
    ipcRenderer.on(FastForwardEvent.ON_PULL_FAILED, handler);
    return () =>
      ipcRenderer.removeListener(FastForwardEvent.ON_PULL_FAILED, handler);
  },

  onWebhookNotification: (callback: (notification: WebhookNotification) => void) => {
    const handler = (_event: unknown, notification: WebhookNotification) =>
      callback(notification);
    ipcRenderer.on(FastForwardEvent.ON_WEBHOOK_NOTIFICATION, handler);
    return () =>
      ipcRenderer.removeListener(
        FastForwardEvent.ON_WEBHOOK_NOTIFICATION,
        handler,
      );
  },
};
