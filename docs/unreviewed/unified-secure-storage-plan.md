# Unified Secure Storage Implementation Plan

## Overview
Consolidate `SecureTokenStorage` and `SecretManager` into a single unified storage service to eliminate duplicate keychain prompts and simplify the codebase.

## Current Problem
- Two separate services trigger independent keychain access prompts
- `SecureTokenStorage`: Handles app-wide authentication tokens
- `SecretManager`: Handles repository-specific secrets
- Users must authenticate twice with macOS Keychain

## Proposed Solution
Create a `UnifiedSecureStorage` service that handles all encrypted storage needs with a single keychain access point.

## Architecture Design

### Core Service Structure
```typescript
class UnifiedSecureStorage {
  // Single encryption initialization
  private encryptionInitialized = false;

  // Specialized storage domains
  private tokens: TokenStorage;      // App-wide tokens
  private secrets: SecretsStorage;   // Repo-specific secrets

  // Unified storage file
  private storageFile: string; // {userData}/unified-secure-storage.json
}
```

### Storage Format
```json
{
  "version": "1.0.0",
  "encrypted": {
    "tokens": {
      "github_token": "...",
      "orbit_auth": "...",
      "git-sync-auth": "..."
    },
    "secrets": {
      "repo-{id}": {
        "data": { /* secret data */ },
        "metadata": { /* metadata */ }
      }
    }
  },
  "metadata": {
    "lastModified": "timestamp",
    "secretsCount": { /* per-repo counts */ }
  }
}
```

## Implementation Steps

### Phase 1: Create Unified Service
1. **New file**: `src/main/services/UnifiedSecureStorage.ts`
   - Single encryption check/initialization
   - Centralized file I/O operations
   - Shared memory cache

2. **Storage domains**:
   - `TokenDomain`: Handles app-wide authentication tokens
   - `SecretsDomain`: Handles repository-specific secrets with metadata

### Phase 2: Service Features
1. **Core Methods**:
   ```typescript
   // Token operations
   setToken(key: string, token: string, metadata?: any): Promise<void>
   getToken(key: string): Promise<string | null>
   deleteToken(key: string): Promise<void>

   // Secret operations
   storeSecrets(repoId: string, secrets: RepositorySecrets): Promise<Result>
   getSecrets(repoId: string): Promise<RepositorySecrets | null>
   deleteSecrets(repoId: string): Promise<void>

   // Shared operations
   clearAll(): Promise<void>
   exportData(): Promise<ExportedData>
   importData(data: ExportedData): Promise<void>
   ```

2. **Preserved Features**:
   - Audit logging for secrets
   - Metadata tracking
   - Memory caching for performance
   - Repository isolation for secrets

### Phase 3: Migration Path
1. **Update IPC Handlers**:
   - `SecureTokenIPC` → Use `UnifiedSecureStorage.tokens`
   - `secretHandlers` → Use `UnifiedSecureStorage.secrets`

2. **Update Services**:
   - `AuthService` → Use unified storage for GitHub auth
   - `GitSyncService` → Use unified storage for sync credentials
   - Repository operations → Use unified storage for secrets

3. **Data Migration**:
   - On first launch, check for existing data files
   - Migrate from `secure-tokens.json` and `*.enc` files
   - Clean up old storage files after successful migration

### Phase 4: Cleanup
1. **Remove old services**:
   - Delete `SecureTokenStorage.ts`
   - Delete `SecretManager.ts`
   - Remove old storage file references

2. **Update tests**:
   - Consolidate test files
   - Update mocks for unified service

## Benefits
1. **User Experience**:
   - Single keychain prompt instead of two
   - Faster app initialization
   - Cleaner authentication flow

2. **Code Quality**:
   - Reduced duplication
   - Centralized encryption logic
   - Easier to maintain and test

3. **Performance**:
   - Single file I/O for all secure data
   - Shared memory cache
   - One-time encryption initialization

## Risk Mitigation
1. **Data Integrity**:
   - Atomic write operations
   - Backup before migration
   - Validation after each operation

2. **Security**:
   - Same encryption strength (OS keychain)
   - Maintained isolation between repos
   - Audit trail preserved

3. **Testing Strategy**:
   - Unit tests for each domain
   - Integration tests for migration
   - Manual testing on macOS for keychain prompts

## File Structure
```
src/main/services/
├── UnifiedSecureStorage.ts       # Main service
├── storage-domains/
│   ├── TokenDomain.ts            # Token-specific logic
│   └── SecretsDomain.ts          # Secrets-specific logic
└── storage-migration/
    └── MigrationService.ts       # Handles data migration
```

## Success Criteria
- [ ] Single keychain prompt on first secure operation
- [ ] All existing functionality preserved
- [ ] Successful migration of existing data
- [ ] No regression in security posture
- [ ] Improved startup performance
- [ ] Comprehensive test coverage

## Timeline Estimate
- Phase 1: 2-3 hours (Core service structure)
- Phase 2: 2-3 hours (Feature implementation)
- Phase 3: 3-4 hours (Migration and integration)
- Phase 4: 1-2 hours (Cleanup and testing)

Total: ~10-12 hours of development work