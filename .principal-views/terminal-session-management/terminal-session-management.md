# Terminal Session Management Architecture

## Overview

This architecture documents the lifecycle management of terminal sessions in the Electron application. The `TerminalSessionManager` is the central authority for all terminal state, including session creation, destruction, ownership, port management, and activity tracking.

## Problem Statement

Terminal sessions need to be:

1. Created with proper PTY processes in a utility worker
2. Tracked centrally for cross-window visibility
3. Owned by specific windows (with transfer capability)
4. Connected via MessagePorts for efficient data streaming
5. Cleaned up properly when destroyed (including activity state)

## Architecture Decision

**Approach: Centralized Session Manager with Utility Process Worker**

The `TerminalSessionManager` maintains minimal state in the main process while delegating PTY operations to a utility process worker. This provides:

- Process isolation (PTY crashes don't affect main process)
- Efficient data streaming via MessagePorts (bypasses main process)
- Central tracking of all sessions, ownership, and activity
- Clean lifecycle management with automatic cleanup

## Data Structures

### Session Store
```typescript
// Primary session tracking
private sessions: Map<string, TerminalSession> = new Map();

// Secondary index by repository
private sessionsByRepo: Map<string, string> = new Map(); // "repoPath:context" -> sessionId

// Activity tracking (which terminals have agents working)
private activityStore: Map<string, TerminalActivityState> = new Map();

// MessagePort tracking
private sessionPorts: Map<string, Map<number, MessageChannelMain>> = new Map();
```

### TerminalSession Shape
```typescript
interface TerminalSession {
  id: string;
  pty: null;                    // PTY lives in worker
  directory: string;
  context?: string;
  createdAt: number;
  lastActivity: number;
  repoPath?: string;
  repoId?: string;              // "owner/repo" format
  owner: TerminalOwner | null;
  remoteAttachments: Set<string>;
  metadata?: TerminalSessionMetadata;
}
```

## Data Flow

### Session Creation
```
Renderer (TIPC Client)
         │
         ▼
terminalRouter.createTerminalSession()
         │
         ▼
sessionManager.createSession()
         │
    ┌────┴────┐
    ▼         ▼
sessions.set()  worker.postMessage(CREATE_SESSION)
    │                    │
    │                    ▼
    │         Utility Process creates PTY
    │                    │
    │                    ▼
    │         worker.postMessage(SESSION_CREATED)
    │                    │
    ▼                    ▼
createMessageChannelForSession()
         │
    ┌────┴────┐
    ▼         ▼
port1 → Worker    port2 → Renderer
```

### Session Destruction
```
destroySession(sessionId)
         │
         ▼
worker.postMessage(DESTROY_SESSION)
         │
         ▼
cleanupSession()
    │
    ├── closeAllPortsForSession()
    ├── ownershipManager.removeSession()
    ├── sessions.delete()
    ├── activityStore.delete()  ← Prevents ghost entries
    └── sessionsByRepo cleanup
```

## Key Components

### TerminalSessionManager
- `src/main/terminal/TerminalSessionManager.ts`
- Central authority for session state
- Manages utility worker communication
- Handles MessagePort creation and cleanup

### TerminalOwnershipManager
- `src/main/terminal/TerminalOwnershipManager.ts`
- Tracks which window owns each session
- Handles ownership claims and transfers

### Terminal Worker
- `src/terminal-worker/`
- Utility process that runs PTY instances
- Communicates via postMessage and MessagePorts

### TIPC Router
- `src/main/terminal/tipc/terminalRouter.ts`
- Type-safe RPC interface for renderers
- Delegates to sessionManager and ownershipManager

## Session Limits

- **Maximum sessions**: 20 (configurable via `maxSessions`)
- Enforced in `canCreateSession()` before creation

## Related Architecture

- **Terminal Activity Tracking**: See `.principal-views/terminal-activity-tracking/` for agent working state propagation
- Activity store is now integrated into TerminalSessionManager for proper lifecycle management

## Key Files

**Main Process:**
- `src/main/terminal/TerminalSessionManager.ts` - Central session management
- `src/main/terminal/TerminalOwnershipManager.ts` - Ownership tracking
- `src/main/terminal/tipc/terminalRouter.ts` - TIPC procedures
- `src/main/terminal/sessionManagerSingleton.ts` - Singleton access

**Worker:**
- `src/terminal-worker/index.ts` - Utility process entry
- `src/terminal-worker/types.ts` - Message types

**Shared:**
- `src/shared/tipc/terminalRouterTypes.ts` - Shared type definitions
