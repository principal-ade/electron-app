# FileTree Staleness Investigation

**Date**: January 2026
**Status**: Resolved (with follow-up fix - February 2026)

## Problem Statement

Users reported that git status changes were usually correct and up-to-date, but the file tree could be stale after file operations (create, modify, delete).

**Update (February 2026)**: After the initial fix, file trees continued to show stale data because CACHE_SYNC events were not being emitted reliably. A follow-up fix was implemented to restore workspace:changed event handling using refreshRepository() instead of getFileTree().

## Background: Update Mechanisms

The repository monitoring system uses different update mechanisms for different data types:

| Data Type | Event | Mechanism |
|-----------|-------|-----------|
| Git Status | `GIT_STATUS_CHANGED` | Event payload contains full data directly |
| File Tree | `CACHE_SYNC` | Event signals cache rebuild complete, data in payload |

See `docs/file-operations-data-flow.md` for the complete pipeline documentation.

## Investigation

### Phase 1: Identifying the Race Condition

Added diagnostic logging with emoji prefixes to trace event flow:
- `PATH A`: `workspace:changed` → `getFileTree()`
- `PATH B`: `CACHE_SYNC` event with fresh data

**Findings from logs:**
```
🟠 [PATH A] Setting fileTreeData with SHA: b3d7696b0fb6af4f6a7b7d1efd15951c930a7b99
🔵 [PATH B] Setting fileTreeData with SHA: b3d7696b0fb6af4f6a7b7d1efd15951c930a7b99-dirty
```

PATH A returned stale data (old SHA), while PATH B arrived ~300ms later with fresh data (SHA with `-dirty` suffix indicating uncommitted changes).

### Root Cause #1: Competing Update Paths

In `RepositoryPanelContext.tsx`, there were two useEffect hooks updating the file tree:

1. **PATH A** (problematic): Listened to `workspace:changed` event, then called `getFileTree()` which returned stale cached data because the cache rebuild hadn't completed yet.

2. **PATH B** (correct): Listened to `CACHE_SYNC` event which fires AFTER the cache is rebuilt, with fresh data in the payload.

The timeline:
```
File change detected
    ↓
workspace:changed fires immediately
    ↓
PATH A calls getFileTree() → returns STALE cached data
    ↓
Cache rebuild completes (250ms debounce)
    ↓
CACHE_SYNC fires with FRESH data
    ↓
PATH B updates with correct data
```

### Fix #1: Remove Redundant Update Path

Removed the `workspace:changed` → `getFileTree()` path entirely. Now only `CACHE_SYNC` events update the file tree.

**File**: `src/renderer/contexts/RepositoryPanelContext.tsx`

Added explanatory comment:
```typescript
// NOTE: We intentionally do NOT listen for workspace:changed events here.
// The CACHE_SYNC event (subscribed in the fileTree useEffect above) provides
// fresh file tree data after the cache is rebuilt. Listening to workspace:changed
// and calling getFileTree() causes a race condition where stale cached data
// is returned before the rebuild completes.
```

---

### Phase 2: Duplicate Event Discovery

After fixing the race condition, testing revealed a new issue: the `onCacheSync` handler was firing twice per event.

**Debugging steps:**
1. Added subscription IDs to verify only one listener existed
2. Added listener count logging - confirmed 1 listener
3. Added send IDs in main process - confirmed 1 send per window
4. Checked for multiple windows receiving events - found 2 windows (MAIN + DEV_WORKSPACE)
5. Skipped MAIN window - duplicates persisted in DEV_WORKSPACE
6. Concluded: duplication happening at renderer IPC receive layer

### Root Cause #2: electron-log IPC Interference

The main process was sending once, but the renderer received twice. Investigation pointed to `electron-log`'s IPC transport mechanism.

**Research findings:**

