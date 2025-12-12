# Git Remote Information Architecture

## Problem Statement

Git remote operations (fetch, ls-remote, etc.) are currently blocking other operations throughout the application. These network-dependent operations can take 5-10+ seconds to complete or timeout, causing the entire UI and repository registration process to hang.

## Current Blocking Locations

### 1. Repository Registration Flow
**File:** `src/main/stores/RepositoryApiEventHandler.ts`

```typescript
// Line 383 - addRepository()
localBranchInfo = await this.branchService.getBranchInfo(params.localPath);

// Line 541 - addLocalClone()
branchInfo = await this.branchService.getBranchInfo(localPath);
```

**Impact:** Blocks the entire repository/clone addition process while waiting for remote information.

### 2. Branch Information Service
**File:** `src/main/version-control-providers/gitBranchService.ts`

```typescript
// Line 87-109 - getDefaultBranch()
// Method 1: Remote HEAD check
await execAsync('git remote set-head origin --auto', { cwd: gitRoot });

// Line 113 - Method 2: ls-remote
await execAsync('git ls-remote --symref origin HEAD', { cwd: gitRoot });

// Line 328-339 - fetchRemoteInfo()
await execAsync('git fetch --timeout=5', { cwd: gitRoot });
```

**Impact:** Multiple sequential remote operations, no parallel execution, blocks caller.

### 3. Git Authentication Check
**File:** `src/main/file-system/gitHandlers.ts`

```typescript
// Line 76-87 - testGitAccess()
await Promise.race([
  git.raw(['ls-remote', url], { env: envVars, timeout: 10000 }),
  new Promise((_, reject) => setTimeout(() => reject(new Error('Authentication timeout')), 10000))
]);
```

**Impact:** 10-second blocking operation during clone authentication.

### 4. GitHub Handlers - SSH/HTTPS Detection
**File:** `src/main/version-control-providers/githubHandlers.ts`

```typescript
// Line 1746-1761 - Sequential auth checks
canUseSsh = (await run('git', ['ls-remote', '--exit-code', '--heads', remoteSsh], targetDir)).code === 0;

if (!canUseSsh) {
  httpsOk = (await run('git', ['ls-remote', '--exit-code', '--heads', remoteHttps], targetDir)).code === 0;
}
```

**Impact:** Sequential checks double the wait time. If SSH takes 10s to fail, then HTTPS takes another 10s.

## Solution: New `gitRemote` Cache Slice

### Overview

Add a new cache slice `gitRemote` to the existing `RepositoryCacheRegistry` architecture. This separates **local git operations** (fast) from **remote git operations** (slow, network-dependent).

### Existing Cache Slices

```typescript
// Current slices in src/shared/main-process-api-interfaces/RepositoryMonitoringAPI.ts
export type CacheSlice = 'gitStatus' | 'fileTree' | 'packages';

export interface CacheSliceDataMap {
  gitStatus: GitStatusWithFiles;    // Local git status
  fileTree: FileTree;                 // File system tree
  packages: PackagesData;             // Package information
}
```

### New `gitRemote` Slice

```typescript
// Add to CacheSlice type
export type CacheSlice = 'gitStatus' | 'fileTree' | 'packages' | 'gitRemote';

// New interface for git remote information
export interface GitRemoteInfo {
  remoteUrl: string;
  defaultBranch?: string;
  remoteBranches: string[];
  accessible: boolean;
  authMethods?: {
    ssh: boolean;
    https: boolean;
  };
  upstreamStatus?: {
    ahead: number;
    behind: number;
    upToDate: boolean;
  };
  lastFetched?: number;
  fetchError?: string;
}

// Add to CacheSliceDataMap
export interface CacheSliceDataMap {
  gitStatus: GitStatusWithFiles;
  fileTree: FileTree;
  packages: PackagesData;
  gitRemote: GitRemoteInfo;  // NEW
}
```

## Implementation Plan

### Phase 1: Update Type Definitions

**Files to modify:**
1. `src/shared/main-process-api-interfaces/RepositoryMonitoringAPI.ts`
   - Add `gitRemote` to `CacheSlice` type
   - Add `GitRemoteInfo` interface
   - Add to `CacheSliceDataMap`

### Phase 2: Server-Side Cache Builder

**File:** `src/repository-monitoring-server/RepositoryMonitoringServer.ts`

Add a new builder function for the `gitRemote` slice:

```typescript
private async buildGitRemoteCache(repoPath: string): Promise<GitRemoteInfo> {
  const git = await gitClientFactory.getClient(repoPath);

  // Get remote URL (fast, local operation)
  const remoteUrl = await git.getConfig('remote.origin.url') || '';

  const remoteInfo: GitRemoteInfo = {
    remoteUrl,
    remoteBranches: [],
    accessible: false,
  };

  // All network operations in parallel with short timeouts
  const [defaultBranch, branches, authCheck] = await Promise.allSettled([
    this.fetchDefaultBranch(repoPath).catch(() => undefined),
    this.fetchRemoteBranches(repoPath).catch(() => []),
    this.checkRemoteAccess(repoPath).catch(() => ({ accessible: false })),
  ]);

  if (defaultBranch.status === 'fulfilled') {
    remoteInfo.defaultBranch = defaultBranch.value;
  }

  if (branches.status === 'fulfilled') {
    remoteInfo.remoteBranches = branches.value;
  }

  if (authCheck.status === 'fulfilled') {
    remoteInfo.accessible = authCheck.value.accessible;
    remoteInfo.authMethods = authCheck.value.authMethods;
  }

  remoteInfo.lastFetched = Date.now();

  return remoteInfo;
}

private async fetchDefaultBranch(repoPath: string): Promise<string | undefined> {
  // Try ls-remote with 3-second timeout
  try {
    const result = await Promise.race([
      execAsync('git ls-remote --symref origin HEAD', {
        cwd: repoPath,
        timeout: 3000
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 3000)
      )
    ]);

    const match = result.stdout.match(/ref: refs\/heads\/(\S+)\s+HEAD/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

private async fetchRemoteBranches(repoPath: string): Promise<string[]> {
  // Similar implementation with timeout
}

private async checkRemoteAccess(repoPath: string): Promise<{
  accessible: boolean;
  authMethods?: { ssh: boolean; https: boolean };
}> {
  // Similar implementation with timeout
}
```

**Register the cache builder:**

```typescript
async registerRepository(repoPath: string): Promise<void> {
  // ... existing code ...

  // Schedule background build of gitRemote cache
  // This won't block registration
  this.cacheRegistry.scheduleRebuild(
    repoPath,
    'gitRemote',
    () => this.buildGitRemoteCache(repoPath)
  ).catch(error => {
    console.warn(`[RepositoryMonitoring] Failed to build gitRemote cache for ${repoPath}:`, error);
  });
}
```

### Phase 3: Update Consumers

**File:** `src/main/stores/RepositoryApiEventHandler.ts`

Update `addRepository` to not block on remote info:

```typescript
async addRepository(params: {
  remoteUrl: string;
  owner: string;
  name: string;
  vcsType?: VCSType;
  localPath?: string;
  description?: string;
  avatarUrl?: string;
  metadata?: Repository['metadata'];
}): Promise<Repository> {
  // ... existing code ...

  // OLD (blocking):
  // localBranchInfo = await this.branchService.getBranchInfo(params.localPath);

  // NEW (non-blocking):
  let localBranchInfo: any = null;
  if (params.localPath) {
    try {
      // Only get local info (current branch, local branches)
      localBranchInfo = await this.branchService.getLocalBranchInfo(params.localPath);

      // Trigger background fetch of remote info via cache
      RepositoryMonitoringService.getGitRemoteInfo(params.localPath)
        .then(remoteInfo => {
          // Update repository when remote info becomes available
          if (remoteInfo.defaultBranch) {
            this.updateRepository(params.remoteUrl, {
              metadata: {
                ...params.metadata,
                defaultBranch: remoteInfo.defaultBranch,
              }
            });
          }
        })
        .catch(error => {
          console.log('[addRepository] Remote info fetch failed:', error);
        });
    } catch (error) {
      console.log('[addRepository] Could not get branch info:', error);
    }
  }

  // Continue with repository registration immediately
  // ...
}
```

**File:** `src/main/version-control-providers/gitBranchService.ts`

Split into local and remote methods:

```typescript
export class GitBranchService {
  /**
   * Get ONLY local branch information (fast, never blocks)
   */
  async getLocalBranchInfo(directory: string): Promise<LocalBranchInfo> {
    const gitRoot = await this.getGitRoot(directory);
    if (!gitRoot) return null;

    const [currentBranch, localBranches, currentCommit] = await Promise.all([
      this.getCurrentBranch(gitRoot),
      this.getLocalBranches(gitRoot),
      this.getCurrentCommit(gitRoot),
    ]);

    return {
      currentBranch,
      localBranches,
      currentCommit,
    };
  }

  /**
   * Get full branch info (delegates remote info to cache)
   */
  async getBranchInfo(directory: string): Promise<BranchInfo | null> {
    const [localInfo, remoteInfo] = await Promise.all([
      this.getLocalBranchInfo(directory),
      RepositoryMonitoringService.getGitRemoteInfo(directory).catch(() => null),
    ]);

    if (!localInfo) return null;

    return {
      ...localInfo,
      defaultBranch: remoteInfo?.defaultBranch,
      remoteBranches: remoteInfo?.remoteBranches || [],
      remotes: remoteInfo?.remoteUrl ? ['origin'] : [],
      branchStatus: remoteInfo?.upstreamStatus,
    };
  }
}
```

