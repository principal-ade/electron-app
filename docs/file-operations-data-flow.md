# File Operations Data Flow Audit

**Focus**: File operations and git changes flow from repository-monitoring-server to UI panels

**Last Updated**: 2025-10-07

## Overview

This document tracks how file operation updates flow from the repository-monitoring-server worker process through the main process, IPC layer, renderer services, and ultimately to UI panels like the File Tree Panel and Git Changes Panel.

## Architecture Layers

### 1. Worker Process Layer (Repository Monitoring Server)

**Location**: `src/repository-monitoring-server/`

#### Key Components:

**RepositoryMonitoringServer** (`RepositoryMonitoringServer.ts:32`)
- Central coordinator for all repository monitoring
- Manages file trees, git status, and package data
- Uses `RepositoryCacheRegistry` for caching (line 46)
- Emits events via `process.parentPort.postMessage()` (lines 158, 559, 637)

**Key Data Types Built**:
- `FileTree` - Built by `FileTreeBuilder` (line 231)
- `GitStatusWithFiles` - Built by `buildGitStatusSlice()` (line 255)
- `PackageLayer[]` - Built by `PackageProcessor` (line 249)

**Event Flow from Server**:

1. **Git State Events** (`handleGitStateEvent`, line 608):
   ```typescript
   process.parentPort.postMessage({
     type: 'event',
     event: {
       name: MonitoringInternalEvent.GIT_STATE_EVENT,
       data: payload
     }
   })
   ```

2. **Workspace Change Events** (`handleWorkspaceChangeEvent`, line 538):
   - Invalidates file tree cache (line 541)
   - Schedules cache rebuilds (lines 544-545)
   - Posts workspace change event (line 558)

3. **Cache Sync Events** (`handleCacheUpdated`, line 102):
   - Emitted when `RepositoryCacheRegistry` updates any cache slice
   - Updates in-memory caches (fileTreeCache, packageCache, gitStatus)
   - Posts `CACHE_SYNC` event with updated entry (line 157)

**Git Watching**:
- Uses `GitWatcherAdapter` (line 53) powered by `@principal-ai/repository-monitoring`
- Subscribes to git state and workspace events (lines 58, 62)
- Debounced updates (500ms for fallback, 300ms for minimal mode, line 568)

---

### 2. Main Process Layer

**Location**: `src/main/repository-monitoring/`

#### RepositoryMonitoringManager (`RepositoryMonitoringManager.ts:57`)

**Responsibilities**:
- Spawns and manages the worker utility process (line 136)
- Routes messages between worker and renderer
- Provides public API for IPC handlers

**Message Handling** (`handleWorkerMessage`, line 207):

1. **Worker → Manager** (via `worker.on('message')`):
   - `ready` - Worker initialized (line 211)
   - `response` - Request completed (line 222)
   - `error` - Request failed (line 231)
   - `event` - Event broadcast (line 243)

2. **Manager → Renderer** (`broadcastToWindows`, line 356):
   ```typescript
   window.webContents.send(`repository-monitoring:${eventName}`, data)
   ```

**Key Events Forwarded**:
- `GIT_STATUS_CHANGED` (line 252)
- `GIT_STATE_EVENT` (line 260)
- `WORKSPACE_CHANGED` (line 268)
- `CACHE_SYNC` (handled by event forwarding, line 243)

#### IPC Handlers (`ipcHandlers.ts:38`)

**Registered Handlers**:
- `GET_FILE_TREE` (line 45) → `manager.getFileTree()`
- `GET_GIT_STATUS` (line 174) → `manager.getGitStatus()`
- `GET_GIT_STATUS_WITH_FILES` (line 186) → `manager.getGitStatusWithFiles()`
- `GET_PACKAGES` (line 61) → `manager.getPackages()`
- `GET_CACHE_SNAPSHOT` (line 74) → `manager.getRepositoryCacheSnapshot()`
- `REGISTER` (line 86) → `manager.registerRepository()`
- `ENABLE_GIT_WATCHING` (line 198) → `manager.enableGitWatching()`

