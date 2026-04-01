# UI Components Interacting with Secure Storage

## Overview
This document maps all UI components in the Electron app that interact with the secure storage system (currently split between `SecureTokenStorage` and `SecretManager`, to be unified as per UNIFIED_SECURE_STORAGE_PLAN.md).

## Architecture Flow
```
UI Components (Renderer Process)
    ↓
Main Process API Services
    ↓
IPC Handlers
    ↓
Secure Storage Services (Main Process)
    ↓
OS Keychain (macOS) / Credential Manager (Windows)
```

## Authentication Components

### 1. TitlebarAuth Component
**Location**: `src/renderer/components/Titlebar/TitlebarAuth.tsx`
**Purpose**: Displays authentication status in the titlebar
**Secure Storage Interactions**:
- Reads authentication state via `useAuthState` hook
- Triggers logout which clears tokens from secure storage
- Displays user information (username, avatar) retrieved from stored auth data
**Storage Keys Used**:
- `github_token` - GitHub access token obtained via WorkOS (via AuthenticationService)
- User metadata associated with the token

### 2. CollaborationPanel Component
**Location**: `src/renderer/components/CollaborationPanel.tsx`
**Purpose**: Handles P2P collaboration features
**Secure Storage Interactions**:
- Authenticates users via WorkOS (GitHub provider)
- Stores/retrieves GitHub access tokens for API access
- Uses `GitHubAuth.authenticate()` which internally stores tokens
**Storage Keys Used**:
- GitHub access tokens (obtained via WorkOS) for collaboration features
- Repository access verification tokens

### 3. CollaborationPanelWithSync Component
**Location**: `src/renderer/components/CollaborationPanelWithSync.tsx`
**Purpose**: Extended collaboration panel with git-sync features
**Secure Storage Interactions**:
- Manages git-sync authentication tokens
- Stores credentials for remote repository access
**Storage Keys Used**:
- `git-sync-auth` tokens
- Repository-specific sync credentials

## Configuration Components

### 4. AgentSetupWizard
**Location**: `src/renderer/pages/LandingPage/AgentConfigurationView/AgentSetupWizard.tsx`
**Purpose**: Configure AI agent connections
**Secure Storage Interactions**:
- Manages agent authentication tokens
- Stores API keys for various AI providers
**Storage Keys Used**:
- Agent-specific API keys
- MCP (Model Context Protocol) server credentials

### 5. DetailedConfigurationView
**Location**: `src/renderer/pages/LandingPage/AgentConfigurationView/DetailedConfigurationView.tsx`
**Purpose**: Advanced agent configuration interface
**Secure Storage Interactions**:
- Displays and manages multiple agent configurations
- Stores custom model API endpoints and keys
**Storage Keys Used**:
- Custom model provider API keys
- Agent configuration metadata

## Repository Secrets Management

### 6. SecretsModal Component
**Location**: `src/renderer/repo-manager/shared/SecretsModal.tsx`
**Purpose**: Manage repository-specific environment secrets
**Secure Storage Interactions**:
- Stores/retrieves repository-specific secrets via `SecretsService`
- Encrypts secrets using system's secure storage
- Provides UI for adding, editing, viewing, and deleting secrets
- Shows/hides secret values with toggle functionality
**Storage Keys Used**:
- `repo-{repoId}`: Repository-specific secrets stored as key-value pairs
- Metadata includes: updatedAt, secretCount, repoPath
**Security Features**:
- Password field for new secret input
- Masked display by default (••••••••)
- Eye/EyeOff toggle for viewing
- Confirmation before deletion
- Auto-cleanup of environment files

### 7. SecretsService (Renderer)
**Location**: `src/renderer/main-process-api/SecretsService.ts`
**Purpose**: Service layer for secrets management in renderer process
**Key Methods**:
```typescript
- get(repoId): Retrieve secrets for a repository
- store(request): Store new/updated secrets
- delete(repoId): Remove all secrets for a repository
- list(): Get metadata for all stored secrets
- exists(repoId): Check if secrets exist for a repo
- update(request): Merge with existing secrets
```

### 9. SecretHandlers (Main Process)
**Location**: `src/main/stores/secretHandlers.ts`
**Purpose**: IPC handlers for secret operations
**Secure Storage Integration**:
- Uses `UnifiedSecureStorage.getInstance()` for all operations
- Lazy initialization to defer keychain access
- Validates request source for security
- Handles encryption/decryption transparently
**Operations Flow**:
1. Renderer calls `SecretsService` method
2. IPC message sent to main process
3. `secretHandlers` receives and validates request
4. Calls `UnifiedSecureStorage` methods (storeSecrets, getSecrets, etc.)
5. Returns encrypted data back to renderer

## Repository Management Components

### 10. IssuesTab
**Location**: `src/renderer/components/repository-maps/IssuesTab.tsx`
**Purpose**: Display and manage GitHub issues
**Secure Storage Interactions**:
- Uses GitHub token for API calls
- Caches authentication state for issue operations
**Storage Keys Used**:
- `github_token` for GitHub API access

