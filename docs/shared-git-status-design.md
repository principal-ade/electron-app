# Shared Git Status Feature

## Overview

Enable users to see the git status of repositories that other users have open, displayed on the Activity Cities visualization.

## ✅ Implementation Complete

This feature has been fully implemented and deployed. This document has been updated to reflect the final implementation.

## Current State

### What Works Now

| Feature | Status | API |
|---------|--------|-----|
| Know who is online | ✅ | `PresenceService.getUsers()` → `user.status` |
| Which repos users have open | ✅ | `user.openRepositories[]` |
| Branch per repo | ✅ | `repoSession.branch` |
| Git status (shared) | ✅ | `repoSession.gitStatus` - **IMPLEMENTED** |
| Repos heartbeat (30s sync) | ✅ | `presence:repos_heartbeat` - **IMPLEMENTED** |
| Device indicator | ✅ | "This Device" badge - **IMPLEMENTED** |
| Auto status updates | ✅ | 1s debounced from file watcher - **IMPLEMENTED** |
| Dirty indicator on cities | ✅ | Amber badge + highlight layers - **IMPLEMENTED** |

### Data Flow (Implemented)

**Two parallel flows:**

#### 1. Event-based Git Status Updates (Real-time)
```
File System Change (detected by repository-monitoring-server)
      │
      ▼
GIT_STATUS_CHANGED event (debounced 1s)
      │
      ▼
sendGitStatusToPresence() → presence:repo_status_update
      │
      ▼
Traffic Controller updates RepositorySession.gitStatus
      │
      ▼
Broadcasts presence:repo_status_changed to subscribers
      │
      ▼
Activity Cities updates git status indicators
```

#### 2. Heartbeat-based Repository Sync (Every 30s)
```
Timer triggers every 30 seconds
      │
      ▼
getOpenRepositoryPaths() → only REPOSITORY/DEV_WORKSPACE windows
      │
      ▼
Gather git status for each open repo
      │
      ▼
sendReposHeartbeat(repos[]) → presence:repos_heartbeat
      │
      ▼
Traffic Controller syncs repository sessions (add/remove/update)
      │
      ▼
Broadcasts changes (repo_opened, repo_closed, repo_status_changed)
      │
      ▼
Activity Cities updates to match actual open repos
```

**Why both?**
- **Events**: Real-time updates when files change (responsive)
- **Heartbeat**: Self-healing sync that corrects any missed events (reliable)

## ✅ Implemented Features

### Achieved Goals

Show on each Activity City card:
- ✅ Whether the repo has uncommitted changes (amber "X dirty" badge)
- ✅ Per-user git status indicators (dot next to username if dirty)
- ✅ File-level highlighting (modified/staged/deleted files highlighted in city)
- ✅ "This Device" badge to distinguish local vs remote repos
- ✅ Aggregated dirty count across all users in a repo

### Data Model (Implemented)

The `RepositorySession` type in `@principal-ai/control-tower-core` now includes:

```typescript
interface RepositorySession {
  repoId: string;
  branch: string;
  openedAt: number;
  lastActivity: number;
  currentFile?: string;
  hasUnsavedChanges?: boolean;
  permissions: { canRead, canWrite, canAdmin };
  agentId: string;                 // ✅ Used for device identification
  clientType?: "desktop" | "web";
  gitStatus?: SharedGitStatus;     // ✅ ADDED - Full git status
}
```

### ✅ Implemented Type: `SharedGitStatus`

Defined in `@principal-ai/control-tower-core/src/types/presence.ts`:

