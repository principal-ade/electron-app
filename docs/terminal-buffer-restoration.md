# Terminal Buffer Restoration - Implementation Guide

## Overview

This document describes how to implement terminal scrollback buffer restoration when switching ownership between windows. When a user takes control of a terminal session from another window, the terminal should display the previous output history, not a blank screen.

## Current State

The electron-app **already has scrollback buffer storage** in the worker process:

- **Legacy Mode**: `session.scrollback: string[]` array in `worker-entry.ts`
- **Daemon Mode**: `ScrollbackBuffer` class in the PTY daemon

The buffer is **already replayed** when a port is registered with `isOwner=true` (see `worker-entry.ts:728-746`). However, the terminal-panel component needs a way to **pull** this buffer deterministically when it's ready.

## Architecture

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              RENDERER PROCESS                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  TabbedTerminalPanel (@industry-theme/xterm-terminal-panel)         │   │
│  │                                                                      │   │
│  │  handleReady() ─────────────────────────────────────────────────┐   │   │
│  │    │                                                             │   │   │
│  │    ├─ Fresh terminal: resize immediately (sync)                 │   │   │
│  │    │                                                             │   │   │
│  │    └─ Reconnection (shouldForce=true):                          │   │   │
│  │         │                                                        │   │   │
│  │         ├─ actions.getTerminalBuffer(sessionId)  ◄───────────────┤   │   │
│  │         │        │                                               │   │   │
│  │         │        ▼                                               │   │   │
│  │         │   terminalRef.write(buffer)                            │   │   │
│  │         │                                                        │   │   │
│  │         └─ actions.resizeTerminal(sessionId, cols, rows, false)  │   │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                            │                                                 │
│                            │ TIPC IPC                                       │
│                            ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  terminalClient.ts                                                   │   │
│  │    getTerminalBuffer({ sessionId }) ──────────────────────────────────┼───┘
│  └─────────────────────────────────────────────────────────────────────┘
│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ IPC (ipcRenderer.invoke)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MAIN PROCESS                                    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  terminalRouter.ts                                                   │   │
│  │                                                                      │   │
│  │  getTerminalBuffer: t.procedure                                      │   │
│  │    .input<{ sessionId: string }>()                                   │   │
│  │    .action(async ({ input }) => {                                    │   │
│  │      const buffer = await sessionManager.getScrollbackBuffer(...)    │   │
│  │      return { success: true, buffer }                                │   │
│  │    })                                                                │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                            │                                                 │
│                            ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  TerminalSessionManager.ts                                           │   │
│  │                                                                      │   │
│  │  async getScrollbackBuffer(sessionId: string): Promise<string|null>  │   │
│  │    │                                                                 │   │
│  │    ├─ Sends GET_SCROLLBACK message to worker                        │   │
│  │    │                                                                 │   │
│  │    └─ Waits for SCROLLBACK_RESPONSE                                 │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                            │                                                 │
│                            │ process.postMessage (MessagePort)              │
│                            ▼                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           UTILITY PROCESS (Worker)                           │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  worker-entry.ts                                                     │   │
│  │                                                                      │   │
│  │  Message Handler:                                                    │   │
│  │    case 'GET_SCROLLBACK':                                            │   │
│  │      const session = sessions.get(sessionId)                         │   │
│  │      const buffer = session.scrollback.join('')                      │   │
│  │      sendToMain({ type: 'SCROLLBACK_RESPONSE', sessionId, buffer })  │   │
│  │                                                                      │   │
│  │  ──────────────────────────────────────────────────────────────────  │   │
│  │                                                                      │   │
│  │  PTY Data Flow (existing):                                           │   │
│  │                                                                      │   │
│  │    ptyProcess.onData(data) ───┬──► session.scrollback.push(data)    │   │
│  │                               │                                      │   │
│  │                               └──► sendToRenderer(sessionId, data)   │   │
│  │                                          │                           │   │
│  │                                          ▼                           │   │
│  │                                    MessagePort                       │   │
│  │                                          │                           │   │
│  └──────────────────────────────────────────┼───────────────────────────┘   │
│                                             │                                │
└─────────────────────────────────────────────┼────────────────────────────────┘
                                              │
                     ┌────────────────────────┘
                     │
                     ▼
            ┌─────────────────┐
            │  PTY Process    │
            │  (node-pty)     │
            │                 │
            │  Shell (zsh)    │
            └─────────────────┘
