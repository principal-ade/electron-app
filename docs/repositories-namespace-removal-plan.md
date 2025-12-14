# REPOSITORIES Namespace Removal Plan

**Status:** In Progress (Phase 1 & 2 Complete)
**Related:** [Storage Namespace Cleanup Analysis](./storage-namespace-cleanup-analysis.md)

## Overview

This document outlines the steps required to remove the `REPOSITORIES` namespace from the application, consolidating repository management into the Alexandria registry system.

---

## Current State

### Two Independent Systems

| System | Storage | Primary Key | Main File |
|--------|---------|-------------|-----------|
| REPOSITORIES | electron-store (app userData) | `repos_<url-hash>` | `RepositoryApiEventHandler.ts` |
| Alexandria | Home directory filesystem | Local path | `AlexandriaRegistryService.ts` |

### REPOSITORIES Namespace Consumers

| Consumer | Usage | Blocking Removal? |
|----------|-------|-------------------|
| `RepositoryCache` | Loads repos on init, auto-creates from git paths | **Yes** |
| `RepositoryApiEventHandler` | CRUD operations, IPC handlers | **Yes** |
| `EventServerManager` | `getRepositoryForPath()` for session enrichment | **Yes** |
| `RepositoryAvatar.tsx` | `getAvatarUrl()` for custom avatars | **Yes** |
| `RepositoryService.ts` | Renderer API wrapper | **Yes** |
| `RepositoryMetadataService` | GitHub metadata caching | No (can be removed) |

---

## Migration Tasks

### Phase 1: Eliminate Non-Essential Features ✅ COMPLETE

These features can be removed without replacement:

#### 1.1 Remove User Tags ✅
- [x] Remove `tags` and `manualTags` fields from `Repository` type
- [x] Remove tag-related methods from `RepositoryApiEventHandler`
- [x] Remove any UI that displays/edits tags (if exists)

#### 1.2 Remove Access Timestamps ✅
- [x] Remove `lastAccessed` tracking from `Repository` and `LocalClone`
- [x] Remove `updateRepositoryAccess()` and `updateLocalCloneAccess()` methods
- [x] Remove "recent repositories" functionality (or reimplement with Alexandria)

#### 1.3 Remove GitHub Metadata Caching ✅
- [x] Remove `metadata` field from `Repository` type
- [x] Remove `refreshRepositoryMetadata()` method
- [x] Remove `RepositoryMetadataService.ts` entirely
- [x] Let Alexandria handle GitHub metadata fetching

#### 1.4 Remove GitHub Search ✅
- [x] Remove `searchGitHubRepositories()` from `RepositoryApiEventHandler`
- [x] Move to a dedicated GitHub API service if still needed

---

### Phase 2: Remove Custom Avatars ✅ COMPLETE

Custom avatar storage was removed entirely (Option C). Now using only GitHub avatar URLs directly.

#### Completed Tasks:
- [x] Remove `customAvatarPath` field from `Repository` and `LocalClone` types
- [x] Remove avatar methods from `RepositoryApiEventHandler`
- [x] Remove avatar IPC handlers and API events
- [x] Remove `avatarStorageService.ts` entirely
- [x] Update `RepositoryAPI` interface and renderer services

---

### Phase 3: Replace RepositoryCache

`RepositoryCache` is used by `EventServerManager` for path → repository lookups.

#### 3.1 Create Lightweight Git Info Cache
```typescript
// New: src/main/stores/GitInfoCache.ts
class GitInfoCache {
  private cache: Map<string, { remoteUrl: string; owner: string; repo: string }>;

  async getGitInfoForPath(path: string): Promise<GitInfo | null> {
    // Check cache first
    // If miss, call GitService.getGitInfo()
    // Cache result (in-memory only, no persistence)
  }
}
```

#### 3.2 Update EventServerManager
- [ ] Replace `repositoryCache.getRepositoryForPath()` with new `GitInfoCache`
- [ ] Only needs: remote URL, owner, repo name (not full Repository object)

#### 3.3 Remove RepositoryCache.ts
- [ ] Delete `src/main/stores/RepositoryCache.ts`
- [ ] Remove initialization from startup

---

### Phase 4: Migrate or Remove RepositoryApiEventHandler

#### 4.1 Methods to Remove (no longer needed)
- [ ] `getRepositories()` → Use Alexandria
- [ ] `getRepository()` → Use Alexandria
- [ ] `addRepository()` → Use Alexandria
- [ ] `updateRepository()` → Use Alexandria
- [ ] `removeRepository()` → Use Alexandria
- [ ] `getRecentRepositories()` → Remove or reimplement
- [ ] `cleanupStaleEntries()` → Remove