**Event Forwarding to Renderer**:
```typescript
manager.on(MonitoringInternalEvent.GIT_STATUS_CHANGED, (data: GitStatusMetadata) => {
  BrowserWindow.getAllWindows().forEach(window => {
    window.webContents.send(RepositoryMonitoringAPIEvent.GIT_STATUS_CHANGED, data);
  });
});
```

Similar forwarding for:
- `GIT_STATE_EVENT` (line 260)
- `WORKSPACE_CHANGED` (line 268)

---

### 3. IPC Bridge Layer (Preload)

**Location**: `src/window/main-process-api-implementations/repositoryMonitoringApi.ts`

**Purpose**: Exposes safe IPC API to renderer via `window.mainProcess.repositoryMonitoring`

**API Methods**:
```typescript
{
  getFileTree: (repoPath) => ipcRenderer.invoke(GET_FILE_TREE, repoPath),
  getGitStatus: (repoPath) => ipcRenderer.invoke(GET_GIT_STATUS, repoPath),
  onGitStatusChanged: (callback) => {
    ipcRenderer.on(GIT_STATUS_CHANGED, (_, status) => callback(status));
    return () => ipcRenderer.removeListener(GIT_STATUS_CHANGED, handler);
  },
  onWorkspaceChange: (callback) => { /* line 72 */ },
  onCacheSync: (callback) => { /* line 80 */ }
}
```

**Event Subscriptions** (lines 64-86):
- `onGitStatusChanged` - Subscribes to `repository-monitoring:git-status-changed`
- `onWorkspaceChange` - Subscribes to `repository-monitoring:workspace-change`
- `onCacheSync` - Subscribes to `repository-monitoring:cache-sync`

---

### 4. Renderer Service Layer

**Location**: `src/renderer/services/` and `src/renderer/main-process-api/`

#### RepositoryMonitoringService (`RepositoryMonitoringService.ts:21`)

**Static API Wrapper** - Simplifies access to preload API:

```typescript
class RepositoryMonitoringService {
  static async getFileTree(repoPath: string): Promise<FileTree | null>
  static async getGitStatusWithFiles(repoPath: string): Promise<GitStatusWithFiles | null>
  static onGitStatusChanged(callback: (status: GitStatus) => void): () => void
  static onCacheSync(callback: (event: RepositoryCacheSyncEvent) => void): () => void
}
```

#### RepositoryDataCache (`RepositoryDataCache.ts:129`)

**Event-Driven Cache** - Central cache that auto-updates from events:

**Initialization** (`initializeEventSubscriptions`, line 156):
```typescript
// Subscribe to git status changes
RepositoryMonitoringService.onGitStatusChanged((status) => {
  this.handleGitStatusChange(status);
});

// Subscribe to cache sync events
RepositoryMonitoringService.onCacheSync((event) => {
  this.handleCacheSyncEvent(event);
});
```

**Data Loading** (`load`, line 240):
1. Fetches cache snapshot from monitoring service (line 251)
2. Extracts git status, file tree, packages from snapshot (lines 255-261)
3. Builds complete `RepositoryCacheData` (line 273)
4. Stores in local cache (line 294)

**Event Handling**:
- Git status changes → Updates cache → Emits `update:${repoPath}` event
- Cache sync events → Updates specific slices → Notifies subscribers

**Subscription Model** (`subscribe`, line 191):
```typescript
subscribe(repoPath: string, componentId: string, callback: (data) => void): () => void {
  this.on(`update:${repoPath}`, callback);
  return () => this.off(`update:${repoPath}`, callback);
}
```

#### MonitoredFileTreeService (`MonitoredFileTreeService.ts:36`)

**File Tree Specific Service**:

**Loading** (`loadFileTree`, line 58):
1. Checks memory cache (5 min TTL)
2. Falls back to `RepositoryMonitoringService.getFileTree()` (line 92)
3. Caches in memory with LRU eviction (line 123)

**Registration** (`registerRepository`, line 150):
- Calls `RepositoryMonitoringService.registerRepository()` when repo opens