From [electron-log Issue #143](https://github.com/megahertz/electron-log/issues/143):
- When webpack bundles `node_modules`, it can create two instances of electron-log
- The `rendererConsole` transport can cause duplicate processing

From [electron-log docs](https://github.com/megahertz/electron-log/blob/master/docs/initialize.md):
- In v5+, renderer processes send log data to main through IPC
- `log.initialize()` preloads electron-log IPC code in renderer processes
- This IPC interception can interfere with custom IPC events

### Fix #2: Deduplication Guard

Added a deduplication guard at the preload layer to filter duplicate events.

**File**: `src/window/main-process-api-implementations/repositoryMonitoringApi.ts`

```typescript
onCacheSync: (() => {
  // Deduplication: track recent events to prevent electron-log induced duplicates
  const recentEvents = new Map<string, number>();
  const DEDUPE_WINDOW_MS = 50; // Ignore duplicate events within 50ms

  return (callback: (event: RepositoryCacheSyncEvent) => void): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: RepositoryCacheSyncEvent,
    ) => {
      // Create a unique key for this event
      const eventKey = `${payload.repoPath}:${payload.slice}:${payload.entry?.version || ''}`;
      const now = Date.now();
      const lastSeen = recentEvents.get(eventKey);

      if (lastSeen && now - lastSeen < DEDUPE_WINDOW_MS) {
        // Duplicate event, skip
        return;
      }

      recentEvents.set(eventKey, now);

      // Clean up old entries periodically
      if (recentEvents.size > 100) {
        const cutoff = now - DEDUPE_WINDOW_MS * 2;
        for (const [key, time] of recentEvents) {
          if (time < cutoff) recentEvents.delete(key);
        }
      }

      callback(payload);
    };

    ipcRenderer.on(RepositoryMonitoringAPIEvent.CACHE_SYNC, handler);
    return () => {
      ipcRenderer.removeListener(
        RepositoryMonitoringAPIEvent.CACHE_SYNC,
        handler,
      );
    };
  };
})(),
```

**Why this approach:**
- Guards at the earliest possible point (preload/bridge layer)
- Uses event content (repoPath, slice, version) for deduplication, not timing alone
- 50ms window is generous enough to catch duplicates but not real sequential events
- Self-cleaning to prevent memory leaks

---

## Files Modified

1. **`src/renderer/contexts/RepositoryPanelContext.tsx`**
   - Removed `workspace:changed` → `getFileTree()` listener
   - Added explanatory comment about why we only use CACHE_SYNC

2. **`src/window/main-process-api-implementations/repositoryMonitoringApi.ts`**
   - Added deduplication guard to `onCacheSync`

3. **`src/main/repository-monitoring/ipcHandlers.ts`**
   - Cleaned up debug logging (no functional changes)

---

## Future Considerations

### Permanent Fix for electron-log Duplication

The deduplication guard is a workaround. A more permanent fix could involve:

1. **Check bundling configuration**: Ensure electron-log isn't bundled multiple times
2. **Disable electron-log IPC transport**: If renderer→main logging isn't needed
3. **Upgrade electron-log**: Check if newer versions have fixes for this issue

### Apply Deduplication to Other Events

If other IPC events show similar duplication, the same pattern can be applied:
- `onGitStatusChanged`
- `onWorkspaceChange`
- `onBuildArtifactsDetected`

Currently only `onCacheSync` has the guard since that's where we observed the issue.

---

---

## Follow-Up Fix (February 2026)

### Issue Recurrence

After the initial fix removed the `workspace:changed` listener, users continued to report stale file tree data. Investigation revealed that while the fix eliminated the race condition, it created a new problem: **CACHE_SYNC events were not being emitted reliably when files were added or removed**.

### Root Cause

The previous fix assumed that:
1. File changes would be detected by the repository-monitoring-server
2. Cache would be rebuilt automatically
3. CACHE_SYNC events would be emitted

However, in practice, CACHE_SYNC events were not consistently fired when files were added/removed, leaving the file tree in a stale state with no update mechanism.

### The Solution

Restored the `workspace:changed` event listener, but with a critical difference:

**Before (caused race condition)**:
```typescript
// Listen to workspace:changed → call getFileTree() → get stale cached data
const tree = await RepositoryMonitoringService.getFileTree(repositoryPath);
setFileTreeData(tree);
```

**After (no race condition)**:
```typescript
// Listen to workspace:changed → call refreshRepository() → invalidate cache → wait for CACHE_SYNC
RepositoryMonitoringService.refreshRepository(repositoryPath);
// File tree updates when CACHE_SYNC event arrives with fresh data
```

### Key Changes

**File**: `src/renderer/contexts/RepositoryPanelContext.tsx`

Added a new `useEffect` that:
1. Listens for `workspace:changed` events
2. Calls `refreshRepository()` instead of `getFileTree()`
3. `refreshRepository()` invalidates the cache and triggers a rebuild
4. The existing CACHE_SYNC listener handles the actual state update when fresh data arrives

This approach:
- ✅ Avoids the race condition (no stale data from cache)
- ✅ Ensures updates happen when files change (workspace:changed triggers refresh)
- ✅ Maintains a single source of truth (CACHE_SYNC events)
- ✅ Handles cases where CACHE_SYNC doesn't fire automatically

### Root Cause #2: Memoization Using Git SHA Instead of Cache Version

After implementing the workspace:changed listener, file trees still showed stale data. Investigation revealed **the real culprit**:

```typescript
const fileTreeSha = fileTreeData?.sha;  // Git commit SHA!
const stableFileTreeData = useMemo(() => fileTreeData, [fileTreeSha]);
```

**The Problem**: The FileTree SHA is the **git commit SHA**, not a hash of the file tree contents:
- Clean state: SHA = `4c88f492bf73cc4b05c9feb2086bb05e89a1559f`
- Add a file: SHA = `4c88f492bf73cc4b05c9feb2086bb05e89a1559f-dirty`
- Add more files: SHA = **still** `4c88f492bf73cc4b05c9feb2086bb05e89a1559f-dirty` (same!)
- The memo sees the same SHA → never invalidates → UI never updates!

**The Solution**: Use the cache `version` field instead of git SHA:

```typescript
// Track cache version separately
const [fileTreeVersion, setFileTreeVersion] = useState<number>(0);

// In CACHE_SYNC handler:
const version = event.entry.version || 0;
setFileTreeData(tree);
setFileTreeVersion(version);  // Update version on each cache rebuild

// Use version for memoization instead of SHA:
const fileTreeStableId = fileTreeVersion;
const stableFileTreeData = useMemo(() => fileTreeData, [fileTreeStableId]);
```

The cache version **increments on every rebuild**, so it reliably detects changes even when git SHA stays the same.

### Code

```typescript
// Listen for workspace file change events and trigger refresh
useEffect(() => {
  if (!repositoryPath) {
    return;
  }

  const unsubscribe = RepositoryMonitoringService.onWorkspaceChange((event) => {
    if (event.repoPath === repositoryPath) {
      console.info(
        '[RepositoryPanelProvider] Workspace changed, triggering refresh for:',
        repositoryPath,
      );
      // Use refreshRepository() to invalidate cache and wait for CACHE_SYNC
      // This avoids the race condition of calling getFileTree() which returns stale data
      RepositoryMonitoringService.refreshRepository(repositoryPath).catch((error) => {
        console.error(
          '[RepositoryPanelProvider] Failed to refresh after workspace change:',
          error,
        );
      });
    }
  });

  return () => {
    unsubscribe();
  };
}, [repositoryPath]);
```

---

## Future Improvements

### FileTree Content Hash

Currently, the `FileTree` object uses git's commit SHA, which doesn't change when files are added/removed in the working directory. This required us to use the cache `version` field as a workaround.

**Proposed improvement**: The repository-monitoring-server should compute a `contentHash` field on the FileTree object that hashes the actual tree structure (file paths, sizes, modification times). This would:

1. Provide a stable, semantic identifier for file tree state
2. Eliminate the need to track cache versions in consuming code
3. Make the API more intuitive (SHA = content, version = cache lifecycle)

**Tracking**: TODO - File issue with repository-monitoring-server package

---

## References

- `docs/file-operations-data-flow.md` - Complete pipeline documentation
- `docs/REPOSITORY_MONITORING_ARCHITECTURE.md` - System architecture
- [electron-log Issue #143](https://github.com/megahertz/electron-log/issues/143) - Duplicate messages issue
- [electron-log initialization docs](https://github.com/megahertz/electron-log/blob/master/docs/initialize.md) - IPC mechanism
