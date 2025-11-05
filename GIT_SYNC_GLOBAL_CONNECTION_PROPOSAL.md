# Git-Sync Global Connection Architecture Proposal

## Overview

This document proposes architectural changes to support **global Git-Sync connections** separate from room-specific connections. Currently, users can only connect to Git-Sync by joining a specific repository/branch room. This proposal enables users to maintain a persistent connection to Git-Sync for presence and collaboration features without requiring an open repository.

## Current Architecture

### Connection Model
- **Connection Type**: Room-only
- **Connection ID**: `${repoId}:${branch}` (e.g., "a24z-ai/a24z:main")
- **Connection Requirement**: Must specify repository and branch
- **Presence**: Only visible when in a specific room

### Connection Config
```typescript
interface GitSyncConfig {
  repoId: string;      // Required: "owner/repo"
  repoPath: string;    // Required: Local file path
  branch: string;      // Required: Branch name
  token?: string;      // GitHub token for auth
}
```

### Limitations
1. Users must open a repository to appear online
2. Cannot see global presence without joining a room
3. Closing all repositories = disconnecting from Git-Sync entirely
4. No persistent connection for presence-only features
5. Connection status tied to specific repo/branch combinations

## Proposed Architecture

### Two-Tier Connection Model

#### 1. Global Connection (Presence Layer)
- **Purpose**: Authentication, presence broadcasting, user discovery
- **Lifecycle**: Establish on app launch (when authenticated), persist across repository changes
- **Features**:
  - Global presence ("User is online")
  - User discovery (see all online users)
  - Cross-repository notifications
  - Real-time collaboration signals
  - Device tracking

#### 2. Room Connections (Collaboration Layer)
- **Purpose**: Repository/branch-specific collaboration
- **Lifecycle**: Created when opening a repository, destroyed when closed
- **Features**:
  - File locking
  - Presence in specific repo/branch
  - Repository-specific events
  - Peer tracking per room

### Connection States

```
User States:
1. Offline:           Not connected to Git-Sync at all
2. Online (Global):   Connected to Git-Sync, no rooms joined
3. Online (In Rooms): Connected globally + in one or more rooms

Connection Types:
- Global:  1 per user per device
- Room:    N per user (one per open repo/branch)
```

## Implementation Requirements

### 1. Server-Side Changes (repository-traffic-controller)

#### New Endpoints/Connection Types

**Global Connection Endpoint**
```
WebSocket: /presence/connect
Auth: GitHub token (no repo-specific permissions required)
Purpose: Global presence and user discovery
```

**Room Connection** (existing pattern)
```
WebSocket: /sync/connect
Auth: GitHub token + repo-specific verification
Purpose: Repository/branch collaboration
```

#### Server Architecture Changes

```typescript
// New global connection tracking
interface GlobalConnection {
  userId: string;           // GitHub handle
  deviceId: string;         // Unique device identifier
  connectionId: string;     // WebSocket connection ID
  connectedAt: number;      // Timestamp
  status: 'online' | 'away' | 'busy';
  statusMessage?: string;
}

// Existing room connection (enhanced)
interface RoomConnection {
  userId: string;
  deviceId: string;
  connectionId: string;
  repoId: string;
  branch: string;
  // ... existing fields
}

// Server state management
class GitSyncServer {
  globalConnections: Map<string, GlobalConnection>;  // userId -> connection
  roomConnections: Map<string, RoomConnection[]>;    // roomId -> connections[]

  // New methods
  handleGlobalConnect(userId: string, deviceId: string): void;
  handleGlobalDisconnect(userId: string, deviceId: string): void;
  broadcastPresenceUpdate(userId: string, status: UserPresence): void;

  // Enhanced existing methods
  handleRoomJoin(roomId: string, userId: string): void;
  handleRoomLeave(roomId: string, userId: string): void;
}
```

#### New Message Protocol

**Global Connection Messages**
```typescript
// Client → Server
{
  type: 'presence_update',
  status: 'online' | 'away' | 'busy',
  statusMessage?: string
}

{
  type: 'subscribe_presence',
  filter?: {
    repositories?: string[];  // Only see presence for these repos
    users?: string[];         // Only see specific users
  }
}

// Server → Client
{
  type: 'presence_event',
  event: 'user_online' | 'user_offline' | 'user_status_changed',
  user: {
    userId: string,
    status: string,
    statusMessage?: string,
    devices: Device[],
    activeRepositories: string[]
  }
}

{
  type: 'presence_snapshot',
  users: UserPresence[]
}
```