**Cache Invalidation**:
- `invalidateSource()` - Removes from memory cache
- `refreshRepository()` - Invalidates + tells monitoring service to refresh (line 164)

---

### 5. React Hooks Layer

**Location**: `src/renderer/hooks/`

#### useRepositoryData (`useRepositoryData.ts:75`)

**Purpose**: Hook that provides repository data with automatic updates

**Flow**:
1. **Initial Load** (line 94):
   - Checks `RepositoryDataCache.get(repoPath)` (line 103)
   - If cached, returns immediately
   - If not cached, calls `RepositoryDataCache.load(repoPath)` (line 113)

2. **Subscription** (line 172):
   ```typescript
   const unsubscribe = cache.current.subscribe(
     repoPath,
     componentId.current,
     (updatedData) => {
       setData(updatedData);
       setLastUpdated(Date.now());
     }
   );
   ```

3. **Cleanup** (line 185):
   - Unsubscribes on unmount
   - Cache auto-evicts if no subscribers

#### useRepositoryGitStatus (`useRepositoryGitStatus.ts:13`)

**Purpose**: Dedicated hook for git status with real-time updates

**Flow**:
1. **Initial Load** (line 31):
   - Fetches from `RepositoryMonitoringService` (lines 43-45)
   - Sets both basic status and status with files

2. **Event Subscription** (line 64):
   ```typescript
   window.mainProcess.repositoryMonitoring.onGitStatusChanged(
     async (status: GitStatus) => {
       if (status.repoPath === repoPath) {
         setGitStatus(status);
         // Fetch detailed status
         const statusWithFiles = await RepositoryMonitoringService.getGitStatusWithFiles(repoPath);
         setGitStatusWithFiles(statusWithFiles);
       }
     }
   );
   ```

---

### 6. React Context Layer

**Location**: `src/renderer/panels/`

#### RepositoryPanelProvider (`RepositoryPanelProvider.tsx:79`)

**Purpose**: Provides unified data context to all repository panels

**Data Flow**:
1. Uses `useRepositoryData()` hook (line 86)
2. Maps git status format for compatibility (line 64)
3. Provides context value with:
   - `gitStatus` - Transformed git status
   - `fileTree` - From cache data
   - `packages` - From cache data
   - `refresh()` - Triggers cache reload

**Context Value** (line 118):
```typescript
{
  repositoryPath,
  repository,
  gitStatus,        // Mapped from GitStatusWithFiles
  gitStatusLoading,
  fileTree,         // From RepositoryCacheData
  packages,         // From RepositoryCacheData
  markdownFiles,
  quality,
  refresh,          // Refreshes cache
  actions           // Custom actions (e.g., openFile)
}
```

---

### 7. UI Component Layer

**Location**: `src/renderer/panels/components/`

#### GitChangesPanel (`GitChangesPanel.tsx:14`)

**Purpose**: Displays git changes in a file tree view

**Data Access** (line 21):
```typescript
const { gitStatus, gitStatusLoading, fileTree } = useRepositoryPanelContext();
```

**Processing** (line 82):
1. Checks if there are changes (staged, unstaged, untracked, deleted)
2. Expands directory paths using fileTree (line 86)
3. Builds git status tree using `PathsFileTreeBuilder` (line 122)
4. Maps to `GitFileStatus[]` format (line 128)

**Rendering** (line 191):
```typescript
<GitStatusFileTree
  fileTree={gitChangesData.tree}
  gitStatusData={gitChangesData.statusData}
  onFileSelect={handleFileSelect}
/>
```

**Event Updates**:
- Automatically re-renders when `gitStatus` changes via context
- Context updates from `useRepositoryData` → `RepositoryDataCache` events

#### FileTreeTab (`FileTreeTab.tsx:21`)

**Purpose**: Displays repository file tree

**Data Access** (via props, typically from RepositoryPanelProvider):
```typescript
<FileTreeTab
  fileTree={fileTree}  // From context
  onFileSelect={onFileSelect}
/>
```

