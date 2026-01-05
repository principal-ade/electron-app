/**
 * FastForwardService - Renderer-side API for fast-forward pull operations
 *
 * Provides methods to interact with the FastForwardService in the main process.
 */

import type {
  PendingPull,
  PullResult,
  PullNowResponse,
  WebhookNotification,
} from '../../shared/main-process-api-interfaces/FastForwardAPI';

/**
 * FastForwardService - API for managing fast-forward pulls from renderer
 */
export const FastForwardService = {
  /**
   * Get all pending pull notifications from the mailbox
   */
  async getPendingPulls(): Promise<PendingPull[]> {
    return window.mainProcess.fastForward.getPendingPulls();
  },

  /**
   * Get pull history (successful and failed pulls)
   */
  async getPullHistory(): Promise<PullResult[]> {
    return window.mainProcess.fastForward.getPullHistory();
  },

  /**
   * Manually trigger a pull for a pending item
   */
  async pullNow(id: string): Promise<PullNowResponse> {
    return window.mainProcess.fastForward.pullNow(id);
  },

  /**
   * Dismiss a pending pull notification
   */
  async dismiss(id: string): Promise<boolean> {
    return window.mainProcess.fastForward.dismiss(id);
  },

  /**
   * Dismiss all pending pull notifications
   */
  async dismissAll(): Promise<boolean> {
    return window.mainProcess.fastForward.dismissAll();
  },

  /**
   * Get all webhook notifications (all event types)
   */
  async getWebhookNotifications(): Promise<WebhookNotification[]> {
    return window.mainProcess.fastForward.getWebhookNotifications();
  },

  /**
   * Dismiss a webhook notification
   */
  async dismissNotification(id: string): Promise<boolean> {
    return window.mainProcess.fastForward.dismissNotification(id);
  },

  /**
   * Mark a webhook notification as read
   */
  async markNotificationRead(id: string): Promise<boolean> {
    return window.mainProcess.fastForward.markNotificationRead(id);
  },

  /**
   * Subscribe to new pending pull notifications
   * Returns an unsubscribe function
   */
  onPendingPull(callback: (pull: PendingPull) => void): () => void {
    return window.mainProcess.fastForward.onPendingPull(callback);
  },

  /**
   * Subscribe to pull completion events
   * Returns an unsubscribe function
   */
  onPullComplete(callback: (result: PullResult) => void): () => void {
    return window.mainProcess.fastForward.onPullComplete(callback);
  },

  /**
   * Subscribe to pull failure events
   * Returns an unsubscribe function
   */
  onPullFailed(callback: (result: PullResult) => void): () => void {
    return window.mainProcess.fastForward.onPullFailed(callback);
  },

  /**
   * Subscribe to new webhook notifications (all event types)
   * Returns an unsubscribe function
   */
  onWebhookNotification(callback: (notification: WebhookNotification) => void): () => void {
    return window.mainProcess.fastForward.onWebhookNotification(callback);
  },
};