```typescript
/**
 * Git status information that can be shared over the wire
 * Based on GitStatusWithFiles but excludes local-only fields
 */
export interface SharedGitStatus {
  /** Current branch name */
  branch: string;
  /** Has uncommitted changes (modified, staged, or untracked files) */
  isDirty: boolean;
  /** Has staged files ready to commit */
  hasStaged: boolean;
  /** Has untracked files */
  hasUntracked?: boolean;
  /** Commits ahead of remote tracking branch */
  ahead: number;
  /** Commits behind remote tracking branch */
  behind: number;
  /** Relative paths of modified files (working directory changes) */
  modifiedFiles: string[];
  /** Relative paths of staged files (ready to commit) */
  stagedFiles: string[];
  /** Relative paths of untracked files (new files not in git) */
  untrackedFiles: string[];
  /** Relative paths of deleted files */
  deletedFiles: string[];
  /** ISO timestamp of last detected change */
  lastChangedAt?: string;
}
```

**Conversion happens in `ipcHandlers.ts`:**

```typescript
function convertToSharedGitStatus(status: GitStatusWithFiles): SharedGitStatus {
  return {
    branch: status.branch,
    isDirty: status.isDirty,
    hasStaged: status.hasStaged,
    hasUntracked: status.hasUntracked,
    ahead: status.ahead,
    behind: status.behind,
    modifiedFiles: status.modifiedFiles,
    stagedFiles: status.stagedFiles,
    untrackedFiles: status.untrackedFiles,
    deletedFiles: status.deletedFiles,
    lastChangedAt: status.lastChangedAt,
  };
}
```

## ✅ Implementation Summary

### Update Strategy (Implemented)

- ✅ **Debounce:** 1 second after any file system change
- ✅ **Granularity:** Full file lists with paths (not just counts)
- ✅ **Privacy:** All status shared (no filtering)
- ✅ **Heartbeat:** 30 second sync of all open repos (self-healing)
- ✅ **Device Tracking:** Each session includes `agentId` for device identification

### Files Modified

#### control-tower-core (v0.4.5)

1. ✅ **`src/types/presence.ts`**
   - Added `SharedGitStatus` interface
   - Added `gitStatus` field to `RepositorySession`
   - Added `PresenceReposHeartbeatRequest/Response` types
   - Added `RepoHeartbeatEntry` type

2. ✅ **`src/server/ServerBuilder.ts`**
   - Updated room join/leave to use `client.deviceId` instead of `clientId`
   - Ensures `agentId` in sessions matches presence `deviceId`

#### repository-traffic-controller

1. ✅ **`lib/presence/RepositoryPresenceExtension.ts`**
   - Added `presence:repo_status_update` handler
   - Added `presence:repos_heartbeat` handler with sync logic
   - Broadcasts `presence:repo_status_changed` on updates

2. ✅ **`server-control-tower.ts`**
   - Calls `setClientDeviceId()` after authentication
   - Sets deviceId from JWT `agentId` field

#### electron-app

1. ✅ **`src/main/services/GitSyncWebSocketManager.ts`**
   - Added `reportRepositoryStatusUpdate()` method
   - Added `sendReposHeartbeat()` method

2. ✅ **`src/main/services/PresenceIPC.ts`**
   - Added IPC handler for `reportRepositoryStatus`
   - Added `getDeviceId()` IPC handler

3. ✅ **`src/main/repository-monitoring/ipcHandlers.ts`**
   - Added `sendGitStatusToPresence()` with 1s debounce
   - Wired `GIT_STATUS_CHANGED` event to auto-send status updates
   - Added `startReposHeartbeat()` with 30s interval
   - Added `getOpenRepositoryPaths()` to filter only open windows
   - Added `parseOwnerRepoFromUrl()` utility

4. ✅ **`src/renderer/main-process-api/PresenceService.ts`**
   - Added `reportRepositoryStatus()` wrapper
   - Added `getDeviceId()` wrapper

5. ✅ **`src/renderer/hooks/useActivityCities.ts`**
   - Consumes `gitStatus` from presence data
   - Aggregates git status by user in `gitStatus.byUser` map
   - Calculates `anyDirty` and `dirtyCount` across all users
   - Fetches current `deviceId` on mount
   - Passes `currentDeviceId` to repositories

