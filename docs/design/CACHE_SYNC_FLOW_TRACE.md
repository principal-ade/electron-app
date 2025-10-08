# CACHE_SYNC Event Flow - Complete Trace

**Purpose**: Function-by-function trace of cache sync events

## Step 1: File Change Detected

**File**: `src/repository-monitoring-server/GitWatcherAdapter.ts`
**Function**: `handleWorkspaceChange(event: WorkspaceChangeEvent)`
**Action**: Emits `MonitoringInternalEvent.WORKSPACE_CHANGED`

```typescript
this.emit(MonitoringInternalEvent.WORKSPACE_CHANGED, payload);
```

---

## Step 2: Workspace Change Handled

**File**: `src/repository-monitoring-server/RepositoryMonitoringServer.ts:538`
**Function**: `handleWorkspaceChangeEvent(payload: WorkspaceChangeEventPayload)`
**Action**: Invalidates file tree cache

```typescript
this.cacheRegistry.invalidateSlice(payload.repoPath, 'fileTree');
this.scheduleRebuild(payload.repoPath, 'fileTree', 250);
```

---

## Step 3: Cache Rebuild Scheduled

**File**: `src/repository-monitoring-server/RepositoryMonitoringServer.ts:180`
**Function**: `scheduleRebuild(repoPath, slice, debounceMs)`
**Action**: Queues cache rebuild

```typescript
this.cacheRegistry.getOrBuild(
  repoPath,
  slice,
  async () => this.buildCacheSlice(repoPath, slice)
);
```

---

## Step 4: File Tree Built

**File**: `src/repository-monitoring-server/RepositoryMonitoringServer.ts:231`
**Function**: `buildCacheSlice(repoPath, 'fileTree')`
**Action**: Builds new file tree

```typescript
case 'fileTree': {
  const fileTree = await this.fileTreeBuilder.buildFileTree(repoPath);
  return fileTree;
}
```

---

## Step 5: Cache Entry Updated

**File**: `src/repository-monitoring-server/cache/RepositoryCacheRegistry.ts:268`
**Function**: `set()` or `getOrBuild()` completion
**Action**: Emits `cacheUpdated` event

```typescript
this.emit('cacheUpdated', {
  repoPath,
  slice,
  entry: { ...entry }
} satisfies CacheUpdatedEvent<K>);
```

---

## Step 6: Cache Updated Event Handled

**File**: `src/repository-monitoring-server/RepositoryMonitoringServer.ts:104`
**Function**: `handleCacheUpdated(event: CacheUpdatedEvent)`
**Action**: Updates local cache AND posts CACHE_SYNC to main process

```typescript
private handleCacheUpdated(event: CacheUpdatedEvent): void {
  const payload: RepositoryCacheSyncEvent = {
    repoPath: event.repoPath,
    slice: event.slice,
    entry: event.entry,
  };

  // Update local caches (fileTreeCache, packageCache, etc.)
  switch (slice) {
    case 'fileTree':
      this.fileTreeCache.set(repoPath, { tree: fileTreeData, timestamp, sha });
      break;
    // ...
  }

  // POST TO MAIN PROCESS
  if (process.parentPort) {
    process.parentPort.postMessage({
      type: 'event',
      event: {
        name: MonitoringInternalEvent.CACHE_SYNC,  // 'cache-sync'
        data: payload,
      },
    });
  }
}
```

---

## Step 7: Main Process Receives Event

**File**: `src/main/repository-monitoring/RepositoryMonitoringManager.ts:207`
**Function**: `handleWorkerMessage(msg: ServerToMainMessage)`
**Action**: Receives event from worker

```typescript
case 'event':
  if (msg.event) {
    // LOCAL EMIT - triggers our ipcHandlers listener
    this.emit(msg.event.name, msg.event.data);

    // BROADCAST TO RENDERER - sends IPC message
    this.broadcastToWindows(msg.event.name, msg.event.data);
  }
  break;
```

**Key Point**: TWO things happen:
1. `this.emit('cache-sync', data)` - Local EventEmitter
2. `this.broadcastToWindows('cache-sync', data)` - IPC to renderer

---

## Step 8a: Main Process Local Event (ipcHandlers)

**File**: `src/main/repository-monitoring/ipcHandlers.ts:277`
**Function**: Event handler registered on manager
**Action**: Forwards to renderer windows

```typescript
manager.on(MonitoringInternalEvent.CACHE_SYNC, (event: RepositoryCacheSyncEvent) => {
  console.log(`[RepositoryMonitoring] Forwarding cache sync to renderer: ${event.repoPath} - ${event.slice}`);
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(window => {
    window.webContents.send(RepositoryMonitoringAPIEvent.CACHE_SYNC, event);
  });
});
```

**Sends IPC**: `'repository-monitoring:cache-sync'` with event data

---

## Step 8b: Main Process Broadcast (ALSO happens)

**File**: `src/main/repository-monitoring/RepositoryMonitoringManager.ts:356`
**Function**: `broadcastToWindows(eventName, data)`
**Action**: Also sends to renderer

```typescript
private broadcastToWindows(eventName: string, data: any): void {
  const windows = BrowserWindow.getAllWindows();
  for (const window of windows) {
    window.webContents.send(`repository-monitoring:${eventName}`, data);
  }
}
```

**Sends IPC**: `'repository-monitoring:cache-sync'` with data

**NOTE**: Event is sent TWICE! (once from ipcHandlers, once from broadcastToWindows)

---

## Step 9: Renderer Receives IPC Event

