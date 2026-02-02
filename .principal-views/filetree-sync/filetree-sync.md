# FileTree Synchronization System

## Overview

The FileTree Synchronization system provides real-time updates of repository file structures across the application. When files are added, modified, or deleted in a repository, the system detects these changes, rebuilds an optimized cache, and propagates fresh data to all UI components displaying the file tree.

## Problem Statement

Keeping UI components in sync with file system changes presents several challenges:

1. **Performance**: Scanning thousands of files on every change would be prohibitively slow
2. **Consistency**: Multiple UI components need to show the same, up-to-date file tree
3. **Timing**: File operations often happen in batches (e.g., git checkout), requiring debouncing
4. **Reliability**: Events must be deduplicated and stale data must be prevented

## System Architecture

### Components

#### 1. File Watcher (Chokidar)
- **Purpose**: Detects file system changes in real-time
- **Location**: Worker process (`repository-monitoring-server`)
- **Events Detected**: `add`, `change`, `unlink`, `addDir`, `unlinkDir`

#### 2. Cache Registry
- **Purpose**: Maintains versioned cache of file tree data
- **Versioning**: Increments on every rebuild to track freshness
- **Invalidation**: Marks cache as stale when changes detected

#### 3. Debounce Timer
- **Purpose**: Batches rapid file changes to avoid excessive rebuilds
- **Delay**: 250ms (configurable)
- **Benefit**: Single rebuild for operations like `git checkout` that touch many files

#### 4. File Tree Builder
- **Purpose**: Constructs optimized file tree structure
- **Output**: JSON tree with metadata (sizes, timestamps, git status)
- **Optimization**: Filters ignored files, applies .gitignore rules

#### 5. IPC Event System
- **workspace:changed**: Emitted immediately when files change
- **CACHE_SYNC**: Emitted after cache rebuild completes with fresh data

#### 6. Deduplication Guard
- **Purpose**: Prevents duplicate event processing
- **Mechanism**: Tracks recent events by key (`repoPath:slice:version`)
- **Window**: 50ms
- **Why Needed**: electron-log IPC transport can cause duplicate events

### Data Flow

```
File Change
    ↓
Chokidar Watcher Detects
    ↓
Worker Process Notified
    ├→ Emit workspace:changed (immediate)
    └→ Invalidate Cache
           ↓
       250ms Debounce
           ↓
       Rebuild Cache (version++)
           ↓
       Emit CACHE_SYNC with fresh data
           ↓
       Preload Bridge (+ deduplication)
           ↓
       RepositoryMonitoringService
           ↓
       RepositoryPanelContext
           ↓
       File Tree UI Re-renders
```

## Key Design Decisions

### 1. Cache Version Tracking

**Problem**: Git SHA doesn't change when files are added/removed in working directory

```typescript
// ❌ BROKEN: SHA stays same when adding files
const fileTreeSha = "4c88f492...";           // Clean
// Add file
const fileTreeSha = "4c88f492...-dirty";     // Dirty but same base SHA
// Add more files
const fileTreeSha = "4c88f492...-dirty";     // Still same!
```

**Solution**: Track cache version separately

```typescript
// ✅ WORKS: Version increments on every rebuild
const cacheVersion = 42;    // Initial
// Add file → cache rebuild
const cacheVersion = 43;    // Incremented!
// Add more files → cache rebuild
const cacheVersion = 44;    // Incremented again!
```

### 2. refreshRepository() vs getFileTree()

**Problem**: Calling `getFileTree()` on `workspace:changed` event created race condition

```typescript
// ❌ RACE CONDITION
workspace:changed event fires
    ↓
Call getFileTree()
    ↓
Returns STALE cached data (rebuild hasn't completed yet)
    ↓
[250ms later]
    ↓
CACHE_SYNC event arrives with FRESH data
    ↓
UI updated twice: first with stale, then with fresh data
```

**Solution**: Use `refreshRepository()` to invalidate and wait

```typescript
// ✅ NO RACE CONDITION
workspace:changed event fires
    ↓
Call refreshRepository()
    ↓
Cache invalidated, rebuild triggered
    ↓
[Wait for CACHE_SYNC event]
    ↓
CACHE_SYNC arrives with FRESH data
    ↓
UI updated once with correct data
```

### 3. Deduplication Guard

**Problem**: electron-log's IPC transport causes duplicate events

**Root Cause**:
- electron-log v5+ sends logs from renderer to main via IPC
- The `rendererConsole` transport can interfere with custom IPC events
- Webpack bundling can create multiple instances of electron-log

**Solution**: Guard at preload layer

