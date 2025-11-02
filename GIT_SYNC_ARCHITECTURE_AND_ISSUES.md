# Git-Sync Architecture and Debugging Guide

**Date:** 2025-11-01
**Status:** Connection works but not showing in diagnostic panel
**Issue:** Panel shows "0 rooms" despite successful WebSocket authentication

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Connection Flow](#connection-flow)
3. [Current Behavior](#current-behavior)
4. [Expected Behavior](#expected-behavior)
5. [Suspected Issues](#suspected-issues)
6. [Fixes Attempted](#fixes-attempted)
7. [Files Involved](#files-involved)
8. [How to Debug](#how-to-debug)
9. [Questions for Review](#questions-for-review)

---

## Architecture Overview

Git-sync uses a **dual-process architecture** in Electron:

```
┌──────────────────────────────────────────────────────────────┐
│                    RENDERER PROCESS (UI)                      │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ GitSyncDiagnosticPanel.tsx                             │  │
│  │ - Displays connection status to user                   │  │
│  │ - Reads from: gitSyncConnectionManager.getActiveConnections() │
│  └────────────────────────────────────────────────────────┘  │
│                            ↓ reads from                       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ GitSyncConnectionManager.ts (Singleton)                │  │
│  │ - connections: Map<string, ConnectionInfo>             │  │
│  │ - Stores proxy clients for UI tracking                 │  │
│  │ - Key: "owner/repo:branch" (e.g., "a24z-ai/a24z:main") │  │
│  └────────────────────────────────────────────────────────┘  │
│                            ↓ IPC                              │
└──────────────────────────────────────────────────────────────┘
                             ↓
                      IPC Communication
                             ↓
┌──────────────────────────────────────────────────────────────┐
│                     MAIN PROCESS                              │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ GitSyncIPC.ts                                          │  │
│  │ - IPC handler: 'git-sync:connect'                      │  │
│  │ - Receives connection requests from renderer           │  │
│  └────────────────────────────────────────────────────────┘  │
│                            ↓ calls                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ GitSyncWebSocketManager.ts (Singleton)                 │  │
│  │ - connections: Map<string, ConnectionInfo>             │  │
│  │ - Creates ACTUAL WebSocket connections                 │  │
│  │ - Handles authentication with Control Tower Core       │  │
│  └────────────────────────────────────────────────────────┘  │
│                            ↓ WebSocket                        │
└──────────────────────────────────────────────────────────────┘
                             ↓
              ws://localhost:3001/ws (Traffic Controller)
                             ↓
                    Control Tower Core Server
```

### Key Points:

1. **Two Separate Maps:**
   - Renderer: `GitSyncConnectionManager.connections` (for UI)
   - Main: `GitSyncWebSocketManager.connections` (actual WebSockets)

2. **These must be kept in sync** for the panel to work correctly

3. **Communication Flow:**
   - UI reads from renderer Map
   - Renderer Map is populated when `getConnection()` succeeds
   - Renderer calls main process via IPC to create real WebSocket
   - Main process creates WebSocket and stores in its own Map

---

## Connection Flow

### Step-by-Step: What Should Happen

#### 1. User Opens Repository

**File:** `src/renderer/repo-manager/RepositoryWorkspace.tsx:502`

```typescript
const client = await gitSyncConnectionManager.getConnection(
  clonePath,
  branch,
  { owner: repository.owner, name: repository.name }
);
```

#### 2. GitSyncConnectionManager Checks Auth

**File:** `src/renderer/services/git-sync/GitSyncConnectionManager.ts:188`

```typescript
// Check authentication first
if (!this.isAuthenticated || !this.authToken || !this.authUser) {
  console.warn('GitSyncConnectionManager: Not authenticated');
  return null; // ← PROBLEM: Returns null if auth not ready
}
```

**ISSUE:** Auth is initialized asynchronously in constructor without `await`:

```typescript
private constructor() {
  super();
  this.initializeAuth();  // ← Async, not awaited!
  this.setupIPCMessageForwarding();
  this.subscribeToAuthChanges();
}

private async initializeAuth() {
  const cliAuthResult = await AuthenticationService.check(); // Takes time!
  // ...
}
```

**Race Condition:**
- Constructor is called
- `initializeAuth()` starts (async)
- RepositoryWorkspace waits 1 second
- RepositoryWorkspace calls `getConnection()`
- Auth might not be ready yet → returns `null`
- **Connection never created in renderer Map**

#### 3. Get GitHub Token from Secure Storage

**File:** `src/renderer/services/git-sync/GitSyncConnectionManager.ts:212`

```typescript
const tokenResult = await AuthenticationService.getGitHubAuth();
if (!tokenResult.authenticated || !tokenResult.token) {
  console.warn('No auth token available for git-sync connection');
  return null;
}
```

#### 4. Call Main Process to Create WebSocket

**File:** `src/renderer/services/git-sync/GitSyncConnectionManager.ts:231`

```typescript
const connectionResult = await GitSyncService.connect({
  repoId,    // "a24z-ai/a24z"
  repoPath,
  branch,    // "main"
  token: githubToken,
});
```

**IPC Call:** `git-sync:connect` → Main Process

#### 5. Main Process Creates WebSocket

**File:** `src/main/services/GitSyncIPC.ts`

```typescript
ipcMain.handle('git-sync:connect', async (_, config: GitSyncConfig) => {
  return await gitSyncWebSocketManager.connect(config);
});
```

**File:** `src/main/services/GitSyncWebSocketManager.ts:168`

```typescript
async connect(config: GitSyncConfig): Promise<ConnectionResult> {
  // Get JWT from landing-page
  const roomToken = await this.getRoomToken(config);

  // Create WebSocket
  const ws = new WebSocket('ws://localhost:3001/ws');

  // Store in main process Map
  this.connections.set(connectionId, connectionInfo);

  // Authenticate
  this.authenticate(connectionInfo, roomToken);
}
```

#### 6. Renderer Creates Proxy Client and Stores

**File:** `src/renderer/services/git-sync/GitSyncConnectionManager.ts:247`

```typescript
// Create a proxy client that communicates through IPC
const client = new GitSyncClient({
  serverUrl: '',
  githubToken: '',
  repoUrl: `github.com/${repoId}`,
  repoPath,
  branch,
  userId: this.authUser.githubHandle,
  agentId: deviceId,
  proxyMode: true, // ← Doesn't create real WebSocket
});

// Store connection info in renderer Map
const connectionInfo: ConnectionInfo = {
  repoId,
  repoPath,
  branch,
  client,
  status: {
    connected: true,
    authenticated: true,
    repoId,
    branch,
    activeLocks: [],
    queuedLocks: 0,
    peers: [],
  },
};

this.connections.set(connectionKey, connectionInfo); // ← Panel reads this!
this.emit('connection-added', connectionKey);
```

#### 7. Panel Reads Connections

**File:** `src/renderer/panels/components/GitSyncDiagnosticPanel.tsx:134`

```typescript
const loadRooms = useCallback(() => {
  const connections = gitSyncConnectionManager.getActiveConnections();
  const roomList = Array.from(connections.values()).map((conn) => ({
    repoId: conn.repoId,
    peerCount: conn.status.peers.length,
  }));
  setRooms(roomList);
}, [addEvent]);
```

---

## Current Behavior

### What We See in Logs:

```
✅ [GitSyncWebSocketManager] Requesting room token from auth server
✅ [GitSyncWebSocketManager] Connecting to: ws://localhost:3001/ws
✅ [GitSyncWebSocketManager] Connected: a24z-ai/a24z:main
✅ [GitSyncWebSocketManager] Sending JWT auth message for: a24z-ai/a24z:main
✅ [GitSyncWebSocketManager] Received message: auth_success
✅ [GitSyncWebSocketManager] Authenticated: a24z-ai/a24z:main
✅ [GitSyncWebSocketManager] Sending message: ping
✅ [GitSyncWebSocketManager] Received message: server_message (pong)
```

**Main process WebSocket is working perfectly!** ✅

### What We DON'T See:

```
❌ [GitSyncConnectionManager] Creating new connection for a24z-ai/a24z:main
❌ [GitSyncConnectionManager] Connection added to Map: a24z-ai/a24z:main
❌ [GitSyncConnectionManager] Total connections: 1
```

**Renderer Map is NOT being populated!** ❌

### Panel Shows:

```
Active Rooms: 0 rooms
```

---

## Expected Behavior

### Complete Log Sequence (What Should Happen):

```
1. [GitSyncConnectionManager] Initializing auth...
2. [GitSyncConnectionManager] Auth check result: { success: true, hasToken: true, hasUser: true }
3. [GitSyncConnectionManager] Auth initialized successfully for: SquallLeonhart13
4. [RepositoryWorkspace] Attempting to connect to git-sync...
5. [GitSyncConnectionManager] getConnection called
6. [GitSyncConnectionManager] Creating new connection for a24z-ai/a24z:main
7. [GitSyncService] IPC: git-sync:connect called
8. [GitSyncWebSocketManager] Requesting room token from auth server
9. [GitSyncWebSocketManager] Connected: a24z-ai/a24z:main
10. [GitSyncWebSocketManager] Authenticated: a24z-ai/a24z:main
11. [GitSyncConnectionManager] Connection added to Map: a24z-ai/a24z:main ← KEY!
12. [GitSyncConnectionManager] Total connections: 1
13. [GitSyncConnectionManager] Emitting: connection-added
```

### Panel Should Show:

```
Active Rooms: 1 room
  • a24z-ai/a24z (0 peers)
```

---

## Suspected Issues

### Issue #1: Auth Race Condition ⭐ PRIMARY SUSPECT

**Problem:**
```typescript
// GitSyncConnectionManager constructor
private constructor() {
  super();
  this.initializeAuth();  // ← Async, not awaited!
  // ...
}

private async initializeAuth() {
  const cliAuthResult = await AuthenticationService.check(); // Takes time!
  if (cliAuthResult.success && cliAuthResult.token && cliAuthResult.user) {
    this.authUser = { ... };
    this.isAuthenticated = true;
  }
}
```

**Timeline:**
1. `GitSyncConnectionManager.getInstance()` called (app startup)
2. Constructor runs, `initializeAuth()` starts
3. RepositoryWorkspace mounts (1 second later)
4. Calls `getConnection()`
5. Auth check fails: `!this.isAuthenticated` → returns `null`
6. Auth finishes initializing (too late!)

**Evidence:**
Only log we see is:
```
[GitSyncConnectionManager] Auth state changed:
```
(Empty object, suggesting auth completed but after getConnection was called)

### Issue #2: Silent Failure

When `getConnection()` returns `null` due to auth not ready:
```typescript
const client = await gitSyncConnectionManager.getConnection(...);

if (client) {
  console.log('Successfully connected');  // ← Never logged
}
```

The code **silently fails** - no error thrown, just returns `null`.

### Issue #3: Singleton Instance Timing

The singleton might be created too late:
```typescript
export const gitSyncConnectionManager = GitSyncConnectionManager.getInstance();
```

If this is imported before auth is ready, the race condition is guaranteed.

---

## Fixes Attempted

### Fix #1: Wait for Auth in getConnection()

**File:** `src/renderer/services/git-sync/GitSyncConnectionManager.ts:188`

**Change:**
```typescript
async getConnection(...): Promise<GitSyncClient | null> {
  // Check authentication first - if not authenticated yet, wait
  if (!this.isAuthenticated || !this.authToken || !this.authUser) {
    console.log('[GitSyncConnectionManager] Auth not ready, waiting...');

    // Wait up to 3 seconds for auth to initialize
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (this.isAuthenticated && this.authToken && this.authUser) {
        console.log('[GitSyncConnectionManager] Auth ready after waiting');
        break;
      }
    }

    // Check again after waiting
    if (!this.isAuthenticated || !this.authToken || !this.authUser) {
      console.warn('[GitSyncConnectionManager] Not authenticated after waiting');
      return null;
    }
  }
  // ...
}
```

**Status:** Applied but not yet tested

### Fix #2: Added Debug Logging

Added extensive logging to track:
- Auth initialization
- Connection creation
- Map operations
- Panel reads

**Example logs added:**
```typescript
console.log('[GitSyncConnectionManager] Connection added to Map:', connectionKey);
console.log('[GitSyncConnectionManager] Total connections:', this.connections.size);
console.log('[GitSyncConnectionManager] getActiveConnections called, size:', this.connections.size);
```

### Fix #3: Fixed server_message Wrapper

**File:** `src/main/services/GitSyncWebSocketManager.ts:286`

Control Tower Core wraps messages in `server_message` envelope:
```typescript
if (message.type === 'server_message' && message.payload) {
  console.log('[GitSyncWebSocketManager] Unwrapping server_message:', message.payload.type);
  this.handleMessage(connectionInfo, message.payload);
  return;
}
```

**Status:** Applied and working (pong messages now handled correctly)

---

## Files Involved

### Renderer Process

| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/renderer/services/git-sync/GitSyncConnectionManager.ts` | Manages UI-side connections | `getConnection()`, `getActiveConnections()` |
| `src/renderer/services/git-sync/GitSyncClient.ts` | Proxy client (no real WebSocket) | `connect()`, `handleMessage()` |
| `src/renderer/panels/components/GitSyncDiagnosticPanel.tsx` | Diagnostic UI panel | `loadRooms()`, displays connection status |
| `src/renderer/repo-manager/RepositoryWorkspace.tsx` | Initiates connections | Calls `getConnection()` on mount |
| `src/renderer/main-process-api/GitSyncService.ts` | IPC wrapper | `connect()`, `sendMessage()` |

### Main Process

| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/main/services/GitSyncIPC.ts` | IPC handlers | `git-sync:connect` handler |
| `src/main/services/GitSyncWebSocketManager.ts` | Actual WebSocket manager | `connect()`, `authenticate()`, handles WS |
| `src/main/services/JWTService.ts` | JWT creation (DEPRECATED) | No longer used for git-sync |

### Authentication

| File | Purpose |
|------|---------|
| `src/main/services/AuthService.ts` | Main process auth |
| `src/renderer/main-process-api/AuthenticationService.ts` | Renderer IPC wrapper |
| `src/main/services/UnifiedSecureStorage.ts` | OS keychain integration |

### External Services

| Service | URL | Purpose |
|---------|-----|---------|
| Landing Page | `http://localhost:3000` | Creates JWTs |
| Traffic Controller | `ws://localhost:3001/ws` | WebSocket server |
| GitHub API | `https://api.github.com` | Token validation |

---

## How to Debug

### Step 1: Restart App and Watch Logs

Look for this **exact sequence**:

```
✅ [GitSyncConnectionManager] Initializing auth...
✅ [GitSyncConnectionManager] Auth check result: { success: true, ... }
✅ [GitSyncConnectionManager] Auth initialized successfully for: SquallLeonhart13
✅ [RepositoryWorkspace] Attempting to connect to git-sync...
❓ [GitSyncConnectionManager] Auth not ready, waiting... (should NOT appear if auth is fast)
❓ [GitSyncConnectionManager] Auth ready after waiting (only if it had to wait)
✅ [GitSyncConnectionManager] Creating new connection for a24z-ai/a24z:main
✅ [GitSyncConnectionManager] Connection added to Map: a24z-ai/a24z:main
✅ [GitSyncConnectionManager] Total connections: 1
```

### Step 2: Open GitSync Diagnostic Panel

Click "Test Connection" button and watch for:

```
✅ [GitSyncConnectionManager] getActiveConnections called, size: 1
✅ [GitSyncConnectionManager] Connection keys: ['a24z-ai/a24z:main']
```

Panel should show:
```
Active Rooms: 1 room
```

### Step 3: If Still Shows 0 Rooms

**Possible scenarios:**

#### Scenario A: Auth Still Not Ready
```
❌ [GitSyncConnectionManager] Auth not ready, waiting...
❌ [GitSyncConnectionManager] Not authenticated after waiting
```
**Solution:** Auth is failing - check `AuthenticationService.check()`

#### Scenario B: getConnection Returns Null Silently
```
✅ [RepositoryWorkspace] Attempting to connect to git-sync...
❌ (no logs from getConnection)
❌ [RepositoryWorkspace] Failed to connect to git-sync: ...
```
**Solution:** Something is throwing before reaching connection logic

#### Scenario C: Connection Created but Map Empty
```
✅ [GitSyncConnectionManager] Creating new connection for a24z-ai/a24z:main
❌ (no "Connection added to Map" log)
```
**Solution:** Error between creation and Map.set()

#### Scenario D: Map Has Data but Panel Can't Read It
```
✅ [GitSyncConnectionManager] Connection added to Map: a24z-ai/a24z:main
✅ [GitSyncConnectionManager] Total connections: 1
✅ [GitSyncConnectionManager] getActiveConnections called, size: 0  ← WRONG!
```
**Solution:** Different singleton instances? Panel reading wrong instance?

---

## Questions for Review

### Architecture Questions

1. **Is the dual-Map architecture correct?**
   - Should we have separate Maps in renderer and main?
   - Or should renderer just query main process for connection status?

2. **Should GitSyncClient in proxy mode exist at all?**
   - It's just a shell for emitting events
   - Could we simplify by removing it entirely?

3. **Is the auth initialization pattern correct?**
   - Constructor calling async `initializeAuth()` without await
   - Should we use a different initialization pattern?

### Synchronization Questions

4. **How should the two Maps stay in sync?**
   - Should main process emit events when connections change?
   - Should renderer poll main process for status?

5. **What happens when WebSocket disconnects?**
   - Does renderer Map get updated?
   - Does panel show stale data?

### Timing Questions

6. **When should connections be created?**
   - On RepositoryWorkspace mount (current)?
   - On-demand when user clicks something?
   - Eagerly on app startup?

7. **How long should we wait for auth?**
   - Current: 3 seconds max
   - Is that enough/too much?

### Error Handling Questions

8. **Should `getConnection()` throw or return null?**
   - Current: Returns `null` silently
   - Should it throw an error for UI to catch?

9. **What should happen when connection fails?**
   - Current: Silent failure
   - Should we show error toast to user?

---

## Testing Checklist

- [ ] Restart app and verify auth initialization logs
- [ ] Verify connection creation logs appear
- [ ] Verify "Connection added to Map" log appears
- [ ] Verify panel shows 1 room
- [ ] Open multiple repositories, verify multiple rooms
- [ ] Close repository window, verify room is removed
- [ ] Disconnect from network, verify error handling
- [ ] Reconnect, verify recovery

---

## Additional Notes

### What's Working ✅

1. GitHub authentication via WorkOS
2. JWT creation via landing-page
3. WebSocket connection to traffic controller
4. Control Tower Core authentication (JWT validation)
5. Ping/pong heartbeat
6. Message unwrapping (server_message envelope)

### What's NOT Working ❌

1. Renderer Map not being populated
2. Panel showing 0 rooms despite successful connection
3. Possibly: Auth timing issue causing silent failures

### Recent Changes (2025-11-01)

1. Switched from localStorage to OS keychain for token storage
2. Updated auth message format: `{ type: 'authenticate', payload: { type: 'jwt', token: '...' } }`
3. Removed unnecessary "register" message after authentication
4. Added server_message unwrapping
5. Added auth waiting logic in getConnection()
6. Added extensive debug logging

---

## Contact / Next Steps

**For review, please check:**

1. Is the architecture sound?
2. Is the auth initialization pattern correct?
3. Why isn't the renderer Map being populated?
4. Should we simplify the architecture?

**To test the current state:**

1. Restart Electron app
2. Open a repository
3. Check console logs for the sequence in "How to Debug"
4. Share logs for analysis

**Log files to review:**
- Electron app console (renderer process)
- Electron app console (main process - toggle in DevTools)
- Traffic controller server logs
- Landing-page server logs
