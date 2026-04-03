# Keychain Consent Feature Audit

This document captures the features that depend on macOS Keychain access and how they behave when keychain consent has not been granted.

## Overview

The app implements a first-run consent flow for macOS Keychain access. Users must explicitly grant consent before the app can securely store credentials. This document audits which features are affected when consent is pending or declined.

## Consent States

| State | Description |
|-------|-------------|
| `pending` | User has not yet made a decision (first run) |
| `granted` | User clicked "Allow" - keychain access enabled |
| `declined` | User clicked "Skip for now" - keychain access disabled |

## Feature Impact by Consent State

### Completely Blocked (Require Consent)

These features cannot function without keychain access:

| Feature | Component/File | Behavior Without Consent |
|---------|---------------|-------------------------|
| **GitHub Authentication** | `AuthView.tsx`, `AuthDetails.tsx` | Shows "Secure Storage Required" prompt |
| **Credential Storage** | `UnifiedSecureStorage.ts` | Cannot store/retrieve tokens |
| **OAuth Login Flow** | `AuthService.ts` | Login button disabled or redirects to consent |
| **Git Sync (P2P)** | `GitSyncConnectionManager.ts`, `GitSyncPanelContext.tsx` | Real-time collaboration unavailable |

### Degraded Functionality

These features work partially but with reduced capabilities:

| Feature | Component/File | Behavior Without Consent |
|---------|---------------|-------------------------|
| **Projects Panel** | `ProjectsPanelContext.tsx`, `ProjectsView.tsx` | Local projects only; no GitHub repos, orgs, or starred repos |
| **Activity Feed** | `ActivityFeedPanel.tsx`, `FeedView.tsx` | Empty state; no GitHub activity |
| **Skill Browser** | `SkillBrowserView.tsx`, `SkillsRepoOnboarding.tsx` | Cannot browse/install skills from private GitHub repos |
| **Clone from GitHub** | `CloneFromGitHubModal.tsx` | Public repos only; private repos require auth |
| **Create Repository** | `CreateRepositoryInWorkspaceModal.tsx` | Cannot create repos on GitHub |
| **Connections View** | `ConnectionsView.tsx` | Shows unauthenticated state |
| **Navigation Sidebar** | `NavigationSidebar.tsx` | User avatar/info not shown |
| **Remote Commit Heatmap** | `useRemoteCommitHeatMap.ts` | No remote commit data displayed |
| **GitHub Actions Runner** | `ActRunnerService.ts` | Cannot access repository secrets |

### Unaffected Features (Local-Only)

These features work normally without keychain consent:

| Feature | Notes |
|---------|-------|
| **Local File Browsing** | File tree, editor, file operations |
| **Local Git Operations** | Commit, branch, diff (without remote auth) |
| **Terminal** | Full terminal functionality |
| **Settings** | All settings except Security shows consent status |
| **Theme/UI** | Full theming and customization |
| **Workspaces** | Local workspace management |
| **Panels** | Local panel functionality |
| **File City Visualization** | Local codebase visualization |
| **Quality Lenses** | Local code quality metrics |

## Main Process Services Dependency Map

### Direct Keychain Access

| Service | File | Purpose |
|---------|------|---------|
| `UnifiedSecureStorage` | `src/main/services/UnifiedSecureStorage.ts` | Core encrypted storage using `safeStorage` API |
| `AuthService` | `src/main/services/AuthService.ts` | OAuth flow, token management |
| `SecureTokenIPC` | `src/main/services/SecureTokenIPC.ts` | Token access bridge to renderer |

### Indirect Keychain Access (via AuthService/Storage)

| Service | File | Purpose |
|---------|------|---------|
| `GitHubAdapter` | `src/main/version-control-providers/githubHandlers.ts` | GitHub API calls requiring auth |
| `GitHubAPICore` | `src/main/version-control-providers/github/apiCore.ts` | Base GitHub API client |
| `gitRepositoryService` | `src/main/file-system/gitRepositoryService.ts` | Git operations with credentials |
| `ActRunnerService` | `src/main/services/act/ActRunnerService.ts` | GitHub Actions with secrets |
| `secretHandlers` | `src/main/stores/secretHandlers.ts` | Repository secrets storage |

