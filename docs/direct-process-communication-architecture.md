# Direct Process Communication Architecture

## Overview

This document describes the architecture for direct MessagePort communication between utility processes and renderers, bypassing the main process for high-frequency data streams.

## Implementation Status

| Phase | Component | Status |
|-------|-----------|--------|
| Phase 1 | Agent Events | ✅ Complete |
| Phase 2 | Terminal PTY | ✅ Complete |
| Phase 3 | Git & File Events | ✅ Already Optimized (no changes needed) |

---

## Phase 1: Agent Events (Complete)

### Problem Solved

Previously, agent events were broadcast to all windows via IPC, causing:
- Main thread contention from serialization on every event
- Unnecessary processing in windows that didn't care about the event
- Console noise from filtered events

### Solution

Direct MessagePort communication from utility process to renderer:

```
┌──────────────────┐                      ┌─────────────────┐
│ Utility Process  │◄────MessagePort─────►│    Renderer     │
│  (EventServer)   │     (direct!)        │  (repo: foo)    │
└──────────────────┘                      └─────────────────┘
         │                                        │
    Events filtered at source              Only foo events
    by repository                          reach this window
```

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Utility Process                           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ worker-entry.ts                                         │ │
│  │                                                         │ │
│  │ registeredPorts: Map<repository, Map<windowId, port>>   │ │
│  │                                                         │ │
│  │ sendEventToPorts(repository, event) {                   │ │
│  │   ports.get(repository)?.forEach(p => p.postMessage())  │ │
│  │ }                                                       │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ HttpEventServer.ts                                      │ │
│  │                                                         │ │
│  │ processAgentEvent() {                                   │ │
│  │   // Process through pipeline                           │ │
│  │   // Send directly to ports for this repo               │ │
│  │   sendEventToPorts(event.repository.root, event)        │ │
│  │   // Also send to main for observability/caching        │ │
│  │ }                                                       │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
         ▲                              ▲
         │ port1                        │ port1
         │ (per window+repo)            │
    ┌────┴──────────────────────────────┴────┐
    │            Main Process                 │
    │  EventServerManager.ts                  │
    │                                         │
    │  registerPortForWindow(windowId, repo) {│
    │    const {port1, port2} = new Channel() │
    │    worker.postMessage({...}, [port1])   │
    │    webContents.postMessage({...},[port2])│
    │  }                                      │
    └────┬──────────────────────────────┬────┘
         │ port2                        │ port2
         ▼                              ▼
┌─────────────────┐            ┌─────────────────┐
│   Renderer A    │            │   Renderer B    │
│   (repo: foo)   │            │   (repo: bar)   │
│                 │            │                 │
│ agentSessionSDK │            │ agentSessionSDK │
│ Api.ts stores   │            │ Api.ts stores   │
│ port, dispatches│            │ port, dispatches│
│ to subscribers  │            │ to subscribers  │
└─────────────────┘            └─────────────────┘
```

### Registration Flow

1. **Renderer mounts** `AgentHighlightProvider` with a `repositoryPath`
2. **Renderer calls** `AgentSessionSDKService.registerEventPort(repositoryPath)`
3. **Main process** receives IPC, creates `MessageChannelMain`
4. **Main process** transfers `port1` to utility process with repo info
5. **Main process** transfers `port2` to renderer
6. **Utility process** stores port in `registeredPorts` map
7. **Renderer** stores port, sets up `onmessage` handler
8. **Events flow directly** from utility process to renderer

### Files Modified

**Types:**
- `src/event-processing-server/types.ts` - `RegisterPortMessage`, `UnregisterPortMessage`
- `src/shared/main-process-api-interfaces/AgentSessionSDKAPI.ts` - New IPC events and API methods

**Main Process:**
- `src/main/agent-session-events/EventServerManager.ts` - Port registration handlers, removed IPC broadcast

**Utility Process:**
- `src/event-processing-server/worker-entry.ts` - Port management, `sendEventToPorts()`
- `src/event-processing-server/HttpEventServer.ts` - Calls `sendEventToPorts()` on event

**Preload:**
- `src/window/main-process-api-implementations/agentSessionSDKApi.ts` - MessagePort handling

**Renderer:**
- `src/renderer/main-process-api/AgentSessionSDKService.ts` - New static methods
- `src/renderer/contexts/AgentHighlightContext.tsx` - Registers port on mount
- `src/renderer/services/EventHighlightService.ts` - Removed filtering (now at source)

### API

```typescript
// Register for events from a repository
await AgentSessionSDKService.registerEventPort(repositoryPath);

