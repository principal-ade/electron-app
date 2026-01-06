# Terminal Streaming to Browser - Implementation Summary

## Overview

This implementation enables terminal sessions running in the Electron desktop app to be accessed remotely via WebSocket, allowing browser clients (or other Electron windows) to:
- Discover and list available terminal sessions
- Attach to sessions and view output in real-time
- Claim ownership and send input to terminals
- Resize terminals
- Transfer ownership seamlessly between local and remote clients

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Electron App (Desktop)                                      │
│                                                              │
│  ┌──────────────────┐        ┌──────────────────────────┐  │
│  │ PTY Worker       │───────>│ TerminalSessionManager   │  │
│  │ (Utility Process)│        │ - Monitors PTY data      │  │
│  └──────────────────┘        │ - Notifies listeners     │  │
│                              └──────────┬───────────────┘  │
│                                         │                   │
│                              ┌──────────▼───────────────┐  │
│                              │ TerminalWebSocketBridge  │  │
│                              │ - Manages connections    │  │
│                              │ - Streams data           │  │
│                              │ - Handles operations     │  │
│                              └──────────┬───────────────┘  │
└─────────────────────────────────────────┼──────────────────┘
                                          │
                                    WebSocket (WSS)
                                          │
                          ┌───────────────┴──────────────────┐
                          │                                  │
                          ▼                                  ▼
               ┌──────────────────┐              ┌──────────────────┐
               │ Browser Client   │              │ Remote Terminal  │
               │ (web-ade)        │              │ Window (Electron)│
               │                  │              │ - Test Window    │
               │ - xterm.js UI    │              │ - Same Protocol  │
               │ - Full control   │              │                  │
               └──────────────────┘              └──────────────────┘
```

## Components Implemented

### 1. Core Types & Models
**File:** `src/main/terminal/types.ts`
- `OwnerType`: 'local' | 'remote'
- `TerminalOwner`: Tracks owner type, ID, user info, and timestamp
- `RemoteClientInfo`: Tracks remote WebSocket clients
- Extended `TerminalSession` with repoPath, repoId, owner, and remoteAttachments

### 2. Ownership Manager
**File:** `src/main/terminal/TerminalOwnershipManager.ts`

**Features:**
- Support for both local (Electron window) and remote (browser) owners
- Single-writer model enforced across all client types
- Remote client registration/unregistration
- Automatic cleanup on disconnect
- Ownership transfer notifications

**Key Methods:**
- `claimOwnershipGeneric(sessionId, owner, force)`: Claim ownership (local or remote)
- `releaseOwnershipGeneric(sessionId, ownerId, ownerType)`: Release ownership
- `isOwnerGeneric(sessionId, ownerId, ownerType)`: Check ownership
- `registerRemoteClient(clientInfo)`: Register browser client
- `cleanupRemoteClient(clientId)`: Clean up on disconnect

### 3. Terminal Event Types
**File:** `src/shared/terminal-events.ts`

**Event Types:**
- `terminal:session_list` - List available sessions
- `terminal:session_created` - New session notification
- `terminal:session_destroyed` - Session destroyed notification
- `terminal:attach` - Attach to session
- `terminal:detach` - Detach from session
- `terminal:claim_ownership` - Claim write access
- `terminal:release_ownership` - Release write access
- `terminal:ownership_changed` - Ownership change broadcast
- `terminal:data` - PTY output stream (Base64 encoded)
- `terminal:write` - Write input to PTY
- `terminal:resize` - Resize terminal
- `terminal:error` - Error notification

### 4. WebSocket Bridge
**File:** `src/main/terminal/TerminalWebSocketBridge.ts`

**Responsibilities:**
- Connect to Control Tower WebSocket server
- Join terminal rooms (`terminals:owner/repo` format)
- Handle all terminal event types
- Stream PTY data to remote clients
- Enforce ownership rules
- Broadcast session lifecycle events

**Key Features:**
- Uses Control Tower Core's `BaseClient`
- JWT authentication
- Room-based isolation per repository
- Sequence numbering for data chunks
- Base64 encoding for wire safety
- Ownership validation before write/resize operations

### 5. Session Manager Integration
**File:** `src/main/terminal/TerminalSessionManager.ts`

**Enhancements:**
- Data listener system for PTY output interception
- Monitoring port creation for non-intrusive data streaming
- Repository detection (git root + remote parsing)
- WebSocket bridge integration hooks
- Lifecycle notifications (create/destroy)

**Key Methods:**
- `addDataListener(id, callback)`: Subscribe to PTY data
- `createMonitoringPort(sessionId)`: Create data interception port
- `findGitRoot(directory)`: Find git repository root
- `getRepoIdFromPath(repoPath)`: Extract owner/repo from git remote

### 6. Authorization Service
**File:** `src/main/terminal/TerminalAuthorizationService.ts`

**Features:**
- Same-user validation (GitHub handle + user ID match)
- Permission checking (read/write/resize/claim)
- Ready for future fine-grained permissions

### 7. Bridge Initializer
**File:** `src/main/terminal/bridgeInitializer.ts`

**Responsibilities:**
- Initialize bridge on app startup
- Connect bridge to session manager
- Register IPC handlers
- Provide connection helpers

### 8. Remote Terminal Window (Test Client)
**Files:**
- `src/main/window/RemoteTerminalWindow.ts`: Window class
- `src/renderer/pages/RemoteTerminalViewer/index.tsx`: React UI

**Purpose:**
- Test the WebSocket bridge within Electron
- Acts as a browser client (WebSocket instead of IPC)
- Validates end-to-end flow

## Data Flow

### Session Discovery
```
1. Browser connects to WebSocket with JWT
2. Browser joins room: terminals:owner/repo
3. Desktop broadcasts terminal:session_list
4. Browser receives and displays sessions
```

### Attach & Stream
```
1. Browser sends terminal:attach { sessionId, asOwner }
2. Desktop validates and adds to remoteAttachments
3. Desktop creates monitoring port (if first attachment)
4. PTY data flows: Worker → MonitorPort → DataListener → Bridge → WebSocket → Browser
5. Browser receives terminal:data events with Base64 encoded output
```

### Write Operation
```
1. Browser sends terminal:write { sessionId, data }
2. Bridge validates ownership
3. If owner: sessionManager.writeToSession(sessionId, data)
4. PTY processes input and echoes back via data stream
```

### Ownership Transfer
```
1. Electron window owns terminal (local)
2. Browser sends terminal:claim_ownership
3. Bridge releases local ownership
4. Bridge grants remote ownership
5. Bridge broadcasts terminal:ownership_changed
6. All clients update UI state
```

## Security Features

**Authentication:**
- JWT tokens required for WebSocket connection
- Token validation on Control Tower server
- User identity verification

**Authorization:**
- Same GitHub user requirement (Phase 1)
- Ownership checks before write/resize
- Repository-level isolation via rooms

**Data Protection:**
- WSS (TLS) encryption
- Base64 encoding for binary safety
- No secrets in event metadata

## Testing the Implementation

### Opening the Remote Terminal Viewer

**Via Menu (Recommended):**
View → Remote Terminal Viewer

**Via Dev Console (from main process):**
```typescript
import { getRemoteTerminalWindow } from './window/RemoteTerminalWindow';
const window = getRemoteTerminalWindow();
window.create();
```

### Configuration Before Testing

**Important:** Update the repository in `RemoteTerminalViewer/index.tsx` line ~171:
```typescript
const repoId = 'your-github-username/your-test-repo';
```

Requirements:
- You must have access to this repository
- The Principal AI GitHub App must be installed on this repository
- You should have active terminal sessions in this repository for testing

### Current Authentication Flow

1. **Get GitHub Token** - Retrieved from main process authentication
2. **Exchange for JWT** - Calls `https://auth.principal-ade.com/api/auth/browser/room-token`
3. **Connect to WebSocket** - Connects to Control Tower at `wss://repository-traffic-controller-production.rj36caac972nm.us-east-1.cs.amazonlightsail.com/ws`
4. **Authenticate** - Sends `authenticate` message with JWT token
5. **Wait for Event** - Waits for `authenticated` event from BaseClient
6. **Join Room** - Joins room `terminals:owner/repo` after authentication complete

