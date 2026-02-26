# Authentication & Token Refresh Flow

This document explains how authentication works in Principal ADE, including OAuth flows, token storage, and automatic refresh.

## What Problem Does This Solve?

Users need to authenticate with multiple services (WorkOS for identity, GitHub for repositories) while:

- **Maintaining security** with proper token storage
- **Avoiding re-login** through automatic token refresh
- **Syncing auth state** across all windows

## Authentication Flow

### Initial Login

1. User clicks login in AuthView
2. `useAuthState()` hook triggers `AuthenticationService`
3. Service calls main process via IPC bridge
4. `AuthService` initiates OAuth via `OAuthServerClient`
5. System browser opens WorkOS login page
6. User completes authentication
7. Tokens returned and stored securely

### Token Storage

Tokens are stored using `UnifiedSecureStorage`:

- **Encryption**: Uses Electron's `safeStorage` (OS keychain)
- **Persistence**: Encrypted data written to `unified-secure-storage.json`
- **Token Types**:
  - `workos_token`: Primary access token
  - `workos_refresh_token`: For automatic renewal
  - `github_token`: GitHub API access

### Token Refresh

`JWTService` monitors token expiration and:
1. Detects token nearing expiry
2. Uses refresh token to obtain new access token
3. Updates storage atomically
4. Broadcasts state change to all windows

## Design Decisions

### Why WorkOS?

WorkOS provides enterprise-grade authentication with:
- SSO support for organizations
- Secure OAuth implementation
- User management APIs

### Why Separate GitHub Token?

GitHub access is managed separately because:
- Different refresh cycles
- Can be revoked independently
- Supports fine-grained permissions

## State Synchronization

`AuthStateManager` broadcasts auth changes to all windows via IPC events, ensuring:
- Consistent login state everywhere
- Immediate logout propagation
- New windows receive current state