6. ✅ **`src/renderer/components/ActivityCities/CityCard.tsx`**
   - Displays amber "X dirty" badge when `gitStatus.anyDirty`
   - Shows per-user dirty indicator (dot next to username)
   - Uses `mergeGitStatusHighlightLayers()` for file-level highlights
   - Shows "This Device" badge for repos from current device

7. ✅ **`src/renderer/utils/gitStatusHighlightLayers.ts`** (NEW)
   - Utility to merge git status from multiple users into highlight layers
   - Highlights modified/staged/deleted files in different colors

### WebSocket Messages (Implemented)

```typescript
// Client → Server: Update git status for a repo
'presence:repo_status_update': {
  owner: string;
  repo: string;
  gitStatus: SharedGitStatus;
}

// Server → Client: Response
PresenceRepoStatusUpdateResponse {
  success: boolean;
  message?: string;
}

// Server → Clients: Broadcast status change
'presence:repo_status_changed': {
  userId: string;
  repoId: string;
  deviceId: string;
  gitStatus: SharedGitStatus;
}

// Client → Server: Sync all open repos (heartbeat)
'presence:repos_heartbeat': {
  repos: RepoHeartbeatEntry[];  // Array of { repoId, branch, gitStatus? }
}

// Server → Client: Heartbeat response
PresenceReposHeartbeatResponse {
  success: boolean;
  repoCount: number;
  added: string[];     // Repos added
  removed: string[];   // Repos removed
  updated: string[];   // Repos with status changes
}
```

### Visual Indicators (Implemented)

| State | Visual | Location |
|-------|--------|----------|
| Any user has uncommitted changes | Amber badge "X dirty" | Top-right of city card |
| Specific user has changes | Amber dot next to username | User badge |
| Modified files | Orange highlight | Buildings in city visualization |
| Staged files | Green highlight | Buildings in city visualization |
| Deleted files | Red highlight | Buildings in city visualization |
| Repo from current device | Blue "This Device" badge | Next to repo name |
| No git changes (clean state) | File extension colors | Buildings in city visualization |

**File Extension Colors (Clean State)**

When there are no git changes for a file, buildings display colors based on their file extension/suffix. This follows the file-city color configuration system defined in `@principal-ai/file-city-builder/src/config/files.json`.

**Dimming Behavior:**
- When **no git changes** are present: File extension colors display at **full opacity** (100%)
- When **git changes exist**: File extension colors are **dimmed to 20% opacity** to help users focus on the git status indicators
- Git status indicators display at **full opacity** (100%) to maximize visibility and contrast