### Phase 4: Renderer-Side Cache Sync

**File:** `src/renderer/services/RepositoryDataCache.ts`

Add `gitRemote` slice handling:

```typescript
export interface RepositoryCacheData {
  // ... existing fields ...

  // NEW: Git remote information
  gitRemote: GitRemoteInfo | null;

  cacheSlices: RepositoryCacheSlicesState;
}

type RepositoryCacheSlicesState = {
  gitStatus?: RegistryCacheEntry<CacheSliceDataMap['gitStatus']>;
  fileTree?: RegistryCacheEntry<CacheSliceDataMap['fileTree']>;
  packages?: RegistryCacheEntry<CacheSliceDataMap['packages']>;
  gitRemote?: RegistryCacheEntry<CacheSliceDataMap['gitRemote']>; // NEW
};

private async applyCacheSyncEvent(event: RepositoryCacheSyncEvent): Promise<void> {
  // ... existing code ...

  switch (slice) {
    // ... existing cases ...

    case 'gitRemote': {
      const gitRemoteData = event.entry.data as GitRemoteInfo | null | undefined;
      updatedData.gitRemote = gitRemoteData ?? null;
      partial.gitRemote = updatedData.gitRemote;
      changedFields.push('gitRemote');

      // Update repository metadata if default branch is available
      if (gitRemoteData?.defaultBranch) {
        updatedData.repository = {
          ...updatedData.repository,
          metadata: {
            ...updatedData.repository.metadata,
            defaultBranch: gitRemoteData.defaultBranch,
          }
        };
        partial.repository = updatedData.repository;
        changedFields.push('repository');
      }

      break;
    }
  }
}
```

### Phase 5: UI Components

Components can now reactively update when remote info loads:

```tsx
// Example: Branch selector component
function BranchSelector({ repoPath }: { repoPath: string }) {
  const cacheData = useRepositoryCache(repoPath);

  const localBranches = cacheData?.gitStatus?.branch ? [cacheData.gitStatus.branch] : [];
  const remoteBranches = cacheData?.gitRemote?.remoteBranches || [];
  const isLoadingRemote = !cacheData?.gitRemote;

  return (
    <select>
      <optgroup label="Local">
        {localBranches.map(branch => <option key={branch}>{branch}</option>)}
      </optgroup>
      {isLoadingRemote ? (
        <option disabled>Loading remote branches...</option>
      ) : (
        <optgroup label="Remote">
          {remoteBranches.map(branch => <option key={branch}>{branch}</option>)}
        </optgroup>
      )}
    </select>
  );
}
```

## Cache Management

### TTL (Time-To-Live) Strategy

```typescript
// In RepositoryMonitoringServer.ts
const CACHE_TTL = {
  gitStatus: 2 * 1000,        // 2 seconds (very dynamic)
  fileTree: 10 * 1000,        // 10 seconds (changes often)
  packages: 60 * 1000,        // 1 minute (relatively stable)
  gitRemote: 5 * 60 * 1000,   // 5 minutes (rarely changes)
};
```

### Invalidation Events

Invalidate `gitRemote` cache when:
- User performs `git fetch`
- User performs `git push`
- User switches branches
- User manually clicks "Refresh" button

```typescript
// In RepositoryMonitoringServer.ts
async invalidateGitRemoteCache(repoPath: string): Promise<void> {
  this.cacheRegistry.invalidate(repoPath, 'gitRemote');

  // Trigger background rebuild
  await this.cacheRegistry.scheduleRebuild(
    repoPath,
    'gitRemote',
    () => this.buildGitRemoteCache(repoPath)
  );
}
```

### Background Refresh

```typescript
// Periodically refresh stale cache entries in background
private startBackgroundRefresh(): void {
  setInterval(() => {
    for (const repoPath of this.monitoredRepositories.keys()) {
      const entry = this.cacheRegistry.get(repoPath, 'gitRemote');

      if (!entry || this.isCacheStale(entry, CACHE_TTL.gitRemote)) {
        // Refresh in background, don't await
        this.cacheRegistry.scheduleRebuild(
          repoPath,
          'gitRemote',
          () => this.buildGitRemoteCache(repoPath)
        ).catch(error => {
          console.warn(`Background refresh failed for ${repoPath}:`, error);
        });
      }
    }
  }, 60 * 1000); // Check every minute
}

private isCacheStale(entry: CacheEntry<any>, ttl: number): boolean {
  return Date.now() - entry.timestamp > ttl;
}
```

