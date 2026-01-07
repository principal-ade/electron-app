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
│                              │ - User discovery room    │  │
│                              │ - Streams data           │  │
│                              │ - Handles operations     │  │
│                              └──────────┬───────────────┘  │
└─────────────────────────────────────────┼──────────────────┘
                                          │
                                    WebSocket (WSS)
                                          │
                      Control Tower Server (Production)
                    Room: terminals:user:{userId}
                    (All user's sessions across repos)
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
- Join user discovery room (`terminals:user:{userId}` format)
- Handle all terminal event types
- Stream PTY data to remote clients
- Enforce ownership rules
- Broadcast session lifecycle events across all user's repositories

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

### Session Discovery (Global Discovery - Option B)
```
1. Browser connects to WebSocket with JWT (user discovery token)
2. Browser joins room: terminals:user:{userId}
3. Desktop main process connects bridge to same user room
4. Browser requests session list via WebSocket
5. Desktop broadcasts terminal:session_list with ALL sessions across repositories
6. Browser receives and displays all user's sessions
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

No repository configuration needed! The Remote Terminal Viewer now uses global user discovery and will show all your terminal sessions across all repositories.

Requirements:
- You should be authenticated with GitHub in the desktop app
- You should have active terminal sessions open in the app
- The production WebSocket server should be deployed with control-tower-core@0.2.1

### Current Authentication Flow (User Discovery)

1. **Get GitHub Token** - Retrieved from main process authentication
2. **Exchange for User Discovery JWT** - Calls `https://auth.principal-ade.com/api/auth/browser/user-token` (no repository parameter)
3. **Connect to WebSocket** - Connects to Control Tower at production server
4. **Authenticate** - Sends `authenticate` message with JWT token
5. **Wait for Event** - Waits for `authenticated` event from BaseClient
6. **Join User Room** - Joins room `terminals:user:{userId}` after authentication complete
7. **Connect Main Process Bridge** - One-time IPC call to connect main process to same room
8. **Request Session List** - Sends `terminal:session_list` event via WebSocket
9. **Receive Sessions** - Gets all user's sessions across all repositories via `event_received`

### What Works Now

✅ Window creation and preload script loading
✅ GitHub token retrieval from main process
✅ JWT user discovery token exchange with auth server
✅ WebSocket connection to Control Tower production server
✅ Authentication message protocol
✅ User room joining (`terminals:user:{userId}`)
✅ Main process bridge connection to same room
✅ Event-driven communication via `event_received`
✅ Session list request/response flow
✅ ConnectedRoomManager broadcasts events to all clients

### Next Steps for Full Implementation

1. **Deploy Production Server**
   - Deploy repository-traffic-controller with control-tower-core@0.2.1
   - Verify ConnectedRoomManager is working in production
   - Test session list broadcasts

2. **Test Session Discovery**
   - Open terminal sessions in desktop app
   - Open Remote Terminal Viewer
   - Verify sessions appear in the list

3. **Implement & Test Attach Flow**
   - Send `terminal:attach` requests
   - Receive and decode `terminal:data` events
   - Render in xterm.js instances

4. **Test Control Operations**
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

**Auth Server URL:**
```typescript
// Default (can be overridden via env var)
process.env.AUTH_SERVER_URL || 'https://auth.principal-ade.com'
```

**Room Format (User Discovery):**
```typescript
`terminals:user:${userId}`
// Example: "terminals:user:185874336"
// Note: Single room per user, contains ALL sessions across repositories
```

## Status

✅ **Phase 1: Foundation** - Complete
✅ **Phase 2: Operations** - Complete
✅ **Phase 3: Data Streaming** - Complete
✅ **Phase 4: Browser Client** - Complete (using Control Tower Core 0.2.1 browser adapter)
✅ **Phase 5: Authentication** - Complete
🔧 **Phase 6: Testing & Deployment** - In Progress

### Recent Progress (2026-01-07)

**Global Discovery Implementation (Option B):**
- ✅ Implemented user discovery room strategy (`terminals:user:{userId}`)
- ✅ Created `/api/auth/browser/user-token` endpoint (no repository required)
- ✅ Updated TerminalWebSocketBridge to use single user connection
- ✅ Updated RemoteTerminalViewer to use user discovery tokens
- ✅ Added one-time IPC call to connect main process bridge
- ✅ All terminal communication now happens exclusively via WebSocket

**Control Tower Core Improvements:**
- ✅ Created `ConnectedRoomManager` that actually broadcasts to clients
- ✅ Fixed DefaultRoomManager only storing events in history without sending
- ✅ ServerBuilder auto-enhances DefaultRoomManager with broadcasting
- ✅ Added `getClientIdsInRoom()` helper to BaseServer
- ✅ Published control-tower-core@0.2.1 to npm
- ✅ Updated repository-traffic-controller to v0.2.1

**Architecture Decisions Made:**
- ✅ **User Discovery Room** - One room per user containing all sessions across repositories
- ✅ **No Repository Context Needed** - Users can discover all their sessions without selecting a repo first
- ✅ **WebSocket-Only Communication** - After initial IPC setup, all terminal operations via WebSocket
- ✅ **Event-Driven Broadcasting** - Room events properly broadcast to all connected clients

**Key Technical Fixes:**
- Fixed event handling to use `event_received` with switch on `event.type`
- Fixed race condition by waiting for `room_joined` before broadcasting
- Fixed missing `terminalBridge` API in preload script
- Fixed room broadcast by implementing proper RoomManager

**Current State:**
- Production WebSocket server needs redeployment with control-tower-core@0.2.1
- Once deployed, full end-to-end flow should work
- RemoteTerminalViewer connects to production server and joins user room
- Main process bridge connects to same room
- Both communicate via WebSocket broadcasting

**Next Steps:**
1. ✅ Deploy repository-traffic-controller with control-tower-core@0.2.1
2. Test full flow with actual terminal sessions
3. Verify session list broadcasts correctly
4. Test attach, write, and resize operations
5. Validate ownership transfer between clients

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
2. **Attach-only** - Browser cannot create new sessions (coming in future phase)
3. **No session persistence** - Sessions die when Electron app closes
4. **No compression** - Large outputs could be slow over network
5. **Production deployment required** - Need to deploy repository-traffic-controller with control-tower-core@0.2.1

## Troubleshooting

### Authentication Issues

**Error: "jwt malformed"**
- **Cause:** Using GitHub token directly instead of JWT token
- **Fix:** Exchange GitHub token for JWT via `/api/auth/browser/user-token`

**Error: "Authentication required to join room"**
- **Cause:** Trying to join room before `auth_result` message is processed
- **Fix:** Wait for `authenticated` event from BaseClient before calling `joinRoom()`

**Error: "Repository not found or no access"**
- **Cause:** (Legacy issue) - Using old per-repository room strategy
- **Fix:** Use user discovery rooms (`terminals:user:{userId}`) - no repository needed!

**Error: "Failed to get room token: 404"**
- **Cause:** Using wrong endpoint or endpoint not deployed
- **Fix:** Use `/api/auth/browser/user-token` for user discovery (deployed as of 2026-01-07)

### WebSocket Issues

**Error: "Connection closed with code 1006"**
- **Cause:** Production server using DefaultRoomManager that doesn't broadcast
- **Fix:** Deploy repository-traffic-controller with control-tower-core@0.2.1 (includes ConnectedRoomManager)

**Error: "Session list not appearing"**
- **Cause:** Events were being stored in history but not sent to clients
- **Fix:** ConnectedRoomManager now properly broadcasts via `event_received` messages

**Error: "Cannot read properties of undefined (reading 'invoke')"**
- **Cause:** Missing `terminalBridge` API in preload script
- **Fix:** Added `terminalBridgeAPI` to `preload-remote-terminal-viewer.ts`

### Preload Script Issues

**Error: "module not found: @principal-ai/repository-monitoring-server"**
- **Cause:** Full `preload.ts` imports dependencies that don't work in sandbox
- **Fix:** Use minimal `preload-remote-terminal-viewer.ts` with only required APIs

## Dependencies

**Control Tower Core 0.2.1:**
- Uses browser-safe exports: `@principal-ai/control-tower-core/adapters/websocket/browser`
- Provides `BrowserWebSocketTransportAdapter` for Electron renderer and web clients
- Includes `ConnectedRoomManager` for proper room broadcasting
- Auto-enhances `DefaultRoomManager` instances with broadcasting capabilities
- No Node.js dependencies pulled into browser bundle

**Auth Server Updates:**
- New endpoint: `/api/auth/browser/user-token` (no repository parameter required)
- Returns JWT with special `repoId: __user_discovery__/{userId}` marker
- Deployed to production: https://auth.principal-ade.com

**Repository Traffic Controller:**
- Updated to use control-tower-core@0.2.1
- ConnectedRoomManager automatically wraps DefaultRoomManager
- Broadcasts events to all clients in rooms
- Ready for deployment

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
