# Repository Monitoring Service Integration Guide

## Overview

This document describes how to integrate the new Repository Monitoring Service with the existing RepositoryManager UI to provide optimized FileTree loading with git-aware caching.

> **Need cache-sync specifics?** Pair this guide with [REPOSITORY_MONITORING_CACHE_SYNC_INTEGRATION.md](./REPOSITORY_MONITORING_CACHE_SYNC_INTEGRATION.md) for the worker/main/renderer coordination required to hydrate renderer caches from the new `RepositoryCacheRegistry`.

## Current Architecture

### How FileTree Loading Currently Works

1. **RepositoryManager Component** (`src/renderer/repo-manager/RepositoryManager.tsx`)
   - Creates `FileTreeSourceService` and `FileTreeCacheService` instances
   - Initializes sources from repository (local clones and remote branches)

2. **FileTreeSourceService** (`src/renderer/services/FileTreeSourceService.ts`)
   - Creates FileTreeSource objects for each clone
   - Uses `CloneVisibilityService` to determine which clone to load
   - Calls `FileTreeCacheService.prefetchTrees()` for visible clones

3. **FileTreeCacheService** (`src/renderer/services/FileTreeCacheService.ts`)
   - Loads file trees via `loadLocalFileSystemTree()` utility
   - Caches trees in memory and localStorage
   - Analysis results are cached in memory only

4. **loadLocalFileSystemTree** (`src/renderer/utils/loadFileSystemTree.ts`)
   - Calls `FileSystemService.buildFilteredFileTree()` via IPC
   - Main process uses globby to scan filesystem with .gitignore support
   - Transforms paths array into FileTree structure

### Performance Issues with Current Approach

1. **No Git-Aware Caching**: Every time a repository is opened, the entire file tree is rescanned
2. **Redundant IPC Calls**: Multiple round trips between renderer and main process
3. **No Background Updates**: File trees aren't updated until explicitly refreshed
4. **Memory Inefficiency**: Each window loads its own copy of the file tree

## Proposed Integration: Clean Break Approach

We're implementing a clean break from the old FileTreeCacheService to ensure we're always using the new repository-monitoring service. This allows us to verify the new implementation works correctly before removing the old code.

### Phase 1: Create New MonitoredFileTreeService

The `MonitoredFileTreeService` is a complete replacement for `FileTreeCacheService` that ONLY uses the repository-monitoring service.

**Key Differences:**
- No fallback to `FileSystemService.buildFilteredFileTree()`
- Throws clear errors if monitoring service doesn't have data
- Simpler caching (memory only, monitoring service handles persistent cache)
- Explicit repository registration required

See: `src/renderer/services/MonitoredFileTreeService.ts`

### Phase 2: Integrate in RepositoryManager

Replace `FileTreeCacheService` with `MonitoredFileTreeService` in the RepositoryManager component:

```typescript
// src/renderer/repo-manager/RepositoryManager.tsx
import { MonitoredFileTreeService } from '../../services/MonitoredFileTreeService';
import { RepositoryMonitoringService } from '../../main-process-api/RepositoryMonitoringService';

export const RepositoryManager: React.FC<RepositoryManagerProps> = React.memo(
  ({ repository, onBack, onSettingsClick, hasUpdateAvailable }) => {
    // ... existing code ...

    // REPLACE THIS:
    // const cacheService = useMemo(() => new FileTreeCacheService(), []);

    // WITH THIS:
    const fileTreeService = useMemo(() => new MonitoredFileTreeService(), []);

    // Register repository when component mounts
    useEffect(() => {
      const registerAndInitialize = async () => {
        if (repository.localClones && repository.localClones.length > 0) {
          const visibleClonePath = CloneVisibilityService.getVisibleClonePath(repository);
          if (visibleClonePath) {
            try {
              // CRITICAL: Register BEFORE trying to load
              await fileTreeService.registerRepository(visibleClonePath);

              // Now initialize sources (which will trigger loading)
              const sources = fileTreeSourceService.initializeFromRepository(repository);

              // Prefetch the trees
              await fileTreeService.prefetchTrees(sources);
            } catch (error) {
              console.error('[RepositoryManager] Failed to register repository:', error);
              // Show error to user - the new service requires registration!
            }
          }
        }
      };

      registerAndInitialize();
    }, [repository, fileTreeService, fileTreeSourceService]);

    // ... rest of component ...
  }
);
```

