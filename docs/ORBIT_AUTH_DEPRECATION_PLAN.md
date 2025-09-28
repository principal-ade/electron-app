# ORBIT_AUTH Deprecation Plan

## Current State

There are **two completely separate authentication systems** that are conflicting:

1. **GitHub OAuth (via AuthService)** - For repository access and general GitHub features
   - Token Key: `GITHUB_TOKEN`
   - Storage: UnifiedSecureStorage (encrypted)
   - Purpose: Main app authentication
   - Status: **ACTIVE AND WORKING**

2. **Orbit P2P Collaboration Auth** - For real-time collaboration features
   - Token Key: `ORBIT_AUTH`
   - Storage: localStorage (unencrypted)
   - Purpose: P2P room joining and WebRTC signaling
   - Status: **PARTIALLY IMPLEMENTED, NOT CONNECTED**

## The Problem

The SecureTokenIPC service is checking for `ORBIT_AUTH` tokens and clearing the AuthStateManager when it doesn't find them, even though the user is authenticated with `GITHUB_TOKEN`. This causes the auth view to show "not signed in" even when the user has valid GitHub credentials.

## Components Using ORBIT_AUTH

### 1. P2P Collaboration Components (NOT FULLY CONNECTED)

#### Frontend Components:
- `/src/renderer/components/CollaborationPanel.tsx`
  - Has its own auth flow using GitHubAuth class
  - Shows "Sign in with GitHub" button
  - Manages peer connections for collaboration

- `/src/renderer/components/CollaborationPanelWithSync.tsx`
  - Extended version with git sync capabilities

#### P2P Services:
- `/src/renderer/services/p2p/GitHubAuth.ts`
  - Standalone auth class for P2P features
  - Stores token in localStorage as 'orbit_auth'
  - Opens OAuth flow to orbit API endpoint

- `/src/renderer/services/p2p/GitHubAuthDirect.ts`
  - Direct implementation variant

- `/src/renderer/services/p2p/GitHubAuthIPC.ts`
  - IPC-based implementation using OrbitService
  - Also uses localStorage 'orbit_auth'

- `/src/renderer/services/p2p/SignalingClient.ts`
- `/src/renderer/services/p2p/SignalingClientHTTP.ts`
  - WebRTC signaling for P2P connections
  - Requires orbit auth token

- `/src/renderer/services/p2p/PeerManager.ts`
  - Manages P2P connections
  - Uses auth for room access

### 2. Git Sync Components (LEGACY)

- `/src/renderer/services/git-sync/GitSyncConnectionManager.ts`
  - Line 210: Checks localStorage for 'orbit_auth'
  - Used for git-sync WebSocket connections

### 3. Secure Storage Migration

- `/src/renderer/services/SecureAuthService.ts`
  - Lines 102, 160-161: Migrates old 'orbit_auth' from localStorage to secure storage
  - Part of token migration system

### 4. Main Process Handlers

- `/src/main/services/SecureTokenIPC.ts`
  - **PROBLEMATIC**: Clears AuthStateManager when no ORBIT_AUTH found
  - Lines 47-75: GET_GITHUB_AUTH handler
  - Lines 78-80: IS_AUTHENTICATED handler
  - Lines 198-224: Additional handlers

## What to Deprecate

### Immediate Actions (To Fix Auth State Issue)

1. **Modify SecureTokenIPC.ts**
   - Remove lines that call `AuthStateManager.getInstance().clearAuthentication()`
   - These handlers should NOT manage GitHub auth state
   - They should only handle Orbit-specific authentication

2. **Disable CollaborationPanel**
   - Comment out or remove CollaborationPanel from the UI
   - This prevents users from triggering the conflicting auth flow

### Components to Temporarily Disable

1. **CollaborationPanel Components**
   - `/src/renderer/components/CollaborationPanel.tsx`
   - `/src/renderer/components/CollaborationPanelWithSync.tsx`
   - Any UI that renders these components

2. **P2P Services** (keep code but disconnect from UI)
   - All files in `/src/renderer/services/p2p/`
   - These can remain for future implementation

3. **Git Sync Connection Manager**
   - Lines checking for 'orbit_auth' should be disabled
   - Or modified to use GITHUB_TOKEN if appropriate

## Migration Path

### Phase 1: Immediate Fix (Current)
1. Stop SecureTokenIPC from clearing AuthStateManager
2. Document the separation of auth contexts
3. Disable UI components that trigger Orbit auth

### Phase 2: Clean Separation
1. Create separate auth state management for Orbit features
2. Rename ORBIT_AUTH to something more specific (e.g., P2P_COLLAB_TOKEN)
3. Create clear boundaries between auth systems

### Phase 3: Future Implementation
1. When ready to implement P2P collaboration:
   - Create dedicated P2P auth flow
   - Use separate state management
   - Don't interfere with main GitHub auth
2. Consider if P2P needs separate auth or can use GitHub token
3. Implement proper token refresh and lifecycle management

## Code Changes Needed

### 1. Fix SecureTokenIPC.ts
Remove auth state clearing from these locations:
- Line 54: `AuthStateManager.getInstance().clearAuthentication();`
- Line 72: `AuthStateManager.getInstance().clearAuthentication();`
- Line 206: `AuthStateManager.getInstance().clearAuthentication();`
- Line 222: `AuthStateManager.getInstance().clearAuthentication();`

### 2. Add Auth Context Separation
Create separate state management:
```typescript
// For GitHub auth
AuthStateManager.getInstance() // existing

// For P2P/Orbit auth (future)
OrbitAuthStateManager.getInstance() // new, separate
```

### 3. Update Documentation
- Document which auth is for what purpose
- Create clear API boundaries
- Add migration guide for existing users

## Testing

After deprecation:
1. User should remain logged in when navigating to AuthView
2. No auth state should be cleared unless explicitly logging out
3. P2P features should show as "coming soon" or be hidden
4. Main GitHub features should work without interference