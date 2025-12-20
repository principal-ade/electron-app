# Direct Process Communication Architecture

## Overview

This document captures the current state of inter-process communication (IPC) for high-frequency data streams and outlines the target architecture using direct MessagePort connections between utility processes and renderers.

## Problem Statement

Currently, high-frequency events flow through the main process, causing:

1. **Main thread contention** - Serialization/deserialization on every event
2. **Unnecessary broadcast** - Events sent to all windows, filtered in renderer
3. **Wasted CPU cycles** - Windows process events they don't care about
4. **Console noise** - Filtered events still log, cluttering developer tools

Example from agent events:
```
[AgentSessionSDKService] Event received from IPC: user-prompt-submit
[EventHighlightService] Event filtered out - different repository
```
This pattern repeats for every event, in every window, even when irrelevant.

---

## Current State

### 1. Terminal Data

| Aspect | Current Implementation |
|--------|----------------------|
| **Process** | PTY runs in **main process** |
| **Transport** | MessagePorts (direct to owning window) |
| **Filtering** | Ownership-based - only owner receives data |
| **Status** | ✅ Good - already using MessagePorts |

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                     Main Process                            │
│  ┌──────────────┐         ┌─────────────────┐              │
│  │ PTY Process  │────────>│ MessageChannel  │              │
│  │  (node-pty)  │  onData │   port1 | port2 │              │
│  └──────────────┘         └────────┬────────┘              │
└────────────────────────────────────┼────────────────────────┘
                                     │ port2 transferred
                                     ▼
┌────────────────────────────────────────────────────────────┐
│                   Renderer Process                          │
│  ┌─────────────┐         ┌──────────────┐                  │
│  │ MessagePort │────────>│   xterm.js   │                  │
│  └─────────────┘         └──────────────┘                  │
└────────────────────────────────────────────────────────────┘
```

**Files:**
- `src/main/terminal/TerminalSessionManager.ts` - Session and port management
- `src/main/terminal/TerminalOwnershipManager.ts` - Ownership tracking
- `src/main/terminal/handlers/ownershipHandlers.ts` - Port creation on claim

**Limitation:** PTY is in main process. Phase 2 (utility process) was deferred due to complexity of proxying MessagePorts.

---

### 2. Agent Events

| Aspect | Current Implementation |
|--------|----------------------|
| **Process** | HTTP server in **utility process** ✅ |
| **Transport** | IPC broadcast via main process ❌ |
| **Filtering** | In renderer after receiving ❌ |
| **Status** | ⚠️ Partial - utility process exists but broadcast is inefficient |

**Architecture:**
```
┌──────────────────┐
│  Utility Process │
│  (EventServer)   │
│  - HTTP server   │
│  - Event parsing │
└────────┬─────────┘
         │ postMessage (processed event)
         ▼
┌────────────────────────────────────────────────────────────┐
│                      Main Process                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ EventServerManager.handleProcessedEvent()           │   │
│  │                                                     │   │
│  │ const windows = BrowserWindow.getAllWindows();      │   │
│  │ windows.forEach(window => {                         │   │
│  │   window.webContents.send(PROCESSED_EVENT, event);  │   │  ← PROBLEM
│  │ });                                                 │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
         │ IPC to ALL windows
         ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Renderer A    │  │   Renderer B    │  │   Renderer C    │
│   (repo: foo)   │  │   (repo: bar)   │  │   (repo: foo)   │
│                 │  │                 │  │                 │
│ if (event.repo  │  │ if (event.repo  │  │ if (event.repo  │
│   !== 'foo')    │  │   !== 'bar')    │  │   !== 'foo')    │
│   return; ✓     │  │   return; ✗     │  │   return; ✓     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

**Files:**
- `src/main/agent-session-events/EventServerManager.ts:344-362` - Broadcast to all windows
- `src/renderer/services/EventHighlightService.ts:68-83` - Filters by repository
- `src/renderer/contexts/AgentHighlightContext.tsx` - Subscribes to events

---

### 3. Git Status Updates

| Aspect | Current Implementation |
|--------|----------------------|
| **Process** | File watching in **main process** |
| **Transport** | IPC via `webContents.send()` |
| **Filtering** | Targeted by path, but still IPC |
| **Status** | ⚠️ Could benefit from MessagePorts for high-frequency updates |

