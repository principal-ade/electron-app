# Turn-Based Sync Development Brief

## Overview
Turn-Based Sync is a conflict-free Git synchronization system for collaborative development. Users take turns editing by acquiring an edit lock, ensuring only one person can make changes at a time.

## Current Implementation Status

### ✅ Completed Components

1. **TurnBasedSyncPanel.tsx** - Main UI component
   - Location: `/electron-react/src/renderer/components/TurnBasedSyncPanel.tsx`
   - Features:
     - Edit lock request/release system
     - 5-minute auto-expiring locks with countdown timer
     - Activity log showing all sync events
     - Demo mode for testing without real peers
     - Visual indicators for lock status

2. **HTTP-Based Signaling** (Replaces WebSockets for AWS App Runner compatibility)
   - API Routes: `/code-city-landing/src/app/api/orbit/signal/`
     - `join/route.ts` - Join a collaboration room
     - `poll/route.ts` - Poll for signals and peer updates
     - `send/route.ts` - Send signals to peers
     - `leave/route.ts` - Leave room and cleanup
   - Client: `/electron-react/src/renderer/services/p2p/SignalingClientHTTP.ts`

3. **S3-Based Storage** for rooms and signals
   - Location: `/code-city-landing/src/lib/s3-orbit-store.ts`
   - Methods: `joinRoom()`, `leaveRoom()`, `getRoomPeers()`, `storeSignal()`, `getSignalsForPeer()`

4. **OAuth Authentication Flow**
   - Success page: `/code-city-landing/src/app/orbit-success/page.tsx`
   - GitHub OAuth callback: `/code-city-landing/src/app/api/orbit/auth/github/callback/route.ts`
   - Client auth: `/electron-react/src/renderer/services/p2p/GitHubAuthDirect.ts`

### 🚧 TODO: Authentication UI Improvements

The current implementation needs better visual feedback for authentication status:

1. **Add Authentication Status Indicator**
   ```tsx
   // In TurnBasedSyncPanel header or connection area
   - Show current user's GitHub handle when authenticated
   - Display authentication status (authenticated/unauthenticated)
   - Show token validity/expiration if applicable
   ```

2. **Improve Connection States**
   ```tsx
   // Current states to visualize:
   - Not authenticated (show "Sign in with GitHub" button)
   - Authenticated but not connected to room
   - Connecting to room (loading state)
   - Connected and ready
   - Connection error/retry states
   ```

3. **Add Persistent Auth Status**
   ```tsx
   // Consider adding to RepositoryMapsHeader:
   - Small auth indicator badge next to Turn-Based Sync button
   - Green checkmark if authenticated
   - Yellow warning if token expired
   - Red X if not authenticated
   ```

## Technical Architecture

### Lock Management Flow
```
1. User requests edit lock → POST /api/orbit/signal/lock/request
2. Server checks if lock available → Stores in S3
3. Server broadcasts lock status to all peers
4. Lock holder can make Git commits
5. After 5 minutes OR manual release → Lock freed
6. Changes auto-sync on lock release
```

### Peer Discovery & Signaling
```
1. Join room with GitHub token + repo URL
2. Poll every 1 second for:
   - New peers joining/leaving
   - WebRTC signals (offer/answer/ICE)
   - Lock status updates
3. Clean up stale peers after 30 seconds inactivity
```

## Integration Points

### Required Environment Variables
```bash
# AWS S3 (production)
FEEDBACK_S3_BUCKET=orbit-and-feedback-bucket
AWS_REGION=us-east-1

# GitHub OAuth
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
```

### Repository Integration
- Button appears in `RepositoryMapsHeader` when:
  - Mode is 'develop'
  - A local clone is selected
- Uses selected clone path for Git operations
- Tracks branch name from repository metadata

## Next Steps for Implementation

### 1. Wire Up Real Git Operations
```typescript
// In TurnBasedSyncPanel.tsx, connect to actual Git:
- When lock acquired: Enable Git commits
- When lock released: Git push to remote
- On sync: Git pull from remote
- Show real commit messages in activity log
```

### 2. Implement Lock Enforcement
```typescript
// Prevent Git operations without lock:
- Hook into Git commands
- Check lock status before allowing commits
- Show warning if trying to edit without lock
```

### 3. Add Conflict Detection
```typescript
// Even with turns, handle edge cases:
- Detect if remote has diverged
- Force sync before acquiring lock
- Handle failed pushes gracefully
```

### 4. Improve Authentication UX
```typescript
// Better auth feedback:
- Show auth status in main UI
- Handle token refresh
- Remember user between sessions
- Clear error messages for auth failures
```

### 5. Add Room Management
```typescript
// Multi-repo support:
- List active collaboration rooms
- Show number of users per room
- Allow switching between repos
- Room cleanup after inactivity
```

## Testing Checklist

- [ ] Demo mode works without real connection
- [ ] Can authenticate with GitHub OAuth
- [ ] Lock request/release works properly
- [ ] 5-minute timer counts down correctly
- [ ] Activity log shows all events
- [ ] Peer join/leave updates in real-time
- [ ] Changes sync when lock released
- [ ] Stale peers cleaned up after 30 seconds
- [ ] UI responsive during polling
- [ ] Error states handled gracefully

## Security Considerations

1. **Token Storage**: Currently in localStorage - consider secure storage
2. **Lock Hijacking**: Add verification that lock holder matches Git committer
3. **Rate Limiting**: Add to polling endpoints to prevent abuse
4. **Token Rotation**: Implement token refresh mechanism

## Performance Optimizations

1. **Polling Frequency**: Currently 1 second - could be dynamic based on activity
2. **S3 Operations**: Batch reads/writes where possible
3. **Signal Cleanup**: Implement TTL on S3 objects
4. **Caching**: Add local cache for peer list

## UI/UX Improvements Needed

1. **Visual Polish**
   - Add animations for lock acquisition/release
   - Better loading states during operations
   - Sound notifications for lock changes
   - Desktop notifications for peer activity

2. **Status Communication**
   - Clearer "waiting for lock" state
   - Show queue if multiple people waiting
   - Estimated wait time for lock
   - Better error messages

3. **Advanced Features**
   - Lock reservation system
   - Scheduled sync times
   - Automatic lock handoff
   - Merge conflict preview

## Contact & Resources

- Current implementation by: Claude
- OAuth success page needs review: `/code-city-landing/src/app/orbit-success/page.tsx`
- Main component: `/electron-react/src/renderer/components/TurnBasedSyncPanel.tsx`
- Production URL: https://principle-md.com
- S3 Bucket: orbit-and-feedback-bucket

## Demo Instructions

1. Open repository in develop mode
2. Select a local clone
3. Click "Turn-Based Sync" button
4. Click "Try Demo" to see simulated collaboration
5. In real mode: Sign in with GitHub → Request lock → Make changes → Release lock