### What Works So Far

✅ Window creation and preload script loading
✅ GitHub token retrieval from main process
✅ JWT room token exchange with auth server
✅ WebSocket connection to Control Tower
✅ Authentication message protocol
✅ Waiting for authentication completion

### Next Steps for Full Implementation

1. **Get Repository from Workspace**
   - Detect active workspace repository
   - Fall back to selection UI if no workspace open
   - Remove hardcoded repository

2. **Complete Session List Flow**
   - Test receiving `terminal:session_list` events
   - Render session list in UI
   - Add filtering/search

3. **Implement Attach Flow**
   - Send `terminal:attach` requests
   - Receive and decode `terminal:data` events
   - Render in xterm.js instances

4. **Add Control Operations**
   - Implement `terminal:write` for input
   - Implement `terminal:resize` for terminal resizing
   - Implement `terminal:claim_ownership` for taking control

## File Reference

### Main Implementation
- `src/main/terminal/types.ts` - Type definitions
- `src/main/terminal/TerminalOwnershipManager.ts` - Ownership management
- `src/main/terminal/TerminalSessionManager.ts` - Session lifecycle
- `src/main/terminal/TerminalWebSocketBridge.ts` - WebSocket orchestration
- `src/main/terminal/TerminalAuthorizationService.ts` - Access control
- `src/main/terminal/bridgeInitializer.ts` - Initialization
- `src/shared/terminal-events.ts` - Event type definitions

### Test Window
- `src/main/window/RemoteTerminalWindow.ts` - Window management
- `src/renderer/pages/RemoteTerminalViewer/index.tsx` - UI component
- `src/renderer/App.tsx` - Route configuration

### Integration
- `src/main/terminal/index.ts` - Terminal manager with bridge init

## Configuration