#### 4.2 Methods to Migrate to Alexandria
- [ ] `addLocalClone()` → Alexandria needs multiple clone support
- [ ] `removeLocalClone()` → Alexandria needs multiple clone support
- [ ] `getRepositoryByLocalPath()` → Alexandria already has this

#### 4.3 Methods to Move Elsewhere
- [ ] `setRepositoryAvatar()` → Avatar service (Phase 2)
- [ ] `getAvatarUrl()` → Avatar service (Phase 2)
- [ ] `searchGitHubRepositories()` → GitHub API service

---

### Phase 5: Update Alexandria for Missing Features

Alexandria needs these features to fully replace REPOSITORIES:

#### 5.1 Multiple Local Clones Support
Currently Alexandria is 1 path = 1 entry. Need:
- [ ] Add `localClones: string[]` to Alexandria entry (or similar)
- [ ] Update registration to handle same remote URL at multiple paths
- [ ] Update queries to find repo by any clone path

#### 5.2 VCS Type Detection
- [ ] Add `vcsType` field to Alexandria entry
- [ ] Implement detection logic (github/gitlab/bitbucket/generic)
- [ ] Or: derive on-demand from remote URL (no storage needed)

#### 5.3 Path → Repository Lookup
- [ ] Add `getRepositoryByLocalPath(path)` API if not exists
- [ ] Should traverse up to git root and find matching entry

---

### Phase 6: Remove REPOSITORIES Namespace

#### 6.1 Remove from Storage System
- [ ] Remove from `StaticNamespaces` enum in `namespaces.types.ts`
- [ ] Remove registration from `MultiStoreManager.ts`
- [ ] Remove from `NamespaceDataTypes` in `typed-namespaces.ts`
- [ ] Remove from `TypedNamespaceRegistry`

#### 6.2 Delete Files
- [ ] `src/main/stores/RepositoryApiEventHandler.ts`
- [ ] `src/main/stores/RepositoryApiEventHandler.spec.ts`
- [ ] `src/main/stores/RepositoryApiEventHandler.spec.js`
- [ ] `src/main/stores/RepositoryCache.ts`
- [ ] `src/main/services/RepositoryMetadataService.ts`
- [ ] `src/renderer/main-process-api/RepositoryService.ts`
- [ ] `src/window/main-process-api-implementations/repositoryApi.ts`
- [ ] `src/shared/main-process-api-interfaces/RepositoryAPI.ts`

#### 6.3 Update Shared Types
- [ ] Review `src/shared/types/repository.types.ts`
- [ ] Keep types if Alexandria uses them, otherwise delete

#### 6.4 Remove from Preload/API
- [ ] Remove `repository` from `MainProcessAPI` interface
- [ ] Remove from `preload.ts` exposure
- [ ] Remove IPC handler registration from `initialization.ts`

---

## Migration Order

```
Phase 1 (Safe, no dependencies)
    ↓
Phase 2 (Avatar decision needed)
    ↓
Phase 3 (RepositoryCache replacement)
    ↓
Phase 4 (Handler removal - depends on Phase 2, 3)
    ↓
Phase 5 (Alexandria enhancements - can parallel with 1-3)
    ↓
Phase 6 (Final cleanup - after all above)
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Alexandria missing features block removal | High | High | Complete Phase 5 first |
| EventServerManager breaks | Medium | High | Thorough testing of GitInfoCache |
| Avatar feature regression | Medium | Low | Option C (remove) if time constrained |
| Data loss during migration | Low | Medium | No user data in REPOSITORIES worth preserving |

---

## Estimated Effort

| Phase | Complexity | Notes |
|-------|------------|-------|
| Phase 1 | Low | Deletions only |
| Phase 2 | Medium | Depends on option chosen |
| Phase 3 | Medium | New cache implementation |
| Phase 4 | Low | Mostly deletions after Phase 2-3 |
| Phase 5 | High | Core library changes may be needed |
| Phase 6 | Low | Final cleanup |

**Total:** Medium-High effort, primarily due to Alexandria enhancements (Phase 5)

---

## Alternative: Minimal Approach

If full migration is too costly, consider keeping a minimal REPOSITORIES:

1. Remove all features except `RepositoryCache`
2. Keep only path → git info lookup
3. No persistence (in-memory only)
4. No IPC API exposure

This eliminates main thread blocking concerns while keeping EventServerManager working.

---

## Next Steps

1. [ ] Decide on avatar approach (Option A/B/C)
2. [ ] Assess Alexandria core library change feasibility (Phase 5)
3. [ ] Choose full migration vs minimal approach
4. [ ] Create implementation tickets for chosen phases