**Architecture:**
```
┌────────────────────────────────────────────────────────────┐
│                      Main Process                           │
│  ┌──────────────────────┐                                  │
│  │ FileSystemHandlers   │                                  │
│  │ - chokidar watchers  │                                  │
│  │ - git status checks  │                                  │
│  └──────────┬───────────┘                                  │
│             │                                               │
│  window.webContents.send('git-status-change', {...})       │
└─────────────┼──────────────────────────────────────────────┘
              │ IPC
              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Renderer Process                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ RepositoryPanelContext                              │    │
│  │ - Receives git-status-change                        │    │
│  │ - Updates panel state                               │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Files:**
- `src/main/file-system/fileSystemHandlers.ts:501, 637` - Sends git-status-change
- `src/renderer/contexts/RepositoryPanelContext.tsx` - Receives updates

---

## Target Architecture

### Goal: Direct Utility Process ↔ Renderer Communication

Use MessagePorts to establish direct channels between utility processes and renderers, bypassing the main process for data flow after initial setup.

```
┌─────────────────┐                      ┌─────────────────┐
│ Utility Process │◄────MessagePort─────►│    Renderer     │
│                 │     (direct!)        │                 │
└─────────────────┘                      └─────────────────┘
         ▲                                        ▲
         │ port1                          port2   │
         └──────────┐              ┌──────────────┘
                    │   (setup)    │
               ┌────┴──────────────┴────┐
               │      Main Process      │
               │  1. Creates channel    │
               │  2. Transfers ports    │
               │  3. Done - out of loop │
               └────────────────────────┘
```

### Key Insight

From [Electron MessagePorts documentation](https://www.electronjs.org/docs/latest/tutorial/message-ports):

> MessagePort objects can be created in either the renderer or the main process, and passed back and forth using the `postMessage` methods.

From [utilityProcess API](https://www.electronjs.org/docs/latest/api/utility-process):

> You can send a message to the child process, optionally transferring ownership of zero or more `MessagePortMain` objects.

**The main process can broker a direct connection:**
1. Create `MessageChannelMain` → gets `port1` and `port2`
2. Transfer `port1` to utility process via `utilityProcess.postMessage(msg, [port1])`
3. Transfer `port2` to renderer via `webContents.postMessage(channel, msg, [port2])`
4. Utility process and renderer now communicate directly

---

## Implementation Status

### Phase 1: Agent Events ✅ COMPLETE

Direct MessagePort communication between utility process and renderers is now implemented.

## Implementation Plan

### Phase 1: Agent Events (Highest Impact) - IMPLEMENTED

**Previous problem:** All windows received all events, filtered locally.

**Solution implemented:**
```
┌──────────────────────────────────────────────────────────────┐
│                     Utility Process                           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ EventServer                                             │ │
│  │                                                         │ │
│  │ // Map of repo -> MessagePorts for interested windows   │ │
│  │ private repoPorts: Map<string, MessagePortMain[]>       │ │
│  │                                                         │ │
│  │ onProcessedEvent(event) {                               │ │
│  │   const ports = this.repoPorts.get(event.repository);   │ │
│  │   ports?.forEach(port => port.postMessage(event));      │ │
│  │ }                                                       │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
         │                              │
    port (repo: foo)              port (repo: bar)
         │                              │
         ▼                              ▼
┌─────────────────┐            ┌─────────────────┐
│   Renderer A    │            │   Renderer B    │
│   (repo: foo)   │            │   (repo: bar)   │
│                 │            │                 │
│ Only receives   │            │ Only receives   │
│ foo events! ✓   │            │ bar events! ✓   │
└─────────────────┘            └─────────────────┘
```

**Steps:**
1. Add `registerForRepository(repoPath)` IPC handler in main
2. Main creates MessageChannel, transfers port1 to EventServer, port2 to renderer
3. EventServer maintains `Map<repoPath, MessagePort[]>`
4. Events route directly to interested renderers
5. Remove broadcast loop from `EventServerManager.handleProcessedEvent()`

**Files to modify:**
- `src/main/agent-session-events/EventServerManager.ts`
- `src/event-processing-server/HttpEventServer.ts` (utility process)
- `src/renderer/contexts/AgentHighlightContext.tsx`
- `src/window/preload.ts` or `preload-dev-workspace.ts`

---

### Phase 2: Terminal PTY (Process Isolation)

**Current:** PTY in main process, MessagePorts to renderer.

**Target:** PTY in utility process, MessagePorts to renderer.

```
┌──────────────────────────────────────────────────────────────┐
│                   Utility Process                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ PTY Worker                                              │ │
│  │ - node-pty spawns shell                                 │ │
│  │ - Receives MessagePort per session                      │ │
│  │ - Sends data directly to renderer                       │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
         │
    MessagePort (direct)
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                     Renderer Process                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ xterm.js                                                ││
│  │ - Receives data via MessagePort                         ││
│  │ - Sends input via MessagePort                           ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Benefits:**
- PTY crash doesn't affect main process
- Better CPU distribution
- True process isolation

