# System Monitor Polling Optimization

## Problem Statement

The SystemMonitor component is generating excessive IPC traffic between the renderer process and the repository monitoring worker, causing performance concerns and potential UI slowdowns.

## Current Behavior

### Polling Frequency
**File:** `src/renderer/principal-window/views/SystemMonitor/SystemMonitor.tsx:56`

```typescript
// Set up polling every 2 seconds
interval = setInterval(fetchStatus, 2000);
```

### What Gets Polled

Every 2 seconds, the SystemMonitor makes two worker requests:

1. **`getRepositoryDetails`** - Gets list of all monitored repositories with their status
   - File: `src/main/repository-monitoring/RepositoryMonitoringManager.ts:494`
   - Returns: Array of `RepositoryInfo[]` with git watching state, file system monitoring state, etc.

2. **`getResourceMetrics`** - Gets worker process memory and CPU usage
   - File: `src/main/repository-monitoring/RepositoryMonitoringManager.ts:511`
   - Returns: `{ memory: number, cpu: number }`

### Traffic Analysis

For a user monitoring **N repositories**:
- **Polling frequency:** Every 2 seconds
- **Requests per poll:** 2 (getRepositoryDetails + getResourceMetrics)
- **Total requests per minute:** 60 requests
- **IPC messages logged:** Each request generates 2-3 log messages (request, response, worker stdout)

**Example log output:**
```
[1] [RepositoryMonitoring] Using parentPort.postMessage
[1] [RepositoryMonitoringManager] [Worker stdout] [RepositoryMonitoring] Received message: getRepositoryDetails 9147020e-2b8f-4bfe-8957-285670ce9dd4
[1] [RepositoryMonitoringManager] [Worker stdout] [RepositoryMonitoring] Sending message to main: response
[1] [RepositoryMonitoring] Using parentPort.postMessage
[1] [RepositoryMonitoringManager] [Worker stdout] [RepositoryMonitoring] Received message: getResourceMetrics 5bfe5fb0-530b-4b55-9cf7-615504840872
[1] [RepositoryMonitoringManager] [Worker stdout] [RepositoryMonitoring] Sending message to main: response
```

This repeats every 2 seconds, creating significant log noise and IPC overhead.

## Why This is Problematic

1. **Excessive IPC Traffic**
   - 60 IPC round-trips per minute just for monitoring UI
   - Each round-trip involves serialization/deserialization
   - Main process <-> Worker <-> Renderer communication overhead