**Room Connection Messages** (existing, unchanged)
```typescript
{
  type: 'lock_acquired',
  type: 'lock_released',
  type: 'peer_joined',
  type: 'peer_left',
  // ... existing messages
}
```

#### Authentication Changes

**Global Connection Auth**
- Verify GitHub token validity
- No repository-specific permissions required
- Rate limiting per user (prevent abuse)

**Room Connection Auth** (existing)
- Verify GitHub token validity
- Verify repository access permissions
- Check branch access rights

### 2. Main Process Changes (Electron)

#### GitSyncWebSocketManager Enhancements

```typescript
// src/main/services/GitSyncWebSocketManager.ts

interface GlobalConnectionInfo {
  connectionId: string;
  userId: string;
  deviceId: string;
  ws: WebSocket;
  status: {
    connected: boolean;
    authenticated: boolean;
  };
}

interface RoomConnectionInfo {
  connectionId: string;
  repoId: string;
  repoPath: string;
  branch: string;
  windowId: number;
  ws: WebSocket;
  status: GitSyncStatus;
  token: string;
}

class GitSyncWebSocketManager {
  private globalConnection: GlobalConnectionInfo | null = null;
  private roomConnections: Map<string, RoomConnectionInfo>;  // existing

  // New methods for global connection
  async connectGlobal(
    userId: string,
    token: string
  ): Promise<{ success: boolean; error?: string }>;

  async disconnectGlobal(): Promise<void>;

  getGlobalConnectionStatus(): {
    connected: boolean;
    authenticated: boolean;
  } | null;

  // Enhanced existing methods
  async connectToRoom(config: GitSyncConfig): Promise<GitSyncConnectionResult>;
  async disconnectFromRoom(connectionId: string): Promise<void>;

  // Connection state tracking
  isGloballyConnected(): boolean;
  getActiveRoomCount(): number;
  getRoomConnections(): RoomConnectionInfo[];
}
```

#### IPC API Changes

```typescript
// src/shared/main-process-api-interfaces/GitSyncAPI.ts

export interface GitSyncAPI {
  // New global connection methods
  connectGlobal(): Promise<{ success: boolean; error?: string }>;
  disconnectGlobal(): Promise<{ success: boolean }>;
  getGlobalConnectionStatus(): Promise<{
    connected: boolean;
    authenticated: boolean;
  } | null>;

  // Enhanced existing methods (renamed for clarity)
  connectToRoom(config: GitSyncConfig): Promise<GitSyncConnectionResult>;
  disconnectFromRoom(connectionId: string): Promise<{ success: boolean; message?: string }>;

  // Enhanced status methods
  getConnectionSummary(): Promise<{
    globalConnection: { connected: boolean; authenticated: boolean } | null;
    roomConnections: GitSyncConnectionInfo[];
  }>;

  // New event subscriptions
  onGlobalConnectionChanged(
    callback: (status: { connected: boolean; authenticated: boolean }) => void
  ): () => void;

  // Existing events (unchanged)
  onRoomConnectionAdded(callback: (connectionId: string) => void): () => void;
  onRoomConnectionRemoved(callback: (connectionId: string) => void): () => void;
  onConnectionStatusChanged(callback: (connectionId: string) => void): () => void;
}
```

#### Connection Lifecycle Management

```typescript
// App startup sequence
app.on('ready', async () => {
  // Auto-connect globally if user is authenticated
  const authStatus = await AuthService.getAuthStatus();
  if (authStatus.isAuthenticated) {
    await gitSyncWebSocketManager.connectGlobal(
      authStatus.githubHandle,
      authStatus.githubToken
    );
  }
});

// Repository open sequence
ipcMain.handle('git-sync:connect-to-room', async (event, config: GitSyncConfig) => {
  // Ensure global connection exists
  if (!gitSyncWebSocketManager.isGloballyConnected()) {
    const globalResult = await gitSyncWebSocketManager.connectGlobal(
      config.userId,
      config.token
    );
    if (!globalResult.success) {
      return { success: false, error: 'Failed to establish global connection' };
    }
  }

  // Then join room
  return await gitSyncWebSocketManager.connectToRoom(config);
});

// Repository close sequence
ipcMain.handle('git-sync:disconnect-from-room', async (event, connectionId: string) => {
  await gitSyncWebSocketManager.disconnectFromRoom(connectionId);
  // Keep global connection alive
});

// App shutdown sequence
app.on('before-quit', async () => {
  await gitSyncWebSocketManager.disconnectGlobal();
});
```

