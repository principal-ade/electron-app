# Terminal MessagePort Migration

## Overview

This document tracks the migration from IPC-based terminal data streaming to MessagePort-based streaming for all terminal panel implementations.

## Background

Currently, terminal data flows differently between implementations:

| Implementation | Data Channel | Performance |
|---------------|--------------|-------------|
| `TerminalPanelPackaged` (desktop-app) | MessagePort (with IPC fallback) | High - bypasses per-chunk IPC |
| `GhosttyTerminal` (ghosty-integration) | Panel events API (`events.on('terminal:data')`) | Low - every chunk through IPC |
| `industry-themed-terminal-panel` | Panel events API | Low - every chunk through IPC |

## Goal

Deprecate the IPC path for terminal data entirely. All terminal panels should use MessagePorts for data streaming.

## Affected Packages

1. **`/Users/griever/Developer/desktop-app/electron-app`** - Host application (provides MessagePort infrastructure)
2. **`/Users/griever/Developer/ghosty-integration/industry-themed-ghostty-terminal-panel`** - Ghostty-based terminal panel
3. **`/Users/griever/Developer/ghosty-integration/industry-themed-terminal-panel`** - xterm-based terminal panel

## Implementation Plan

### Phase 1: Expose MessagePort Action in Host

**Status:** ✅ Complete

**Files modified:**
- `src/shared/main-process-api-interfaces/TerminalService.ts` - Added `REQUEST_DATA_PORT` event and `RequestDataPortResult` interface
- `src/main/terminal/handlers/ownershipHandlers.ts` - Added IPC handler for `terminal:requestDataPort`
- `src/window/main-process-api-implementations/terminalApi.ts` - Added `requestDataPort()` implementation
- `src/renderer/main-process-api/TerminalService.ts` - Added `requestDataPort()` and `onPortReady()` static methods
- `src/renderer/contexts/PanelContext.tsx` - Added `requestTerminalDataPort`, `onTerminalPortReady`, and ownership actions to `ExtendedPanelActions`

**New Actions Available to Panels:**
```typescript
interface ExtendedPanelActions {
  // ... existing actions ...

  /**
   * Request a MessagePort for receiving terminal data directly.
   * Returns { success: true } if the port will be delivered via onTerminalPortReady.
   */
  requestTerminalDataPort?: (sessionId: string) => Promise<{ success: boolean; reason?: string }>;

  /**
   * Register a callback to receive MessagePorts for terminal data streaming.
   * Call this before requestTerminalDataPort() to ensure you receive the port.
   */
  onTerminalPortReady?: (
    callback: (data: { sessionId: string; writable: boolean }, port: MessagePort) => void
  ) => () => void;

  // Ownership actions (also added)
  checkTerminalOwnership?: (sessionId: string) => Promise<OwnershipStatus>;
  claimTerminalOwnership?: (sessionId: string, force?: boolean) => Promise<OwnershipResult>;
  releaseTerminalOwnership?: (sessionId: string) => Promise<OwnershipResult>;
  refreshTerminal?: (sessionId: string) => Promise<boolean>;
}
```

### Phase 2: Update Ghostty Terminal Panel

**Status:** ✅ Complete

**Location:** `/Users/griever/Developer/ghosty-integration/industry-themed-ghostty-terminal-panel`

**Files modified:**
- `src/types/index.ts` - Added `TerminalActions`, `OwnershipStatus`, `OwnershipResult`, `RequestDataPortResult`, `PortReadyData` interfaces
- `src/panels/GhosttyTerminal.tsx` - Updated to use MessagePort with event fallback
- `src/panels/TabbedGhosttyTerminal.tsx` - Updated to use MessagePort with event fallback

**Key Changes:**
1. Added complete `TerminalActions` interface with MessagePort methods
2. Components set up `onTerminalPortReady` listener before requesting port
3. After claiming ownership, request MessagePort via `requestTerminalDataPort()`
4. HIGH-PERFORMANCE PATH: Listen on MessagePort for `{ type: 'DATA', data }` messages
5. FALLBACK PATH: If MessagePort not available, fall back to `events.on('terminal:data')`
6. Clean up MessagePort on ownership loss and unmount

### Phase 3: Update Industry-Themed Terminal Panel

**Status:** ✅ Complete

**Location:** `/Users/griever/Developer/ghosty-integration/industry-themed-terminal-panel`

**Files modified:**
- `src/types/index.ts` - Added `RequestDataPortResult`, `PortReadyData` interfaces
- `src/panels/TerminalPanel.tsx` - Updated to use MessagePort with 3-second timeout (no fallback)

