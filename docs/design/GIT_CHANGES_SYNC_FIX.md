# Git Changes Panel Real-Time Sync Fix

**Date**: 2025-10-08
**Issue**: Git changes panel was not updating in real-time when files were created/modified

## Root Causes

### 1. Stale Cache Data (Primary Issue)
**Location**: `src/repository-monitoring-server/RepositoryMonitoringServer.ts:602`

**Problem**: When workspace changes triggered a git status refresh, the code was calling:
```typescript
await this.cacheRegistry.scheduleRebuild(repoPath, 'gitStatus', async () => {
  return await this.getGitStatusWithFiles(repoPath);  // ❌ Returns cached data!
});
```

`getGitStatusWithFiles()` internally calls `cacheRegistry.getOrBuild()`, which returns the **existing cached data** instead of building fresh data. This caused the cache sync event to contain stale git status.

**Fix**: Call `buildGitStatusSlice()` directly to force a fresh build:
```typescript
await this.cacheRegistry.scheduleRebuild(repoPath, 'gitStatus', async () => {
  return await this.buildGitStatusSlice(repoPath);  // ✅ Forces fresh build
});
```

### 2. GitChangesContext Cache Blocking Updates (Secondary Issue)
**Location**: `src/renderer/contexts/GitChangesContext.tsx:149`

**Problem**: When `GIT_STATUS_CHANGED` events arrived, `refreshGitStatus()` would call `checkGitStatus()`, which had a 30-second cache that blocked fetching fresh data:
```typescript
// Check cache
if (existingState?.gitStatus && existingState.lastStatusCheck) {
  const age = Date.now() - existingState.lastStatusCheck;
  if (age < STATUS_CACHE_DURATION) {  // 30 seconds
    return existingState.gitStatus;  // ❌ Returns stale data
  }
}
```

**Fix**: Added `bypassCache` parameter to allow explicit refreshes to skip the cache:
```typescript
const checkGitStatus = useCallback(
  async (source: FileTreeSource, bypassCache = false): Promise<GitDetailedChanges | null> => {
    // Check cache (unless bypassed)
    if (!bypassCache && existingState?.gitStatus && existingState.lastStatusCheck) {
      // ... cache check logic
    }
    // ... fetch fresh data
  }
);

const refreshGitStatus = useCallback(
  async (sourceId: string) => {
    // ...
    // Bypass cache when explicitly refreshing from events
    await checkGitStatus(source, true);  // ✅ Bypasses cache
  }
);
```

## Event Flow (After Fix)

1. **File change detected** → GitWatcherAdapter emits `WORKSPACE_CHANGED`
2. **RepositoryMonitoringServer** receives event → schedules git status refresh (300-500ms delay)
3. **Timer fires** → calls `buildGitStatusSlice()` to build **fresh** git status
4. **Cache updated** → emits `CACHE_SYNC` event with fresh data
5. **Main process** forwards to renderer via IPC
6. **RepositoryDataCache** receives event → updates local cache → notifies subscribers
7. **useRepositoryData** hook receives update → updates `data` state
8. **RepositoryPanelProvider** recalculates `gitStatus` → triggers re-render
9. **GitChangesPanel** displays updated file list

Additionally, a `GIT_STATUS_CHANGED` event is sent to `GitChangesContext` which also refreshes (now bypassing its internal cache).

## Files Modified

### Server-side
- `src/repository-monitoring-server/RepositoryMonitoringServer.ts`
  - Changed `scheduleGitStatusRefresh()` to call `buildGitStatusSlice()` instead of `getGitStatusWithFiles()`

### Renderer-side
- `src/renderer/contexts/GitChangesContext.tsx`
  - Added `bypassCache` parameter to `checkGitStatus()`
  - Modified `refreshGitStatus()` to bypass cache when called from events

## Testing

Create a file in a monitored repository and verify:
1. File tree panel updates immediately (was already working)
2. Git changes panel updates within 300-500ms (now fixed)
3. Console shows cache sync events with correct file counts

## Related Systems

- **File tree syncing**: Uses the same `WORKSPACE_CHANGED` event but updates immediately (no delayed timer)
- **Package syncing**: Also triggered by workspace changes, works correctly
- **Git status syncing**: Now works correctly with the fixes applied