### 3. Renderer Process Changes (Electron)

#### GitSyncConnectionManager Updates

```typescript
// src/renderer/services/git-sync/GitSyncConnectionManager.ts

class GitSyncConnectionManager {
  // New global connection tracking
  private globalConnectionStatus: {
    connected: boolean;
    authenticated: boolean;
  } | null = null;

  // Enhanced methods
  async connectGlobally(): Promise<void> {
    const result = await GitSyncService.connectGlobal();
    if (result.success) {
      this.globalConnectionStatus = {
        connected: true,
        authenticated: true
      };
      this.emit('global-connection-changed', true);
    }
  }

  async disconnectGlobally(): Promise<void> {
    await GitSyncService.disconnectGlobal();
    this.globalConnectionStatus = null;
    this.emit('global-connection-changed', false);
  }

  getGlobalConnectionStatus() {
    return this.globalConnectionStatus;
  }

  // Enhanced existing methods (renamed)
  async joinRoom(
    repoId: string,
    repoPath: string,
    branch: string
  ): Promise<GitSyncClient>;

  async leaveRoom(repoId: string, branch: string): Promise<void>;
}
```

#### UI Hook Updates

```typescript
// src/renderer/hooks/useGitSyncConnection.ts

export interface GitSyncConnectionStatus {
  // Global connection status
  isGloballyConnected: boolean;
  isAuthenticated: boolean;

  // Room connection status
  roomCount: number;
  isInRoom: boolean;  // true if in at least one room

  // Specific room status (if repo/branch provided)
  isConnectedToThisRoom?: boolean;
}

export function useGitSyncConnection(
  repositoryPath?: string,
  branch?: string,
): GitSyncConnectionStatus {
  const [status, setStatus] = useState<GitSyncConnectionStatus>({
    isGloballyConnected: false,
    isAuthenticated: false,
    roomCount: 0,
    isInRoom: false,
  });

  useEffect(() => {
    const updateStatus = async () => {
      const summary = await GitSyncService.getConnectionSummary();

      const globalStatus = summary.globalConnection || {
        connected: false,
        authenticated: false
      };

      const rooms = summary.roomConnections;

      let isConnectedToThisRoom = false;
      if (repositoryPath && branch) {
        isConnectedToThisRoom = rooms.some(
          (conn) => conn.repoPath === repositoryPath &&
                   conn.branch === branch &&
                   conn.status.connected
        );
      }

      setStatus({
        isGloballyConnected: globalStatus.connected,
        isAuthenticated: globalStatus.authenticated,
        roomCount: rooms.length,
        isInRoom: rooms.length > 0,
        isConnectedToThisRoom,
      });
    };

    updateStatus();

    // Listen for changes
    const unsubGlobal = GitSyncService.onGlobalConnectionChanged(() => updateStatus());
    const unsubRoom = GitSyncService.onRoomConnectionAdded(() => updateStatus());
    const unsubRoomRemoved = GitSyncService.onRoomConnectionRemoved(() => updateStatus());

    return () => {
      unsubGlobal();
      unsubRoom();
      unsubRoomRemoved();
    };
  }, [repositoryPath, branch]);

  return status;
}
```

#### UI Component Updates

```typescript
// PresencePanel: Show connection status with new terminology
{isGloballyConnected ? (
  roomCount > 0 ? (
    `Connected to Git-Sync (${roomCount} ${roomCount === 1 ? 'room' : 'rooms'})`
  ) : (
    'Connected to Git-Sync (no rooms joined)'
  )
) : (
  'Not connected to Git-Sync'
)}

// Buttons
{!isGloballyConnected && (
  <button onClick={handleConnectGlobal}>
    Connect to Git-Sync
  </button>
)}

{isGloballyConnected && (
  <button onClick={handleDisconnectGlobal}>
    Disconnect from Git-Sync
  </button>
)}

// GitSyncStatusIndicator: Update to show global status
const Icon = isGloballyConnected ? Wifi : WifiOff;
const tooltip = isGloballyConnected
  ? `Git-Sync Connected (${roomCount} ${roomCount === 1 ? 'room' : 'rooms'})`
  : 'Git-Sync Disconnected';
```

