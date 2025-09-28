# Git Watcher Migration Plan

## Overview
This document outlines the components that need to be migrated from the old git watcher system to the new repository monitoring system.

## Current State Analysis

### Components Already Using New System ✅
1. **MonitoredFileTreeService** - Already uses RepositoryMonitoringService
2. **RepositoryManager** - Enables git watching via RepositoryMonitoringService
3. **RepositoryExplorationView** - Uses useRepositoryGitStatus hook
4. **SystemMonitor** - Displays monitoring status from new system

### Components That Need Migration ❌
1. **GitWatcherService** (`src/renderer/main-process-api/GitWatcherService.ts`)
   - OLD service using `window.mainProcess.gitWatcher`
   - Should be DELETED and replaced with RepositoryMonitoringService

2. **FileTreeInvalidator** (`src/renderer/services/FileTreeInvalidator.ts`)
   - Has TODOs for git watcher integration (lines 37-39)
   - Needs to subscribe to git status changes from RepositoryMonitoringService

3. **GitChangesContext** (if using old watcher)
   - Check if it's using GitWatcherService
   - Migrate to useRepositoryGitStatus hook

### Old System Components to Remove 🗑️

#### Main Process
1. **GitRepositoryWatcher** (if exists in main/)
2. **Old git watcher IPC handlers** in initialization.ts
3. **GitWatcherAPI** interface (if separate from monitoring API)

#### Renderer Process
1. **GitWatcherService** - The old service
2. **Any direct chokidar imports** (none found)

#### Shared
1. **GitWatcherAPI types** in shared/main-process-api-interfaces/

## Migration Steps

### Step 1: Update FileTreeInvalidator
Replace the TODO section with:
```typescript
// In setupListeners():
private unsubscribe: (() => void) | null = null;

private setupListeners(): void {
  // Listen for git status changes from repository monitoring
  this.unsubscribe = window.mainProcess.repositoryMonitoring.onGitStatusChanged(
    (status: GitStatus) => {
      // Convert to FileChangeEvent format if needed
      this.handleGitStatusChange(status);
    }
  );
}

private handleGitStatusChange(status: GitStatus & { modifiedFiles?: string[] }): void {
  if (!status.repoPath) return;

  // Invalidate if there are changes
  if (status.isDirty || status.hasUntracked) {
    this.invalidateNow(status.repoPath);
  }
}

// In destroy():
destroy(): void {
  if (this.unsubscribe) {
    this.unsubscribe();
    this.unsubscribe = null;
  }
  // ... rest of cleanup
}
```

### Step 2: Check GitChangesContext Usage
1. Search for imports of GitWatcherService
2. Replace with useRepositoryGitStatus hook
3. Update any components using the context

### Step 3: Remove Old Git Watcher System
1. Delete `src/renderer/main-process-api/GitWatcherService.ts`
2. Remove git watcher IPC handlers from main process
3. Remove GitWatcherAPI types from shared/
4. Remove `window.mainProcess.gitWatcher` from preload script

### Step 4: Update Window API Types
Remove gitWatcher from the window API interface:
```typescript
// Remove this:
gitWatcher: GitWatcherAPI;
```

### Step 5: Clean Up Imports
Search and remove all imports of:
- `GitWatcherService`
- `GitWatcherAPI`
- Any old git watcher types

## Testing Plan

### Unit Tests
1. Update FileTreeInvalidator tests to mock repository monitoring events
2. Remove GitWatcherService tests
3. Add tests for git status change handling

### Integration Tests
1. Verify file changes trigger UI updates
2. Test repository registration/unregistration
3. Confirm no memory leaks from event listeners

### Manual Testing
1. Open a repository in the app
2. Modify files and verify UI updates
3. Check git status displays correctly
4. Verify no console errors about missing APIs

## Benefits of Migration

1. **Single Source of Truth**: All git monitoring through RepositoryMonitoringService
2. **Better Performance**: FSMonitor support and optimized watching
3. **Reduced Complexity**: Remove duplicate git watching systems
4. **Consistent API**: Same monitoring API for all components
5. **Git-Aware Caching**: SHA-based cache invalidation

## Risk Assessment

### Low Risk ✅
- MonitoredFileTreeService already migrated
- Repository monitoring system is proven and working
- Clear migration path

### Medium Risk ⚠️
- FileTreeInvalidator might have hidden dependencies
- Need to ensure all event listeners are cleaned up properly

### Mitigation
- Keep old code commented until migration is verified
- Add comprehensive logging during migration
- Test thoroughly before removing old system

## Timeline
1. **Phase 1** (Current): Document migration plan
2. **Phase 2**: Update FileTreeInvalidator
3. **Phase 3**: Remove GitWatcherService and clean up
4. **Phase 4**: Update tests and documentation
5. **Phase 5**: Final verification and cleanup

## Success Criteria
- [ ] No references to GitWatcherService remain
- [ ] FileTreeInvalidator responds to git changes
- [ ] All tests pass
- [ ] No console errors about missing APIs
- [ ] File changes trigger UI updates within 2 seconds