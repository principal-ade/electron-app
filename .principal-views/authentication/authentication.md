# Authentication - User Logout

## Overview

This canvas documents the complete logout flow in the Electron app, including:
- Token deletion from secure keychain storage
- In-memory state management updates
- Git credential cleanup
- UI synchronization via IPC events

**Note:** This documents **App OAuth logout only**. See [authentication-methods.md](./authentication-methods.md) for details on the three authentication methods (App OAuth, gh CLI, Git credentials) and how they interact.

## Critical Issues Identified

### 1. Silent Token Deletion Failures

**Location:** `src/main/services/AuthService.ts:850-861`

**Problem:** The `clearStoredAuth()` method catches and logs errors but doesn't throw them:

```typescript
private async clearStoredAuth(): Promise<void> {
  try {
    await this.storage.deleteToken(TOKEN_KEYS.GITHUB_TOKEN);
    await this.storage.deleteToken(TOKEN_KEYS.WORKOS_TOKEN);
    console.log('[AuthService] Credentials cleared');
  } catch (error) {
    console.error('[AuthService] Failed to clear credentials:', error);
    // Don't throw - clearing non-existent credentials is fine
  }
}
```

**Impact:** Logout can return `success: true` even when tokens remain in keychain, causing:
- User appears signed out in UI
- Tokens persist in keychain
- On app restart, user auto-logs back in (stale token issue)

**Root Causes:**
- Keychain locked during logout
- Keychain access timeout (30 second limit)
- Permission denied errors
- App force-quit mid-logout

### 2. Stale UI Data (FIXED)

**Problem:** Components using local state instead of subscribing to auth changes showed stale data.

**Example:** FeedLeftPanel was fetching user once on mount:
```typescript
const [currentUser, setCurrentUser] = useState<GitHubUser | null>(null);

useEffect(() => {
  const fetchCurrentUser = async () => {
    const user = await GithubService.getCurrentUser();
    setCurrentUser(user);  // Never updates on logout!
  };
  fetchCurrentUser();
}, []);
```

**Solution:** Use `useAuth()` hook which subscribes to auth state changes:
```typescript
const { user: currentUser } = useAuth();  // Auto-updates on logout
```

## Event Flow

1. **User Initiates Logout** - User clicks logout in UI
2. **Token Deletion** - Both GitHub and WorkOS tokens deleted from keychain
3. **Memory Cache Clear** - UnifiedSecureStorage cache updated
4. **Auth State Cleared** - AuthStateManager sets `isAuthenticated = false`
5. **Git Credentials Cleared** - Remove git credential helper config
6. **Broadcast Auth Change** - Send `auth-state:changed` IPC event to all renderers
7. **UI Updates** - All components using `useAuth()` re-render with signed-out state

## Success Validation

To verify logout worked correctly, check:

1. **Tokens removed from keychain:**
   ```bash
   # Check keychain storage file
   cat ~/Library/Application\ Support/your-app/unified-secure-storage.json
   ```

2. **Auth state cleared:**
   ```typescript
   AuthStateManager.getInstance().getFullState()
   // Should return: { isAuthenticated: false, user: null }
   ```

3. **UI shows signed-out state:**
   - Sidebar shows "Sign in with GitHub" button
   - FeedLeftPanel shows GitHub icon instead of user avatar
   - No user-specific data visible

4. **Git credentials removed:**
   ```bash
   git config --global --get credential.helper
   # Should not show your app's credential helper
   ```

## Improvements Needed

1. **Make logout failures explicit** - Throw errors when token deletion fails
2. **Add verification step** - After deletion, verify tokens are actually gone
3. **Add detailed logging** - Log each deleteToken operation result
4. **Handle locked keychain** - Prompt user to unlock keychain if needed
5. **Add transaction-like behavior** - Rollback on partial failure

## Related Files

- `src/main/services/AuthService.ts` - Main logout handler
- `src/main/services/UnifiedSecureStorage.ts` - Keychain storage
- `src/main/services/AuthStateManager.ts` - Auth state management
- `src/main/services/GitCredentialHelper.ts` - Git integration
- `src/renderer/hooks/useAuthState.ts` - React auth hook
- `src/renderer/panels/FeedLeftPanel.tsx` - Example UI component

## Testing

To test logout:

1. Sign in with GitHub
2. Verify user shown in UI
3. Click logout
4. Verify:
   - UI shows signed out
   - Restart app
   - Should remain signed out (not auto-login)

If auto-login occurs after restart, tokens weren't properly deleted.
