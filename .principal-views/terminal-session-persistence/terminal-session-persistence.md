# Terminal Session Persistence Architecture

## Overview

This architecture documents a proposed approach for preserving terminal sessions across Electron app updates and restarts. The core idea is to decouple PTY process management from Electron's lifecycle by running an **external PTY daemon** that survives app restarts.

## Problem Statement

Currently, terminal sessions are destroyed when the app updates:

1. Electron's auto-updater downloads new version
2. `will-quit` event triggers `shutdownServices()`
3. `TerminalSessionManager.shutdown()` destroys all sessions
4. Utility worker (and all PTY processes) terminate
5. App restarts with no terminal state

**User impact**: Running processes (dev servers, builds, etc.) are killed. Terminal history is lost.

## Architecture Decision

**Approach: External PTY Daemon with Worker-Direct Connection**

Instead of running PTY processes in a utility worker (child of Electron), run them in a separate long-lived daemon process. The key insight is that the **utility worker connects directly to the daemon**, bypassing the main process for data flow. This keeps the main process responsive.

**Design Principles:**
- Daemon spawns PTY processes and survives app restarts
- Worker connects directly to daemon via Unix socket (no main process relay)
- Main process only handles control messages (create, destroy, list)
- Data flows: Daemon → Worker → MessagePort → Renderer (bypasses main!)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Electron App                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐         ┌─────────────────────────────────────┐    │
│  │    Renderer     │◄──────►│       Utility Worker                 │    │
│  │                 │ Message │                                      │    │
│  │  Terminal UI    │  Port   │  - Holds MessagePorts               │    │
│  │  xterm.js       │ (direct)│  - Connects to daemon socket        │    │
│  │                 │         │  - Bridges socket ↔ ports           │    │
│  └─────────────────┘         └──────────────┬──────────────────────┘    │
│                                              │                           │
│  ┌─────────────────┐                         │ Unix Socket               │
│  │  Main Process   │ control messages only   │ (PTY data)               │
│  │                 │─────────────────────────┤                           │
│  │  Session Mgr    │ create/destroy/list     │                           │
│  │  (coordinator)  │                         │                           │
│  └─────────────────┘                         │                           │
│                                              │                           │
└──────────────────────────────────────────────┼───────────────────────────┘
                                               │
                                     ~/.principal/pty-daemon.sock
                                               │
┌──────────────────────────────────────────────┼───────────────────────────┐
│                    PTY Daemon (Independent Process)                       │
├──────────────────────────────────────────────┼───────────────────────────┤
│                                              │                            │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ DaemonSessionManager                                                 │ │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                 │ │
│  │ │ PTY 1    │ │ PTY 2    │ │ PTY 3    │ │ PTY N    │  ...           │ │
│  │ │ /bin/zsh │ │ /bin/zsh │ │ /bin/zsh │ │ /bin/zsh │                 │ │
│  │ └──────────┘ └──────────┘ └──────────┘ └──────────┘                 │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ✓ Runs independently of Electron lifecycle                              │
│  ✓ Persists sessions across app restarts/updates                         │
│  ✓ Maintains scrollback buffers for reattachment                         │
│  ✓ Auto-starts when needed, idle shutdown after 30min                    │
└───────────────────────────────────────────────────────────────────────────┘
```

## Why Worker-Direct Connection?

**Problem with Main Process Relay:**
Terminal output can be high-volume (compilation, `cat` large files, verbose logs). If main process relays all PTY data, it causes UI jank - laggy window dragging, slow menus, input delays.

**Solution:**
Worker connects directly to daemon socket. Data flows without touching main process:
```
PTY Output:  Daemon → Unix socket → Worker → port1 → port2 → Renderer
User Input:  Renderer → port2 → port1 → Worker → Unix socket → Daemon → PTY
```

Main process only handles infrequent control operations:
- Create/destroy sessions
- List sessions on startup
- Coordinate ownership

## Communication Protocol

JSON-based protocol over Unix socket with newline delimiters:

### Client → Daemon Messages

```typescript
type ClientMessage =
  | { type: 'create'; id: string; cwd: string; shell?: string; env?: Record<string, string>; cols?: number; rows?: number }
  | { type: 'write'; id: string; data: string }
  | { type: 'resize'; id: string; cols: number; rows: number }
  | { type: 'destroy'; id: string }
  | { type: 'list' }                    // Get all existing sessions
  | { type: 'attach'; id: string }      // Reattach to existing session (get scrollback)
  | { type: 'ping' }                    // Health check
