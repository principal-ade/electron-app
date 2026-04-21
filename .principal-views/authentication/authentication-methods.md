# Authentication Methods Architecture

## Overview

The application supports **multiple authentication methods** that can work independently or as fallbacks for each other. This provides flexibility for different user preferences and security requirements.

## Authentication Methods

### 1. App OAuth (Primary)

**What it is:**
- Full OAuth flow with GitHub
- Tokens stored in system keychain via `UnifiedSecureStorage`
- Managed by `AuthService` and `AuthStateManager`

**Capabilities:**
- Full GitHub API access with user's OAuth scopes
- Automatic token refresh via WorkOS
- Centralized auth state management
- Cross-window auth synchronization via IPC

**When to use:**
- User wants full integration with the app
- Needs features requiring specific OAuth scopes
- Prefers app-managed authentication

**Limitations:**
- Requires OAuth consent
- Requires keychain access
- Tokens stored in app's secure storage

**UI Indicator:**
- User profile shown in sidebar and feed panel
- "Sign out" option available
- `AuthStateManager.isAuthenticated === true`

---

### 2. GitHub CLI (`gh`) Fallback

**What it is:**
- Uses system-installed `gh` CLI credentials
- Automatically used when app OAuth tokens not available
- Runs `gh api` commands to access GitHub API

**Capabilities:**
- Full GitHub API access (same as OAuth)
- Uses whatever scopes user granted to `gh` CLI
- No app keychain access required
- Works independently of app authentication

**When to use:**
- User doesn't want to authenticate with app
- User already uses `gh` CLI for development
- Keychain access issues prevent app OAuth
- User prefers system-level authentication

**Limitations:**
- Requires `gh` CLI installed and authenticated (`gh auth login`)
- No automatic token refresh by app
- Performance overhead (spawns CLI process per call)
- No centralized auth state in app
- User must manage `gh` authentication separately

**How to check if available:**
```bash
# Check if gh is installed
which gh

# Check if authenticated
gh auth status

# View current auth
gh auth status -t
```

**UI Indicator:**
- Currently: No indicator (appears as unauthenticated in app UI)
- **Opportunity:** Could show "Using gh CLI credentials" badge

---

### 3. Git Credential Manager

**What it is:**
- System git credentials configured in git config
- Used for git operations (clone, push, pull, fetch)
- Managed by `GitCredentialHelper`

**Capabilities:**
- Git operations only (not GitHub API)
- Push/pull to private repositories
- Clone private repositories

**When to use:**
- Git operations (not API calls)
- User has git credentials configured separately
- SSH key authentication

**Limitations:**
- Cannot access GitHub API (only git operations)
- Separate from OAuth and CLI authentication

**How to check:**
```bash
# Check git credentials
git config --global credential.helper

# Check SSH keys
ssh -T git@github.com
```

---

## Authentication Flow Precedence

For GitHub API calls, the app uses this fallback order:

```
1. App OAuth Token (from keychain)
   ↓ (if not available or invalid)
2. GitHub CLI (`gh api`)
   ↓ (if gh not installed/authenticated)
3. Return empty results or error
```

### Code Example

From `githubHandlers.ts` line 1255-1287:

```typescript
async getUserOrganizations(): Promise<GitHubOrganization[]> {
  // 1. Try using token-based API first (App OAuth)
  const apiResult = await this.makeGitHubAPICall('/user/orgs');
  if (apiResult.success && apiResult.data) {
    return transformOrgs(apiResult.data);
  }

  // 2. Fallback to CLI (gh CLI)
  try {
    const result = await this.executeCommand(['gh', 'api', '/user/orgs']);
    if (result.success && result.stdout) {
      return transformOrgs(JSON.parse(result.stdout));
    }
    return [];
  } catch (error) {
    console.error('[GitHub] Error getting user organizations:', error);
    return [];
  }
}
```

**Current issue:** This fallback happens silently. After logout, users see organizations loading via CLI fallback, which is confusing.

---

## API Coverage by Method

| API Endpoint | App OAuth | gh CLI | Git Creds |
|--------------|-----------|---------|-----------|
| `/user` | ✅ | ✅ | ❌ |
| `/user/orgs` | ✅ | ✅ | ❌ |
| `/user/repos` | ✅ | ✅ | ❌ |
| `/repos/{owner}/{repo}` | ✅ | ✅ | ❌ |
| `/orgs/{org}/members` | ✅ | ✅ | ❌ |
| Git clone/push/pull | ❌ | ❌ | ✅ |

---

## CLI Fallback Locations

The CLI fallback is used in **19 locations** in `githubHandlers.ts`:

1. `getStarredRepositories()` - line 1072
2. `getUserRepositories()` - line 1217
3. `getUserOrganizations()` - line 1267
4. `getCurrentUser()` - line 1358
5. `getRepositoryCommits()` - line 1530
6. `getRepository()` - line 1628
7. `searchRepositories()` - line 1722
8. `getUserProfile()` - line 1791
9. `getOrgMembers()` - line 1873
10. `getUserFollowers()` - line 1933
11. `getUserFollowing()` - line 1986
12. `createRepository()` - line 2004
13. `forkRepository()` - line 2040
14-19. Various other GitHub API operations