Examples of file extension colors:
- `.ts` → TypeScript blue (#007ACC)
- `.tsx` → TypeScript blue with React cyan border
- `.js` → JavaScript yellow (#f1e05a)
- `.jsx` → React cyan with JavaScript border
- `.json` → Yellow/orange (#ffd93d)
- `.py` → Python blue (#3572A5) with yellow border
- `.rs` → Rust orange (#dea584) with red border
- `.md` → Markdown blue (#083fa1)
- `.css` → Purple (#563d7c) with white border

The complete color palette is maintained in the file-city package and includes support for:
- Primary colors (fill)
- Secondary colors (borders, glows)
- Icons for special file types
- Compound extensions (e.g., `.test.ts`, `.stories.tsx`)
- Special filenames (e.g., `package.json`, `README.md`)

See `/Users/griever/Developer/web-ade/file-city/packages/builder/src/config/files.json` for the complete configuration.

## ✅ Architecture Diagram (As Implemented)

```
┌─────────────────────────────────────────────────────────────┐
│                     User A's Desktop                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │ File Watcher    │───►│ RepositoryMonitoringManager  │   │
│  │ (via RMS)       │    │ GIT_STATUS_CHANGED event     │   │
│  └─────────────────┘    └──────────────┬───────────────┘   │
│                                        │ (1s debounce)      │
│                                        ▼                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ sendGitStatusToPresence()                           │   │
│  │ ├─ parseOwnerRepoFromPath()                         │   │
│  │ ├─ convertToSharedGitStatus()                       │   │
│  │ └─ reportRepositoryStatusUpdate()                   │   │
│  └─────────────────────────────────────┬───────────────┘   │
│                                        │                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 30s Timer: startReposHeartbeat()                    │   │
│  │ ├─ getOpenRepositoryPaths() (only open windows)     │   │
│  │ ├─ Gather git status for each repo                  │   │
│  │ └─ sendReposHeartbeat(repos[])                      │   │
│  └─────────────────────────────────────┬───────────────┘   │
└────────────────────────────────────────┼────────────────────┘
                                         │
                    ┌────────────────────┴───────────────┐
                    │                                    │
                    ▼                                    ▼
    ┌──────────────────────────────┐   ┌──────────────────────────────┐
    │ presence:repo_status_update  │   │ presence:repos_heartbeat     │
    │ (real-time, on file changes) │   │ (every 30s, self-healing)    │
    └──────────────┬───────────────┘   └──────────────┬───────────────┘
                   │                                   │
                   └────────────┬──────────────────────┘
                                ▼
                ┌────────────────────────────────────────┐
                │      Traffic Controller                │
                │  RepositoryPresenceExtension           │
                │  ├─ Updates RepositorySession          │
                │  ├─ Syncs repos (add/remove/update)    │
                │  └─ Broadcasts to subscribers          │
                └────────────────┬───────────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
    presence:repo_status_changed    presence:repo_opened/closed
                 │                               │
┌────────────────┴───────────────────────────────┴───────────┐
│                     User B's Desktop                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │ useActivityCities hook                              │   │
│  │ ├─ Receives presence events via onPresenceEvent     │   │
│  │ ├─ Aggregates git status by user (byUser Map)       │   │
│  │ ├─ Calculates anyDirty + dirtyCount                 │   │
│  │ └─ Fetches current deviceId                         │   │
│  └─────────────────────────────────────┬───────────────┘   │
│                                        │                    │
│                                        ▼                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ CityCard Component                                  │   │
│  │ ├─ Amber "X dirty" badge (if anyDirty)              │   │
│  │ ├─ Per-user dirty dot (amber dot next to username)  │   │
│  │ ├─ "This Device" badge (if agentId matches)         │   │
│  │ └─ Highlight layers (modified/staged/deleted files) │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Key Files (Implemented)

### control-tower-core
| File | Purpose |
|------|---------|
| `src/types/presence.ts` | `SharedGitStatus`, heartbeat types, `RepositorySession` |
| `src/server/ServerBuilder.ts` | Room extension wiring with `deviceId` |

### repository-traffic-controller
| File | Purpose |
|------|---------|
| `lib/presence/RepositoryPresenceExtension.ts` | Handles `repo_status_update` and `repos_heartbeat` |
| `server-control-tower.ts` | Sets `deviceId` after authentication |

### electron-app
| File | Purpose |
|------|---------|
| `src/main/services/GitSyncWebSocketManager.ts` | WebSocket methods for status updates and heartbeat |
| `src/main/services/PresenceIPC.ts` | IPC handlers for presence and `getDeviceId()` |
| `src/main/repository-monitoring/ipcHandlers.ts` | Auto status updates (1s debounce) + heartbeat (30s) |
| `src/renderer/main-process-api/PresenceService.ts` | Service wrappers for all presence operations |
| `src/renderer/hooks/useActivityCities.ts` | Aggregates presence data with git status |
| `src/renderer/components/ActivityCities/CityCard.tsx` | Renders city with indicators |
| `src/renderer/utils/gitStatusHighlightLayers.ts` | Merges git status into highlight layers |

## Design Decisions (Final)

| Decision | Implementation |
|----------|----------------|
| Granularity | Full file lists with relative paths |
| Debounce | 1 second for file changes |
| Heartbeat | 30 seconds for full repo sync |
| Privacy | All status shared (no filtering) |
| Scope | Per-repo with branch tracking |
| Device Tracking | Each session tagged with `agentId` |
| Reliability | Dual system: events (fast) + heartbeat (reliable) |
| File Highlights | Yes - modified/staged/deleted files highlighted in city |

## Implementation Notes

### Key Learnings

1. **Heartbeat is Essential**
   - Event-driven updates alone can miss changes (app crashes, network issues)
   - 30s heartbeat provides self-healing sync
   - Heartbeat only sends repos with **actual windows open**, not all watched repos
   - Uses `applicationWindows` map to filter `REPOSITORY` and `DEV_WORKSPACE` types

2. **Device ID Tracking**
   - Server assigns `clientId` per connection, but we need persistent `deviceId`
   - Solution: Call `setClientDeviceId(clientId, deviceId)` after authentication
   - JWT contains `agentId` which becomes the `deviceId`
   - Room extensions (like `RepositoryPresenceExtension`) use `client.deviceId`

3. **Git Status Conversion**
   - Local git status (`GitStatusWithFiles`) contains `repoPath` and `watchingEnabled`
   - Wire format (`SharedGitStatus`) omits these local-only fields
   - Conversion happens in `ipcHandlers.ts` via `convertToSharedGitStatus()`

4. **Aggregation Strategy**
   - Each user can have multiple devices, each with different git status for same repo
   - `useActivityCities` aggregates by repo, creating `gitStatus.byUser` map
   - Calculates `anyDirty` and `dirtyCount` across all users
   - Per-user indicators show individual dirty status

5. **Highlight Layers**
   - File-level highlighting uses `ArchitectureMapHighlightLayers`
   - `mergeGitStatusHighlightLayers()` combines git status from multiple users
   - Modified files → orange, staged → green, deleted → red
   - Multiple users can have different file changes shown simultaneously

### Testing

Test script available at `scripts/test-git-status-presence.ts` for manual testing against the deployed traffic controller.

### OTEL Canvas Integration

Events for git status sharing have been added to:
- `docs/presence-tracking.otel.canvas` - Git status sharing events
- Should be added to telemetry instrumentation in future work

## ✅ Real-Time Repository Tracking (April 2026)

### Problem Identified

When opening a new repository window, the live activity view did not immediately show the new repository. Users had to navigate away from the view and come back, or wait for the 30-second heartbeat to sync.

### Root Causes Discovered

1. **Race Condition**: Desktop app called `reportRepositoryOpened()` before ensuring the client was in the `__global_presence__` room
   - `setTimeout(() => subscribeToPresence(), 100)` ran asynchronously
   - `reportRepositoryOpened()` might send `presence:repo_open` before room join completed
   - Server required client to be in room to process presence messages
   - Result: Request timed out waiting for response

2. **Missing Event Listeners**: Desktop app didn't listen for `presence:repo_opened` broadcasts
   - Server successfully handled test script requests and broadcasted events
   - But desktop app had no listener for `presence:repo_opened` events
   - BaseClient emits unrecognized message types as custom events
   - Result: Events received but ignored

3. **Wrong IPC Channel**: Events broadcasted on incorrect channel
   - Events sent via `GitSyncEvent.ON_MESSAGE`
   - But UI hooks listened on `'presence:event'` channel
   - Result: Renderer never received the events

### Solution Implemented (control-tower-core v0.6.2)

#### 1. Added Dedicated Presence Hooks

Extended `PresenceExtension` interface with repository lifecycle hooks:

```typescript
interface PresenceExtension {
  // Existing hooks...

  /**
   * Called when a user opens a repository
   */
  onRepoOpened?(
    userId: string,
    repoId: string,
    branch: string,
    deviceId: string,
  ): Promise<void> | void;

  /**
   * Called when a user closes a repository
   */
  onRepoClosed?(
    userId: string,
    repoId: string,
    deviceId: string,
  ): Promise<void> | void;
}
```

#### 2. Updated DefaultPresenceManager

Added handlers for `presence:repo_open` and `presence:repo_close` messages:

```typescript
case "presence:repo_open": {
  const { repoId, branch } = message.payload;

  // Call onRepoOpened hooks for all extensions
  for (const ext of this.extensions) {
    await ext.onRepoOpened?.(userId, repoId, branch, deviceId);
  }

  // Broadcast repo opened event
  if (this.config.broadcastPresenceUpdates && this.server) {
    await experimental?.broadcastAuthenticated({
      type: "presence:repo_opened",
      payload: {
        userId,
        repoId,
        branch,
        openedAt: Date.now(),
      },
    });
  }

  const response = { success: true };
  await sendResponse({ type: "presence:repo_open", payload: response });
  return true;
}
```

#### 3. Implemented Hooks in RepositoryPresenceExtension

```typescript
async onRepoOpened(userId: string, repoId: string, branch: string, deviceId: string): Promise<void> {
  const agentId = deviceId;
  const sessions = this.repoSessions.get(userId) || [];
  const existingSession = sessions.find(s => s.repoId === repoId && s.agentId === agentId);

  if (existingSession) {
    existingSession.lastActivity = Date.now();
    if (branch) {
      existingSession.branch = branch;
    }
    return;
  }

  const clientType = this.agentClientTypes.get(agentId);
  sessions.push({
    repoId,
    branch: branch || 'main',
    openedAt: Date.now(),
    lastActivity: Date.now(),
    permissions: { canRead: true, canWrite: true, canAdmin: false },
    agentId,
    clientType
  });
  this.repoSessions.set(userId, sessions);

  let repoUsers = this.repositoryUsers.get(repoId);
  if (!repoUsers) {
    repoUsers = new Set();
    this.repositoryUsers.set(repoId, repoUsers);
  }
  repoUsers.add(userId);
}
```

### Solution Implemented (Desktop App)

#### 1. Fixed Race Condition

Updated `reportRepositoryOpened()` to ensure room membership:

```typescript
async reportRepositoryOpened(owner: string, repo: string, branch: string): Promise<{ success: boolean; message?: string }> {
  try {
    const client = this.getAuthenticatedClient();
    if (!client) {
      return { success: false, message: 'No authenticated connection available' };
    }

    // Ensure we're in the global presence room before sending repo_open
    await this.subscribeToPresence();

    const repoId = `${owner}/${repo}`;
    const response = await client.request<PresenceActionResponse>(
      'presence:repo_open',
      { repoId, branch },
    );

    // ... handle response
  }
}
```

#### 2. Added Broadcast Event Listeners

Listen for server broadcasts and forward to renderer:

```typescript
// Listen for presence:repo_opened broadcasts from server
client.on('presence:repo_opened', async (data: unknown) => {
  const payload = data as PresenceRepoOpenedPayload;
  console.log('[GitSyncWebSocketManager] 📡 presence:repo_opened broadcast received:', payload);

  // Broadcast the event to renderer for real-time UI updates
  this.broadcastPresenceEvent({
    type: 'presence:repo_opened',
    payload,
  });

  // Also fetch and broadcast updated presence data
  try {
    const result = await this.fetchPresenceData();
    if (result.success && result.data) {
      this.broadcastToRenderers(GitSyncEvent.ON_MESSAGE, connectionId, {
        type: 'presence_updated',
        users: result.data.users,
        stats: result.data.stats,
      });
    }
  } catch (error) {
    console.error('[GitSyncWebSocketManager] Failed to refresh presence after repo_opened:', error);
  }
});
```

#### 3. Added Semantic Types

Created clear, self-documenting types for event payloads:

```typescript
/**
 * Payload for presence:repo_opened broadcast events
 */
interface PresenceRepoOpenedPayload extends Record<string, unknown> {
  userId: string;
  repoId: string;
  branch: string;
  openedAt: number;
}

/**
 * Payload for presence:repo_closed broadcast events
 */
interface PresenceRepoClosedPayload extends Record<string, unknown> {
  userId: string;
  repoId: string;
  closedAt: number;
}
```

### New Event Flow (Real-Time Repository Tracking)

```
User opens repository window
      │
      ▼
DevWorkspaceWindow.created
      │
      ▼
presenceWindowBridge.trackRepositoryOpened()
      │
      ▼
gitSyncWebSocketManager.reportRepositoryOpened()
      │
      ├─ await subscribeToPresence()  ← Ensures room membership
      │
      ├─ client.request('presence:repo_open')
      │       │
      │       ▼
      │   Traffic Controller receives message
      │       │
      │       ├─ Calls onRepoOpened hooks
      │       │
      │       ├─ Broadcasts presence:repo_opened to all clients
      │       │
      │       └─ Sends response { success: true }
      │
      └─ Receives response (no timeout!)

Traffic Controller broadcasts presence:repo_opened
      │
      ▼
All connected clients receive event
      │
      ├─ Main process: client.on('presence:repo_opened')
      │       │
      │       ├─ broadcastPresenceEvent() → IPC 'presence:event'
      │       │
      │       └─ fetchPresenceData() → broadcastToRenderers()
      │
      └─ Renderer: PresenceService.onPresenceEvent()
              │
              ▼
          useActivityCities hook receives event
              │
              ├─ Checks event.type === 'presence:repo_opened'
              │
              └─ Calls refresh() → Updates UI immediately!
```

### WebSocket Messages Added

```typescript
// Client → Server: Report repository opened
'presence:repo_open': {
  repoId: string;   // e.g., "principal-ai/repository-traffic-controller"
  branch: string;   // e.g., "main"
}

// Server → Client: Response
{
  success: boolean;
}

// Server → All Clients: Broadcast (via BaseClient event system)
'presence:repo_opened': {
  userId: string;
  repoId: string;
  branch: string;
  openedAt: number;  // Unix timestamp
}

// Client → Server: Report repository closed
'presence:repo_close': {
  repoId: string;
}

// Server → All Clients: Broadcast
'presence:repo_closed': {
  userId: string;
  repoId: string;
  closedAt: number;
}
```

### Files Modified

#### control-tower-core (v0.6.2)

1. ✅ **`src/abstractions/PresenceExtension.ts`**
   - Added `onRepoOpened()` and `onRepoClosed()` hooks

2. ✅ **`src/abstractions/DefaultPresenceManager.ts`**
   - Added `presence:repo_open` message handler
   - Added `presence:repo_close` message handler
   - Broadcasts `presence:repo_opened` and `presence:repo_closed` events

#### repository-traffic-controller (deployed)

1. ✅ **`lib/presence/RepositoryPresenceExtension.ts`**
   - Implemented `onRepoOpened()` hook
   - Implemented `onRepoClosed()` hook
   - Removed old `handleMessage` cases (now handled by DefaultPresenceManager)

#### electron-app

1. ✅ **`src/main/services/GitSyncWebSocketManager.ts`**
   - Fixed race condition: Added `await subscribeToPresence()` before sending requests
   - Added event listeners for `presence:repo_opened` and `presence:repo_closed`
   - Added semantic types: `PresenceRepoOpenedPayload`, `PresenceRepoClosedPayload`
   - Broadcasts events on correct IPC channel via `broadcastPresenceEvent()`

2. ✅ **`test-presence.cjs`**
   - Created test script to verify `presence:repo_open` functionality
   - Tests full flow: connect → authenticate → join room → send message
   - Uses JWT with room secret for authentication

### Testing

Manual testing verified:
- ✅ Opening a repository window immediately shows in live activity view
- ✅ No need to navigate away and come back
- ✅ Updates appear within milliseconds instead of waiting for 30s heartbeat
- ✅ Test script successfully validates server-side functionality
- ✅ Events properly flow from main process to renderer via IPC

### Result

**Before**: Users had to wait up to 30 seconds for heartbeat sync, or navigate away and back to see new repository windows.

**After**: Repository windows appear **instantly** in live activity view via real-time event broadcasts! 🎉