// Subscribe to events (after registration)
const unsubscribe = AgentSessionSDKService.subscribeToRepositoryEvents(
  repositoryPath,
  (event) => { /* handle event */ }
);

// Cleanup
unsubscribe();
await AgentSessionSDKService.unregisterEventPort(repositoryPath);
```

---

## Phase 2: Terminal PTY (Complete)

### Problem Solved

Previously, PTY operations ran in the main process, causing:
- PTY hangs/crashes could block main process
- CPU contention from PTY data processing on main thread
- Risk of main process instability from shell process issues

### Solution

Utility process handles all PTY operations, with direct MessagePort to renderer:

```
┌──────────────────┐                      ┌─────────────────┐
│ Utility Process  │◄────MessagePort─────►│    Renderer     │
│  (TerminalWorker)│     (direct!)        │    (xterm.js)   │
└──────────────────┘                      └─────────────────┘
         │                                        │
    node-pty runs here                   Terminal data flows
    (spawn, write, resize)               directly to/from UI
```

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Utility Process                           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ terminal-worker/worker-entry.ts                         │ │
│  │                                                         │ │
│  │ sessions: Map<sessionId, {pty, ownerWindowId, ...}>     │ │
│  │ sessionPorts: Map<sessionId, Map<windowId, port>>       │ │
│  │                                                         │ │
│  │ createSession() - spawns node-pty process               │ │
│  │ pty.onData() -> port.postMessage({type: 'DATA'})        │ │
│  │ port.onmessage({type: 'WRITE'}) -> pty.write()          │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
         ▲                              ▲
         │ port1                        │ messages (CREATE, etc)
         │ (per session+window)         │
    ┌────┴──────────────────────────────┴────┐
    │            Main Process                 │
    │  TerminalSessionManager.ts              │
    │                                         │
    │  - Spawns utility process on init       │
    │  - Minimal session state (tracking)     │
    │  - Brokers MessagePort connections      │
    │  - Forwards session operations          │
    └────┬──────────────────────────────┬────┘
         │ port2                        │ IPC (create, destroy)
         ▼                              ▼
┌─────────────────┐            ┌─────────────────┐
│   Renderer A    │            │   Renderer B    │
│   (owner)       │            │   (viewer)      │
│                 │            │                 │
│ preload stores  │            │ preload stores  │
│ port, routes    │            │ port, routes    │
│ data to xterm   │            │ data to xterm   │
└─────────────────┘            └─────────────────┘
```

### Session Lifecycle

1. **Renderer requests session** via IPC (`terminal:getOrCreate`)
2. **Main process** generates sessionId, forwards `CREATE_SESSION` to worker
3. **Worker** spawns node-pty process, stores session state
4. **Worker** sends `SESSION_CREATED` message back to main
5. **Main process** resolves promise, returns sessionId to renderer
6. **Renderer requests port** via IPC (`terminal:claimOwnership` or `requestDataPort`)
7. **Main process** creates `MessageChannelMain`, transfers ports
8. **PTY data flows directly** from worker to renderer via MessagePort

### Message Types

