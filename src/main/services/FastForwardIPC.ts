/**
 * FastForwardIPC - IPC handlers for fast-forward pull operations
 *
 * Provides IPC endpoints for renderers to interact with the FastForwardService.
 */

import { ipcMain } from 'electron';
import {
  FastForwardEvent,
  GetPendingPullsResponse,
  GetPullHistoryResponse,
  GetWebhookNotificationsResponse,
  PullNowResponse,
  DismissResponse,
} from '../../shared/main-process-api-interfaces/FastForwardAPI';
import { fastForwardService } from './FastForwardService';

class FastForwardIPC {
  constructor() {
    this.setupHandlers();
    console.log('[FastForwardIPC] Initialized');
  }

  private setupHandlers(): void {
    // Get all pending pulls from the mailbox
    ipcMain.handle(
      FastForwardEvent.GET_PENDING_PULLS,
      async (): Promise<GetPendingPullsResponse> => {
        console.log('[FastForwardIPC] GET_PENDING_PULLS');
        const pulls = fastForwardService.getPendingPulls();
        return { pulls };
      },
    );

    // Get pull history
    ipcMain.handle(
      FastForwardEvent.GET_PULL_HISTORY,
      async (): Promise<GetPullHistoryResponse> => {
        console.log('[FastForwardIPC] GET_PULL_HISTORY');
        const history = fastForwardService.getPullHistory();
        return { history };
      },
    );

    // Manually trigger a pull for a pending item
    ipcMain.handle(
      FastForwardEvent.PULL_NOW,
      async (_event, id: string): Promise<PullNowResponse> => {
        console.log('[FastForwardIPC] PULL_NOW:', id);
        return await fastForwardService.pullNow(id);
      },
    );

    // Dismiss a pending pull notification
    ipcMain.handle(
      FastForwardEvent.DISMISS,
      async (_event, id: string): Promise<DismissResponse> => {
        console.log('[FastForwardIPC] DISMISS:', id);
        const success = fastForwardService.dismiss(id);
        return { success };
      },
    );

    // Dismiss all pending pulls
    ipcMain.handle(
      FastForwardEvent.DISMISS_ALL,
      async (): Promise<DismissResponse> => {
        console.log('[FastForwardIPC] DISMISS_ALL');
        fastForwardService.dismissAll();
        return { success: true };
      },
    );

    // Get all webhook notifications
    ipcMain.handle(
      FastForwardEvent.GET_WEBHOOK_NOTIFICATIONS,
      async (): Promise<GetWebhookNotificationsResponse> => {
        console.log('[FastForwardIPC] GET_WEBHOOK_NOTIFICATIONS');
        const notifications = fastForwardService.getWebhookNotifications();
        return { notifications };
      },
    );

    // Dismiss a webhook notification
    ipcMain.handle(
      FastForwardEvent.DISMISS_NOTIFICATION,
      async (_event, id: string): Promise<DismissResponse> => {
        console.log('[FastForwardIPC] DISMISS_NOTIFICATION:', id);
        const success = fastForwardService.dismissNotification(id);
        return { success };
      },
    );

    // Mark a webhook notification as read
    ipcMain.handle(
      FastForwardEvent.MARK_NOTIFICATION_READ,
      async (_event, id: string): Promise<DismissResponse> => {
        console.log('[FastForwardIPC] MARK_NOTIFICATION_READ:', id);
        const success = fastForwardService.markNotificationRead(id);
        return { success };
      },
    );
  }
}

// Create and export singleton instance
export const fastForwardIPC = new FastForwardIPC();