**File**: `src/window/main-process-api-implementations/repositoryMonitoringApi.ts:80`
**Function**: `onCacheSync()` subscription
**Action**: IPC listener fires

```typescript
onCacheSync: (callback) => {
  const handler = (_event: Electron.IpcRendererEvent, payload: RepositoryCacheSyncEvent) =>
    callback(payload);
  ipcRenderer.on(RepositoryMonitoringAPIEvent.CACHE_SYNC, handler);  // Listens for 'repository-monitoring:cache-sync'
  return () => {
    ipcRenderer.removeListener(RepositoryMonitoringAPIEvent.CACHE_SYNC, handler);
  };
}
```

---

## Step 10: RepositoryDataCache Subscribes

**File**: `src/renderer/services/RepositoryDataCache.ts:167`
**Function**: `initializeEventSubscriptions()`
**Action**: Subscribes to cache sync

```typescript
const unsubscribeCacheSync = RepositoryMonitoringService.onCacheSync((event) => {
  this.handleCacheSyncEvent(event);
});
this.eventSubscriptions.push(unsubscribeCacheSync);
```

---

## Step 11: Cache Sync Event Handled

**File**: `src/renderer/services/RepositoryDataCache.ts:475`
**Function**: `handleCacheSyncEvent(event: RepositoryCacheSyncEvent)`
**Action**: Applies cache update

```typescript
private handleCacheSyncEvent(event: RepositoryCacheSyncEvent): void {
  void this.applyCacheSyncEvent(event);
}

private async applyCacheSyncEvent(event: RepositoryCacheSyncEvent): Promise<void> {
  const entry = this.cache.get(event.repoPath);
  if (!entry) {
    return;  // ⚠️ EARLY RETURN IF REPO NOT IN CACHE
  }

  // Update cache...
  // Queue batched update...
  // Flush after debounce...
}
```

---

## Step 12: Cache Updated & Subscribers Notified

**File**: `src/renderer/services/RepositoryDataCache.ts:390`
**Function**: `flushBatchedUpdates()`
**Action**: Emits update events

```typescript
private flushBatchedUpdates(): void {
  for (const [repoPath, queuedUpdate] of this.updateQueue) {
    const entry = this.cache.get(repoPath);
    if (entry) {
      // EMIT EVENT TO SUBSCRIBERS
      this.emit(`update:${repoPath}`, {
        repoPath,
        fields: Array.from(queuedUpdate.fields),
        data: entry.data,
      } as CacheUpdateEvent);
    }
  }
  this.updateQueue.clear();
}
```

---

## Step 13: useRepositoryData Hook Receives Update

**File**: `src/renderer/hooks/useRepositoryData.ts:172`
**Function**: Effect subscribes to cache
**Action**: Callback fires

```typescript
const unsubscribe = cache.current.subscribe(
  repoPath,
  componentId.current,
  (updatedData) => {
    console.log(`[useRepositoryData] Received cache update for ${repoPath}`);
    setData(updatedData);  // ← React state update
    setLastUpdated(Date.now());
    setIsStale(false);
  }
);
```

---

## Step 14: UI Re-renders

**File**: `src/renderer/panels/RepositoryPanelProvider.tsx:94`
**Context updates**, triggering re-render of:
- FileTreeTab
- GitChangesPanel
- Any other consuming components

---

## POTENTIAL ISSUES

### Issue 1: Repository Not in Cache
**Location**: Step 11 - `applyCacheSyncEvent()`
**Problem**: Early return if `this.cache.get(event.repoPath)` returns null
**When**: If repository hasn't been loaded yet via `useRepositoryData`

### Issue 2: No Active Subscriptions
**Problem**: If no component is subscribed to that repository's updates
**When**: Component unmounted or never mounted

### Issue 3: Component Not Using Hook
**Problem**: If panel doesn't use `useRepositoryData` with `subscribe: true`
**When**: Old implementation or manual data fetching

---

## DEBUGGING CHECKLIST

Run this code in the renderer console to check subscription:

```javascript
// Check if RepositoryDataCache singleton exists
const cache = window.__REPO_CACHE__ || RepositoryDataCache.getInstance();

// Check if repo is in cache
cache.cache.has('/Users/griever/Developer/SFTechWeek-2025-Hackathon');

// Check subscriptions count
const entry = cache.cache.get('/Users/griever/Developer/SFTechWeek-2025-Hackathon');
console.log('Subscriptions:', entry?.subscriptions.size);

// Check event listeners
console.log('Event listener count:', cache.listenerCount('update:/Users/griever/Developer/SFTechWeek-2025-Hackathon'));
```

---

## EXPECTED CONSOLE LOGS

When file watching works:

```
[GitWatcherAdapter] Workspace change detected: /Users/griever/Developer/SFTechWeek-2025-Hackathon
[RepositoryMonitoringServer] handleWorkspaceChangeEvent
[RepositoryMonitoringServer] File tree cache invalidated for /Users/griever/Developer/SFTechWeek-2025-Hackathon
[RepositoryCacheRegistry] Building fileTree for /Users/griever/Developer/SFTechWeek-2025-Hackathon
[RepositoryMonitoringManager] Received message from worker: event
[RepositoryMonitoring] Forwarding cache sync to renderer: /Users/griever/Developer/SFTechWeek-2025-Hackathon - fileTree
[RepositoryDataCache] Received cache update for /Users/griever/Developer/SFTechWeek-2025-Hackathon
[useRepositoryData] Received cache update for /Users/griever/Developer/SFTechWeek-2025-Hackathon
```