## Renderer Dependencies

### Hooks

| Hook | File | Depends On |
|------|------|-----------|
| `useAuthState` | `src/renderer/hooks/useAuthState.ts` | AuthService CHECK/STATUS |
| `useKeychainConsent` | `src/renderer/hooks/useKeychainConsent.ts` | Consent IPC handlers |

### Services

| Service | File | Depends On |
|---------|------|-----------|
| `AuthenticationService` | `src/renderer/main-process-api/AuthenticationService.ts` | AuthService handlers |
| `GithubService` | `src/renderer/main-process-api/GithubService.ts` | GitHubAdapter |
| `GitSyncConnectionManager` | `src/renderer/services/git-sync/GitSyncConnectionManager.ts` | AuthService CHECK |

### Contexts

| Context | File | Depends On |
|---------|------|-----------|
| `GitSyncPanelContext` | `src/renderer/contexts/GitSyncPanelContext.tsx` | GitSyncConnectionManager, useAuthState |
| `ProjectsPanelContext` | `src/renderer/contexts/ProjectsPanelContext.tsx` | GithubService.getCurrentUser |

## Consent Check Implementation

Consent is checked at multiple levels:

### IPC Handler Level

```typescript
// AuthService.ts - CHECK handler
ipcMain.handle(AuthEvent.CHECK, async () => {
  const hasConsent = await this.checkKeychainConsent();
  if (!hasConsent) {
    return { success: false, requiresConsent: true };
  }
  // ... proceed with keychain access
});
```

### Method Level

```typescript
// AuthService.ts - getStoredAuth()
private async getStoredAuth(): Promise<AuthResult> {
  const hasConsent = await this.checkKeychainConsent();
  if (!hasConsent) {
    return { success: false, authenticated: false };
  }
  // ... proceed with keychain access
}
```

## User Experience Flow

### First Run (Consent Pending)

1. App launches
2. Main process skips auth initialization (consent pending)
3. Main window opens
4. Consent modal appears explaining keychain access
5. User chooses:
   - **Allow**: Consent saved, keychain initialized, macOS prompt appears
   - **Skip**: Consent declined, app works in local-only mode

### Returning User (Consent Granted)

1. App launches
2. Main process initializes auth (consent granted)
3. User is automatically authenticated if credentials stored

### Returning User (Consent Declined)

1. App launches
2. Main process skips auth initialization
3. User sees local-only experience
4. Can enable later via Settings → Security

## Re-enabling Consent

Users who declined can enable keychain access later:

1. Go to **Settings → Security**
2. Click **"Enable Secure Storage"**
3. Consent modal appears
4. Click **"Allow"**
5. macOS Keychain prompt appears
6. Auth features become available

## Disabling Consent

Users who granted consent can disable it later:

1. Go to **Settings → Security**
2. Click **"Disable Secure Storage"**
3. Consent status changes to `declined`
4. App stops accessing keychain
5. **Stored credentials are preserved** on disk (encrypted)
6. Re-enabling will restore access to existing credentials

## Related Documentation

- [Authentication Services](./authentication-services.md)
- [Unified Secure Storage Plan](./unified-secure-storage-plan.md)
- [OAuth and PKCE Guide](./oauth-and-pkce-guide.md)
- [Secure Storage On-Demand Fetching](./secure-storage-on-demand-fetching.md)

## Related Code

- **Types**: `src/shared/types/userPreferences.types.ts` - `KeychainConsentState`
- **IPC Events**: `src/shared/ipc-events/AuthEvents.ts` - Consent events
- **Main Process**: `src/main/services/AuthService.ts` - Consent handlers
- **Renderer Hook**: `src/renderer/hooks/useKeychainConsent.ts`
- **Consent Modal**: `src/renderer/components/KeychainConsentModal.tsx`
- **Settings UI**: `src/renderer/principal-window/views/Settings/components/SecuritySettings.tsx`

## OTEL Telemetry

The keychain consent flow is instrumented with OpenTelemetry events. See:
- `.principal-views/keychain-consent/keychain-consent.otel.canvas`
- `.principal-views/keychain-consent/keychain-consent.workflow.json`
