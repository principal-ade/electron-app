# Token Storage Discrepancy Analysis

## Problem Summary

The application has multiple authentication token storage mechanisms that are conflicting with each other, causing the auth state to be inconsistent. When navigating to the AuthView, users appear as not logged in despite having valid stored credentials.

## Root Cause

There are **two different token keys** being used for GitHub authentication:

1. **`GITHUB_TOKEN`** - Used by AuthService
2. **`ORBIT_AUTH`** - Used by SecureTokenIPC

These represent different authentication contexts but both services are trying to manage the same AuthStateManager singleton.

## Token Storage Locations

### 1. AuthService (src/main/services/AuthService.ts)
- **Token Key**: `TOKEN_KEYS.GITHUB_TOKEN`
- **Purpose**: GitHub OAuth authentication via principle-md.com OAuth server
- **Storage Method**: UnifiedSecureStorage
- **When Used**:
  - During OAuth login flow
  - On app startup via `initializeAuthState()`
  - When checking auth status via `AuthEvent.CHECK` handler

### 2. SecureTokenIPC (src/main/services/SecureTokenIPC.ts)
- **Token Key**: `TOKEN_KEYS.ORBIT_AUTH`
- **Purpose**: Legacy authentication (possibly for Orbit workspace features)
- **Storage Method**: UnifiedSecureStorage (same instance)
- **When Used**:
  - Via `SecureTokenAPIEvent.GET_GITHUB_AUTH` handler
  - Via `SecureTokenAPIEvent.IS_AUTHENTICATED` handler

## The Conflict Flow

1. **App Startup**:
   - AuthService.initializeAuthState() runs
   - Checks for `GITHUB_TOKEN` and finds it
   - Sets AuthStateManager to authenticated with user data
   - ✅ User is authenticated

2. **Component Mount**:
   - Multiple components use `useAuthState` hook
   - Hook subscribes to auth state changes
   - Initial state shows authenticated ✅

3. **Unknown Trigger**:
   - Something calls SecureTokenIPC handlers
   - SecureTokenIPC checks for `ORBIT_AUTH` token
   - Doesn't find it (because auth is stored as `GITHUB_TOKEN`)
   - **Calls `AuthStateManager.getInstance().clearAuthentication()`**
   - ❌ User appears logged out

## Evidence from Logs

```
[useAuthState] Auth state changed: {isAuthenticated: true, user: "SquallLeonhart13"}
[useAuthState] Initial auth state: {isAuthenticated: false, user: undefined}
[useAuthState] Auth state changed: {isAuthenticated: false, user: undefined}
```

This shows the state being set to true, then immediately cleared to false.

## Additional Issues

### 1. Multiple Auth State Clearers
Both services clear auth state when they don't find their respective tokens:
- AuthService clears when no `GITHUB_TOKEN` found
- SecureTokenIPC clears when no `ORBIT_AUTH` found

### 2. No Coordination
The services don't coordinate - they both think they "own" the AuthStateManager.

### 3. Race Conditions
Multiple components mounting simultaneously can trigger multiple auth checks, leading to unpredictable state.

## Proposed Solutions

### Option 1: Unified Token Key
Use a single token key for GitHub authentication across both services.

### Option 2: Separate Auth Contexts
Maintain separate auth states for different authentication contexts (GitHub vs Orbit).

### Option 3: Primary Auth Service
Designate AuthService as the primary auth manager and have SecureTokenIPC query it instead of managing state directly.

### Option 4: Token Migration
Migrate existing `ORBIT_AUTH` tokens to `GITHUB_TOKEN` and deprecate the old key.

## Immediate Fix

The quickest fix is to prevent SecureTokenIPC from clearing AuthStateManager when it doesn't find tokens. Only AuthService should manage the auth state lifecycle.

## Long-term Recommendation

1. Audit all authentication flows to understand which tokens are for what purpose
2. Create a clear separation between different auth contexts
3. Document the authentication architecture
4. Consider using a single source of truth for auth state management