```

### Sequence Diagram: Ownership Transfer with Buffer Restoration

```
Window A                    Main Process                 Worker              Window B
   │                             │                          │                    │
   │  [Creates terminal]         │                          │                    │
   │  ─────────────────────────► │                          │                    │
   │                             │  CREATE_SESSION          │                    │
   │                             │  ───────────────────────►│                    │
   │                             │                          │  [Spawns PTY]      │
   │                             │                          │                    │
   │                             │◄─ SESSION_CREATED ───────│                    │
   │                             │                          │                    │
   │  [User types, output flows] │                          │                    │
   │  ◄──────────────────────────┼──────────────────────────┤                    │
   │                             │                          │  [Stores in        │
   │                             │                          │   scrollback[]]    │
   │                             │                          │                    │
   ├─────────────────────────────┼──────────────────────────┼────────────────────┤
   │                             │                          │                    │
   │                             │                          │    [User clicks    │
   │                             │                          │    "Take Control"] │
   │                             │                          │                    │
   │                             │  claimTerminalOwnership  │                    │
   │                             │ ◄────────────────────────┼────────────────────│
   │                             │                          │                    │
   │  terminal:ownershipLost     │                          │                    │
   │ ◄───────────────────────────│                          │                    │
   │                             │                          │                    │
   │                             │  requestTerminalDataPort │                    │
   │                             │ ◄────────────────────────┼────────────────────│
   │                             │                          │                    │
   │                             │  REGISTER_PORT           │                    │
   │                             │  ───────────────────────►│                    │
   │                             │                          │                    │
   │                             │  terminal:port (port2)   │                    │
   │                             │  ────────────────────────┼───────────────────►│
   │                             │                          │                    │
   │                             │                          │    [Terminal       │
   │                             │                          │     mounts,        │
   │                             │                          │     onReady fires] │
   │                             │                          │                    │
   │                             │  getTerminalBuffer       │                    │
   │                             │ ◄────────────────────────┼────────────────────│
   │                             │                          │                    │
   │                             │  GET_SCROLLBACK          │                    │
   │                             │  ───────────────────────►│                    │
   │                             │                          │                    │
   │                             │                          │  [Joins scrollback │
   │                             │                          │   array]           │
   │                             │                          │                    │
   │                             │◄─ SCROLLBACK_RESPONSE ───│                    │
   │                             │                          │                    │
   │                             │  { buffer: "..." }       │                    │
   │                             │  ────────────────────────┼───────────────────►│
   │                             │                          │                    │
   │                             │                          │    [Writes buffer  │
   │                             │                          │     to xterm.js]   │
   │                             │                          │                    │
   │                             │                          │    [Terminal shows │
   │                             │                          │     full history]  │
```

## Implementation Steps

### Step 1: Upgrade terminal-panel to v0.5.28+

The `@industry-theme/xterm-terminal-panel` v0.5.28 includes `getTerminalBuffer` support in the `TerminalPanelActions` interface and calls it automatically in `handleReady` when taking control.

```bash
npm install @industry-theme/xterm-terminal-panel@0.5.28
```

**Reference:** `package.json`

### Step 2: Add Message Types to Worker

**File:** `src/terminal-worker/types.ts`

Add new message types:

```typescript
// Add to MainToWorkerMessage union (around line 45)
| { type: 'GET_SCROLLBACK'; sessionId: string; requestId: string }

// Add to WorkerToMainMessage union (around line 105)
| { type: 'SCROLLBACK_RESPONSE'; sessionId: string; requestId: string; buffer: string | null }
```

### Step 3: Handle GET_SCROLLBACK in Worker

**File:** `src/terminal-worker/worker-entry.ts`

Add handler in the message switch statement (around line 580):

```typescript
case 'GET_SCROLLBACK': {
  const { sessionId, requestId } = msg;
  const session = sessions.get(sessionId);

  let buffer: string | null = null;

  if (session) {
    if (useDaemonMode && daemonBridge) {
      // Daemon mode: request scrollback from daemon
      // The daemon will respond with a 'scrollback' message
      daemonBridge.send({ type: 'get-scrollback', id: sessionId });
      // For now, return empty - daemon scrollback needs async handling
      buffer = null;
    } else {
      // Legacy mode: join the scrollback array
      buffer = session.scrollback.join('');
    }
  }

  sendToMain({
    type: 'SCROLLBACK_RESPONSE',
    sessionId,
    requestId,
    buffer,
  });
  break;
}
```

**Existing scrollback storage:** Lines 430-442 (onData handler)
```typescript
ptyProcess.onData((data: string) => {
  session.lastActivity = Date.now();

  // Store in scrollback buffer (existing code)
  session.scrollback.push(data);
  if (session.scrollback.length > SCROLLBACK_MAX_CHUNKS) {
    session.scrollback = session.scrollback.slice(-SCROLLBACK_TRIM_TO);
  }

  sendToRenderer(sessionId, data);
});
```

### Step 4: Add getScrollbackBuffer to TerminalSessionManager

**File:** `src/main/terminal/TerminalSessionManager.ts`

Add method (around line 600):

```typescript
/**
 * Get the scrollback buffer for a session.
 * Used for buffer restoration when switching ownership.
 */
