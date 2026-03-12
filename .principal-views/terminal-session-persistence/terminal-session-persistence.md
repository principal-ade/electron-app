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

**Approach: External PTY Daemon with Socket IPC**

Instead of running PTY processes in a utility worker (child of Electron), run them in a separate long-lived daemon process that:

- Starts independently of Electron
- Communicates via Unix domain socket (or named pipe on Windows)
- Survives app restarts/updates
- Manages session lifecycle and scrollback buffers

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Electron App                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Main Process                                                        │
│  ┌────────────────────────┐      ┌────────────────────────────────┐ │
│  │ TerminalSessionManager │ ───→ │ PtyDaemonClient                │ │
│  │ (coordinator)          │      │ - Connects to socket           │ │
│  └────────────────────────┘      │ - Multiplexes sessions         │ │
│                                   │ - Handles reconnection         │ │
│                                   └───────────────┬────────────────┘ │
└───────────────────────────────────────────────────┼─────────────────┘
                                                    │
                                          Unix Socket IPC
                                    ~/.your-app/pty-daemon.sock
                                                    │
┌───────────────────────────────────────────────────┼─────────────────┐
│                      PTY Daemon (Separate Process)                   │
├───────────────────────────────────────────────────┼─────────────────┤
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ SessionManager                                                  │ │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │ │
│  │ │ PTY 1    │ │ PTY 2    │ │ PTY 3    │ │ PTY 4    │  ...      │ │
│  │ │ /bin/zsh │ │ /bin/zsh │ │ /bin/zsh │ │ /bin/zsh │           │ │
│  │ └──────────┘ └──────────┘ └──────────┘ └──────────┘           │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  - Runs independently of Electron lifecycle                         │
│  - Persists sessions across app restarts                            │
│  - Maintains scrollback buffers for reattachment                    │
│  - Auto-starts when needed, optional idle shutdown                  │
└──────────────────────────────────────────────────────────────────────┘
```

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

### App Startup (Fresh)

```
App Launch
    │
    ▼
PtyDaemonClient.connect()
    │
    ├── Socket exists? ──No──→ startDaemon()
    │         │                     │
    │        Yes              spawn detached
    │         │                     │
    │         ▼                     ▼
    └──→ net.connect(SOCKET_PATH)
              │
              ▼
    Daemon sends 'sessions' message
              │
              ▼
    sessions.length === 0 (fresh start)
```

### App Startup (After Update)

```
App Launch (v2)
    │
    ▼
PtyDaemonClient.connect()
    │
    ▼
Socket exists (daemon still running)
    │
    ▼
net.connect(SOCKET_PATH)
    │
    ▼
Daemon sends 'sessions' message
    │
    ▼
[session1, session2, session3] ← Existing sessions!
    │
    ▼
For each session:
    ├── Restore to TerminalSessionManager
    ├── Send 'attach' to get scrollback
    └── Re-wire MessagePort to renderer
```

### Session Creation via Daemon

```
Renderer requests new terminal
         │
         ▼
TerminalSessionManager.createSession()
         │
         ▼
daemonClient.send({ type: 'create', id, cwd })
         │
         ▼
Daemon spawns PTY process
         │
         ▼
Daemon sends { type: 'created', id, pid }
         │
         ▼
Session stored in manager, MessagePort wired
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
TerminalSessionManager.prepareForRestart()
    │
    ├── Save session metadata to disk (optional)
    └── Disconnect from daemon (socket closes cleanly)
              │
              ▼
        Daemon stays alive
        PTY processes continue running
              │
              ▼
App quits, updater replaces binary
              │
              ▼
App launches (v2)
              │
              ▼
PtyDaemonClient.connect()
              │
              ▼
Daemon sends existing sessions
              │
              ▼
Sessions restored with full state
```

## Key Components

### PtyDaemon (New)

Standalone Node.js process:
- **Location**: `src/pty-daemon/` or separate package
- **Entry**: `daemon.ts` - Socket server + session management
- **Lifecycle**: Spawned detached, runs independently
- **Socket**: `~/.your-app/pty-daemon.sock`

### PtyDaemonClient (New)

Client for main process:
- **Location**: `src/main/terminal/PtyDaemonClient.ts`
- **Responsibilities**:
  - Connect to daemon (start if needed)
  - Send/receive messages
  - Handle reconnection on disconnect
  - Emit events for session data

### Modified TerminalSessionManager

Existing manager adapted to use daemon:
- **Changes**:
  - Replace worker communication with daemon client
  - Add session restoration on startup
  - Remove worker lifecycle management
  - Keep ownership + activity tracking (unchanged)

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

### Phase 1: Daemon Infrastructure
- Implement PtyDaemon process
- Implement PtyDaemonClient
- Add daemon spawn/connect logic

### Phase 2: Session Manager Integration
- Modify TerminalSessionManager to use daemon
- Add session restoration on startup
- Keep existing ownership/activity tracking

### Phase 3: UI Updates
- Show "Restoring sessions..." on startup
- Add daemon status indicator (optional)
- Handle reconnection gracefully

### Phase 4: Cleanup
- Remove utility worker code
- Update shutdown flow
- Add telemetry for persistence success rate

## Comparison with Current Architecture

| Aspect | Utility Worker (Current) | External Daemon (Proposed) |
|--------|-------------------------|---------------------------|
| Process lifecycle | Child of Electron | Independent |
| Survives app restart | No | Yes |
| Survives app update | No | Yes |
| Running processes | Lost on quit | Preserved |
| Scrollback history | Lost on quit | Preserved |
| Complexity | Lower | Higher |
| IPC mechanism | MessagePort | Unix socket |
| Startup overhead | None | Daemon spawn if needed |

## Key Files (Proposed)

**Daemon Process:**
- `src/pty-daemon/daemon.ts` - Main daemon entry
- `src/pty-daemon/SessionManager.ts` - PTY session management
- `src/pty-daemon/SocketServer.ts` - Unix socket server
- `src/pty-daemon/types.ts` - Protocol types

**Main Process:**
- `src/main/terminal/PtyDaemonClient.ts` - Daemon client
- `src/main/terminal/TerminalSessionManager.ts` - Modified to use daemon
- `src/main/terminal/sessionRestoration.ts` - Startup restoration logic

**Shared:**
- `src/shared/pty-daemon/protocol.ts` - Message type definitions
- `src/shared/pty-daemon/constants.ts` - Socket paths, timeouts

## Related Architecture

- **Terminal Session Management**: See `.principal-views/terminal-session-management/` for current utility worker architecture
- **App Updates**: See `.principal-views/app-updates/` for update flow integration points
