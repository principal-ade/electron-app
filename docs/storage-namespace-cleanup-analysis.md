# Storage Namespace Cleanup Analysis

**Date:** 2024-12-13
**Status:** In Progress

## Overview

This document captures the analysis and cleanup of storage namespaces in the electron-app. The goal is to reduce complexity, eliminate unused code, and address potential main thread blocking from synchronous electron-store operations.

---

## Namespaces Removed

### 1. AI_CONFIGURATION (`ai-configuration`)

**Status:** Deleted
**Reason:** Never used - only defined in type definitions, no actual read/write operations.

**Files Modified:**
- `src/shared/types/namespaces.types.ts` - Removed from enum
- `src/main/storage-providers/MultiStoreManager.ts` - Removed registration
- `src/main/storage-providers/typed-namespaces.ts` - Removed type mapping

---

### 2. LLM_MODELS (`llm-models`)

**Status:** Deleted
**Reason:** Abandoned feature - `LLMModelsService` had no consumers.

**Files Deleted:**
- `src/renderer/main-process-api/LLMModelsService.ts`
- `src/shared/main-process-api-interfaces/LLMModelsAPI.ts`
- `src/window/main-process-api-implementations/llmModelsApi.ts`

**Files Modified:**
- `src/shared/types/namespaces.types.ts` - Removed from enum
- `src/main/storage-providers/MultiStoreManager.ts` - Removed registration and `SupportedLLMProvider` enum
- `src/main/storage-providers/typed-namespaces.ts` - Removed type mapping and import
- `src/window/preload.ts` - Removed import and exposure
- `src/shared/main-process-api-interfaces/index.ts` - Removed from MainProcessAPI

---

### 3. SESSION_SUMMARIES (`session-summaries`)

**Status:** Deleted
**Reason:** Orphaned - referenced `AgentSessionArchivingService` that writes to this namespace doesn't exist.

**Files Modified:**
- `src/shared/types/namespaces.types.ts` - Removed from enum
- `src/main/storage-providers/MultiStoreManager.ts` - Removed registration
- `src/main/storage-providers/typed-namespaces.ts` - Removed `SessionSummary` interface and type mapping

---

### 4. GLOBAL_SESSION_REGISTRY (`global-session-registry`)

**Status:** Deleted
**Reason:** Redundant - live session data flows through in-memory `SessionCache` in `agentSessionSDKHandlers.ts`. Persistent storage was only used for terminal↔session linking.

**Files Deleted:**
- `src/main/agent-sessions/agentSessionService.ts`

**Files Modified:**
- `src/shared/types/namespaces.types.ts` - Removed from enum
- `src/main/storage-providers/MultiStoreManager.ts` - Removed registration
- `src/main/storage-providers/typed-namespaces.ts` - Removed `GlobalSessionRegistry` interface, `AgentSessionRecord` import, and type mapping
- `src/main/terminal/TerminalSessionManager.ts` - Removed agentSessionService import and all session linking code
- `src/main/terminal/types.ts` - Removed `agentSessionId` field from `TerminalSession`

**Impact:**
- Terminal sessions no longer linked to agent sessions (was optional feature)
- Session history not persisted between app restarts (live sessions still work via in-memory cache)

---

## Namespaces Kept

### USER_PREFERENCES (`user-preferences`)
Core settings storage. Actively used.

### CACHE (`cache`)
General cache storage for transient data.

### TEMP (`temp`)
Short-lived/volatile data.

### DOCKER_CONTAINERS (`docker-containers`)
Docker container state and management.

### DOCKER_SESSIONS (`docker-sessions`)
Docker analysis session tracking.

### SECRETS_METADATA (`secrets-metadata`)
Metadata for encrypted secrets (not the secrets themselves).

### REPOSITORY_LINKS (`repository-links`)
User bookmarks/links per repository. Backend exists but no UI currently uses it. **Kept for future use.**

---

## Namespaces Under Review

### REPOSITORIES (`repositories`)

**Status:** Under review for potential removal/simplification

#### What It Stores

```typescript
interface Repository {
  remoteUrl: string;           // Primary identifier (normalized)
  vcsType: 'github' | 'gitlab' | 'bitbucket' | 'generic';
  owner?: string;
  name: string;
  localClones: LocalClone[];   // Multiple paths where repo is cloned
  addedAt: number;
  lastAccessed?: number;
  description?: string;
  avatarUrl?: string;          // Cached GitHub avatar URL
  customAvatarPath?: string;   // Custom avatar stored locally
  tags?: string[];
  manualTags?: string[];
  metadata?: {
    stars?: number;
    language?: string;
    topics?: string[];
    defaultBranch?: string;
    isPrivate?: boolean;
    isFork?: boolean;
    license?: { key, name, spdxId, url };
    parentRepo?: { owner, name, url };
  };
}
```

