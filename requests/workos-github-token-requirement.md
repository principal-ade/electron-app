# Request: WorkOS Token Endpoint - Return GitHub Access Token

**Date:** 2025-10-20
**Requested By:** Electron App Team
**Target Project:** landing-page
**Priority:** High (Blocking)

---

## Summary

The `/api/auth/workos/token` endpoint needs to return the GitHub access token (not just the WorkOS token) to maintain compatibility with the electron-app's GitHub API operations.

## Background

The electron-app currently uses the legacy GitHub OAuth flow (`/api/auth/cli/*` endpoints) which returns a GitHub access token that can be used to call `api.github.com`.

To migrate to WorkOS, the electron-app needs the **GitHub access token** returned by the WorkOS flow, not just the WorkOS token.

---

## Problem

### Current WorkOS Token Response

`POST /api/auth/workos/token` currently returns:

```json
{
  "access_token": "wos_xxxxx",        // ❌ WorkOS token - can't call GitHub API
  "refresh_token": "wos_refresh_xxx",
  "token_type": "Bearer",
  "user": {
    "id": "user_01HXXX",              // ❌ WorkOS user ID, not GitHub ID
    "email": "user@example.com",
    "login": "user",                  // ❌ Derived from email, not real GitHub username
    "name": "User Name"
  },
  "provider": "workos",
  "workos_user_id": "user_01HXXX"
}
```

### What Electron-App Needs

The electron-app requires:
- **GitHub access token** to call `api.github.com` for:
  - Repository operations
  - Branch/commit management
  - Pull request/issue access
  - Private repository access
- **Real GitHub user data** (ID, username, email)

### Expected Response Format

To match the legacy `/api/auth/cli/token` behavior:

```json
{
  "access_token": "gho_xxxxx",          // ✅ GitHub token - works with api.github.com
  "workos_access_token": "wos_xxxxx",   // Keep WorkOS token for reference
  "refresh_token": "wos_refresh_xxx",
  "token_type": "Bearer",
  "user": {
    "id": 583231,                       // ✅ Real GitHub user ID
    "login": "octocat",                 // ✅ Real GitHub username
    "email": "octocat@github.com",
    "name": "The Octocat",
    "avatar_url": "https://avatars.githubusercontent.com/u/583231"
  },
  "provider": "workos",
  "workos_user_id": "user_01HXXX",
  "github_access_token": "gho_xxxxx"    // Also available explicitly
}
```

---

## Solution

### 1. Extract GitHub Token from WorkOS Response

The `/api/auth/workos/callback/route.ts` **already does this correctly** (lines 211-221). The same logic needs to be applied to the token endpoint.

### 2. Code Changes Required

**File:** `src/app/api/auth/workos/token/route.ts`

**Location:** Around lines 70-118, after the WorkOS authentication

```typescript
// Authenticate with WorkOS using the authorization code
const authResponse = await workos.userManagement.authenticateWithCode({
  clientId: process.env.WORKOS_CLIENT_ID,
  code: session.code,
});

// Get user profile from WorkOS
const userProfile = await workos.userManagement.getUser(
  authResponse.user.id,
);

// ============================================================
// ADD THIS: Extract GitHub access token from WorkOS response
// ============================================================
let githubAccessToken: string | null = null;

// WorkOS returns the OAuth provider's access token when configured
if ((authResponse as any).impersonator?.accessToken) {
  githubAccessToken = (authResponse as any).impersonator.accessToken;
} else if ((authResponse as any).oauthTokens?.accessToken) {
  githubAccessToken = (authResponse as any).oauthTokens.accessToken;
}

console.log('[WorkOS] GitHub token available:', !!githubAccessToken);

// ============================================================
// ADD THIS: Fetch real GitHub user data using the GitHub token
// ============================================================
let githubUserData = null;
if (githubAccessToken) {
  try {
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${githubAccessToken}`,
        Accept: "application/json",
      },
    });

    if (userResponse.ok) {
      githubUserData = await userResponse.json();
      console.log('[WorkOS] GitHub user data fetched:', githubUserData.login);
    } else {
      console.warn('[WorkOS] Failed to fetch GitHub user data');
    }
  } catch (error) {
    console.error('[WorkOS] Error fetching GitHub user data:', error);
  }
}

// Clean up the session
global.cliAuthSessions.delete(state);