### Phase 3: Update All References

Update all components that use `FileTreeCacheService` to use `MonitoredFileTreeService`:

```typescript
// Any component that currently does:
const cacheService = useMemo(() => new FileTreeCacheService(), []);

// Should change to:
const fileTreeService = useMemo(() => new MonitoredFileTreeService(), []);
```

Components to update:
- `RepositoryManager.tsx`
- `DevelopmentWorkspace.tsx` (if it creates its own cache service)
- `PlanningView.tsx` (removed; planning workflow retired)
- Any other views that load FileTrees

### Phase 4: Verification & Cleanup

1. **Test the new implementation**:
   - Open repository windows
   - Verify FileTrees load correctly
   - Check console for MonitoredFileTreeService logs
   - Ensure no fallback to old scanning

2. **Monitor performance**:
   - FileTree load time should be faster (served from cache)
   - Memory usage should be lower (shared across windows)
   - No redundant filesystem scans

3. **Clean up old code** (after verification):
   - Remove `FileTreeCacheService.ts`
   - Remove `loadFileSystemTree.ts` (local loading logic)
   - Remove `FileSystemService.buildFilteredFileTree()` and related IPC handlers
   - Remove filesystem scanning code from main process

### Phase 5: Real-Time Updates (Future Enhancement)

Subscribe to file tree changes for automatic UI updates:

```typescript
// src/renderer/repo-manager/RepositoryManager.tsx
useEffect(() => {
  if (visibleClonePath) {
    // Subscribe to file tree updates
    const unsubscribe = RepositoryMonitoringService.onFileTreeUpdate(
      visibleClonePath,
      (updatedTree) => {
        // Update the cache
        cacheService.storeTree(activeSource, updatedTree, {
          fileCount: updatedTree.allFiles?.length || 0,
          directoryCount: updatedTree.allDirectories?.length || 0,
        });

        // Trigger re-render
        setFileTreeVersion(v => v + 1);
      }
    );

    return unsubscribe;
  }
}, [visibleClonePath, activeSource, cacheService]);
```

### Phase 3: Quality Metrics Integration (Future)

Once Phase 2 of the monitoring service is complete, integrate quality metrics:

```typescript
// src/renderer/components/RepositoryQualityPanel.tsx
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';

export function RepositoryQualityPanel({ repository }) {
  const [metrics, setMetrics] = useState(null);
  const [packages, setPackages] = useState([]);

  useEffect(() => {
    const loadMetrics = async () => {
      if (repository.visibleClonePath) {
        const [metricsData, packagesData] = await Promise.all([
          RepositoryMonitoringService.getQualityMetrics(repository.visibleClonePath),
          RepositoryMonitoringService.getPackages(repository.visibleClonePath)
        ]);

        setMetrics(metricsData);
        setPackages(packagesData.packages);
      }
    };

    loadMetrics();
  }, [repository.visibleClonePath]);

  return (
    <div>
      {/* Display quality metrics and package information */}
    </div>
  );
}
```

## Clean Break Advantages

### Why No Fallback?

1. **Certainty**: Always know data comes from the monitoring service
2. **Clear Errors**: Explicit failures help identify registration issues
3. **No Mixed State**: Avoid bugs from mixing old and new data sources
4. **Easier Testing**: Can verify new implementation in isolation
5. **Clean Migration**: Easy to remove old code once verified

### Error Handling

With no fallback, errors are explicit and actionable:

```typescript
// Error: "No FileTree available from monitoring service for /path/to/repo"
// Solution: Ensure repository is registered

// Error: "MonitoredFileTreeService only supports local sources"
// Solution: GitHub sources need different handling (keep old path for now)
```