**Rendering** (line 70):
```typescript
<DynamicFileTree
  fileTree={fileTree}
  onFileSelect={onFileSelect}
  showIcons={true}
  defaultOpen={false}
/>
```

**Event Updates**:
- Re-renders when `fileTree` prop changes
- FileTree updates from cache sync events → RepositoryDataCache → useRepositoryData → context

---

## Complete Data Flow Diagrams

### File Tree Update Flow

```
1. File Change Detected (GitWatcherAdapter)
   ↓
2. Workspace Change Event → RepositoryMonitoringServer.handleWorkspaceChangeEvent()
   ↓
3. File Tree Cache Invalidated (line 541)
   ↓
4. Cache Rebuild Scheduled (line 544)
   ↓
5. FileTreeBuilder.buildFileTree() Called
   ↓
6. RepositoryCacheRegistry Updates
   ↓
7. CACHE_SYNC Event Emitted (line 157)
   ↓
8. Worker → Main Process (postMessage)
   ↓
9. Main Process → All Renderer Windows (webContents.send)
   ↓
10. RepositoryDataCache.handleCacheSyncEvent()
    ↓
11. Cache Updated & Subscribers Notified
    ↓
12. useRepositoryData Hook Receives Update
    ↓
13. RepositoryPanelProvider Context Updates
    ↓
14. FileTreeTab Re-renders with New Data
```

### Git Changes Flow

```
1. Git Operation (commit, stage, etc.)
   ↓
2. Git State Event → RepositoryMonitoringServer.handleGitStateEvent()
   ↓
3. Git Status Cache Rebuild Scheduled (line 648)
   ↓
4. GitCore.getDetailedStatus() Called (line 265)
   ↓
5. GitStatusWithFiles Built (line 268)
   ↓
6. GIT_STATUS_CHANGED Event Emitted (line 590)
   ↓
7. Worker → Main Process
   ↓
8. Main Process → Renderer (ipcHandlers.ts:252)
   ↓
9. RepositoryDataCache.handleGitStatusChange()
    ↓
10. Cache Updated → Subscribers Notified
    ↓
11. useRepositoryGitStatus Hook Updates (direct subscription)
    OR
    useRepositoryData Hook Updates (via cache)
    ↓
12. RepositoryPanelProvider Context Updates
    ↓
13. GitChangesPanel Re-renders with New Git Status
```

### Cache Sync Event Flow (Universal)

```
1. Any Cache Slice Updates (fileTree, gitStatus, packages)
   ↓
2. RepositoryCacheRegistry.emit('cacheUpdated')
   ↓
3. RepositoryMonitoringServer.handleCacheUpdated() (line 102)
   ↓
4. In-Memory Caches Updated (fileTreeCache, packageCache, gitStatus state)
   ↓
5. CACHE_SYNC Event Posted to Main Process (line 158)
   ↓
6. RepositoryMonitoringManager.handleWorkerMessage() (line 243)
   ↓
7. Event Forwarded to All Windows (line 247)
   ↓
8. repositoryMonitoringApi.onCacheSync() Listeners Triggered (line 80)
   ↓
9. RepositoryDataCache.handleCacheSyncEvent() (line 163)
   ↓
10. Local Cache Updated
    ↓
11. Batched Update Queued (100ms debounce, line 134)
    ↓
12. Subscribers Notified via EventEmitter
    ↓
13. All Connected Hooks Receive Updates
    ↓
14. React Components Re-render
```

---

## Event Types & Payloads

### MonitoringInternalEvent Types

Defined in `src/repository-monitoring-server/types.ts`:

- **`GIT_STATE_EVENT`**: Git operations (commit, branch switch, merge, etc.)
  ```typescript
  {
    event: GitStateEvent,
    affectedCacheFields: CacheSlice[]  // ['fileTree', 'packages', 'gitStatus']
  }
  ```

- **`WORKSPACE_CHANGED`**: File system changes
  ```typescript
  {
    repoPath: string,
    state?: GitState,
    changes?: FileChange[]
  }
  ```