// ============================================================
// MODIFY THIS: Return GitHub token as primary access_token
// ============================================================
return NextResponse.json({
  // Primary access token should be GitHub token (for backwards compatibility)
  access_token: githubAccessToken || authResponse.accessToken,

  // Keep WorkOS token available
  workos_access_token: authResponse.accessToken,
  refresh_token: authResponse.refreshToken,
  token_type: "Bearer",

  // Use real GitHub user data if available
  user: githubUserData ? {
    id: githubUserData.id,                    // Real GitHub ID
    email: githubUserData.email || authResponse.user.email,
    login: githubUserData.login,              // Real GitHub username
    name: githubUserData.name ||
      (authResponse.user.firstName && authResponse.user.lastName
        ? `${authResponse.user.firstName} ${authResponse.user.lastName}`
        : authResponse.user.email),
    avatar_url: githubUserData.avatar_url,
  } : {
    // Fallback to WorkOS data if GitHub fetch failed
    id: authResponse.user.id,
    email: authResponse.user.email,
    login: authResponse.user.email?.split("@")[0] || authResponse.user.id,
    name: authResponse.user.firstName && authResponse.user.lastName
      ? `${authResponse.user.firstName} ${authResponse.user.lastName}`
      : authResponse.user.email,
  },

  provider: "workos",
  workos_user_id: authResponse.user.id,
  github_access_token: githubAccessToken,     // Also available explicitly
});
```

---

## Required WorkOS Configuration

For WorkOS to return the GitHub access token, you need to enable a setting in the WorkOS Dashboard:

1. Go to [WorkOS Dashboard](https://dashboard.workos.com)
2. Navigate to **Authentication** → **Connections** → **GitHub**
3. Find and enable: **"Return OAuth tokens"** or **"Return GitHub OAuth tokens"**
4. Save the configuration

Without this setting enabled, WorkOS will not include the GitHub token in the authentication response, and the above code will not work.

---

## Testing

### 1. Manual Testing

Start a WorkOS auth flow and exchange for token:

```bash
# 1. Start auth flow
curl -X POST http://localhost:3000/api/auth/workos/start \
  -H "Content-Type: application/json" \
  -d '{
    "code_challenge": "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    "state": "test-state-123"
  }'

# 2. Complete auth in browser (use returned auth_url)

# 3. Exchange for token
curl -X POST http://localhost:3000/api/auth/workos/token \
  -H "Content-Type: application/json" \
  -d '{
    "state": "test-state-123",
    "code_verifier": "test-verifier-that-matches-challenge"
  }'
```

### 2. Verify Response

Check that the response includes:
- ✅ `access_token` starts with `gho_` or `ghp_` (GitHub token)
- ✅ `github_access_token` field is present
- ✅ `user.id` is a number (GitHub ID, not WorkOS string)
- ✅ `user.login` is the actual GitHub username

### 3. Test GitHub API Access

```bash
# Extract the access_token from response
TOKEN="gho_xxxxx"

# Test that it works with GitHub API
curl -H "Authorization: Bearer $TOKEN" https://api.github.com/user
```

Should return the authenticated user's GitHub profile.

---

## Impact

**Without this change:**
- ❌ Electron-app cannot migrate to WorkOS
- ❌ GitHub API operations will fail
- ❌ Repository access will break
- ❌ Users will lose functionality

**With this change:**
- ✅ Electron-app can migrate to WorkOS seamlessly
- ✅ All GitHub API operations continue working
- ✅ Backwards compatible with existing behavior
- ✅ Can eventually deprecate legacy GitHub OAuth endpoints

---

## Timeline

This is **blocking** the electron-app's migration to WorkOS. The electron-app team has prepared client-side changes but cannot deploy until this server-side fix is implemented.

---

## Questions or Issues?

If you have questions about this request or need clarification:
- Check the existing implementation in `/api/auth/workos/callback/route.ts` (lines 211-236) which already does this for web flows
- Review the legacy implementation in `/api/auth/cli/token/route.ts` which shows the expected response format
- See the migration guide in `docs/AUTH_MIGRATION_GUIDE.md`

---

## Reference Files

- **Current WorkOS token endpoint:** `src/app/api/auth/workos/token/route.ts`
- **Working example (callback):** `src/app/api/auth/workos/callback/route.ts` (lines 211-236)
- **Legacy endpoint (reference):** `src/app/api/auth/cli/token/route.ts`
- **Documentation:** `docs/AUTH_MIGRATION_GUIDE.md`, `docs/WORKOS_SETUP_GUIDE.md`