```

### Daemon → Client Messages

```typescript
type DaemonMessage =
  | { type: 'created'; id: string; pid: number }
  | { type: 'data'; id: string; data: string }
  | { type: 'exit'; id: string; exitCode: number; signal?: string }
  | { type: 'error'; id: string; error: string }
  | { type: 'sessions'; sessions: SessionInfo[] }
  | { type: 'scrollback'; id: string; data: string }  // Response to 'attach'
  | { type: 'pong' }
```

### SessionInfo Shape

```typescript
interface SessionInfo {
  id: string;
  cwd: string;
  pid: number;
  createdAt: string;      // ISO timestamp
  lastActivity: string;   // ISO timestamp
  cols: number;
  rows: number;
}
```

## Data Flow

### PTY Data Flow (High-Frequency - Bypasses Main)

```
┌──────────────────────────────────────────────────────────────────┐
│                    PTY OUTPUT (daemon → renderer)                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  PTY Process                                                      │
│      │ stdout/stderr                                              │
│      ▼                                                            │
│  DaemonSessionManager.onData()                                    │
│      │ JSON: { type: 'data', id, data }                          │
│      ▼                                                            │
│  Unix Socket ──────────────────────────────────────────────────► │
│                                                                   │
│  ◄─────────────────────────────────────────── Utility Worker     │
│      │ parse JSON, lookup session port                           │
│      ▼                                                            │
│  port1.postMessage({ type: 'DATA', data })                       │
│      │ MessageChannel (direct transfer)                          │
│      ▼                                                            │
│  port2.onmessage() ──► xterm.js.write(data)                      │
│                                                                   │
│  ✓ Main process NOT involved in data path                        │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    USER INPUT (renderer → daemon)                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  xterm.js.onData(input)                                          │
│      │                                                            │
│      ▼                                                            │
│  port2.postMessage({ type: 'WRITE', data: input })               │
│      │ MessageChannel (direct transfer)                          │
│      ▼                                                            │
│  Utility Worker: port1.onmessage()                               │
│      │ JSON: { type: 'write', id, data }                         │
│      ▼                                                            │
│  Unix Socket ──────────────────────────────────────────────────► │
│                                                                   │
│  ◄─────────────────────────────────────────── PTY Daemon         │
│      │ ptyProcess.write(data)                                    │
│      ▼                                                            │
│  PTY stdin                                                        │
│                                                                   │
│  ✓ Main process NOT involved in data path                        │
└──────────────────────────────────────────────────────────────────┘
```

### Control Flow (Low-Frequency - Through Main)

```
┌──────────────────────────────────────────────────────────────────┐
│               SESSION CREATION (main coordinates)                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Renderer: "Create new terminal"                                  │
│      │ IPC                                                        │
│      ▼                                                            │
│  Main: TerminalSessionManager.createSession()                     │
│      │ postMessage to worker                                      │
│      ▼                                                            │
│  Worker: send({ type: 'create', id, cwd }) via socket            │
│      │                                                            │
│      ▼                                                            │
│  Daemon: spawn PTY, respond { type: 'created', id, pid }         │
│      │                                                            │
│      ▼                                                            │
│  Worker: notify main "session created"                            │
│      │                                                            │
│      ▼                                                            │
│  Main: create MessageChannel, transfer ports                      │
│      │ port1 → worker, port2 → renderer                          │
│      ▼                                                            │
│  Data flow now bypasses main!                                     │
└──────────────────────────────────────────────────────────────────┘
```

### App Startup (Fresh)

```
App Launch
    │
    ▼