**Host-side fix:**
- `src/renderer/contexts/RepositoryPanelContext.tsx` - Added `requestTerminalDataPort` and `onTerminalPortReady` action implementations (was missing, causing xterm panel to fail while ghostty worked)

### Phase 4: Deprecate Legacy IPC Path

**Status:** Not Started

**Files to modify:**
- `src/main/terminal/TerminalSessionManager.ts` - Remove `sendViaLegacyIPC()`
- `src/main/terminal/config.ts` - Remove `enableMessagePorts` flag (always enabled)
- `src/window/main-process-api-implementations/terminalApi.ts` - Remove IPC fallback in `onDataForSession()`

## Technical Details

### How MessagePorts Work in Electron

```
Main Process                          Renderer Process
─────────────────────────────────────────────────────────

PTY (node-pty)                        Terminal UI (xterm/ghostty)
   │                                       ▲
   └──onData()──────────────┐             │
                            │             │
                  MessageChannelMain      │
                   ├─ port1 (main side)   │
                   └─ port2 ────────────>─┘
                              transferred via
                              webContents.postMessage()
```

### Message Format

**PTY → Renderer (port1 to port2):**
```typescript
{ type: 'DATA', data: string }
```

**Renderer → PTY (port2 to port1):**
```typescript
{ type: 'WRITE', data: string }
{ type: 'RESIZE', cols: number, rows: number }
```

### Port Lifecycle

1. Panel creates/claims terminal session
2. Panel calls `requestTerminalDataPort(sessionId)`
3. Host creates `MessageChannelMain`
4. Host sends `PORT_READY` event with `port2` transferred
5. Panel receives port, calls `port.start()`, listens for messages
6. On session destroy/ownership loss, port is closed

## Migration Checklist

### Host (desktop-app)
- [x] Add `terminal:requestDataPort` IPC handler
- [x] Expose `requestTerminalDataPort` action to panels
- [x] Add `onTerminalPortReady` action to panels
- [x] Add ownership actions to panels (`checkTerminalOwnership`, `claimTerminalOwnership`, `releaseTerminalOwnership`, `refreshTerminal`)
- [ ] Test MessagePort creation for panel-initiated requests
- [x] Update documentation

### Ghostty Terminal Panel
- [x] Add `requestTerminalDataPort` to TerminalActions interface
- [x] Add `onTerminalPortReady` to TerminalActions interface
- [x] Implement MessagePort request after ownership claim
- [x] Add MessagePort listener for terminal data (HIGH-PERFORMANCE PATH)
- [x] Keep `events.on('terminal:data')` as fallback (FALLBACK PATH)
- [ ] Test data streaming performance
- [x] Update types (`OwnershipStatus`, `OwnershipResult`, `RequestDataPortResult`, `PortReadyData`)

### Industry-Themed Terminal Panel
- [x] Add `requestTerminalDataPort` to TerminalPanelActions interface
- [x] Implement MessagePort request after ownership claim
- [x] Add MessagePort listener for terminal data (HIGH-PERFORMANCE PATH)
- [x] Remove `events.on('terminal:data')` fallback (fail fast with 3s timeout)
- [ ] Test data streaming performance
- [x] Update types (`RequestDataPortResult`, `PortReadyData`)

### Host (RepositoryPanelContext.tsx)
- [x] Add `requestTerminalDataPort` action implementation
- [x] Add `onTerminalPortReady` action implementation

### Cleanup (after all panels migrated)
- [ ] Remove `sendViaLegacyIPC()` from TerminalSessionManager
- [ ] Remove `enableMessagePorts` config flag
- [ ] Remove IPC fallback from `onDataForSession()`
- [ ] Remove `terminal:data` event emission entirely
- [ ] Update all documentation

## Testing

### Performance Verification
- Run `cat /dev/urandom | base64 | head -c 1000000` to generate high-throughput output
- Verify no dropped frames or lag in terminal rendering
- Compare CPU usage between IPC and MessagePort paths

### Functionality Verification
- Terminal output displays correctly
- User input works
- Resize events propagate
- Ownership transfer works (port cleanup/recreation)
- Multiple terminals work simultaneously

## References

- Electron MessageChannelMain docs: https://www.electronjs.org/docs/latest/api/message-channel-main
- Current MessagePort implementation: `src/main/terminal/TerminalSessionManager.ts:408-452`
- Current renderer API: `src/window/main-process-api-implementations/terminalApi.ts:93-131`