async getScrollbackBuffer(sessionId: string): Promise<string | null> {
  if (!this.sessions.has(sessionId)) {
    return null;
  }

  const requestId = `scrollback-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      this.pendingScrollbackRequests.delete(requestId);
      reject(new Error('Scrollback request timed out'));
    }, 5000);

    this.pendingScrollbackRequests.set(requestId, { resolve, reject, timeout });

    this.sendToWorker({
      type: 'GET_SCROLLBACK',
      sessionId,
      requestId,
    });
  });
}

// Add to class properties (around line 100):
private pendingScrollbackRequests = new Map<string, {
  resolve: (buffer: string | null) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}>();
```

Add handler in `handleWorkerMessage` (around line 340):

```typescript
case 'SCROLLBACK_RESPONSE': {
  const { requestId, buffer } = msg;
  const pending = this.pendingScrollbackRequests.get(requestId);
  if (pending) {
    clearTimeout(pending.timeout);
    this.pendingScrollbackRequests.delete(requestId);
    pending.resolve(buffer);
  }
  break;
}
```

### Step 5: Add getTerminalBuffer to TIPC Router

**File:** `src/main/terminal/tipc/terminalRouter.ts`

Add procedure (around line 200):

```typescript
getTerminalBuffer: t.procedure
  .input<{ sessionId: string }>()
  .action(async ({ input }) => {
    try {
      const buffer = await sessionManager.getScrollbackBuffer(input.sessionId);
      return {
        success: buffer !== null,
        buffer,
        size: buffer?.length ?? 0,
      };
    } catch (error) {
      console.error('[terminalRouter] getTerminalBuffer error:', error);
      return {
        success: false,
        buffer: null,
        size: 0,
      };
    }
  }),
```

### Step 6: Add to TIPC Router Types

**File:** `src/shared/tipc/terminalRouterTypes.ts`

Add to the router type definition:

```typescript
getTerminalBuffer: {
  input: { sessionId: string };
  output: { success: boolean; buffer: string | null; size: number };
};
```

### Step 7: Wire Up in Panel Actions

**File:** Where `TerminalPanelActions` is constructed (likely in a context or panel component)

Add the `getTerminalBuffer` action:

```typescript
const terminalActions: TerminalPanelActions = {
  // ... existing actions ...

  getTerminalBuffer: async (sessionId: string) => {
    const result = await terminalClient.getTerminalBuffer({ sessionId });
    return result.success ? result.buffer : null;
  },
};
```

## File Reference Summary

| File | Line(s) | Change Description |
|------|---------|-------------------|
| `package.json` | - | Upgrade `@industry-theme/xterm-terminal-panel` to `^0.5.28` |
| `src/terminal-worker/types.ts` | ~45, ~105 | Add `GET_SCROLLBACK` and `SCROLLBACK_RESPONSE` message types |
| `src/terminal-worker/worker-entry.ts` | ~580 | Add `GET_SCROLLBACK` case handler |
| `src/main/terminal/TerminalSessionManager.ts` | ~100, ~340, ~600 | Add `pendingScrollbackRequests`, handler, and `getScrollbackBuffer()` |
| `src/main/terminal/tipc/terminalRouter.ts` | ~200 | Add `getTerminalBuffer` procedure |
| `src/shared/tipc/terminalRouterTypes.ts` | - | Add type for `getTerminalBuffer` |
| Panel actions file | - | Wire `getTerminalBuffer` to TIPC client |

## Existing Code That Supports This

The worker **already stores scrollback** and **replays it on port registration**:

- **Storage:** `worker-entry.ts:430-442` - Appends to `session.scrollback[]` on every `onData`
- **Replay:** `worker-entry.ts:728-746` - Sends buffer when `registerPort(isOwner=true)` is called

The new `getTerminalBuffer` approach provides a **pull-based** mechanism that the terminal-panel can call when xterm.js is definitively ready, avoiding timing issues.

## Configuration

**Scrollback limits** (defined in `worker-entry.ts`):

```typescript
const SCROLLBACK_MAX_CHUNKS = 10_000;  // Max chunks before trimming
const SCROLLBACK_TRIM_TO = 5_000;      // Trim to this many chunks
```

**Daemon mode limits** (defined in `constants.ts`):

```typescript
export const SCROLLBACK_LINES = 10_000;     // Max lines
export const SCROLLBACK_MAX_BYTES = 10_000_000;  // 10MB max
```

## Testing

1. Open Window A, create a terminal, run some commands
2. Open Window B
3. In Window B, click "Take Control" on the terminal from Window A
4. Verify:
   - Window B shows full command history
   - No blank terminal
   - No duplicate output
   - No extra `%` characters (zsh prompt markers)

## Notes

- The daemon mode uses `ScrollbackBuffer` class which stores by lines, not chunks
- Daemon mode may need additional async handling for `get-scrollback` requests
- The existing push-based replay (`registerPort` with scrollback) can remain as a fallback
- The new pull-based `getTerminalBuffer` is deterministic and called when xterm is ready
