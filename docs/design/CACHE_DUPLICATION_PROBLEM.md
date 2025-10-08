# Cache Duplication Problem

## The Issue

We have **TWO separate caching systems** for repository data:

### 1. MonitoredFileTreeService (OLD)
**File**: `src/renderer/services/MonitoredFileTreeService.ts` (361 lines)

**What it does**:
- Simple memory cache for file trees ONLY
- 5 minute TTL, max 3 trees
- Calls `RepositoryMonitoringService.getFileTree()` directly
- Manual invalidation only
- **NO event subscriptions**

**Used by**:
- `RepositoryManager.tsx` - Creates instance and passes to views
- `RepositoryExplorationView.tsx` - Uses for file tree display
- `FileTreeSourceService.ts` - Wraps it for file tree loading
- `RepositoryCityVisualization.tsx` - Uses for visualization
- `RepoSourceArchitecturePanelSimple.tsx` - Uses for architecture view
- `FileTreeInvalidator.ts` - Manual invalidation utility

**Pattern**: **Pull-based** - Components explicitly load data when needed

---

### 2. RepositoryDataCache (NEW)
**File**: `src/renderer/services/RepositoryDataCache.ts` (805 lines)

**What it does**:
- Comprehensive cache for ALL repo data (file tree, git status, packages, quality)
- Event-driven updates
- Subscribes to `CACHE_SYNC` events from worker
- Auto-updates when worker cache changes
- Batched updates (100ms debounce)

**Used by**:
- `useRepositoryData.ts` - Hook for accessing cache
- `RepositoryPanelProvider.tsx` - Provides data to panels
- `GitChangesPanel.tsx` - Via RepositoryPanelProvider
- Any component using `useRepositoryData` hook

**Pattern**: **Push-based** - Worker pushes updates, components auto-refresh

---

## Why File Tree Doesn't Update

**The Flow**:
1. ✅ Worker detects file change
2. ✅ Worker rebuilds file tree
3. ✅ Worker emits `CACHE_SYNC` event
4. ✅ Main process forwards to renderer
5. ✅ `RepositoryDataCache` receives event and updates
6. ❌ `MonitoredFileTreeService` **has no idea** - it's not subscribed!
7. ❌ `FileTreeTab` shows stale data from `MonitoredFileTreeService`

**Meanwhile**:
- `GitChangesPanel` uses `RepositoryDataCache` → **updates automatically** ✅
- Markdown list probably uses direct API calls → **updates** ✅
- `FileTreeTab` uses `MonitoredFileTreeService` → **never updates** ❌

---

## The Duplication

Both services do similar things:

| Feature | MonitoredFileTreeService | RepositoryDataCache |
|---------|-------------------------|---------------------|
| Cache file trees | ✅ | ✅ |
| Cache git status | ❌ | ✅ |
| Cache packages | ❌ | ✅ |
| Event subscriptions | ❌ | ✅ |
| Auto-updates | ❌ | ✅ |
| Manual refresh | ✅ | ✅ |
| LRU eviction | ✅ | ✅ |
| Singleton pattern | ❌ (per-instance) | ✅ |

---

## Options

### Option 1: Band-Aid Fix - Subscribe in MonitoredFileTreeService

**Add to MonitoredFileTreeService constructor**:
```typescript
constructor() {
  RepositoryMonitoringService.onCacheSync((event) => {
    if (event.slice === 'fileTree') {
      this.invalidateByPath(event.repoPath);
    }
  });
}
```

**Pros**:
- Quick fix
- Minimal code changes

**Cons**:
- Still have two caching systems
- Duplication remains
- More complexity
- Memory overhead from two caches

---

### Option 2: Proper Fix - Delete MonitoredFileTreeService

**Migrate all usage to `RepositoryDataCache`**:
- Replace `MonitoredFileTreeService` with `useRepositoryData` hook
- Components get data from `RepositoryPanelProvider`
- Single source of truth
- Automatic updates everywhere

**Changes needed**:
1. `RepositoryManager.tsx` - Remove MonitoredFileTreeService creation
2. `RepositoryExplorationView.tsx` - Get fileTree from `useRepositoryData`
3. `FileTreeSourceService.ts` - Use RepositoryDataCache instead
4. Other consumers - Migrate to hook pattern

**Pros**:
- Single caching system
- Automatic updates everywhere
- Less code to maintain
- Lower memory usage
- Consistent data across all components

**Cons**:
- More code changes
- Need to test all consumers
- Possible behavior changes

---

## Recommendation

**Option 2 - Delete the duplication**

The old `MonitoredFileTreeService` was created before the comprehensive `RepositoryDataCache` existed. Now that we have a better event-driven system, we should migrate everything to use it.

**Migration Steps**:
1. Update `RepositoryExplorationView` to use `useRepositoryData` hook
2. Remove `MonitoredFileTreeService` prop passing
3. Update other consumers one by one
4. Delete `MonitoredFileTreeService.ts` once nothing uses it
5. Delete `FileTreeInvalidator.ts` (no longer needed)

---

## Quick Win

For immediate file tree updates, wrap `FileTreeTab` in `RepositoryPanelProvider`:

```typescript
fileTree: (
  <RepositoryPanelProvider
    repositoryPath={activeFileTreeSource?.path ?? null}
    actions={{ openFile: handleSearchFileSelect }}
  >
    <FileTreePanelContent />  // New component that uses useRepositoryPanelContext
  </RepositoryPanelProvider>
),
```

This gets file tree updates working NOW, then we can migrate away from MonitoredFileTreeService gradually.