2. **Wasted Resources**
   - Polling happens even when SystemMonitor view is not visible
   - Most polls return identical data (repositories don't change frequently)
   - CPU wasted on serialization and worker communication

3. **Log Noise**
   - 180+ log messages per minute makes debugging difficult
   - Obscures important log messages
   - Can fill up log storage quickly

4. **Not Event-Driven**
   - The worker already emits events when repository state changes
   - SystemMonitor ignores these events and polls instead
   - Violates reactive architecture principles

## Impact Analysis

### Performance Impact
- **Low-Medium** - IPC is fast but not free
- Measurable on systems monitoring many repositories (10+)
- Compounds with other polling mechanisms in the app

### User Experience Impact
- **Low** - Not directly noticeable to users
- May contribute to general sluggishness on slower machines
- Battery drain on laptops due to constant wake-ups

### Developer Experience Impact
- **High** - Log noise makes debugging very difficult
- Hard to find actual errors in sea of polling messages
- Misleading performance metrics

## Recommended Solutions

### Solution 1: Increase Polling Interval (Quick Fix)

**Change:** Modify polling interval from 2 seconds to 10 seconds

**File:** `src/renderer/principal-window/views/SystemMonitor/SystemMonitor.tsx`

```typescript
// Before
interval = setInterval(fetchStatus, 2000);

// After
interval = setInterval(fetchStatus, 10000); // Poll every 10 seconds
```

**Pros:**
- One-line change
- Reduces traffic by 80%
- No architectural changes needed

**Cons:**
- Still polling when not needed
- Still not using available events
- UI updates delayed by up to 10 seconds

**Effort:** 5 minutes
**Impact:** Reduces IPC traffic from 60/min to 12/min

---

### Solution 2: Event-Driven Updates (Recommended)

**Change:** Subscribe to worker events instead of polling

The monitoring worker already emits events for repository state changes:
- `GIT_STATUS_CHANGED` - When git status updates
- `METRICS_UPDATED` - When repository metrics change
- `WORKSPACE_CHANGED` - When file system changes detected

**Implementation:**

```typescript
// src/renderer/principal-window/views/SystemMonitor/SystemMonitor.tsx

useEffect(() => {
  // Initial fetch
  fetchStatus();

  // Subscribe to repository events
  const unsubscribeGitStatus = RepositoryMonitoringService.onGitStatusChanged(() => {
    fetchStatus();
  });

  const unsubscribeMetrics = RepositoryMonitoringService.onMetricsUpdated(() => {
    fetchStatus();
  });

  // Optional: Still poll, but much less frequently (every 30s as backup)
  const interval = setInterval(fetchStatus, 30000);

  return () => {
    unsubscribeGitStatus();
    unsubscribeMetrics();
    clearInterval(interval);
  };
}, []);
```

**Pros:**
- Instant UI updates when actual changes occur
- Minimal IPC traffic (only when needed)
- Follows reactive architecture
- Better UX (real-time updates)

**Cons:**
- Requires understanding event system
- Need to ensure all relevant events are subscribed
- More complex cleanup logic

**Effort:** 1-2 hours
**Impact:** Reduces IPC traffic by 90%+, improves responsiveness

---

### Solution 3: Visibility-Aware Polling (Complementary)

**Change:** Only poll when SystemMonitor view is visible

**Implementation:**

```typescript
// src/renderer/principal-window/views/SystemMonitor/SystemMonitor.tsx

useEffect(() => {
  let interval: NodeJS.Timeout | null = null;

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      // Resume polling when tab becomes visible
      fetchStatus();
      interval = setInterval(fetchStatus, 10000);
    } else {
      // Stop polling when tab is hidden
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    }
  };

  // Initial setup
  fetchStatus();
  interval = setInterval(fetchStatus, 10000);

  // Listen for visibility changes
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    if (interval) clearInterval(interval);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, []);
```

**Pros:**
- No polling when user isn't looking
- Significant resource savings for background tabs
- Better battery life on laptops

**Cons:**
- Adds complexity
- Need to handle visibility state correctly
- May need route-based visibility detection (not just tab visibility)

**Effort:** 2-3 hours
**Impact:** Reduces unnecessary polling by 70%+ (when not visible)

---

### Solution 4: Combined Approach (Best)

Combine all three solutions:

1. **Increase base polling interval** to 30 seconds (backup)
2. **Use event-driven updates** for real-time changes
3. **Disable polling when not visible**

**Pros:**
- Best of all approaches
- Minimal traffic, maximum responsiveness
- Robust fallback mechanism

**Cons:**
- Most complex solution
- Requires testing all edge cases

**Effort:** 3-4 hours
**Impact:** 95%+ reduction in unnecessary IPC traffic

## Implementation Priority

### High Priority
- **Solution 1** (Quick Fix) - Increase interval to 10 seconds
  - Immediate relief with minimal effort
  - Can be done in 5 minutes

### Medium Priority
- **Solution 2** (Event-Driven) - Switch to event subscriptions
  - Proper architectural solution
  - Should be done within next sprint

### Low Priority
- **Solution 3** (Visibility-Aware) - Add visibility detection
  - Nice-to-have optimization
  - Can be added later as polish

## Additional Recommendations

### 1. Reduce Log Verbosity

**File:** `src/repository-monitoring-server/worker-entry.ts`

Consider reducing log level for routine operations:

```typescript
// Only log worker messages in development or when debugging
if (process.env.NODE_ENV === 'development') {
  console.log('[RepositoryMonitoring] Received message:', message.type);
}
```

### 2. Batch Worker Requests

Instead of making two separate requests (getRepositoryDetails + getResourceMetrics), combine them:

```typescript
// New combined request type
type: 'getMonitoringSnapshot'
// Returns: { repositories: RepositoryInfo[], metrics: ResourceMetrics }
```

**Benefit:** Reduces IPC round-trips from 2 to 1 (50% reduction)

### 3. Implement Request Coalescing

If multiple polls happen in quick succession, coalesce them:

```typescript
let pendingRequest: Promise<MonitoringStatus> | null = null;

const fetchStatus = async () => {
  if (pendingRequest) {
    return pendingRequest;
  }

  pendingRequest = RepositoryMonitoringService.getMonitoringStatus();

  try {
    return await pendingRequest;
  } finally {
    pendingRequest = null;
  }
};
```

**Benefit:** Prevents duplicate concurrent requests

## Testing Considerations

### Performance Testing
- Monitor IPC message count before/after changes
- Measure CPU usage with/without polling
- Test with 1, 5, 10, 20 repositories

### Functional Testing
- Verify UI still updates when repository state changes
- Test behavior when switching tabs/windows
- Ensure cleanup happens on unmount
- Test edge cases (worker crash, slow responses)

### User Testing
- Ensure perceived responsiveness doesn't decrease
- Verify no visible delays in UI updates
- Check that resource graphs still update smoothly

## Success Metrics

### Before Optimization
- IPC requests per minute: **60**
- Log messages per minute: **180+**
- Polling happens: **Always (even when hidden)**

### After Optimization (Solution 4)
- IPC requests per minute: **~5-10** (event-driven + 30s backup)
- Log messages per minute: **~10-20**
- Polling happens: **Only when visible + on actual changes**

### Target Improvements
- ✅ 90%+ reduction in IPC traffic
- ✅ 95%+ reduction in log noise
- ✅ Faster UI updates (event-driven)
- ✅ Better battery life (no unnecessary wake-ups)

## Related Files

- `src/renderer/principal-window/views/SystemMonitor/SystemMonitor.tsx` - Main component
- `src/renderer/main-process-api/RepositoryMonitoringService.ts` - Service API
- `src/main/repository-monitoring/RepositoryMonitoringManager.ts` - Manager implementation
- `src/main/repository-monitoring/ipcHandlers.ts` - IPC handlers
- `src/repository-monitoring-server/worker-entry.ts` - Worker entry point
- `src/repository-monitoring-server/RepositoryMonitoringServer.ts` - Server implementation

## Questions for Discussion

1. **Is the SystemMonitor view used frequently?** If rarely opened, visibility-aware polling is more important.

2. **Are there other components polling similarly?** Should we establish a standard polling pattern?

3. **Should we add a global "dev mode" flag** to reduce log verbosity in production?

4. **Do we need real-time metrics?** Or is 30-second granularity acceptable for resource graphs?

5. **Should polling be configurable?** Allow users to adjust polling frequency in settings?

## Appendix: Current Event System

The repository monitoring worker already provides these events:

### Available Events

```typescript
// From RepositoryMonitoringService
onGitStatusChanged(callback: (status: GitStatusMetadata) => void): () => void
onGitStateEvent(callback: (event: GitState) => void): () => void
onMetricsUpdated(callback: (metrics: any) => void): () => void
onWorkspaceChanged(callback: (change: FileChange) => void): () => void
onCacheSync(callback: (event: RepositoryCacheSyncEvent) => void): () => void
```

### Example Usage

```typescript
// Subscribe to all relevant events
const unsubGit = RepositoryMonitoringService.onGitStatusChanged((status) => {
  console.log('Git status changed:', status);
  updateUI();
});

const unsubMetrics = RepositoryMonitoringService.onMetricsUpdated((metrics) => {
  console.log('Metrics updated:', metrics);
  updateUI();
});

// Cleanup
return () => {
  unsubGit();
  unsubMetrics();
};
```

These events are already being emitted - SystemMonitor just needs to use them!