```typescript
// Track recent events by content hash
const recentEvents = new Map<string, number>();
const eventKey = `${repoPath}:${slice}:${version}`;
const now = Date.now();

if (recentEvents.get(eventKey) && (now - lastSeen) < 50) {
  return; // Duplicate, ignore
}

recentEvents.set(eventKey, now);
callback(event);
```

## Operations

### Normal File Change Flow

1. User modifies `src/app.ts`
2. Chokidar detects change event
3. Worker invalidates cache
4. Debounce timer starts (250ms)
5. Debounce completes, cache rebuilds
6. CACHE_SYNC event emitted with new tree
7. UI receives update and re-renders

**Total latency**: ~250-300ms

### Batch Operation Flow (e.g., git checkout)

1. `git checkout feature-branch` touches 50 files
2. Chokidar detects 50 change events
3. Worker invalidates cache once
4. Debounce timer resets on each change
5. After last change, wait 250ms
6. Single cache rebuild for all changes
7. Single CACHE_SYNC event
8. Single UI update

**Total latency**: ~300-350ms (same as single file!)

### Manual Refresh Flow

1. User explicitly refreshes repository
2. Renderer calls `refreshRepository()`
3. IPC invoke to main process
4. Worker invalidates cache immediately
5. Cache rebuilds without debounce
6. CACHE_SYNC event emitted
7. UI updates

**Total latency**: ~50-100ms (no debounce)

## Error Scenarios

### Scenario 1: Cache Rebuild Fails

**Cause**: Permission errors, corrupted .git directory, disk full

**Handling**:
- Error logged to console
- Cache marked as invalid
- Previous cached data retained
- UI shows last known good state

**Recovery**: Manual refresh or file change triggers retry

### Scenario 2: IPC Event Lost

**Cause**: Process crash, IPC channel closed

**Handling**:
- Subscription automatically recreated on reconnect
- Manual refresh available to user
- Workspace context handles missing events gracefully

**Recovery**: Next file change or manual refresh

### Scenario 3: Duplicate Events Despite Guard

**Cause**: Events arriving >50ms apart (beyond deduplication window)

**Impact**: Minimal - duplicate work but same result

**Mitigation**: Increase deduplication window if needed

## Performance Characteristics

### Small Repository (< 1000 files)
- Rebuild time: ~10-30ms
- Memory: ~1-2MB cache
- CPU: Negligible

### Medium Repository (1000-10000 files)
- Rebuild time: ~50-150ms
- Memory: ~5-10MB cache
- CPU: ~5-10% during rebuild

### Large Repository (10000+ files)
- Rebuild time: ~200-500ms
- Memory: ~20-50MB cache
- CPU: ~10-20% during rebuild
- Mitigation: Debouncing prevents excessive rebuilds

## Monitoring & Debugging

### Key Telemetry Events

All events follow the `filetree.*` naming convention:

- `filetree.file.changed` - File system change detected
- `filetree.watcher.detected` - Watcher detected change
- `filetree.cache.invalidated` - Cache marked stale
- `filetree.debounce.triggered` - Debounce completed
- `filetree.cache.rebuild` - Cache rebuild completed
- `filetree.cache.synced` - IPC event emitted
- `filetree.preload.event_received` - Preload received event
- `filetree.dedup.dropped` - Duplicate event dropped
- `filetree.context.updated` - React context updated
- `filetree.ui.rendered` - UI component rendered

### Debug Logging

Enable debug logs:
```typescript
localStorage.setItem('debug:filetree', 'true');
```

Look for:
- `[PATH A]` / `[PATH B]` prefixes (race condition indicators)
- `[DEDUPE]` prefix (duplicate event detection)
- Cache version numbers
- Timing deltas between events

## Future Improvements

### 1. Incremental Updates

**Current**: Full tree rebuilt on every change
**Proposed**: Only update changed subtrees
**Benefit**: Faster rebuilds for large repositories

### 2. Content Hash on FileTree

**Current**: Use cache version for change detection
**Proposed**: Add `contentHash` field to FileTree object
**Benefit**: More semantic, easier to reason about

### 3. Smart Debouncing

**Current**: Fixed 250ms delay
**Proposed**: Adaptive delay based on change frequency
**Benefit**: Faster updates for single changes, better batching for bulk operations

### 4. Persistent Cache

**Current**: Cache rebuilt on app restart
**Proposed**: Serialize cache to disk, load on startup
**Benefit**: Instant file tree on app launch

## References

- **Investigation Doc**: `docs/filetree-staleness-investigation.md`
- **Architecture Doc**: `docs/REPOSITORY_MONITORING_ARCHITECTURE.md`
- **Data Flow Doc**: `docs/file-operations-data-flow.md`
- **Canvas**: `.principal-views/filetree-sync/filetree-sync.otel.canvas`
