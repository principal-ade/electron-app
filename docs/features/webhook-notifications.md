# Webhook Notifications & Fast-Forward Pull

This document describes the webhook notification system that displays GitHub webhook events in the desktop app's titlebar mailbox, with automatic fast-forward pull functionality for push events.

## Overview

When the app receives webhook events from the traffic controller (via WebSocket), it:

1. **Stores all events as notifications** - Every webhook event (push, pull_request, issues, etc.) is stored in memory and displayed in the mailbox UI
2. **Auto-pulls when possible** - For push events, if the local repository is clean and can fast-forward, it automatically pulls
3. **Creates pending pull items** - If auto-pull isn't possible (dirty repo, local commits ahead, etc.), it creates a "pending pull" that the user can manually trigger

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Traffic Controller                           │
│                    (WebSocket Server)                               │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ webhook:github_event
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    GitSyncWebSocketManager                          │
│                    (Main Process)                                   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ handleWebhookEvent()
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FastForwardService                             │
│                    (Main Process)                                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                       PullMailbox                            │   │
│  │  - webhookNotifications: WebhookNotification[]               │   │
│  │  - pendingPulls: Map<string, PendingPull>                   │   │
│  │  - pullHistory: PullResult[]                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ IPC Events
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Renderer                                    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      PullMailbox UI                          │   │
│  │  - Titlebar button with badge                                │   │
│  │  - Dropdown showing notifications & pending pulls            │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Supported Webhook Events

The system handles all GitHub webhook events, with special handling for push events:

| Event | Icon | Description |
|-------|------|-------------|
| `push` | GitPullRequest | New commits pushed - triggers fast-forward check |
| `pull_request` | GitPullRequest | PR opened, closed, merged, etc. |
| `issues` | CircleDot | Issue opened, closed, commented |
| `create` | GitBranch | Branch or tag created |
| `delete` | GitBranch | Branch or tag deleted |
| `release` | Tag | Release published |
| `workflow_run` | Zap | GitHub Actions workflow |
| `check_run` | Zap | Check run completed |
| `installation` | Package | App installation changed |
| Other | Bell | Generic notification |

## Fast-Forward Pull Logic

When a `push` event is received:

```
1. Create notification for the push event
2. Find local repositories that match the webhook's repo/branch
3. For each matching repo:
   a. Check if working tree is dirty
      → If dirty: Create pending pull with reason "dirty"
   b. Fetch from remote
      → If fetch fails: Create pending pull with reason "fetch_failed"
   c. Check ahead/behind status
      → If ahead > 0: Create pending pull with reason "ahead"
      → If behind == 0: Already up to date, skip
   d. If behind > 0 and ahead == 0:
      → Auto-pull (fast-forward)
      → Add to pull history
      → Refresh repository monitoring
```

## Pending Pull Reasons

| Reason | Description | User Action |
|--------|-------------|-------------|
| `dirty` | Uncommitted changes in working tree | Commit or stash changes, then pull |
| `ahead` | Local commits ahead of remote | Merge or rebase required |
| `fetch_failed` | Failed to fetch from remote | Check network, try again |
| `different_branch` | Currently on a different branch | Switch branches if needed |
| `unknown` | Unknown error during pull | Check logs, try manual pull |

## Data Types

### WebhookNotification

```typescript
interface WebhookNotification {
  id: string;
  event: string;           // push, pull_request, issues, etc.
  repository: string;      // owner/repo
  branch?: string;
  timestamp: number;
  read: boolean;
  title: string;           // Human-readable title
  description?: string;    // Additional details
  url?: string;            // Link to GitHub
  actor?: string;          // Who triggered it
  pendingPullId?: string;  // Links to PendingPull if applicable
}
```

### PendingPull

```typescript
interface PendingPull {
  id: string;
  repoPath: string;        // Local filesystem path
  repoFullName: string;    // owner/repo
  branch: string;
  reason: PendingPullReason;
  reasonDetail?: string;
  commitsBehind?: number;
  webhookEvent: string;
  webhookDeliveryId: string;
  createdAt: number;
  pusher?: string;
  commitMessage?: string;
}
```

## IPC API

### Queries

| Event | Description | Response |
|-------|-------------|----------|
| `fast-forward:get-pending-pulls` | Get all pending pulls | `{ pulls: PendingPull[] }` |
| `fast-forward:get-pull-history` | Get pull history | `{ history: PullResult[] }` |
| `fast-forward:get-webhook-notifications` | Get all notifications | `{ notifications: WebhookNotification[] }` |

### Actions

| Event | Parameters | Description |
|-------|------------|-------------|
| `fast-forward:pull-now` | `id: string` | Manually trigger a pending pull |
| `fast-forward:dismiss` | `id: string` | Dismiss a pending pull |
| `fast-forward:dismiss-all` | - | Dismiss all pending pulls |
| `fast-forward:dismiss-notification` | `id: string` | Dismiss a notification |
| `fast-forward:mark-notification-read` | `id: string` | Mark notification as read |

### Events (Main → Renderer)

| Event | Payload | Description |
|-------|---------|-------------|
| `fast-forward:on-pending-pull` | `PendingPull` | New pending pull created |
| `fast-forward:on-pull-complete` | `PullResult` | Pull completed successfully |
| `fast-forward:on-pull-failed` | `PullResult` | Pull failed |
| `fast-forward:on-webhook-notification` | `WebhookNotification` | New webhook event received |

## Renderer API

```typescript
import { FastForwardService } from '../main-process-api/FastForwardService';

// Get data
const notifications = await FastForwardService.getWebhookNotifications();
const pendingPulls = await FastForwardService.getPendingPulls();
const history = await FastForwardService.getPullHistory();

// Actions
await FastForwardService.pullNow(pullId);
await FastForwardService.dismiss(pullId);
await FastForwardService.dismissAll();
await FastForwardService.dismissNotification(notificationId);
await FastForwardService.markNotificationRead(notificationId);

// Subscribe to events
const unsubscribe = FastForwardService.onWebhookNotification((notification) => {
  console.log('New webhook:', notification);
});

const unsubPending = FastForwardService.onPendingPull((pull) => {
  console.log('New pending pull:', pull);
});

// Cleanup
unsubscribe();
unsubPending();
```

## UI Component

The `PullMailbox` component in the titlebar provides:

- **Inbox button** with badge showing notification count
  - Orange badge when there are pending pulls requiring action
  - Primary color badge for unread notifications only
- **Dropdown** with two sections:
  - **Needs Action**: Pending pulls that require manual intervention
  - **Recent Events**: All webhook notifications
- **Actions per notification**:
  - Open on GitHub (external link)
  - Dismiss notification
- **Actions per pending pull**:
  - Pull Now button to manually trigger the pull

## Storage

All data is stored in memory only. Notifications and pending pulls do not persist across app restarts. Limits:

- Maximum 100 webhook notifications
- Maximum 50 pull history entries

## Files

| File | Purpose |
|------|---------|
| `src/shared/main-process-api-interfaces/FastForwardAPI.ts` | Type definitions |
| `src/main/services/FastForwardService.ts` | Core service logic |
| `src/main/services/FastForwardIPC.ts` | IPC handlers |
| `src/main/services/GitSyncWebSocketManager.ts` | Webhook event source |
| `src/window/main-process-api-implementations/fastForwardApi.ts` | Preload bridge |
| `src/renderer/main-process-api/FastForwardService.ts` | Renderer API |
| `src/renderer/principal-window/components/PullMailbox/PullMailbox.tsx` | UI component |