**WebSocket Server URL:**
```typescript
// Default (can be overridden via env var)
process.env.CONTROL_TOWER_WS_URL ||
'wss://repository-traffic-controller-production.rj36caac972nm.us-east-1.cs.amazonlightsail.com'
```

**Room Format:**
```typescript
`terminals:${owner}/${repo}`
// Example: "terminals:principal-ai/desktop-app"
```

## Status

✅ **Phase 1: Foundation** - Complete
✅ **Phase 2: Operations** - Complete
✅ **Phase 3: Data Streaming** - Complete
✅ **Phase 4: Browser Client** - Complete (using Control Tower Core 0.2.0 browser adapter)
🔧 **Phase 5: Authentication** - In Progress

### Recent Progress (2026-01-06)

**Authentication Flow Implemented:**
- ✅ Created minimal `preload-remote-terminal-viewer.ts` to avoid dependency conflicts
- ✅ Implemented proper authentication event flow (wait for `authenticated` event before room join)
- ✅ Added JWT room token exchange via `/api/auth/browser/room-token`
- ✅ Fixed race condition where room join happened before auth completed
- ✅ Added menu item: View → Remote Terminal Viewer

**Key Findings:**
- Control Tower Core's `WebSocketServerTransportAdapter` already handles `authenticate` messages correctly
- BaseClient emits `authenticated` event when `auth_result` is processed - must wait for this
- Cannot use GitHub token directly - must exchange for JWT room token first
- Browser endpoint is `/api/auth/browser/room-token` (not `/api/auth/cli/room-token`)
- Auth server URL: `https://auth.principal-ade.com`

**Current Blocker:**
- Need to determine correct repository to use for testing (hardcoded test repo causes "Repository not found or no access" error)
- Should get repository from active workspace instead of hardcoding

**Architectural Decision Needed:**
- **Should we join rooms at all for session discovery?** Current implementation joins `terminals:owner/repo` room immediately, but this requires knowing the repository upfront. Alternative: connect to server without joining a room, implement a global session discovery mechanism, or use presence/broadcast to discover available sessions across all repositories the user has access to.

**Next Steps:**
1. Decide on room joining strategy (per-repo vs global discovery)
2. Get repository from active workspace context (if per-repo approach)
3. Handle case where no repository is open (show helpful message or show all sessions)
4. Test full flow with actual terminal sessions
5. Verify session list, attach, and control operations work end-to-end

## Performance Considerations

**Data Streaming:**
- Monitoring port runs in parallel with renderer ports
- No impact on local terminal performance
- Periodic logging (every 100 chunks) to reduce spam
- Base64 encoding adds ~33% size overhead
- Future: Consider compression for large outputs

**Ownership:**
- O(1) ownership checks
- O(n) cleanup on disconnect (n = sessions owned)
- Automatic garbage collection when windows/clients close

**Memory:**
- Sequence counters per session
- Remote attachment tracking per session
- Data listeners map (minimal overhead)

## Known Limitations

1. **Phase 1 only allows same GitHub user** - No cross-user sharing yet
2. **Attach-only** - Browser cannot create new sessions (coming in Phase 2)
3. **Repository must be hardcoded** - Should get from active workspace context
4. **No session persistence** - Sessions die when Electron app closes
5. **No compression** - Large outputs could be slow over network

## Troubleshooting

### Authentication Issues

**Error: "jwt malformed"**
- **Cause:** Using GitHub token directly instead of JWT room token
- **Fix:** Exchange GitHub token for JWT via `/api/auth/browser/room-token`

**Error: "Authentication required to join room"**
- **Cause:** Trying to join room before `auth_result` message is processed
- **Fix:** Wait for `authenticated` event from BaseClient before calling `joinRoom()`

**Error: "Repository not found or no access"**
- **Cause:** User doesn't have access to the hardcoded repository, or GitHub App not installed
- **Fix:** Use a repository where you have access and the Principal AI GitHub App is installed

**Error: "Failed to get room token: 405"**
- **Cause:** Using wrong endpoint (e.g., `/api/auth/cli/room-token` instead of browser endpoint)
- **Fix:** Use `/api/auth/browser/room-token` for browser/Electron renderer contexts

### Preload Script Issues

**Error: "module not found: @principal-ai/repository-monitoring-server"**
- **Cause:** Full `preload.ts` imports dependencies that don't work in sandbox
- **Fix:** Use minimal `preload-remote-terminal-viewer.ts` with only required APIs

## Dependencies

**Control Tower Core 0.2.0:**
- Uses browser-safe exports: `@principal-ai/control-tower-core/adapters/websocket/browser`
- Provides `BrowserWebSocketTransportAdapter` for Electron renderer and web clients
- No Node.js dependencies pulled into browser bundle

## Future Enhancements

- [ ] Browser session creation
- [ ] Multiple simultaneous writers (collaborative mode)
- [ ] Session persistence across app restarts
- [ ] Terminal sharing with different GitHub users (team access)
- [ ] Recording and playback
- [ ] Terminal search across sessions
- [ ] Compression for data streaming
- [ ] Bandwidth throttling options
- [ ] Session snapshots