---

## Design Opportunities

### 1. **Authentication Method Awareness**

**Current state:** App doesn't distinguish between auth methods in UI

**Improvement:** Show authentication method clearly:
```
┌─────────────────────────────┐
│ ✓ Authenticated via:        │
│   • App OAuth (Primary)     │
│   or                        │
│   • gh CLI (Fallback)       │
│   or                        │
│   • Not authenticated       │
└─────────────────────────────┘
```

### 2. **Explicit Authentication Choice**

Let users choose their preferred method:
```
Settings → Authentication:
○ Use app OAuth (Recommended)
○ Use gh CLI only
○ Use both (OAuth with CLI fallback)
```

### 3. **Auth Method Indicator in UI**

When using CLI fallback, show badge:
```
┌─────────────────────┐
│ Your Organizations  │
│ [Using gh CLI] 🔵   │
│ • org1              │
│ • org2              │
└─────────────────────┘
```

### 4. **Capability Matrix**

Show users what they can do with each method:

| Feature | App OAuth | gh CLI | Status |
|---------|-----------|---------|---------|
| View repos | ✅ | ✅ | Working |
| View orgs | ✅ | ✅ | Working |
| Create repo | ✅ | ✅ | Working |
| Git operations | Via git creds | Via git creds | Working |
| Auto-refresh tokens | ✅ | ❌ | OAuth only |

### 5. **Clear Logout Behavior**

When user logs out of app OAuth:
```
┌────────────────────────────────────┐
│ Signed out of app                  │
│                                    │
│ Note: You're still authenticated   │
│ via gh CLI. Organizations and      │
│ repos are still accessible.        │
│                                    │
│ To fully sign out:                 │
│ Run: gh auth logout                │
└────────────────────────────────────┘
```

---

## User Stories

### Story 1: Privacy-Conscious User
**As a** privacy-conscious user
**I want to** use the app without OAuth
**So that** I don't grant app-level access to my GitHub account

**Solution:** User installs `gh` CLI, authenticates there, and app uses CLI fallback

---

### Story 2: Power User
**As a** power user who already uses `gh` CLI
**I want to** avoid duplicate authentication
**So that** I have one less credential to manage

**Solution:** App detects `gh` auth and uses it automatically

---

### Story 3: Corporate User
**As a** corporate user with SSO requirements
**I want to** use system-managed authentication
**So that** I comply with company security policies

**Solution:** User authenticates via corporate `gh` CLI setup, app uses those credentials

---

### Story 4: Casual User
**As a** casual user
**I want** the simplest authentication flow
**So that** I can start using the app quickly

**Solution:** One-click OAuth flow (current primary path)

---

## Security Considerations

### App OAuth
- ✅ Tokens in encrypted keychain
- ✅ Auto-refresh via WorkOS
- ✅ Revocable via GitHub settings
- ⚠️ Requires keychain access

### gh CLI
- ✅ Managed by GitHub's official CLI
- ✅ System-level authentication
- ✅ Separate from app permissions
- ⚠️ App can access any scopes user granted to gh
- ⚠️ No indication in app when using CLI auth

### Recommendations
1. **Always show which auth method is active**
2. **Require explicit user consent** before using CLI fallback
3. **Log authentication method** for each API call
4. **Provide clear logout instructions** for each method

---

## Implementation Status

### Current (v0.0.589)
- ✅ App OAuth fully implemented
- ✅ CLI fallback silently used when OAuth unavailable
- ❌ No UI indication of auth method
- ❌ No user choice of auth method
- ❌ Confusing behavior after logout (CLI fallback kicks in)

### Proposed
- ✅ Document all auth methods (this doc)
- 🔲 Add auth method detection
- 🔲 Show auth method in UI
- 🔲 Let users choose auth preference
- 🔲 Clear logout flow for each method
- 🔲 Telemetry for auth method usage

---

## Telemetry Events

Should emit events to track auth method usage:

```typescript
{
  name: "github.api.call",
  attributes: {
    endpoint: "/user/orgs",
    auth_method: "oauth" | "cli" | "none",
    success: true,
    fallback_used: boolean
  }
}
```

This helps understand:
- How many users rely on CLI fallback
- Which endpoints use fallback most
- Performance impact of CLI vs OAuth

---

## Related Files

- `src/main/services/AuthService.ts` - App OAuth management
- `src/main/version-control-providers/githubHandlers.ts` - CLI fallback logic
- `src/main/services/GitCredentialHelper.ts` - Git credential management
- `src/renderer/hooks/useAuthState.ts` - React auth state
- `.principal-views/authentication/authentication.otel.canvas` - Logout telemetry

---

## Next Steps

1. **Audit current behavior** - Document which features work with each auth method
2. **Add detection** - Detect which auth methods are available
3. **Update UI** - Show current auth method clearly
4. **Add choice** - Let users select preferred auth method
5. **Improve logout** - Make logout behavior clear for each method
6. **Add telemetry** - Track auth method usage
7. **User testing** - Validate with users who prefer different methods