**Complexity:**
- Need to handle PTY lifecycle in utility process
- Session management coordination
- Error recovery across process boundary

**Files to modify:**
- `src/main/terminal/TerminalSessionManager.ts`
- `src/main/terminal/phase2-future/worker/` (promote to active)
- New: `src/utility-processes/pty-worker.ts`

---

### Phase 3: Git & File System Events

**Current:** Main process watches files, sends IPC.

**Target:** Utility process watches files, MessagePorts to interested renderers.

```
┌──────────────────────────────────────────────────────────────┐
│                   Utility Process                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ FileWatcher                                             │ │
│  │ - chokidar watches registered paths                     │ │
│  │ - git status polling                                    │ │
│  │ - MessagePort per repo/window                           │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
         │
    MessagePort (per repo)
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                     Renderer Process                         │
└─────────────────────────────────────────────────────────────┘
```

**Considerations:**
- File watching is already reasonably efficient
- May be lower priority than agent events
- Could consolidate with agent event utility process

---

## Message Protocol

### Registration Message (Renderer → Main → Utility)

```typescript
interface RegisterInterestMessage {
  type: 'REGISTER_INTEREST';
  windowId: number;
  repository: string;
  interests: ('agent-events' | 'git-status' | 'file-changes')[];
}
```

### Port Transfer (Main orchestrates)

```typescript
// Main process
const { port1, port2 } = new MessageChannelMain();

// Send to utility process
utilityProcess.postMessage(
  { type: 'PORT_FOR_WINDOW', windowId, repository },
  [port1]
);

// Send to renderer
webContents.postMessage('event-port', { repository }, [port2]);
```

### Event Messages (Utility → Renderer via port)

```typescript
interface EventMessage {
  type: 'AGENT_EVENT' | 'GIT_STATUS' | 'FILE_CHANGE';
  payload: unknown;
  timestamp: number;
}
```

---

## Migration Strategy

### Backward Compatibility

During migration, support both paths:

```typescript
// EventServerManager.ts
private handleProcessedEvent(event: RepoNormalizedUniversalAgentSessionEvent) {
  const repo = event.repository?.root;

  // New path: direct MessagePort
  if (this.hasDirectPort(repo)) {
    this.sendViaPort(repo, event);
    return;
  }

  // Legacy path: broadcast IPC
  this.broadcastToAllWindows(event);
}
```

### Feature Flag

```typescript
// settings or environment
const USE_DIRECT_PORTS = process.env.DIRECT_PORTS === 'true';
```

### Gradual Rollout

1. Implement for agent events first (most noisy)
2. Validate performance improvement
3. Extend to git status
4. Finally, terminal PTY (most complex)

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Console noise from filtered events | High | Zero |
| Main process CPU during agent activity | ~15% | <5% |
| Event delivery latency | ~5ms (IPC hop) | <1ms (direct) |
| Windows processing irrelevant events | All | None |

---

## References

- [Electron MessagePorts Tutorial](https://www.electronjs.org/docs/latest/tutorial/message-ports)
- [Electron utilityProcess API](https://www.electronjs.org/docs/latest/api/utility-process)
- [VS Code Issue #131798](https://github.com/microsoft/vscode/issues/131798) - Direct helper process to renderer communication
- `src/main/terminal/README.md` - Current terminal architecture
- `src/main/agent-session-events/EventServerManager.ts` - Current event server

---

## Open Questions

1. **Single utility process or multiple?**
   - One process for all event types (simpler lifecycle)
   - Separate processes per concern (better isolation)

2. **Port lifecycle management**
   - When to create/destroy ports
   - Handling window close/reload
   - Reconnection strategy

3. **Error handling**
   - What happens if utility process crashes?
   - Port disconnection detection
   - Automatic reconnection

4. **Debugging**
   - How to inspect MessagePort traffic
   - Logging without reintroducing overhead
