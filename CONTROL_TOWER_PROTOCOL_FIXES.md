# Control Tower Core Protocol Compatibility Issues

## Summary
The repository-traffic-controller server and Control Tower Core client library use incompatible message formats, requiring client-side workarounds. This document details the issues and recommended server-side fixes.

## Issue 1: Message Envelope Mismatch

### Current Server Behavior
The server wraps all messages in a `server_message` envelope:
```json
{
  "id": "abc123",
  "type": "server_message",
  "payload": {
    "type": "room_joined",
    "roomId": "__global_presence__",
    "state": {...}
  },
  "timestamp": 1763052960520
}
```

### Expected Control Tower Core Format
Control Tower Core expects messages with a flat structure where the type is at the top level and data is in a `payload` field:
```json
{
  "id": "abc123",
  "type": "room_joined",
  "payload": {
    "roomId": "__global_presence__",
    "state": {...}
  },
  "timestamp": 1763052960520
}
```

### Current Client-Side Workaround
File: `src/main/services/GitSyncWebSocketManager.ts` (lines 264-286, 897-923)

We intercept the transport layer's `onMessage` handler to:
1. Detect `server_message` wrapper
2. Extract the inner payload
3. Restructure to Control Tower Core format by moving `type` to top level and remaining fields into `payload`

### Recommended Server Fix
**Remove the `server_message` wrapper entirely.** Send messages directly in Control Tower Core format:

```javascript
// BEFORE (current - incorrect)
ws.send({
  type: 'server_message',
  payload: {
    type: 'room_joined',
    roomId: roomId,
    state: roomState
  }
});

// AFTER (recommended - correct)
ws.send({
  type: 'room_joined',
  payload: {
    roomId: roomId,
    state: roomState
  }
});
```

This applies to ALL message types: `room_joined`, `room_left`, `presence_updated`, `lock_acquired`, `lock_released`, `lock_denied`, `event_broadcast`, `error`, `auth_result`.

## Issue 2: Empty User List in room_joined

### Current Server Behavior
When a user joins the `__global_presence__` room, the server sends:
```json
{
  "type": "room_joined",
  "payload": {
    "roomId": "__global_presence__",
    "state": {
      "room": {...},
      "users": {},  // ← Empty!
      "eventHistory": [],
      "locks": {}
    }
  }
}
```

The current user (the one who just joined) is not included in the `users` object.

### Expected Behavior
The `users` object should include the current user who just joined:
```json
{
  "type": "room_joined",
  "payload": {
    "roomId": "__global_presence__",
    "state": {
      "room": {...},
      "users": {
        "user_abc123": {
          "id": "user_abc123",
          "userId": "github_user_id",
          "username": "octocat",
          "status": "online",
          "joinedAt": 1763052960520,
          "activeRepository": null
        }
      },
      "eventHistory": [],
      "locks": {}
    }
  }
}
```

### Current Client-Side Workaround
File: `src/main/services/GitSyncWebSocketManager.ts` (lines 998-1013)

After successfully joining the room via WebSocket, we make a REST API call to `/api/presence/users` to fetch the initial user list, then manually broadcast a `presence_updated` event to the renderer.

### Recommended Server Fix
**Add the user to the room BEFORE sending the `room_joined` response:**

```javascript
// When handling join_room request
async function handleJoinRoom(ws, message) {
  const { roomId, token } = message.payload;
  const user = await authenticateToken(token);

  // Get or create room
  const room = await getRoomOrCreate(roomId);

  // Add user to room FIRST
  const roomUser = {
    id: user.id,
    userId: user.githubUserId,
    username: user.githubUsername,
    status: 'online',
    joinedAt: Date.now(),
    activeRepository: null
  };
  room.users.set(user.id, roomUser);

  // THEN send room_joined with users populated
  sendMessage(ws, {
    type: 'room_joined',
    payload: {
      roomId: room.id,
      state: {
        room: {
          id: room.id,
          name: room.name,
          createdAt: room.createdAt,
          maxUsers: room.maxUsers,
          maxHistory: room.maxHistory,
          permissions: room.permissions,
          metadata: room.metadata
        },
        users: Object.fromEntries(room.users),  // Include all users, including the one joining
        eventHistory: room.eventHistory,
        locks: Object.fromEntries(room.locks)
      }
    }
  });

  // Optionally: broadcast presence_updated to other users in the room
  broadcastToRoom(roomId, {
    type: 'presence_updated',
    payload: {
      users: Array.from(room.users.values())
    }
  }, [user.id]); // Exclude the joining user
}
```

## Issue 3: No presence_updated Events

### Current Behavior
The server does not send `presence_updated` events when:
- A user joins a room
- A user leaves a room
- A user's status changes

### Expected Behavior
The server should broadcast `presence_updated` events to all users in a room when the user list changes:

```javascript
// When a user joins
broadcastToRoom(roomId, {
  type: 'presence_updated',
  payload: {
    users: Array.from(room.users.values())
  }
});

// When a user leaves
room.users.delete(userId);
broadcastToRoom(roomId, {
  type: 'presence_updated',
  payload: {
    users: Array.from(room.users.values())
  }
});

// When a user updates their status/active repo
const user = room.users.get(userId);
user.status = newStatus;
user.activeRepository = newRepo;
broadcastToRoom(roomId, {
  type: 'presence_updated',
  payload: {
    users: Array.from(room.users.values())
  }
});
```

## Impact of Server Fixes

Once these server-side changes are made, we can remove the following client-side workarounds:

1. **Message transformation** (lines 264-286, 897-923): Remove the transport interception code
2. **REST API fallback** (lines 998-1013): Remove the `fetchPresenceData()` call after joining
3. **Dead code cleanup**: Remove the unused `handleMessage()` method (lines 520-633) which was doing manual unwrapping

## Testing Checklist

After server changes, verify:
- [ ] `room_joined` messages arrive with correct format (no `server_message` wrapper)
- [ ] `room_joined` includes the joining user in `state.users`
- [ ] `presence_updated` events are broadcast when users join/leave
- [ ] `presence_updated` events are broadcast when users change status
- [ ] All other message types (`lock_acquired`, `event_broadcast`, etc.) follow the same format
- [ ] Authentication messages (`auth_result`) also follow the format

## References

- Control Tower Core BaseClient implementation: `node_modules/@principal-ai/control-tower-core/dist/client/BaseClient.js`
- Control Tower Core message handler: BaseClient.js lines 204-236
- Client-side workarounds: `src/main/services/GitSyncWebSocketManager.ts`