### 11. SyncStatusIndicator
**Location**: `src/renderer/components/repository-maps/SyncStatusIndicator.tsx`
**Purpose**: Shows git-sync status
**Secure Storage Interactions**:
- Reads sync authentication status
- Displays connection state based on stored credentials
**Storage Keys Used**:
- Git-sync authentication tokens
- Repository sync credentials

## Service Layer Interfaces

### 12. AuthenticationService
**Location**: `src/renderer/main-process-api/AuthenticationService.ts`
**Purpose**: Primary interface for authentication operations
**Key Methods**:
```typescript
- login(): Initiates OAuth flow
- logout(): Clears all auth tokens
- saveGitHubAuth(): Stores GitHub token
- getGitHubAuth(): Retrieves GitHub token
- saveToken(): Generic token storage
- getToken(): Generic token retrieval
- deleteToken(): Remove specific token
```

### 13. GitHubAuth Service
**Location**: `src/renderer/services/p2p/GitHubAuth.ts`
**Purpose**: GitHub-specific authentication handling
**Secure Storage Interactions**:
- Manages GitHub OAuth flow
- Stores and retrieves GitHub tokens
- Verifies repository access permissions

## Security Patterns

### Token Display Pattern
Components follow a consistent pattern for displaying sensitive data:
1. Initially hidden with placeholder (•••••)
2. Toggle button to show/hide (Eye/EyeOff icon)
3. Copy to clipboard functionality with temporary success feedback
4. Auto-hide after a timeout when shown

### Authentication Flow Pattern
1. Check existing authentication on component mount
2. Display appropriate UI based on auth state
3. Handle token refresh if needed
4. Clear tokens on logout or error

### Error Handling Pattern
- Never log sensitive tokens
- Display generic error messages to users
- Store detailed errors in secure logs only
- Automatic retry with exponential backoff for transient failures

## Current State of Unified Storage

### Already Implemented
The `UnifiedSecureStorage` has been **already implemented** and is currently in use:
- `AuthService` (main process) already uses `UnifiedSecureStorage.getInstance()`
- `secretHandlers` (main process) already uses `UnifiedSecureStorage.getInstance()`
- All authentication and secrets flows go through the unified storage
- The migration from separate `SecureTokenStorage` and `SecretManager` is complete

### Current Architecture
1. **Main Process Services Using UnifiedSecureStorage**:
   - `AuthService`: Uses UnifiedSecureStorage for all token operations
   - `SecureTokenIPC`: Bridges IPC calls to UnifiedSecureStorage for tokens
   - `secretHandlers`: Handles repository-specific secrets via UnifiedSecureStorage
   - Storage domains (`TokenDomain`, `SecretsDomain`) handle specialized storage

2. **Two Primary Storage Paths**:

   **Authentication Tokens Path**:
   - UI Components (TitlebarAuth, CollaborationPanel, etc.)
   - → AuthenticationService (renderer)
   - → IPC to AuthService (main)
   - → UnifiedSecureStorage.tokens domain
   - → OS Keychain

   **Repository Secrets Path**:
   - UI Components (SecretsModal in RepoManager)
   - → SecretsService (renderer)
   - → IPC to secretHandlers (main)
   - → UnifiedSecureStorage.secrets domain
   - → OS Keychain

3. **Benefits Already Realized**:
   - Single keychain prompt for all secure operations
   - Unified encryption initialization
   - Centralized storage file management
   - Consistent error handling across all secure storage
   - Repository isolation for secrets maintained

4. **Storage Implementation Details**:
   - Single storage file: `{userData}/unified-secure-storage.json`
   - Lazy initialization to defer keychain access
   - Memory caching for performance
   - Atomic write operations for data integrity
   - Repository-specific namespacing for secrets (`repo-{id}`)

## Testing Considerations

### Component Testing
- Mock secure storage in tests
- Test authentication flows without real tokens
- Verify token display/hide functionality
- Test error states and recovery

### Integration Testing
- Test full OAuth flow
- Verify token persistence across app restarts
- Test migration from old to new storage
- Verify single keychain prompt

### Security Testing
- Ensure tokens never appear in logs
- Verify secure transmission over IPC
- Test token expiration handling
- Validate encryption at rest

## Future Improvements

### Planned Enhancements
1. **Centralized Credentials Manager UI**
   - Single location to manage all stored credentials
   - Bulk operations (clear all, export, import)
   - Audit log viewer

2. **Token Rotation UI**
   - Automatic token refresh indicators
   - Manual rotation triggers
   - Expiration warnings

3. **Security Dashboard**
   - Show which services have stored credentials
   - Last access times
   - Security recommendations

### Component Consolidation
- Merge similar authentication components
- Create reusable credential input components
- Standardize token display across all UIs

## Appendix: Storage Key Reference

### Application-Wide Tokens
- `github_token`: GitHub API authentication
- `orbit_auth`: Orbit authentication token
- `git-sync-auth`: Git synchronization credentials

### Repository-Specific Secrets
- `repo-{id}`: Repository-specific credentials
- Format: `{ data: {...}, metadata: {...} }`

### Metadata Fields
- `lastModified`: Timestamp of last update
- `expiresAt`: Token expiration time (if applicable)
- `scope`: Permission scope for the token
- `source`: How the token was obtained (oauth, manual, etc.)