Main: Initialize worker
    │
    ▼
Worker: Check if daemon socket exists
    │
    ├── No ──→ Main spawns daemon (detached)
    │                │
    │          Wait for socket
    │                │
    ▼                ▼
Worker: net.connect(SOCKET_PATH)
    │
    ▼
Daemon sends 'sessions' message
    │
    ▼
sessions.length === 0 (fresh start)
    │
    ▼
Worker notifies main: "ready, 0 sessions"
```

### App Startup (After Update) - Session Restoration

```
App Launch (v2)
    │
    ▼
Main: Initialize worker
    │
    ▼
Worker: net.connect(SOCKET_PATH)
    │
    ▼
Daemon sends 'sessions' message
    │
    ▼
[session1, session2, session3] ← Existing sessions!
    │
    ▼
Worker notifies main: "3 existing sessions"
    │
    ▼
Main: For each session:
    │
    ├── Restore to TerminalSessionManager
    ├── Create MessageChannel
    ├── Transfer port1 to worker, port2 to renderer
    └── Worker: send 'attach' to get scrollback
              │
              ▼
        Daemon sends scrollback data
              │
              ▼
        Worker forwards via port1 → renderer
              │
              ▼
        xterm.js displays restored content
```

### App Update Flow

```
Update Available
    │
    ▼
User clicks "Install Update"
    │
    ▼
app.on('before-quit')
    │
    ▼
Main: TerminalSessionManager.prepareForRestart()
    │
    ├── Save session metadata to disk (cwd, context, etc.)
    └── Tell worker to disconnect cleanly
              │
              ▼
        Worker: socket.end()
              │
              ▼
        Daemon stays alive (no clients, but has sessions)
        PTY processes continue running
        Scrollback buffers preserved
              │
              ▼
App quits, worker dies, updater replaces binary
              │
              ▼
App launches (v2)
              │
              ▼
New worker connects to existing daemon
              │
              ▼
Sessions restored with full scrollback!
```

## Key Components

### PtyDaemon (Standalone Process)

Standalone Node.js process that manages PTY lifecycles:
- **Location**: `src/pty-daemon/`
- **Entry**: `daemon.ts` - Socket server + session management
- **Lifecycle**: Spawned detached by main process, runs independently
- **Socket**: `~/.principal/pty-daemon.sock`
- **Key Classes**:
  - `SocketServer` - Accepts client connections, multiplexes messages
  - `DaemonSessionManager` - Spawns PTYs via node-pty, manages lifecycle
  - `ScrollbackBuffer` - Circular buffer per session for reattachment

### Utility Worker (Modified)

Electron utility process that bridges MessagePorts ↔ Daemon:
- **Location**: `src/terminal-worker/`
- **Key Change**: No longer spawns PTYs directly
- **Responsibilities**:
  - Connect to daemon via Unix socket
  - Hold MessagePorts (port1 per session)
  - Bridge: socket data ↔ MessagePort messages
  - Notify main of session events (created, exited)

### PtyDaemonClient (In Worker)

Socket client that runs inside the utility worker:
- **Location**: `src/terminal-worker/PtyDaemonClient.ts`
- **Responsibilities**:
  - Connect to daemon socket
  - Send/receive JSON messages
  - Handle reconnection with backoff
  - Route PTY data to correct MessagePort

### Modified TerminalSessionManager (Main Process)

Coordinator that delegates to worker:
- **Location**: `src/main/terminal/TerminalSessionManager.ts`
- **Changes**:
  - Sends control messages to worker (create, destroy, list)
  - Worker handles daemon communication
  - Creates MessageChannels, transfers ports
  - Handles session restoration on startup
  - Keep ownership + activity tracking (unchanged)
- **Does NOT**: Handle PTY data (that's worker ↔ renderer direct)

## Daemon Lifecycle

### Startup

1. First terminal request triggers daemon check
2. If socket doesn't exist, spawn daemon
3. Daemon creates socket, begins listening
4. Client connects, receives session list

### Idle Shutdown (Optional)

```typescript
// In daemon
const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

