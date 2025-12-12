# Terminal Architecture

## Overview

The terminal system provides PTY (pseudoterminal) support with a modular, MessagePort-based architecture for efficient data streaming.

## Current Implementation: Phase 1 (MessagePorts in Main Process)

### Status: ✅ Complete and Working

Phase 1 implements MessageChannel-based data streaming while keeping PTY processes in the main process. This provides the primary performance benefit (bypassing per-chunk IPC) while maintaining simplicity.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Main Process                            │
│                                                             │
│  ┌──────────────┐         ┌─────────────────┐              │
│  │ PTY Process  │────────>│ MessageChannel  │              │
│  │  (node-pty)  │  onData │   port1 | port2 │              │
│  └──────────────┘         └─────────┬───────┘              │
│         ▲                            │                       │
│         │                            │                       │
│         │                            │ postMessage          │
│         │ write/resize               │ (port2 transferred)  │
│         │                            │                       │
│         │                            ▼                       │
└─────────┼────────────────────────────────────────────────────┘
          │                            │
          │◄───────────────────────────┘
          │
┌─────────┼────────────────────────────────────────────────────┐
│         │                 Renderer Process                   │
│         │                                                    │
│  ┌──────┴──────┐         ┌──────────────┐                   │
│  │ port2       │────────>│  xterm.js    │                   │
│  │ on('message')         │   Terminal   │                   │
│  └─────────────┘         └──────────────┘                   │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow

**PTY Output (Main → Renderer):**
1. PTY emits data via `onData` event
2. Main: `port1.postMessage({ type: 'DATA', data })`
3. Renderer: `port2.on('message')` receives data
4. xterm.js displays the data

**User Input (Renderer → Main):**
1. User types in xterm.js
2. Renderer: `port2.postMessage({ type: 'WRITE', data })`
3. Main: `port1.on('message')` receives command
4. Main: `pty.write(data)`

### Benefits

✅ **Performance**
- Eliminates per-chunk IPC overhead
- Main process only handles setup, not every data packet
- Direct MessageChannel communication

✅ **Compatibility**
- Works with all existing terminal features
- Automatic fallback to legacy IPC if needed
- No renderer code changes required

✅ **Simplicity**
- PTY stays in main process (easier debugging)
- No worker process management overhead
- Straightforward error handling

## Directory Structure

```
src/main/terminal/
├── index.ts                      # Main TerminalManager (coordinator)
├── types.ts                      # Shared TypeScript interfaces
├── TerminalSessionManager.ts     # Session lifecycle & MessageChannels
├── TerminalOwnershipManager.ts   # Ownership and viewer tracking
├── sessionManagerSingleton.ts    # Singleton for shared state with TIPC
├── handlers/                     # IPC handler modules
│   ├── sessionHandlers.ts        # create/getOrCreate/destroy
│   ├── ownershipHandlers.ts      # claim/release/check
│   └── commandHandlers.ts        # write/resize/refresh
├── tipc/                         # TIPC router for type-safe RPC
│   └── terminalRouter.ts         # Terminal TIPC procedures
├── utils/
│   └── ptyLoader.ts              # Dynamic node-pty loading
└── phase2-future/                # Phase 2 foundation (deferred)
    └── worker/                   # Worker process implementation
        ├── ptyWorker.ts          # Worker process skeleton
        ├── WorkerManager.ts      # Worker lifecycle management
        └── types.ts              # Worker message types
```

## Key Components

### TerminalManager (`index.ts`)
Main coordinator that:
- Initializes all sub-managers
- Sets up IPC handlers
- Provides public API for other services
- Manages overall lifecycle

### TerminalSessionManager
Handles:
- PTY process creation and lifecycle
- MessageChannel creation and management
- Data streaming (MessagePort or legacy IPC)
- Session cleanup and destruction

**Key Methods:**
- `createSession()` - Spawns PTY and creates MessageChannel
- `createMessageChannelForSession()` - Sets up port1/port2
- `sendToActiveViewers()` - Streams data (via port or IPC)
- `handlePortMessage()` - Processes renderer commands

### TerminalOwnershipManager
Manages:
- Single-writer ownership semantics
- Window ownership tracking
- Ownership transfers
- Viewer management