- **`GIT_STATUS_CHANGED`**: Git status updated
  ```typescript
  GitStatusMetadata {
    repoPath: string,
    branch: string,
    isDirty: boolean,
    hasUntracked: boolean,
    hasStaged: boolean,
    ahead: number,
    behind: number,
    lastChangedAt?: string
  }
  ```

- **`CACHE_SYNC`**: Cache slice synchronized
  ```typescript
  {
    repoPath: string,
    slice: 'fileTree' | 'gitStatus' | 'packages',
    entry: CacheEntry<T>
  }
  ```

### RepositoryMonitoringAPIEvent Types

Defined in `src/shared/main-process-api-interfaces/RepositoryMonitoringAPI.ts`:

**IPC Events** (sent to renderer):
- `repository-monitoring:git-status-changed`
- `repository-monitoring:git-state-event`
- `repository-monitoring:workspace-change`
- `repository-monitoring:cache-sync`

---

## Key Integration Points

### Panel Registration & Setup

**When a Repository View Opens**:

1. **RepositoryExplorer/RepositoryDetailsPanel**:
   ```typescript
   // Register repository with monitoring service
   await RepositoryMonitoringService.registerRepository(repoPath);

   // Enable git watching
   await RepositoryMonitoringService.enableGitWatching(repoPath);
   ```

2. **RepositoryPanelProvider**:
   ```typescript
   // Load data via hook (auto-subscribes to updates)
   const { data } = useRepositoryData(repoPath, {
     autoLoad: true,
     subscribe: true
   });
   ```

3. **MonitoredFileTreeService**:
   ```typescript
   // Register for file tree monitoring
   await monitoredFileTreeService.registerRepository(repoPath);
   ```

### Cache Warming

**Initial Cache Population** (when repo registered):

1. Main process calls `manager.registerRepository(repoPath)`
2. Worker receives `register` message
3. `RepositoryMonitoringServer.registerRepository()` creates state
4. Initial git status fetch (line 82)
5. File tree built on first `getFileTree()` request
6. Cache slices populated lazily or via `getRepositoryCacheSnapshot()`

### Real-Time Updates

**Git Operations**:
- Detected by `GitWatcherAdapter` via `@principal-ai/repository-monitoring`
- Debounced (300-500ms) before cache rebuild
- `GIT_STATUS_CHANGED` event sent to all windows
- Components auto-update via subscriptions

**File Changes**:
- Workspace changes detected by git watcher
- File tree cache invalidated
- Rebuild scheduled with debounce (250ms)
- `CACHE_SYNC` event sent when rebuild completes
- Panels receive updated file tree

---

## Supporting Future Panels

### Requirements for New File-Related Panels

Any new panel that needs file operation or git change data should:

1. **Use RepositoryPanelProvider** for data access:
   ```typescript
   const { fileTree, gitStatus, packages } = useRepositoryPanelContext();
   ```

2. **Or subscribe directly** via hooks:
   ```typescript
   const { data } = useRepositoryData(repoPath, { subscribe: true });
   // OR
   const { gitStatusWithFiles } = useRepositoryGitStatus(repoPath);
   ```

3. **Handle loading states**:
   ```typescript
   const { loading, isSliceLoading } = useRepositoryPanelContext();
   if (isSliceLoading('fileTree')) return <LoadingSpinner />;
   ```

4. **Implement refresh** capability:
   ```typescript
   const { refresh } = useRepositoryPanelContext();
   <RefreshButton onClick={refresh} />
   ```

### Data Available to Panels

Via `RepositoryPanelContext`:
- `fileTree: FileTree | null` - Complete file tree structure
- `gitStatus: GitStatus` - Git status with file lists
- `packages: PackageLayer[]` - Package structure
- `markdownFiles: MarkdownFile[]` - Markdown file list
- `quality: QualityMetrics | null` - Quality metrics
- `repository: EnhancedAlexandriaEntry` - Repository metadata

### Event-Driven Updates

