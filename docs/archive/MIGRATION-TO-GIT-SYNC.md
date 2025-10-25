# Migration Guide: P2P to Git-Sync Server

## Overview

This guide explains how to migrate from the existing P2P collaboration system to the new Git-Sync server architecture.

## Architecture Changes

### Old P2P Architecture

* **WebRTC-based**: Direct peer-to-peer connections
* **Signaling Server**: Only for establishing connections
* **Components**:
  * `PeerManager`: Managed WebRTC connections
  * `SignalingClient`: Connected to signaling server
  * `GitSyncManager`: Handled git operations over P2P
  * `CollaborationPanel`: UI for P2P collaboration

### New Git-Sync Architecture

* **Server-based**: Centralized sync server with WebSocket connections
* **Branch-aware locking**: Prevents conflicts at the branch level
* **JWT Authentication**: Secure token exchange with GitHub OAuth
* **Components**:
  * `GitSyncClient`: WebSocket client for server communication
  * `GitSyncAuth`: Authentication with JWT tokens
  * `GitSyncPanel`: New UI component
  * Server at [`http://34.226.213.143:3001`](http://34.226.213.143:3001)

## Migration Steps

### 1. Update Component Imports

Replace old components with new ones:

```typescript
// OLD
import { CollaborationPanel } from './components/CollaborationPanel';
import { PeerManager } from './services/p2p/PeerManager';
import { SignalingClient } from './services/p2p/SignalingClient';
import { GitHubAuth } from './services/p2p/GitHubAuth';

// NEW
import { GitSyncPanel } from './components/GitSyncPanel';
import { GitSyncClient } from './services/git-sync/GitSyncClient';
import { GitSyncAuth } from './services/git-sync/GitSyncAuth';
```

### 2. Update Component Usage

Replace CollaborationPanel with GitSyncPanel:

```tsx
// OLD
<CollaborationPanel 
  repoUrl={repoUrl}
  onClose={handleClose}
/>

// NEW
<GitSyncPanel
  repoUrl={repoUrl}
  repoPath={localRepoPath}
  branch={currentBranch}
  onClose={handleClose}
  serverUrl="http://34.226.213.143:3001"
/>
```

### 3. Authentication Flow

The new system uses JWT tokens instead of direct GitHub tokens:

```typescript
// OLD - Direct GitHub token usage
const githubAuth = GitHubAuth.getInstance();
const result = await githubAuth.authenticate();
const token = result.token; // GitHub token

// NEW - JWT token exchange
const gitSyncAuth = GitSyncAuth.getInstance(serverUrl);
const result = await gitSyncAuth.authenticate();
const token = result.token; // JWT token
```

### 4. Sync Operations

Replace P2P sync with server-based sync:

```typescript
// OLD - P2P sync
const syncManager = new GitSyncManager(peerManager);
await syncManager.broadcastSyncState();
await syncManager.performSync(peerId);

// NEW - Server-based sync with locking
const client = new GitSyncClient(config);
await client.connect();

// Acquire lock before editing
const lockResult = await client.acquireLock({
  resource: 'src/index.js',
  type: 'file',
  exclusive: true
});

// Broadcast changes
client.broadcastEvent({
  type: 'file_change',
  data: { file: 'src/index.js', changes: [...] }
});

// Release lock when done
await client.releaseLock(lockResult.lock.id);
```

### 5. Branch-Aware Operations

The new system is branch-aware:

```typescript
// Switch branches with automatic lock cleanup
const result = await client.switchBranch('feature-branch');
console.log(`Released ${result.released} locks`);

// Check merge safety before merging
const safety = await client.checkMergeSafety('main', ['src/index.js']);
if (safety.safe) {
  // Proceed with merge
} else {
  // Handle blocking locks
  console.log('Blocked by:', safety.blockingLocks);
}
```

### 6. Environment Configuration

Add these environment variables:

```bash
# .env
GIT_SYNC_SERVER_URL=http://34.226.213.143:3001
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### 7. Remove Old Dependencies

After migration, you can remove:

```json
{
  "dependencies": {
    // Remove these
    "simple-peer": "^x.x.x",
    "socket.io-client": "^x.x.x"
  }
}
```

## Feature Comparison

| Feature               | Old P2P       | New Git-Sync                     |
| --------------------- | ------------- | -------------------------------- |
| Connection Type       | WebRTC P2P    | WebSocket                        |
| Authentication        | GitHub token  | JWT (exchanged for GitHub token) |
| File Locking          | No            | Yes (branch-aware)               |
| Branch Awareness      | No            | Yes                              |
| Merge Coordination    | Manual        | Automated safety checks          |
| Cross-Branch Warnings | No            | Yes                              |
| Scalability           | Limited (P2P) | High (server-based)              |
| Offline Support       | No            | Queued operations                |
| Event History         | No            | Yes                              |

## API Reference

### GitSyncClient

```typescript
class GitSyncClient {
  // Connection
  connect(): Promise<void>
  disconnect(): void
  
  // Locking
  acquireLock(request: LockRequest): Promise<LockResult>
  releaseLock(lockId: string): Promise<boolean>
  
  // Sync
  broadcastEvent(event: SyncEvent): void
  
  // Branch operations
  switchBranch(newBranch: string): Promise<BranchSwitchResult>
  checkMergeSafety(toBranch: string, files: string[]): Promise<MergeSafetyResult>
  
  // Status
  getStatus(): SyncStatus
}
```

### GitSyncAuth

```typescript
class GitSyncAuth {
  // Authentication
  authenticate(): Promise<AuthResult>
  refreshToken(): Promise<boolean>
  logout(): void
  
  // Status
  checkStatus(): Promise<AuthStatus>
  getToken(): string | null
  getUser(): GitSyncUser | null
  
  // Repository
  verifyRepoAccess(repoUrl: string): Promise<boolean>
}
```

## Troubleshooting

### Connection Issues

* Verify server is running: `curl `[`http://34.226.213.143:3001/health`](http://34.226.213.143:3001/health)
* Check WebSocket connection in browser dev tools
* Ensure JWT token is valid (check localStorage)

### Authentication Issues

* Clear localStorage: `localStorage.removeItem('git-sync-auth')`
* Re-authenticate with GitHub
* Check GitHub OAuth app settings

### Lock Conflicts

* View active locks in GitSyncPanel
* Use `client.getStatus()` to see current locks
* Force release with timeout (automatic after 5 minutes)

## Rollback Plan

If you need to rollback to P2P:

1. Keep old components in separate directory (`/legacy/p2p/`)
2. Use feature flag to switch between implementations
3. Maintain both until migration is complete

```typescript
const useGitSync = process.env.USE_GIT_SYNC === 'true';

const CollaborationComponent = useGitSync 
  ? GitSyncPanel 
  : LegacyCollaborationPanel;
```

## Next Steps

1. Test authentication flow
2. Verify lock acquisition/release
3. Test branch switching
4. Monitor server performance
5. Gather user feedback
6. Remove P2P code after successful migration