### TIPC Router (`tipc/terminalRouter.ts`)
Type-safe RPC for terminal operations:
- Session management (create, destroy, list)
- Ownership management (check, claim, release)
- Data port management (request MessagePort for streaming)
- Follows the terminal-testing-app pattern for reconnection

## Usage

### Monitoring

Console logs indicate which path is active:

**MessagePort mode:**
```
[Terminal] Created MessageChannel for session <id>
[Terminal] Transferred port2 to window <id>
[TerminalAPI] Received MessagePort for session <id>
[TerminalAPI] Using existing MessagePort for session <id>
```

**Legacy IPC mode:**
```
[TerminalAPI] Using legacy IPC for session <id>
```

## Future: Phase 2 (Worker Process)

### Status: 📋 Planned (Foundation in `worker/` directory)

Phase 2 would move PTY processes to Electron's `utilityProcess` for true process isolation.

### Benefits
- PTY crashes don't affect main process
- Better CPU distribution across cores
- Improved main process responsiveness
- Crash isolation and recovery

### Challenges
- Cannot transfer MessagePorts to utilityProcess
- Requires data proxy: PTY → worker → main → MessagePort → renderer
- Adds complexity and another hop in data path
- More complex error handling and recovery

### Architecture Sketch
```
Utility Process         Main Process              Renderer
     │                       │                        │
     │←─create session───────│                        │
     │─spawn PTY             │                        │
     │──data─────────────────>│                       │
     │                       │──forward via port──────>│
```

### Decision
Phase 2 is **deferred** because:
1. Phase 1 provides the main performance benefit (no per-chunk IPC)
2. Added complexity doesn't justify incremental gains
3. PTY in main process is more debuggable
4. Can be revisited if process isolation becomes critical

Foundation code is preserved in `phase2-future/worker/` for future implementation.

## Testing

### Manual Testing
1. Open terminal in the app
2. Verify shell prompt appears
3. Type commands and verify output
4. Check console for MessagePort logs

### Verification
```bash
# Should see these logs:
[Terminal] Created MessageChannel for session <id>
[TerminalAPI] Using existing MessagePort for session <id>
```

### Performance Testing
Compare terminal responsiveness with MessagePorts enabled vs disabled:
- High-frequency output (npm install, build logs)
- Multiple concurrent terminals
- Large output streams

## Troubleshooting

### Terminal shows cursor but no output
- Check for `[TerminalAPI] Using existing MessagePort` message
- Verify MessagePort is being received
- Check browser console for errors

### Falls back to legacy IPC unexpectedly
- Check `enableMessagePorts` flag is true
- Look for MessageChannel creation errors
- Verify port transfer succeeded

### Data not flowing
- Ensure port.start() was called
- Check message format: `{ type: 'DATA', data: '...' }`
- Verify event listeners are attached

## Related Documentation

- [Terminal MessagePort Mode](../../../docs/TERMINAL_MESSAGEPORT_MODE.md) - User guide
- [Terminal MessagePort Design](../../../docs/terminal-message-port-design.md) - Original proposal
- [Panel Architecture](../../../docs/PANEL_ARCHITECTURE.md) - Overall panel design

## Migration History

1. **Refactoring** (dc60ed305) - Split monolithic terminal.ts into modules
2. **Foundation** (5496d2b7c) - Added MessagePort infrastructure
3. **Phase 1 Main** (3adfc8909) - Implemented MessageChannels in main process
4. **Renderer Support** (02e2093e2) - Added renderer-side MessagePort handling
5. **Enabled by Default** (c67afa24f) - Activated MessagePorts for testing
6. **Timing Fix** (310a8840c) - Fixed PORT_READY event timing with global registry

## Performance Optimizations

### Implemented ✅

**1. WebGL Renderer (`@industry-theme/xterm-terminal-panel@0.1.6`)**
- Uses `@xterm/addon-webgl` for GPU-accelerated rendering
- Falls back to canvas renderer if WebGL unavailable
- Handles WebGL context loss gracefully
- Significantly faster for high-throughput terminal output

