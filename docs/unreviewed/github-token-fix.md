# GitHub Token Preservation Fix

## Problem

When WorkOS tokens are refreshed, the electron-app **overwrites the GitHub access token** with the WorkOS token, causing API calls to fail.

### Root Cause

1. **Initial Auth** (`/api/auth/workos/token`):
   ```json
   {
     "access_token": "gho_xxx",           // GitHub token
     "github_access_token": "gho_xxx",    // Same GitHub token
     "refresh_token": "workos_refresh"
   }
   ```

2. **Token Refresh** (`/api/auth/workos/refresh`):
   ```json
   {
     "access_token": "eyJhbG...",         // WorkOS JWT (NOT GitHub!)
     "github_access_token": null,          // ❌ No GitHub token!
     "refresh_token": "workos_refresh"
   }
   ```

3. **electron-app stores `access_token`** which overwrites the GitHub token with WorkOS token
4. **API calls fail** because they need the GitHub token, not WorkOS token

### Code Location

**File:** `src/main/services/OAuthServerClient.ts:248`
```typescript
return {
  token: tokenResponse.access_token,  // ❌ This is WorkOS token on refresh!
  refreshToken: newRefreshToken,
  expiresAt,
  user: tokenResponse.user,
};
```

**File:** `src/main/services/AuthService.ts:355`
```typescript
// This overwrites the GitHub token with WorkOS token
await this.storeAuth(
  refreshedAuth.token,  // ❌ WorkOS token replaces GitHub token!
  refreshedAuth.user,
  refreshedAuth.refreshToken,
  refreshedAuth.expiresAt,
);
```

## Solution

Since **GitHub OAuth App tokens never expire**, we should:
1. **Store the GitHub token separately** from the WorkOS token
2. **Never overwrite the GitHub token** during WorkOS refresh
3. **Always use the GitHub token** for API calls

### Implementation

#### Option 1: Separate Storage (Recommended)

Store two tokens separately:

**src/main/services/UnifiedSecureStorage.ts** - Add new key:
```typescript
export const TOKEN_KEYS = {
  GITHUB_TOKEN: 'github-token',        // For GitHub API calls
  WORKOS_TOKEN: 'workos-token',        // For WorkOS session
  // ... existing keys
};
```

**src/main/services/OAuthServerClient.ts** - Return both tokens:
```typescript
interface TokenResponse {
  access_token: string;
  github_access_token?: string;  // Add this
  workos_access_token?: string;  // Add this
  refresh_token?: string;
  // ...
}

async refreshAccessToken(refreshToken: string): Promise<AuthResult> {
  // ... existing code ...

  const tokenResponse = (await response.json()) as TokenResponse;

  // Prefer github_access_token if available, fallback to access_token
  const githubToken = tokenResponse.github_access_token || tokenResponse.access_token;
  const workosToken = tokenResponse.workos_access_token || tokenResponse.access_token;

  return {
    token: githubToken,           // ✅ GitHub token for API calls
    workosToken: workosToken,     // ✅ WorkOS token for session
    refreshToken: newRefreshToken,
    expiresAt,
    user: tokenResponse.user,
  };
}
```

**src/main/services/AuthService.ts** - Store both tokens:
```typescript
private async storeAuth(
  githubToken: string,
  user: any,
  workosToken?: string,
  refreshToken?: string,
  expiresAt?: number,
): Promise<void> {
  // Store GitHub token (never expires)
  await this.storage.setToken(TOKEN_KEYS.GITHUB_TOKEN, githubToken, {
    user,
  });

  // Store WorkOS token with refresh info (expires after 1 hour)
  if (workosToken) {
    await this.storage.setToken(TOKEN_KEYS.WORKOS_TOKEN, workosToken, {
      refreshToken,
      expiresAt,
    });
  }
}

private async getStoredAuth(): Promise<AuthResult> {
  // Get GitHub token (primary)
  const githubTokenData = await this.storage.getTokenWithMetadata(TOKEN_KEYS.GITHUB_TOKEN);

  if (!githubTokenData) {
    return { success: false, authenticated: false };
  }

  const { token: githubToken, metadata } = githubTokenData;
  const user = metadata?.user;

  // Get WorkOS token for refresh
  const workosTokenData = await this.storage.getTokenWithMetadata(TOKEN_KEYS.WORKOS_TOKEN);
  const refreshToken = workosTokenData?.metadata?.refreshToken;
  const expiresAt = workosTokenData?.metadata?.expiresAt;

  // Check if WorkOS token needs refresh
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  const isExpired = expiresAt && expiresAt <= now;
  const isExpiringSoon = expiresAt && expiresAt <= now + fiveMinutes;

  if ((isExpired || isExpiringSoon) && refreshToken) {
    // Refresh WorkOS token but KEEP GitHub token
    const authClient = new OAuthServerClient({...});
    const refreshedAuth = await authClient.refreshAccessToken(refreshToken);

    // ✅ Only update WorkOS token, preserve GitHub token
    await this.storage.setToken(TOKEN_KEYS.WORKOS_TOKEN, refreshedAuth.workosToken, {
      refreshToken: refreshedAuth.refreshToken,
      expiresAt: refreshedAuth.expiresAt,
    });

    // ✅ Return GitHub token (unchanged)
    return {
      success: true,
      authenticated: true,
      token: githubToken,  // ✅ Original GitHub token preserved!
      user,
    };
  }

  return {
    success: true,
    authenticated: true,
    token: githubToken,  // ✅ Always return GitHub token for API calls
    user,
  };
}
```

#### Option 2: Simpler Fix (Quick)

Just don't refresh if the token is a GitHub OAuth App token:

**src/main/services/AuthService.ts**:
```typescript
// Check if this is a GitHub OAuth App token (they don't expire)
const isGitHubOAuthToken = token.startsWith('gho_');

if (isGitHubOAuthToken) {
  // GitHub OAuth App tokens never expire, no need to refresh
  return {
    success: true,
    authenticated: true,
    token,
    user,
  };
}

// Only refresh WorkOS tokens
if ((isExpired || isExpiringSoon) && refreshToken) {
  // ... refresh logic
}
```

## Testing

After implementing the fix:

1. **Initial Auth**: Verify both GitHub and WorkOS tokens are stored
2. **Token Refresh**: Verify GitHub token is NOT overwritten
3. **API Calls**: Verify timeline/sessions endpoints still work after refresh
4. **Multiple Refreshes**: Verify GitHub token persists across multiple refresh cycles

```bash
# In electron-app:
# 1. Login
# 2. Wait 1+ hours for WorkOS token to expire
# 3. Trigger refresh
# 4. Verify API calls still work
```

## Recommendation

**Use Option 1 (Separate Storage)** because:
- Clean separation of concerns
- Supports both GitHub and WorkOS tokens properly
- Easy to debug which token is being used
- Follows OAuth best practices

## Related Files to Update

1. `src/main/services/OAuthServerClient.ts` - Return both tokens
2. `src/main/services/AuthService.ts` - Store/retrieve both tokens
3. `src/main/services/UnifiedSecureStorage.ts` - Add WORKOS_TOKEN key
4. `src/shared/main-process-api-interfaces/AuthenticationAPI.ts` - Update types