Panels automatically receive updates when:
- Files are created/modified/deleted (via `WORKSPACE_CHANGED` → `CACHE_SYNC`)
- Git operations occur (via `GIT_STATE_EVENT` → `GIT_STATUS_CHANGED`)
- Cache rebuilds complete (via `CACHE_SYNC`)

No manual polling or refresh required - the event system handles everything.

---

## Performance Considerations

### Caching Strategy

**Multi-Level Cache**:
1. **Worker Process** - `RepositoryCacheRegistry` (primary cache, SHA-based for file trees)
2. **Renderer Service** - `RepositoryDataCache` (local cache, 5min TTL)
3. **Component Memory** - `MonitoredFileTreeService` (LRU cache, max 3 trees)

### Debouncing & Batching

**Worker Process**:
- File tree rebuild: 250ms debounce (line 180)
- Package rebuild: 300ms debounce (line 178)
- Git status minimal mode: 300ms (line 568)
- Git status fallback mode: 500ms (line 568)

**Renderer Cache**:
- Update batching: 100ms (line 134)
- Flush timer for batched updates
- Prevents excessive re-renders

### Subscription Management

**Automatic Cleanup**:
- `useRepositoryData` unsubscribes on unmount (line 185)
- Cache evicts unused entries when no subscribers (line 231)
- Component ID tracking prevents memory leaks (line 183)

---

## Troubleshooting Guide

### Common Issues

**Panel Not Updating**:
1. Check if repository is registered: `RepositoryMonitoringService.registerRepository()`
2. Verify git watching enabled: `RepositoryMonitoringService.enableGitWatching()`
3. Check subscription: `useRepositoryData` with `subscribe: true`
4. Inspect events in console: Look for `[RepositoryDataCache]` logs

**Stale Data**:
1. Manually refresh: `RepositoryMonitoringService.refreshRepository(repoPath)`
2. Check cache TTL (5min default)
3. Verify worker process is running: `getMonitoringStatus()`

**Missing File Tree**:
1. Ensure `MonitoredFileTreeService.registerRepository()` called
2. Check worker logs for build errors
3. Verify repository path is valid

### Debug Commands

```typescript
// Check cache state
const snapshot = await RepositoryMonitoringService.getRepositoryCacheSnapshot(repoPath);
console.log('Cache slices:', snapshot.slices);

// Check monitoring status
const status = await RepositoryMonitoringService.getMonitoringStatus();
console.log('Registered repos:', status.repositories);

// Force refresh
await RepositoryMonitoringService.refreshRepository(repoPath);
```

---

## Future Enhancements

### Planned Improvements

1. **Fine-Grained File Updates**: Instead of rebuilding entire file tree, send delta updates
2. **Incremental Git Status**: Only update changed files instead of full status
3. **Selective Subscriptions**: Subscribe to specific cache slices only
4. **Cross-Window Sync**: Ensure all windows show same state immediately

### Extension Points

**Adding New Cache Slices**:
1. Define slice type in `CacheSlice` union (RepositoryMonitoringAPI.ts:41)
2. Add to `CacheSliceDataMap` interface (line 58)
3. Implement `build${Slice}Slice()` method in RepositoryMonitoringServer
4. Add to `buildCacheSlice()` switch (line 216)
5. Update `RepositoryCacheData` to include new field

**Adding New Events**:
1. Define event type in `MonitoringInternalEvent` enum
2. Emit from RepositoryMonitoringServer
3. Forward in `ipcHandlers.ts`
4. Subscribe in `RepositoryDataCache` or component hooks

---

## Conclusion

The file operations data flow is designed as an event-driven, multi-layered architecture:

- **Worker Process** builds and caches file trees, git status, packages
- **Main Process** manages worker and routes events to renderer
- **IPC Bridge** provides safe communication channel
- **Renderer Services** maintain reactive cache and provide data access
- **React Hooks** connect cache to components with auto-updates
- **UI Panels** consume data via context, updating automatically

This architecture ensures:
- **Real-time updates** across all panels
- **Efficient caching** at multiple levels
- **Automatic subscription management** prevents memory leaks
- **Extensibility** for new panels and data types
- **Performance** through debouncing and batching