## Migration Strategy

### Phase 1: Server Implementation
1. Add global connection endpoint
2. Implement presence tracking
3. Add message protocol for global events
4. Deploy alongside existing room-only connections (backward compatible)

### Phase 2: Main Process Updates
1. Add global connection methods to GitSyncWebSocketManager
2. Update IPC API with new methods
3. Implement connection lifecycle management
4. Test with both connection types

### Phase 3: Renderer Updates
1. Update GitSyncConnectionManager
2. Modify useGitSyncConnection hook
3. Update UI components (PresencePanel, GitSyncStatusIndicator)
4. Add global connect/disconnect functionality

### Phase 4: Testing & Rollout
1. Test global connection without rooms
2. Test room connections with global connection
3. Test disconnection scenarios
4. Monitor server load and connection stability
5. Gradual rollout to users

## Benefits

### User Experience
- ✅ Always visible to team when app is open
- ✅ See who's online without opening repositories
- ✅ Persistent presence across repository switches
- ✅ Better collaboration awareness

### Technical
- ✅ Cleaner separation of concerns (presence vs collaboration)
- ✅ Reduced connection churn (global connection persists)
- ✅ More efficient presence updates (single global connection)
- ✅ Foundation for cross-repository features

### Future Capabilities
- Direct messaging between users
- Cross-repository notifications
- Team presence dashboard
- Activity feeds across all repositories
- Smart suggestions based on team activity

## Backward Compatibility

The proposed changes maintain backward compatibility:

1. **Existing room connections continue to work** unchanged
2. **Global connection is additive**, not replacing existing functionality
3. **Clients can operate in "room-only" mode** if global connection fails
4. **Server supports both connection types** simultaneously
5. **Gradual migration path** without breaking changes

## Open Questions

1. **Auto-connect behavior**: Should global connection establish automatically on app launch, or require user action?
2. **Offline mode**: How should presence appear when user intentionally goes offline vs disconnection?
3. **Privacy controls**: Should users control their visibility (appear offline, limit who sees them)?
4. **Rate limiting**: What are appropriate connection/message rate limits for global connections?
5. **Reconnection strategy**: How aggressive should auto-reconnection be for global vs room connections?
6. **Multi-device handling**: How to display when a user is online on multiple devices?

## Security Considerations

### Global Connection
- Token validation on every connection
- Rate limiting to prevent abuse
- No repository data transmitted over global connection
- Presence-only information (no sensitive data)

### Room Connection
- Existing security model unchanged
- Repository access verification required
- File content remains room-specific
- Separate token validation per room

## Performance Considerations

### Server Load
- **Before**: N connections per user (one per open repo)
- **After**: 1 global + N room connections per user
- **Net impact**: +1 connection per user, but more efficient presence updates

### Network Traffic
- Global connection: Low bandwidth (presence events only)
- Room connections: Higher bandwidth (file operations, locks)
- Overall: Slight increase, but more efficient presence broadcasting

### Connection Stability
- Global connection: Long-lived, needs robust reconnection
- Room connections: Shorter-lived, tolerant of failures
- Monitoring: Track connection health separately

## Success Metrics

1. **Connection reliability**: Global connection uptime >99.5%
2. **User adoption**: % of users with persistent global connection
3. **Presence accuracy**: Latency of presence updates <2s
4. **Room join time**: Time to join room after opening repository <500ms
5. **User satisfaction**: Feedback on improved collaboration awareness

## Next Steps

1. **Review and approve** this proposal
2. **Create detailed server API specification**
3. **Prototype server-side implementation**
4. **Test with development environment**
5. **Implement main process changes**
6. **Update renderer UI**
7. **Conduct beta testing**
8. **Production rollout**

## Timeline Estimate

- **Server implementation**: 2-3 weeks
- **Main process changes**: 1-2 weeks
- **Renderer updates**: 1 week
- **Testing & refinement**: 1-2 weeks
- **Total**: ~6-8 weeks

## Related Documents

- `GIT_SYNC_ARCHITECTURE_AND_ISSUES.md` - Current architecture overview
- Server repository documentation
- WebSocket protocol specification

---

**Document Version**: 1.0
**Date**: 2025-11-05
**Author**: Generated during architecture discussion
**Status**: Proposal - Awaiting Review