## Benefits of This Integration

### Immediate Benefits (Phase 1)
1. **Faster Load Times**: Pre-computed file trees served from worker process cache
2. **Git-Aware Caching**: Only recompute when repository actually changes (SHA-based)
3. **Reduced IPC Overhead**: Single call to get complete FileTree instead of multiple calls
4. **Memory Efficiency**: Single FileTree instance shared across all windows for same repo

### Future Benefits (Phase 2+)
1. **Real-Time Updates**: File trees automatically update when files change
2. **Quality Metrics**: Rich repository analysis without blocking UI
3. **Background Processing**: CPU-intensive operations run in separate process
4. **Crash Protection**: Worker process can restart without affecting main window

## Migration Strategy (Clean Break)

### Step 1: Implement New Service
- ✅ Create `MonitoredFileTreeService`
- ✅ Document integration approach
- [ ] Create `RepositoryMonitoringService` renderer wrapper

### Step 2: Test in Isolation
- [ ] Create test repository window with new service
- [ ] Verify FileTree loading works
- [ ] Compare performance with old implementation

### Step 3: Gradual Migration
- [ ] Add feature flag to switch between services
- [ ] Migrate one view at a time
- [ ] Keep old code until all views migrated

### Step 4: Complete Migration
- [ ] Remove feature flag
- [ ] Delete old FileTreeCacheService
- [ ] Delete old filesystem scanning code
- [ ] Update all documentation

## Testing Strategy

### Unit Tests
```typescript
// src/renderer/services/MonitoringFileTreeSource.test.ts
describe('MonitoringFileTreeSource', () => {
  it('should load file tree from monitoring service', async () => {
    const mockTree = { /* mock FileTree */ };
    jest.spyOn(RepositoryMonitoringService, 'getFileTree')
      .mockResolvedValue(mockTree);

    const result = await MonitoringFileTreeSource.loadFileTree('/path/to/repo');
    expect(result).toEqual(mockTree);
  });

  it('should handle service errors gracefully', async () => {
    jest.spyOn(RepositoryMonitoringService, 'getFileTree')
      .mockRejectedValue(new Error('Service unavailable'));

    const result = await MonitoringFileTreeSource.loadFileTree('/path/to/repo');
    expect(result).toBeNull();
  });
});
```

### Integration Tests
1. Test repository registration on window open
2. Test FileTree loading from monitoring service
3. Test fallback to existing logic when service unavailable
4. Test cache invalidation and refresh

### Performance Tests
1. Measure FileTree load time: before vs after
2. Measure memory usage with multiple windows
3. Measure CPU usage during repository scanning

## Implementation Checklist

### Phase 1: New Service Implementation
- [x] Create `MonitoredFileTreeService` (clean replacement)
- [ ] Create `RepositoryMonitoringService` renderer API wrapper
- [ ] Add unit tests for `MonitoredFileTreeService`

### Phase 2: Integration
- [ ] Update `RepositoryManager` to use new service
- [ ] Add repository registration on mount
- [ ] Handle registration errors gracefully

### Phase 3: Testing
- [ ] Test with local repositories
- [ ] Verify no filesystem scanning occurs
- [ ] Measure performance improvement

### Phase 4: Migration
- [ ] Add feature flag for switching services
- [ ] Migrate other views gradually
- [ ] Remove old code after verification

## Key Files to Modify

1. `src/renderer/main-process-api/RepositoryMonitoringService.ts` (new)
2. `src/renderer/repo-manager/RepositoryManager.tsx`
3. `src/renderer/services/FileTreeCacheService.ts`
4. `src/renderer/services/MonitoringFileTreeSource.ts` (new)
5. `src/main/initialization.ts` (already updated)

## Notes

- The monitoring service runs in a separate utility process, similar to event-processing-server
- File trees are cached based on git SHA, so they're only recomputed when the repository changes
- The service can monitor multiple repositories simultaneously
- Registration is idempotent - calling it multiple times for the same path is safe