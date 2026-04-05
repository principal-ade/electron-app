# Git Sync Feature

## Overview

Git Sync is a real-time Git synchronization and collaboration feature that enables turn-based editing across multiple users working on the same repository. It uses WebSocket connections to a traffic controller server for coordinating locks, presence, and sync events.

## Architecture

### Process Boundary

```
┌─────────────────────────────────────────────────────────────────┐
│                     Renderer Process                             │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │ GitSyncPanelContext │───▶│ GitSyncConnectionManager        │ │
│  │ (React State)       │    │ (Singleton, Proxy Client)       │ │
│  └─────────────────────┘    └──────────────┬──────────────────┘ │
└────────────────────────────────────────────┼────────────────────┘
                                             │ IPC
┌────────────────────────────────────────────┼────────────────────┐
│                      Main Process          │                     │
│                       ┌────────────────────▼──────────────────┐ │
│                       │ GitSyncWebSocketManager               │ │
│                       │ (Singleton, Control Tower Core)       │ │
│                       └────────────────────┬──────────────────┘ │
└────────────────────────────────────────────┼────────────────────┘
                                             │ WebSocket
                               ┌─────────────▼─────────────┐
                               │    Traffic Controller     │
                               │ (Repository Presence)     │
                               └───────────────────────────┘
```

### Key Components

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `GitSyncConnectionManager` | `src/renderer/services/git-sync/` | Singleton managing renderer-side connections via IPC proxy |
| `GitSyncClient` | `src/renderer/services/git-sync/` | WebSocket client abstraction (works in proxy mode) |
| `GitSyncWebSocketManager` | `src/main/services/` | Main process WebSocket management using Control Tower Core |
| `GitSyncPanelContext` | `src/renderer/contexts/` | React context providing state to git-sync panels |

## Authentication Flow

1. **CLI Auth Check**: `GitSyncConnectionManager` checks existing CLI authentication state
2. **Room Token Request**: Main process requests room-specific JWT from OAuth server
3. **WebSocket Connect**: Establishes connection to traffic controller
4. **Authentication Message**: Sends JWT token to server for validation
5. **Room Join**: Joins the repository room for presence tracking

```
Renderer                    Main Process                OAuth Server          Traffic Controller
   │                            │                           │                        │
   │──initializeAuth()─────────▶│                           │                        │
   │                            │                           │                        │
   │──getConnection()──────────▶│                           │                        │
   │                            │──POST /api/auth/cli/room-token──▶                  │
   │                            │◀──────JWT Token────────────│                        │
   │                            │                           │                        │
   │                            │───────WebSocket Connect────────────────────────────▶
   │                            │◀──────connected────────────────────────────────────│
   │                            │                           │                        │
   │                            │───────{ type: 'authenticate', token }──────────────▶
   │                            │◀──────auth_success─────────────────────────────────│
   │                            │                           │                        │
   │                            │───────joinRoom(repoId)─────────────────────────────▶
   │                            │◀──────room_joined──────────────────────────────────│
   │◀─────connected─────────────│                           │                        │
```

## Turn-Based Locking

The core collaboration mechanism is turn-based locking, which ensures conflict-free editing:

### Lock Types

| Type | Description |
|------|-------------|
| `file` | Lock on a specific file path |
| `directory` | Lock on a directory (recursive) |

### Lock Lifecycle

1. **Request**: User requests exclusive lock on a resource
2. **Acquire**: Server grants lock if available (5-minute default duration)
3. **Hold**: User can edit while holding the lock
4. **Release**: User releases lock or it auto-expires
5. **Notify**: Other peers are notified of lock changes

### Cross-Branch Warnings

The system detects and warns about potential conflicts:

| Warning Type | Severity | Description |
|--------------|----------|-------------|
| `same_file_different_branch` | warning | Same file locked on different branches |
| `merge_conflict_potential` | warning | Changes may conflict on merge |
| `branch_divergence` | info | Branches have diverged significantly |

## Sync Events

Real-time events broadcast to all peers in a room:

| Event | Description |
|-------|-------------|
| `file_change` | File was created, modified, or deleted |
| `commit` | New commit was pushed |
| `lock_acquired` | Peer acquired a lock |
| `lock_released` | Peer released a lock |
| `branch_change` | Peer switched branches |

## Presence System

### Global Presence

- Subscription to `__global_presence__` room
- Tracks all online users across repositories
- Status updates (online/away/offline)

### Repository Presence

- Per-repository peer tracking
- Shows who is working on which branch
- Peer join/leave notifications

## Webhook Integration

GitHub webhooks flow through the traffic controller:

1. GitHub sends webhook to landing page
2. Landing page forwards to traffic controller
3. Traffic controller broadcasts to subscribed clients
4. Client triggers fast-forward check for local repos

## Connection States

| State | Description |
|-------|-------------|
| `disconnected` | No connection to server |
| `connecting` | Establishing WebSocket connection |
| `connected` | WebSocket open, not yet authenticated |
| `authenticated` | Authenticated and ready for operations |
| `reconnecting` | Lost connection, attempting to reconnect |

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GIT_SYNC_SERVER_URL` | Production URL | Traffic controller WebSocket URL |
| `AUTH_SERVER_URL` | Production URL | OAuth server for room tokens |

### Reconnection Settings

- **Max Attempts**: Infinite (keeps retrying)
- **Initial Delay**: 5 seconds
- **Max Delay**: 30 seconds
- **Backoff Factor**: 1.5x

## Error Handling

| Error | Recovery |
|-------|----------|
| Connection lost | Auto-reconnect with exponential backoff |
| Auth token expired | Re-request room token from OAuth server |
| Lock timeout | Request released, user notified |
| Room join failed | Log error, retry on next connect |

## Source Files

### Renderer Process

- `src/renderer/services/git-sync/GitSyncClient.ts` - Client abstraction
- `src/renderer/services/git-sync/GitSyncConnectionManager.ts` - Connection management
- `src/renderer/contexts/GitSyncPanelContext.tsx` - React context
- `src/renderer/hooks/useGitSyncConnection.ts` - Hook for connection state

### Main Process

- `src/main/services/GitSyncWebSocketManager.ts` - WebSocket management
- `src/main/services/GitSyncIPC.ts` - IPC handlers
- `src/main/services/FastForwardService.ts` - Webhook-triggered fast-forward

### Shared

- `src/shared/main-process-api-interfaces/GitSyncAPI.ts` - Type definitions
- `src/renderer/main-process-api/GitSyncService.ts` - IPC service wrapper

## Related Documentation

- `docs/turn-based-sync-brief.md` - Original feature brief
- `docs/features/webhook-notifications.md` - Webhook architecture
- `.principal-views/user-feed-panel/user-feed-panel.otel.canvas` - Related presence events