**Main → Worker:**
- `CREATE_SESSION` - Spawn new PTY
- `DESTROY_SESSION` - Kill PTY
- `WRITE` - Write data to PTY (fallback when no port)
- `RESIZE` - Resize PTY
- `REFRESH` - Send Ctrl+L
- `REGISTER_PORT` - Register MessagePort for session+window
- `UNREGISTER_PORT` - Clean up port
- `SET_OWNER` - Change data owner window

**Worker → Main:**
- `READY` - Worker initialized
- `SESSION_CREATED` - PTY spawned (success/failure)
- `SESSION_EXIT` - PTY exited
- `SESSION_ERROR` - Error in session
- `WORKER_ERROR` - Worker-level error

**Port Messages (Worker ↔ Renderer):**
- `DATA` (worker→renderer) - PTY output
- `WRITE` (renderer→worker) - User input
- `RESIZE` (renderer→worker) - Terminal resize

### Files Created/Modified

**New Files:**
- `src/terminal-worker/types.ts` - Message type definitions
- `src/terminal-worker/worker-entry.ts` - Utility process entry point

**Modified Files:**
- `src/main/terminal/TerminalSessionManager.ts` - Refactored to delegate to worker
- `.erb/configs/webpack.config.main.dev.ts` - Added terminal-worker entry
- `.erb/configs/webpack.config.main.prod.ts` - Added terminal-worker entry
- `tsconfig.main.json` - Added terminal-worker to includes

### Benefits Achieved

| Metric | Before | After |
|--------|--------|-------|
| PTY crash risk to main | High | Isolated |
| Main thread CPU from PTY | Moderate | Zero |
| Data transfer hops | 2 (main→render) | 0 (direct) |
| PTY operation blocking main | Yes | No |

---

## Phase 3: Git & File Events (Not Needed)

**Status:** ✅ Already Optimized

Upon investigation, the git/file watching system already has intelligent event routing:

### Current Architecture

The `RepositoryMonitoringManager` already routes events only to windows associated with specific repositories:

```typescript
// From repository-monitoring/ipcHandlers.ts
manager.on('event', (event) => {
  // Find window(s) that own this repository
  // Only send to relevant windows, not broadcast
});
```

The monitoring server uses `chokidar` for file watching and sends events through a controlled pipeline that:
1. Associates file watchers with specific repository paths
2. Maintains a mapping of windows to their monitored repositories
3. Only notifies windows that have registered interest in a repository

### Why MessagePorts Aren't Needed Here

Unlike the agent events system (which previously broadcast to all windows) or terminal PTY (which had crash isolation concerns), the git/file monitoring:

- **Already routes to specific windows** - No broadcast-to-all problem
- **Has low event frequency** - File change events are relatively infrequent compared to terminal data
- **Runs in a separate process** - Uses `@principal-ai/repository-monitoring-server`

### Conclusion

The original assumption that git/file events had a "broadcast to all windows" problem was incorrect. The existing architecture already handles targeted delivery efficiently.

---

## Key Insights

### MessagePort Transfer Pattern

```typescript
// Main process creates channel
const { port1, port2 } = new MessageChannelMain();

// Transfer port1 to utility process
utilityProcess.postMessage(
  { type: 'REGISTER_PORT', windowId, repository },
  [port1]  // Transfer list
);

// Transfer port2 to renderer
webContents.postMessage(
  'event-port-ready',
  { repository },
  [port2]  // Transfer list
);

// Now utility process and renderer communicate directly!
```

### Benefits Achieved

| Metric | Before | After |
|--------|--------|-------|
| Console noise from filtered events | High | Zero |
| Main process involvement in event delivery | Every event | Setup only |
| Windows processing irrelevant events | All | None |
| IPC hops per event | 2 (utility→main→renderer) | 0 (direct) |

---

## References

- [Electron MessagePorts Tutorial](https://www.electronjs.org/docs/latest/tutorial/message-ports)
- [Electron utilityProcess API](https://www.electronjs.org/docs/latest/api/utility-process)
- [VS Code Issue #131798](https://github.com/microsoft/vscode/issues/131798) - Direct helper process to renderer communication
