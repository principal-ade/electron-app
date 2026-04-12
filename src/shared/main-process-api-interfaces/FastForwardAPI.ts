/**
 * FastForward API Types
 *
 * Types for webhook notifications and the fast-forward pull feature.
 * - All webhook events are stored and displayed in the mailbox
 * - Push events also trigger fast-forward checks for local repos
 */

/**
 * IPC event names for webhook mailbox operations
 */
export const FastForwardEvent = {
  // Queries
  GET_PENDING_PULLS: 'fast-forward:get-pending-pulls',
  GET_PULL_HISTORY: 'fast-forward:get-pull-history',
  GET_WEBHOOK_NOTIFICATIONS: 'fast-forward:get-webhook-notifications',

  // Actions
  PULL_NOW: 'fast-forward:pull-now',
  DISMISS: 'fast-forward:dismiss',
  DISMISS_ALL: 'fast-forward:dismiss-all',
  DISMISS_NOTIFICATION: 'fast-forward:dismiss-notification',
  MARK_NOTIFICATION_READ: 'fast-forward:mark-notification-read',

  // Events (main → renderer)
  ON_PENDING_PULL: 'fast-forward:on-pending-pull',
  ON_PULL_COMPLETE: 'fast-forward:on-pull-complete',
  ON_PULL_FAILED: 'fast-forward:on-pull-failed',
  ON_WEBHOOK_NOTIFICATION: 'fast-forward:on-webhook-notification',
} as const;

/**
 * Reason why a pull is pending (not auto-pulled)
 */
export type PendingPullReason =
  | 'dirty' // Uncommitted changes in working tree
  | 'ahead' // Local commits ahead of remote (would need merge/rebase)
  | 'different_branch' // Currently on a different branch
  | 'fetch_failed' // Failed to fetch from remote
  | 'unknown'; // Unknown reason

/**
 * A pending pull notification stored in the mailbox
 */
export interface PendingPull {
  id: string;
  repoPath: string;
  repoFullName: string; // e.g., "owner/repo"
  branch: string;
  reason: PendingPullReason;
  reasonDetail?: string; // Human-readable detail
  commitsBehind?: number;
  webhookEvent: string; // e.g., "push"
  webhookDeliveryId: string;
  createdAt: number;
  // Webhook payload info
  pusher?: string;
  commitMessage?: string;
}

/**
 * Result of a completed pull operation
 */
export interface PullResult {
  id: string;
  repoPath: string;
  repoFullName: string;
  branch: string;
  success: boolean;
  message: string;
  commitsBehind?: number;
  completedAt: number;
  // If failed
  error?: string;
  // If auto-pulled
  wasAutomatic: boolean;
}

/**
 * Response from getPendingPulls
 */
export interface GetPendingPullsResponse {
  pulls: PendingPull[];
}

/**
 * Response from getPullHistory
 */
export interface GetPullHistoryResponse {
  history: PullResult[];
}

/**
 * Response from pullNow
 */
export interface PullNowResponse {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Response from dismiss
 */
export interface DismissResponse {
  success: boolean;
}

/**
 * A webhook notification (any event type)
 */
export interface WebhookNotification {
  id: string;
  event: string; // push, pull_request, issues, installation, etc.
  repository: string; // owner/repo
  branch?: string;
  timestamp: number;
  read: boolean;
  // Event-specific data
  title: string; // Human-readable title
  description?: string; // Additional details
  url?: string; // Link to GitHub
  actor?: string; // Who triggered it
  // For push events that have pending pulls
  pendingPullId?: string;
  // For skill update notifications
  type?: string; // Type of notification (e.g., 'skill_update')
  skillName?: string; // Name of skill (for skill_update notifications)
  message?: string; // Custom message
}

/**
 * Response from getWebhookNotifications
 */
export interface GetWebhookNotificationsResponse {
  notifications: WebhookNotification[];
}

/**
 * FastForward API interface for preload bridge
 */
export interface FastForwardAPI {
  // Pending pulls (for push events that couldn't auto-pull)
  getPendingPulls: () => Promise<PendingPull[]>;
  getPullHistory: () => Promise<PullResult[]>;
  pullNow: (id: string) => Promise<PullNowResponse>;
  dismiss: (id: string) => Promise<boolean>;
  dismissAll: () => Promise<boolean>;

  // Webhook notifications (all event types)
  getWebhookNotifications: () => Promise<WebhookNotification[]>;
  dismissNotification: (id: string) => Promise<boolean>;
  markNotificationRead: (id: string) => Promise<boolean>;

  // Events
  onPendingPull: (callback: (pull: PendingPull) => void) => () => void;
  onPullComplete: (callback: (result: PullResult) => void) => () => void;
  onPullFailed: (callback: (result: PullResult) => void) => () => void;
  onWebhookNotification: (
    callback: (notification: WebhookNotification) => void,
  ) => () => void;
}