**2. Debounced Scroll-to-Bottom (`@industry-theme/xterm-terminal-panel@0.1.6`)**
- Changed from immediate scroll on every write to 1-second debounce
- Only scrolls after writes stop for 1 second
- Reduces layout thrashing during rapid output
- Constant: `SCROLL_DEBOUNCE_MS = 1000`

### Future Optimizations 📋

**3. Write Batching in Preload (High Impact)**

Currently, each MessagePort message immediately dispatches to all subscribers:

```typescript
// Current: preload.ts
port.onmessage = (e: MessageEvent) => {
  if (e.data?.type === 'DATA') {
    subscribers.forEach((cb) => cb(e.data.data));  // Immediate dispatch
  }
};
```

**Proposed:** Buffer incoming data and flush on `requestAnimationFrame`:

```typescript
// Proposed: preload.ts
const pendingData = new Map<string, string[]>();
let rafScheduled = false;

function flushPendingData() {
  rafScheduled = false;
  for (const [sessionId, chunks] of pendingData) {
    const subscribers = terminalSubscribers.get(sessionId);
    if (subscribers && chunks.length > 0) {
      const batch = chunks.join('');
      subscribers.forEach((cb) => cb(batch));
    }
  }
  pendingData.clear();
}

port.onmessage = (e: MessageEvent) => {
  if (e.data?.type === 'DATA') {
    if (!pendingData.has(sessionId)) {
      pendingData.set(sessionId, []);
    }
    pendingData.get(sessionId)!.push(e.data.data);

    if (!rafScheduled) {
      rafScheduled = true;
      requestAnimationFrame(flushPendingData);
    }
  }
};
```

**Benefits:**
- Reduces write frequency to ~60/sec max (matches display refresh)
- Batches rapid small chunks into single larger writes
- xterm.js handles larger batches more efficiently

**Location:** `src/window/preload.ts` (lines 262-273)

---

**4. Main Process Batching (Lower Priority)**

Buffer data in `TerminalSessionManager.sendToOwner()` before posting to MessagePort:

```typescript
// Proposed: TerminalSessionManager.ts
private pendingOutputs = new Map<string, string[]>();
private flushScheduled = false;

private sendToOwner(sessionId: string, data: string): void {
  if (!this.pendingOutputs.has(sessionId)) {
    this.pendingOutputs.set(sessionId, []);
  }
  this.pendingOutputs.get(sessionId)!.push(data);

  if (!this.flushScheduled) {
    this.flushScheduled = true;
    setImmediate(() => this.flushOutputs());
  }
}

private flushOutputs(): void {
  this.flushScheduled = false;
  for (const [sessionId, chunks] of this.pendingOutputs) {
    const batch = chunks.join('');
    // ... send via MessagePort
  }
  this.pendingOutputs.clear();
}
```

**Benefits:**
- Reduces MessagePort message frequency
- Batches PTY output bursts (common with build output)

**Trade-off:** Adds slight latency (~1ms) for interactive typing

**Location:** `src/main/terminal/TerminalSessionManager.ts` (lines 61-94)

---

**5. Reduce Subscriber Iteration Overhead (Minor)**

Current subscriber pattern uses `forEach` on every message:

```typescript
subscribers.forEach((cb) => cb(e.data.data));
```

For single-subscriber case (most common), direct call is faster:

```typescript
if (subscribers.size === 1) {
  subscribers.values().next().value(e.data.data);
} else {
  subscribers.forEach((cb) => cb(e.data.data));
}
```

**Impact:** Minor - only matters at very high message rates

---

### Performance Testing

To measure impact of optimizations:

```bash
# High-frequency output test
yes "test output line" | head -10000

# Build output test
npm install  # or large build

# Continuous output
tail -f /var/log/system.log
```

Monitor:
- CPU usage in Activity Monitor
- Frame rate in DevTools Performance tab
- Console for `[ThemedTerminal] WebGL renderer enabled`

### Priority Order

1. ✅ WebGL addon - GPU acceleration (DONE)
2. ✅ Debounce scrollToBottom - Layout thrashing (DONE)
3. 📋 Write batching in preload - Biggest remaining gain
4. 📋 Main process batching - Diminishing returns
5. 📋 Subscriber optimization - Micro-optimization