#### Key Files

| File | Role |
|------|------|
| `src/main/stores/RepositoryApiEventHandler.ts` | IPC handlers, CRUD operations |
| `src/main/stores/RepositoryCache.ts` | In-memory cache, loads from namespace on init |
| `src/main/services/RepositoryMetadataService.ts` | Metadata caching layer |
| `src/renderer/main-process-api/RepositoryService.ts` | Renderer API wrapper |
| `src/renderer/components/repository-maps/RepositoryAvatar.tsx` | Avatar display component |

#### Active Consumers

**Main Process:**
- `EventServerManager` - Uses `repositoryCache.getRepositoryForPath()` to enrich session events with repo info

**Renderer (via IPC):**
- `RepositoryAvatar.tsx` - Only uses `getAvatarUrl()` for custom avatar loading

#### Comparison: REPOSITORIES vs Alexandria

| Aspect | REPOSITORIES Namespace | Alexandria Registry |
|--------|----------------------|---------------------|
| **Storage** | electron-store (app userData) | Home directory filesystem |
| **Library** | Custom implementation | `@principal-ai/alexandria-core-library` |
| **Main File** | `RepositoryApiEventHandler.ts` | `AlexandriaRegistryService.ts` |
| **Key by** | `repos_<url-hash>` | Local path |
| **Multiple clones** | Yes (array per repo) | No (1 path = 1 entry) |
| **Avatar storage** | Yes | No |
| **VCS type** | Yes (github/gitlab/bitbucket/generic) | No |
| **User tags** | Yes | No |
| **Workspaces** | No | Yes |
| **CodebaseView** | No | Yes |
| **Sync between them** | None | None |

#### What Would Break If Removed

1. **Avatar loading** - `RepositoryAvatar.tsx` custom avatar feature
2. **Event server repo lookup** - `EventServerManager` path→repo mapping
3. **Recent repos** - Access timestamp tracking
4. **GitHub search** - `searchGitHubRepositories` method
5. **Multiple clone tracking** - Alexandria doesn't support this

#### Options for REPOSITORIES

**Option A: Keep but simplify**
- Remove avatar storage (or move to Alexandria)
- Remove tags (or move to Alexandria)
- Remove metadata caching
- Keep only path→repo lookup for EventServerManager

**Option B: Migrate to Alexandria**
- Add multiple local clones support to Alexandria
- Add path → repo lookup API to Alexandria
- Add VCS type field to Alexandria
- Move avatar storage to Alexandria

**Option C: Replace with simpler in-memory cache**
- No persistence
- EventServerManager just needs git root → remote URL mapping
- Derive owner/repo from git remote on demand

---

## Main Thread Blocking Concern

### The Problem

`electron-store` is **synchronous** - all read/write operations block the main thread. The `ElectronStoreLocalStorageProvider` wraps these with async functions, but the underlying operations are still blocking:

```typescript
// This looks async but store.get() is synchronous!
public async get<T>(key: string): Promise<T | undefined> {
  return this.store.get(key) as T;  // BLOCKS
}
```

### Risk Assessment

| Namespace | Data Size | Write Frequency | Risk |
|-----------|-----------|-----------------|------|
| USER_PREFERENCES | Small | Rare | Low |
| REPOSITORIES | Medium | Moderate | Medium |
| CACHE | Variable | Frequent | Medium |
| DOCKER_* | Small | Rare | Low |
| SECRETS_METADATA | Small | Rare | Low |
| REPOSITORY_LINKS | Small | Rare | Low |

### Mitigation Options

1. **Move to async storage** - Replace electron-store with async alternatives (SQLite, IndexedDB via better-sqlite3)
2. **Reduce write frequency** - Batch writes, debounce updates
3. **Move to worker thread** - Run storage operations in a worker
4. **Lazy loading** - Don't load all data at startup

---

## Remaining Namespaces (8 total)

```typescript
export enum StaticNamespaces {
  USER_PREFERENCES = 'user-preferences',
  REPOSITORIES = 'repositories',        // Under review
  CACHE = 'cache',
  TEMP = 'temp',
  DOCKER_CONTAINERS = 'docker-containers',
  DOCKER_SESSIONS = 'docker-sessions',
  SECRETS_METADATA = 'secrets-metadata',
  REPOSITORY_LINKS = 'repository-links',
}
```

---

## Next Steps

1. [ ] Decide on REPOSITORIES namespace fate (keep/simplify/migrate/remove)
2. [ ] If keeping, consider async storage migration
3. [ ] Clean up documentation references to removed namespaces
4. [ ] Update `docs/store-namespaces.md` and related docs
5. [ ] Consider consolidating Alexandria and REPOSITORIES if both are kept
