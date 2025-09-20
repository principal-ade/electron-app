# Git Event Integration for Landing Page

## Overview
This document outlines the implementation plan for integrating git event listening into the landing page to provide real-time updates for repository timestamps and file changes in the sidebar.

## Current State

### Existing Infrastructure
1. **GitRepositoryWatcher** (`src/main/file-system/GitRepositoryWatcher.ts`)
   - Uses `chokidar` for file watching
   - Monitors `.git` directory for commit/branch changes
   - Monitors working directory for file modifications
   - Emits `git:status-update` and `git:file-changed` events via IPC

2. **GitWatcherService** (`src/renderer/main-process-api/GitWatcherService.ts`)
   - Renderer-side service for git watching
   - Provides methods: `watchRepository()`, `unwatchRepository()`, `onStatusUpdate()`
   - Currently not used by landing page

3. **Landing Page** (`src/renderer/pages/LandingPage/LandingPage.tsx`)
   - Loads git status once on repository selection
   - Subscribes to `AlexandriaService.onRepositoryChange` for repo add/remove
   - Does NOT listen to git status updates
   - Does NOT automatically watch repositories

### Current Data Flow
```
Repository Selected → Load Git Status Once → Display in UI
                      (No continuous updates)
```

## Implementation Plan

### Phase 1: Commit Event Listening for Timestamp Updates

#### Goal
Update repository timestamps in the sidebar when commits occur, without full file watching.

#### Implementation Steps

1. **Add GitWatcher Integration to Landing Page**
   ```typescript
   // In LandingPage.tsx
   import { GitWatcherService } from '../../main-process-api/GitWatcherService';

   // Watch repositories on load
   useEffect(() => {
     repositories.forEach(repo => {
       GitWatcherService.watchRepository(repo.path);
     });
   }, [repositories]);

   // Listen for status updates
   useEffect(() => {
     const unsubscribe = GitWatcherService.onStatusUpdate((status) => {
       // Update the specific repository's git info
       updateRepositoryGitStatus(status.repoPath, status);
     });

     return () => unsubscribe();
   }, []);
   ```

2. **Update Repository Enhancement Logic**
   - Modify `enhanceRepositoryWithGitInfo()` to be callable for updates
   - Create `updateRepositoryGitStatus()` to update existing repo data
   - Focus on updating:
     - `gitBranch` - current branch
     - `isDirty` - uncommitted changes flag
     - `dirtyFileCount` - count of changed files
     - `mostRecentChange` - timestamp for sorting

3. **Optimize Event Handling**
   - Debounce rapid status updates (already handled in GitRepositoryWatcher)
   - Only update the affected repository, not reload all
   - Maintain selection state during updates

### Phase 2: File Change Event Strategy

#### Options Analysis

##### Option A: Full File Watching (Current Capability)
**Pros:**
- Real-time updates for all changes
- Already implemented in GitRepositoryWatcher
- Comprehensive change detection

**Cons:**
- Performance overhead for large repositories
- May trigger too many updates
- Unnecessary for casual browsing

##### Option B: Agent-Triggered Updates (Recommended)
**Pros:**
- Minimal performance impact
- Updates only when user is actively working
- Can leverage existing agent hooks/events

**Cons:**
- May miss external changes (e.g., git pull, external editor)
- Requires agent integration

##### Option C: Lazy Loading on Selection
**Pros:**
- Zero background overhead
- Simple implementation
- Always shows fresh data when needed

**Cons:**
- No real-time sidebar updates
- Slight delay on selection

#### Recommended Approach: Hybrid Strategy

1. **Listen to Commit Events Only** (Phase 1)
   - Use existing GitRepositoryWatcher for `.git` directory only
   - Update timestamps when commits/pulls/branch changes occur
   - Minimal overhead, covers main use cases

2. **Agent-Triggered Refreshes**
   - Listen for agent activity events
   - Refresh git status when agents make changes
   - Example events: file saves, terminal commands, git operations

3. **On-Demand Refresh**
   - Refresh full details when repository is selected
   - Add manual refresh button if needed
   - Cache results with reasonable TTL

### Implementation Details

#### Event Sources to Monitor

1. **Git Events (Phase 1)**
   - Commit events (`.git/COMMIT_EDITMSG`, `.git/logs/HEAD`)
   - Branch switches (`.git/HEAD`)
   - Remote updates (`.git/FETCH_HEAD`)
   - Stash operations (`.git/refs/stash`)

2. **Agent Events (Phase 2)**
   ```typescript
   // Listen for agent activity
   AgentEventService.onFileModified((event) => {
     // Find affected repository
     const repo = findRepositoryByPath(event.filePath);
     if (repo) {
       // Trigger focused update
       refreshRepositoryMetrics(repo);
     }
   });
   ```

3. **User Actions**
   - Repository selection → Full refresh
   - Manual refresh button → Force update
   - Return from other views → Check staleness

#### Performance Considerations

1. **Throttling**
   - Debounce git status checks (500ms minimum)
   - Batch multiple file changes
   - Limit concurrent status checks

2. **Selective Updates**
   - Only update visible repositories
   - Defer updates for collapsed sections
   - Use request animation frame for UI updates

3. **Memory Management**
   - Unwatch repositories when removed
   - Clean up event listeners on unmount
   - Limit status history/cache size

### Migration Path

1. **Step 1:** Implement commit event listening (non-breaking)
2. **Step 2:** Add configuration toggle for file watching
3. **Step 3:** Integrate agent event triggers
4. **Step 4:** Add performance monitoring
5. **Step 5:** Optimize based on usage patterns

### Testing Strategy

1. **Unit Tests**
   - Event handler logic
   - Status update merging
   - Timestamp calculations

2. **Integration Tests**
   - Git operation → UI update flow
   - Multiple repository handling
   - Event cleanup on unmount

3. **Performance Tests**
   - Large repository handling
   - Rapid change scenarios
   - Memory leak detection

### Success Metrics

- Repository timestamps update within 1 second of commits
- No noticeable performance degradation with 10+ repositories
- Memory usage remains stable over time
- User-reported "stale data" issues reduced by 80%

### Future Enhancements

1. **Smart Detection**
   - Detect repository activity patterns
   - Auto-adjust watching strategy
   - Predictive pre-loading

2. **Notification System**
   - Toast notifications for important changes
   - Badge indicators for unreviewed changes
   - Activity feed in sidebar

3. **Advanced Metrics**
   - Commit frequency graphs
   - File change heatmaps
   - Contributor activity tracking

## Decision Points

1. **Q: Should we watch all repositories or only visible ones?**
   - A: Start with visible only, expand based on performance testing

2. **Q: How to handle repositories with thousands of files?**
   - A: Use git-only watching, disable working directory watching

3. **Q: Should we persist watch state across app restarts?**
   - A: No, start fresh each session to avoid stale watchers

4. **Q: How to handle network drives or slow filesystems?**
   - A: Add timeout detection and fallback to lazy loading

## References

- Current GitWatcher implementation: `src/main/file-system/GitRepositoryWatcher.ts`
- GitWatcher service: `src/renderer/main-process-api/GitWatcherService.ts`
- Landing page: `src/renderer/pages/LandingPage/LandingPage.tsx`
- Alexandria events: `src/main/stores/AlexandriaApiEventHandler.ts`