## Benefits

1. **Non-Blocking Registration:** Repository registration completes instantly with local data
2. **Progressive Enhancement:** UI shows local info immediately, remote info appears when ready
3. **Resilient to Network Issues:** App remains functional even if remote operations fail
4. **Leverages Existing Architecture:** Uses proven `RepositoryCacheRegistry` pattern
5. **Automatic Sync:** Renderer cache automatically updates via `cache-sync` events
6. **Efficient:** Parallel remote operations with short timeouts
7. **Consistent:** Same slice-based architecture as other cached data

## Migration Path

1. ✅ Add type definitions (no breaking changes)
2. ✅ Add server-side cache builder (runs in background)
3. ✅ Update consumers to use non-blocking methods (gradual)
4. ✅ Add renderer-side cache sync (automatic)
5. ✅ Update UI components (progressive)

## Testing Strategy

### Unit Tests

```typescript
describe('GitRemote Cache Slice', () => {
  it('should build gitRemote cache with timeout', async () => {
    const builder = () => buildGitRemoteCache('/test/repo');
    const entry = await cacheRegistry.scheduleRebuild('/test/repo', 'gitRemote', builder);

    expect(entry.data).toBeDefined();
    expect(entry.data?.remoteUrl).toBe('https://github.com/user/repo.git');
  });

  it('should handle network timeout gracefully', async () => {
    // Mock network delay > 3 seconds
    const builder = () => buildGitRemoteCache('/test/slow-repo');
    const entry = await cacheRegistry.scheduleRebuild('/test/slow-repo', 'gitRemote', builder);

    // Should complete with partial data
    expect(entry.data).toBeDefined();
    expect(entry.data?.accessible).toBe(false);
  });
});
```

### Integration Tests

```typescript
describe('Repository Registration with Remote Info', () => {
  it('should register repository without waiting for remote', async () => {
    const startTime = Date.now();
    const repo = await addRepository({
      remoteUrl: 'https://github.com/user/repo.git',
      owner: 'user',
      name: 'repo',
      localPath: '/test/repo',
    });
    const duration = Date.now() - startTime;

    // Should complete in < 500ms (local operations only)
    expect(duration).toBeLessThan(500);
    expect(repo.name).toBe('repo');

    // Remote info might not be available yet
    expect(repo.metadata?.defaultBranch).toBeUndefined();
  });

  it('should update repository when remote info loads', async () => {
    const repo = await addRepository({
      remoteUrl: 'https://github.com/user/repo.git',
      owner: 'user',
      name: 'repo',
      localPath: '/test/repo',
    });

    // Wait for remote info to load
    await waitFor(() => {
      const updated = getRepository(repo.remoteUrl);
      return updated?.metadata?.defaultBranch === 'main';
    }, { timeout: 10000 });
  });
});
```

## Open Questions

1. **Should we persist gitRemote cache across app restarts?**
   - Pros: Instant data on startup
   - Cons: Might be stale
   - **Recommendation:** Yes, with short TTL (5 min) and background refresh

2. **What should be the default timeout for remote operations?**
   - **Recommendation:** 3 seconds for individual operations, with fallback to local data

3. **Should we expose cache refresh to users?**
   - **Recommendation:** Yes, add a "Refresh" button for branch/remote info

4. **How do we handle repositories with no remote?**
   - **Recommendation:** Set `accessible: false`, don't retry frequently

5. **Should we parallelize SSH and HTTPS auth checks?**
   - **Recommendation:** Yes, use `Promise.allSettled()` to test both simultaneously

## Related Files

- `src/shared/main-process-api-interfaces/RepositoryMonitoringAPI.ts` - Type definitions
- `src/repository-monitoring-server/RepositoryMonitoringServer.ts` - Server-side cache
- `src/repository-monitoring-server/cache/RepositoryCacheRegistry.ts` - Cache registry implementation
- `src/renderer/services/RepositoryDataCache.ts` - Renderer-side cache
- `src/main/stores/RepositoryApiEventHandler.ts` - Repository management
- `src/main/version-control-providers/gitBranchService.ts` - Branch operations
- `src/main/file-system/gitHandlers.ts` - Git IPC handlers
- `src/main/version-control-providers/githubHandlers.ts` - GitHub operations
