# Repository Map Usage and Implementation Guide

This document outlines the current use of the `Map` for caching in `RepositoryManager.tsx` and provides a plan for implementing a similar caching mechanism in `RepositoryDetailsPanel.tsx`. The goal is to improve performance by reducing redundant data fetching and processing.

## Current Implementation in `RepositoryManager.tsx`

In `src/renderer/pages/RepoManager/RepositoryManager.tsx`, a `Map` named `treeCache` is used for in-memory caching of file tree data. This cache is essential for performance, as it avoids re-fetching and processing the entire file tree every time a user switches between different views or sources within the same repository.

### 1. Purpose of the Cache

The `treeCache` serves as a short-term, in-memory storage for computationally expensive data, including:
- The full `FileTree` structure.
- `FileTreeStats` (e.g., file counts, lines of code).
- `filterLayers` used for visualization.

By caching this data, the application provides a faster and smoother user experience, especially when navigating between different views that rely on the same underlying file tree.

### 2. Initialization

The cache is initialized as a `Map` within the `RepositoryManager` component using the `useMemo` hook. This ensures that the same `Map` instance is preserved across re-renders, maintaining the cache's state throughout the component's lifecycle.

```typescript
// From src/renderer/pages/RepoManager/RepositoryManager.tsx

const treeCache = useMemo(
  () =>
    new Map<
      string,
      { tree: FileTree; stats: FileTreeStats; filterLayers?: any[] }
    >(),
  [],
);
```

### 3. Population and Usage

The cache is populated and accessed within the `loadTree` function. The logic is straightforward:
1.  **Check Cache First**: Before fetching any data, it checks if a result for the `selectedSource.id` already exists in `treeCache`.
2.  **Return Cached Data**: If a cached entry is found, it is returned immediately, and the component state is updated with the cached data.
3.  **Fetch and Populate**: If no cache entry is found, it proceeds to fetch and process the data. Upon successful retrieval, the new data is stored in the cache using `treeCache.set(selectedSource.id, ...)`.

```typescript
// Simplified logic from the loadTree function

const loadTree = useCallback(
  async (forceReload = false) => {
    if (!selectedSource) return;

    // 1. Check cache first
    if (!forceReload) {
      const cached = treeCache.get(selectedSource.id);
      if (cached) {
        // 2. Return cached data
        setFileTree(cached.tree);
        setTreeStats(cached.stats);
        // ... and so on
        return;
      }
    }

    // 3. Fetch data if not in cache
    const result = await cacheService.loadFileTree(selectedSource);

    // 4. Populate cache
    treeCache.set(selectedSource.id, {
      tree: result.tree,
      stats: result.treeStats,
      filterLayers: result.filterLayers,
    });

    // ... update state
  },
  [selectedSource, cacheService, treeCache],
);
```

### 4. Cache Invalidation

The cache is invalidated under the following conditions:
- **On Component Mount**: The entire cache is cleared on the initial mount to prevent stale data from previous sessions.
- **On Source Change**: When the `selectedSource` changes, the `loadTree` function is called, which can fetch new data.
- **Manual Refresh**: A `forceReload` parameter in the `loadTree` function allows bypassing the cache.
- **File System Events**: The `FileTreeInvalidator` service listens for file system changes and fires a `filetree:cache-invalidated` event, which triggers a cache-bypassing reload.

## Proposed Implementation in `RepositoryDetailsPanel.tsx`

To enhance the performance of `RepositoryDetailsPanel.tsx`, a similar in-memory caching mechanism should be implemented. This will be particularly useful for caching data related to Git status, branch status, and quality metrics, which can be expensive to compute repeatedly.

### Implementation Steps

#### 1. Introduce a Cache `Map`

In `src/renderer/principal-window/views/RepositoryExplorer/components/RepositoryDetailsPanel.tsx`, add a `useMemo`-initialized `Map` to store cached data. A single cache can hold different types of data for a repository.

```typescript
// Proposed addition to RepositoryDetailsPanel.tsx

const detailsCache = useMemo(() => new Map<string, any>(), []);
```

#### 2. Integrate with Data Loading Functions

Modify the data loading functions (e.g., `checkForUpdates`) to use the cache.

```typescript
// Proposed modification to checkForUpdates in RepositoryDetailsPanel.tsx

const checkForUpdates = useCallback(async () => {
  if (!selectedRepository?.path || isCheckingRef.current) return;

  // Check cache first
  const cacheKey = `${selectedRepository.path}-branchStatus`;
  if (detailsCache.has(cacheKey)) {
    const cachedData = detailsCache.get(cacheKey);
    setBranchStatus(cachedData.branchStatus);
    setPushStatus(cachedData.pushStatus);
    return;
  }

  isCheckingRef.current = true;
  setIsCheckingUpdates(true);

  try {
    const [status, pushSafety] = await Promise.all([
      GitService.getBranchStatus(selectedRepository.path),
      GitService.isPushSafe(selectedRepository.path),
    ]);

    // Populate cache
    detailsCache.set(cacheKey, { branchStatus: status, pushStatus: pushSafety });

    setBranchStatus(status);
    setPushStatus(pushSafety);
  } catch (error) {
    console.error('[RepositoryDetailsPanel] Error checking for updates:', error);
  } finally {
    isCheckingRef.current = false;
    setIsCheckingUpdates(false);
  }
}, [selectedRepository?.path, detailsCache]);
```

#### 3. Define Cache Keys

Use a unique identifier for the repository combined with the data type as the cache key. This allows storing multiple types of data for the same repository.
- **Example Key**: `` `${selectedRepository.path}-branchStatus` ``
- **Example Key**: `` `${selectedRepository.path}-qualityMetrics` ``

#### 4. Manage Cache Invalidation

The existing "Refresh" button provides a natural way to manage cache invalidation. When the user clicks this button, clear the cache for the selected repository.

```typescript
// Proposed modification to handleRefresh in RepositoryDetailsPanel.tsx

const handleRefresh = async () => {
  if (onRefresh && !isRefreshing) {
    // Invalidate cache for the current repository
    if (selectedRepository?.path) {
      const keysToDelete = [
        `${selectedRepository.path}-branchStatus`,
        // Add other keys as they are implemented
      ];
      keysToDelete.forEach(key => detailsCache.delete(key));
    }
    await onRefresh();
  }
};
```

By following these steps, `RepositoryDetailsPanel.tsx` will benefit from improved performance and a more responsive user interface, aligning its data management strategy with the one used in `RepositoryManager.tsx`.