setInterval(() => {
  if (sessions.size === 0 && clients.size === 0) {
    const idleTime = Date.now() - lastActivity;
    if (idleTime > IDLE_TIMEOUT) {
      shutdown();
    }
  }
}, 60000);
```

### Crash Recovery

If daemon crashes while app is running:
1. Client detects socket close
2. Emits 'disconnected' event
3. Schedules reconnection attempts
4. On reconnect, syncs session state
5. UI shows reconnection status

## Security Considerations

### Socket Permissions

```typescript
// Daemon: restrict socket to current user
fs.chmodSync(SOCKET_PATH, 0o600);
```

### Process Isolation

- Daemon runs as same user (no privilege escalation)
- No network exposure (Unix socket only)
- PTY processes inherit daemon's environment

## Platform Support

| Platform | Socket Type | Path |
|----------|-------------|------|
| macOS | Unix socket | `~/.your-app/pty-daemon.sock` |
| Linux | Unix socket | `~/.your-app/pty-daemon.sock` |
| Windows | Named pipe | `\\.\pipe\your-app-pty-daemon` |

## Migration Path

### Phase 1: Daemon Infrastructure ✓
- ✓ Implement PtyDaemon process (`src/pty-daemon/`)
- ✓ Implement socket server and session manager
- ✓ Add daemon spawn logic
- ✓ Test daemon standalone

### Phase 2: Worker Integration
- Modify utility worker to connect to daemon socket
- Worker no longer spawns PTYs directly
- Worker bridges socket ↔ MessagePort
- Keep MessagePort flow to renderer unchanged

### Phase 3: Session Manager Updates
- Main sends control messages to worker
- Worker handles daemon protocol
- Add session restoration on startup
- Update shutdown to disconnect (not destroy)

### Phase 4: UI Updates
- Show "Restoring sessions..." indicator
- Handle reconnection state in UI
- Add daemon status to debug info

### Phase 5: Cleanup & Polish
- Remove direct node-pty usage from worker
- Add telemetry for persistence success rate
- Handle edge cases (daemon crash, socket errors)

## Comparison with Current Architecture

| Aspect | Current (Worker spawns PTY) | New (Worker → Daemon → PTY) |
|--------|----------------------------|----------------------------|
| PTY lifecycle | Tied to worker/app | Independent of app |
| Survives app restart | No | Yes |
| Survives app update | No | Yes |
| Running processes | Lost on quit | Preserved |
| Scrollback history | Lost on quit | Preserved in daemon |
| Data path | Worker → MessagePort → Renderer | Daemon → Worker → MessagePort → Renderer |
| Main process load | Control only | Control only (unchanged) |
| Complexity | Medium | Higher |
| Startup overhead | Worker spawn | Worker spawn + daemon connect |

## Key Files

**Daemon Process (New):**
- `src/pty-daemon/daemon.ts` - Main daemon entry point
- `src/pty-daemon/DaemonSessionManager.ts` - PTY spawning and lifecycle
- `src/pty-daemon/SocketServer.ts` - Unix socket server
- `src/pty-daemon/ScrollbackBuffer.ts` - Circular buffer for scrollback
- `src/pty-daemon/Logger.ts` - Daemon logging

**Utility Worker (Modified):**
- `src/terminal-worker/worker-entry.ts` - Modified to connect to daemon
- `src/terminal-worker/DaemonBridge.ts` - Socket ↔ MessagePort bridge

**Main Process:**
- `src/main/terminal/TerminalSessionManager.ts` - Coordinates worker
- `src/main/terminal/daemonSpawner.ts` - Spawns daemon if not running

**Shared:**
- `src/shared/pty-daemon/protocol.ts` - Message type definitions
- `src/shared/pty-daemon/constants.ts` - Socket paths, timeouts

## Related Architecture

- **Terminal Session Management**: See `.principal-views/terminal-session-management/` for current utility worker architecture
- **App Updates**: See `.principal-views/app-updates/` for update flow integration points
