# Repository Manager Git Integration Design

## Executive Summary

This document outlines the plan to integrate the new utility-process-based git watching (implemented in [REPOSITORY_WATCHING_DESIGN.md](./REPOSITORY_WATCHING_DESIGN.md)) into the Repository Manager's explore view, specifically showing edited files in the search area by default.

## Goal

When users open the Repository Manager dashboard:
1. The repository is automatically registered with the monitoring service
2. Git watching is enabled by default
3. The search/explore view shows modified files automatically
4. Users can see real-time updates as files change

## Current State

### What Exists
- **Repository Manager** (`src/renderer/repo-manager/RepositoryManager.tsx`)
  - Already registers repositories with cache service
  - Has explore view with search functionality
- **Git Changes Context** (`src/renderer/contexts/GitChangesContext.tsx`)
  - Currently uses old main-process git watcher
  - Provides git status and highlight layers
- **Repository Search Tab** (`src/renderer/components/repository-maps/RepositorySearchTab.tsx`)
  - Shows search interface
  - Can filter and display files
- **New Git Watching** (utility process)
  - Fully functional with FSMonitor support
  - Already integrated in SystemMonitor view

### What's Missing
- Connection between Repository Manager and new git monitoring
- Default view showing modified files
- Real-time updates in the explore view

## Implementation Plan

### Phase 1: Connect Repository Manager to Monitoring Service

#### 1.1 Auto-register with Monitoring Service
```typescript
// In RepositoryManager.tsx, when repository is loaded:
useEffect(() => {
  if (visibleClonePath) {
    // Register with monitoring service (in addition to cache)
    window.mainProcess.repositoryMonitoring.registerRepository(visibleClonePath);

    // Enable git watching by default
    window.mainProcess.repositoryMonitoring.enableGitWatching(visibleClonePath);
  }

  return () => {
    // Cleanup on unmount
    if (visibleClonePath) {
      window.mainProcess.repositoryMonitoring.disableGitWatching(visibleClonePath);
    }
  };
}, [visibleClonePath]);
```

#### 1.2 Create Git Status Hook
```typescript
// New hook: useRepositoryGitStatus.ts
export function useRepositoryGitStatus(repoPath: string | null) {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [modifiedFiles, setModifiedFiles] = useState<string[]>([]);

  useEffect(() => {
    if (!repoPath) return;

    // Get initial status
    window.mainProcess.repositoryMonitoring.getGitStatus(repoPath)
      .then(setGitStatus);

    // Subscribe to changes
    const unsubscribe = window.mainProcess.repositoryMonitoring.onGitStatusChanged(
      (status) => {
        if (status.repoPath === repoPath) {
          setGitStatus(status);
          // TODO: Get list of modified files
        }
      }
    );

    return unsubscribe;
  }, [repoPath]);

  return { gitStatus, modifiedFiles };
}
```

### Phase 2: Show Modified Files in Search Tab

#### 2.1 Add Modified Files View Mode
```typescript
// In RepositorySearchTab.tsx
interface RepositorySearchTabProps {
  // ... existing props
  showModifiedFiles?: boolean;  // New prop
  modifiedFiles?: string[];      // New prop
}

// Add tab/toggle for viewing modes
<div className="view-mode-selector">
  <button
    className={viewMode === 'modified' ? 'active' : ''}
    onClick={() => setViewMode('modified')}
  >
    Modified Files ({modifiedFiles.length})
  </button>
  <button
    className={viewMode === 'search' ? 'active' : ''}
    onClick={() => setViewMode('search')}
  >
    Search
  </button>
</div>
```

#### 2.2 Default to Modified Files View
```typescript
// In DevelopmentWorkspace.tsx
const { gitStatus, modifiedFiles } = useRepositoryGitStatus(repo?.localPath);

// Pass to search tab
<RepositorySearchTab
  fileTrees={fileTrees}
  activeFileTreeSource={activeFileTreeSource}
  showModifiedFiles={true}  // Default to showing modified
  modifiedFiles={modifiedFiles}
  onFileSelect={handleFileSelect}
  // ... other props
/>
```

### Phase 3: Enhanced Git Status with File Details

#### 3.1 Extend Git Status API
```typescript
// Add to RepositoryMonitoringAPI.ts
export interface GitStatusWithFiles extends GitStatus {
  modifiedFiles: string[];
  untrackedFiles: string[];
  stagedFiles: string[];
  deletedFiles: string[];
}

// Add new method
getDetailedGitStatus(repoPath: string): Promise<GitStatusWithFiles>;
```

#### 3.2 Implement in Server
```typescript
// In RepositoryMonitoringServer.ts
async getDetailedGitStatus(repoPath: string): Promise<GitStatusWithFiles> {
  const basicStatus = await this.getGitStatus(repoPath);

  // Use git to get file lists
  const git = await GitCore.getClient(repoPath);
  const status = await git.status();

  return {
    ...basicStatus,
    modifiedFiles: status.modified,
    untrackedFiles: status.not_added,
    stagedFiles: status.staged,
    deletedFiles: status.deleted,
  };
}
```

### Phase 4: Real-time Updates

#### 4.1 Update File List on Changes
```typescript
// In useRepositoryGitStatus hook
useEffect(() => {
  const unsubscribe = window.mainProcess.repositoryMonitoring.onGitStatusChanged(
    async (status) => {
      if (status.repoPath === repoPath) {
        setGitStatus(status);

        // Get detailed status with file list
        const detailed = await window.mainProcess.repositoryMonitoring
          .getDetailedGitStatus(repoPath);
        setModifiedFiles(detailed.modifiedFiles);
      }
    }
  );

  return unsubscribe;
}, [repoPath]);
```

#### 4.2 Visual Indicators
```typescript
// Show status indicator in UI
<div className="git-status-bar">
  <span className={`branch ${gitStatus?.isDirty ? 'dirty' : 'clean'}`}>
    {gitStatus?.branch}
  </span>
  {gitStatus?.isDirty && (
    <span className="modified-count">
      {modifiedFiles.length} modified
    </span>
  )}
</div>
```

## Migration Strategy

### ✅ Step 1: Parallel Operation (COMPLETED)
- ✅ Keep existing GitChangesContext working
- ✅ Add new monitoring integration alongside
- ✅ Use feature flag to switch between them

### ✅ Step 2: Testing (COMPLETED)
- ✅ Test with various repository sizes
- ✅ Verify FSMonitor performance benefits
- ✅ Ensure real-time updates work correctly

### ✅ Step 3: Implementation (COMPLETED)
- ✅ New useRepositoryGitStatus hook implemented
- ✅ RepositorySearchTab enhanced with modified files view
- ✅ Real-time git status updates working
- ✅ Repository auto-registration and git watching enabled

### 🔄 Step 4: Migration & Cleanup (IN PROGRESS)
- [ ] Identify all uses of old GitChangesContext/GitWatcherService
- [ ] Migrate remaining components to new monitoring service
- [ ] Remove old GitChangesContext usage
- [ ] Remove GitRepositoryWatcher dependencies
- [ ] Update all documentation

## Success Criteria

- [x] Repository automatically registered when opened
- [x] Git watching enabled by default
- [x] Modified files show in search tab immediately
- [x] Real-time updates when files change
- [x] Performance improvement with FSMonitor
- [x] No UI freezing during git operations
- [x] Graceful fallback when FSMonitor unavailable

## Technical Dependencies

- Requires completion of [REPOSITORY_WATCHING_DESIGN.md](./REPOSITORY_WATCHING_DESIGN.md) Phase 1
- Utility process git watching must be stable
- FSMonitor support must be tested

## Performance Expectations

With FSMonitor enabled:
- Initial modified files list: < 200ms
- File change detection: < 500ms
- UI update after change: < 100ms

Without FSMonitor:
- Initial modified files list: < 1s
- File change detection: < 2s
- UI update after change: < 100ms

## UI/UX Considerations

1. **Default View**: Show modified files immediately on open
2. **Empty State**: If no modified files, show helpful message
3. **Loading State**: Show skeleton while fetching initial status
4. **Error State**: Gracefully handle git errors (not a git repo, etc.)
5. **Refresh**: Manual refresh button for edge cases
6. **Filters**: Allow filtering modified files by type/path

## ✅ COMPLETED IMPLEMENTATION

### What We Built

1. **Extended API with File Lists** (`GitStatusWithFiles`)
   - Added `modifiedFiles`, `untrackedFiles`, `stagedFiles`, `createdFiles`, `deletedFiles` arrays
   - Implemented `getGitStatusWithFiles()` method throughout the entire IPC pipeline
   - Added proper TypeScript types and interfaces

2. **Created useRepositoryGitStatus Hook**
   - Fetches git status with file lists from monitoring service
   - Subscribes to real-time git status changes
   - Provides easy access to all file categories
   - Includes loading states and error handling

3. **Enhanced RepositorySearchTab**
   - Toggle buttons to switch between "Modified Files" and "Search" views
   - Modified files list with status indicators (A=Added/Green, M=Modified/Orange, D=Deleted/Red)
   - Click to select files with hover effects
   - Smart defaults: Shows modified files first if they exist
   - Map integration: Modified files highlighted on code city

4. **Repository Auto-Registration**
   - Monitoring service automatically started on repository open
   - Git watching enabled by default for all local repositories
   - Proper cleanup on component unmount

5. **Real-time Updates**
   - File changes detected via FSMonitor (when available)
   - Automatic UI updates when files are modified
   - Event subscriptions handle repository changes

## Next Steps - Migration & Cleanup

1. **Identify Legacy Usage** ✅

   **Files Using GitChangesContext/useGitChanges:**
   - `src/renderer/contexts/GitChangesContext.tsx` - **Core context file (DELETE)**
   - `src/renderer/repo-manager/RepositoryManager.tsx` - Wraps views with `<GitChangesProvider>`
  - `src/renderer/repo-manager/LocalDevelopmentView.tsx` (removed) - Formerly used `useGitChanges()` hook
   - `src/renderer/repo-manager/DevelopmentWorkspace.tsx` - Uses `useGitChanges()` hook
   - `src/renderer/components/repository-maps/GitChangesButton.tsx` - Toggle button component

   **Files Using GitWatcherService:**
   - `src/renderer/main-process-api/GitWatcherService.ts` - **Core service file (DELETE)**
   - `src/renderer/contexts/GitChangesContext.tsx` - Subscribes to status updates
   - `src/renderer/contexts/FileChangeContext.tsx` - Watches repositories
   - `src/renderer/services/FileTreeInvalidator.ts` - TODO comments about future integration
   - `src/renderer/unused/RepositorySettingsModal.tsx` - Already in unused folder
   - `src/renderer/unused/RepositoryCard.tsx` - Already in unused folder

2. **Migrate Remaining Components**

   **Priority 1 - Core Repository Views:**
  - `LocalDevelopmentView.tsx` (removed) - View retired alongside the former planning workflows
   - `DevelopmentWorkspace.tsx` - Keep for highlight layers only, use new hook for data
   - `GitChangesButton.tsx` - Convert to use new git status hook

   **Priority 2 - Context Providers:**
   - `RepositoryManager.tsx` - Remove `<GitChangesProvider>` wrappers
   - Generate git highlight layers from new hook data instead of old context

   **Priority 3 - Related Services:**
   - `FileChangeContext.tsx` - Migrate from GitWatcherService to RepositoryMonitoringService
   - `FileTreeInvalidator.ts` - Update TODO comments or integrate with new monitoring

3. **Remove Legacy Code**

   **Files to Delete:**
   - `src/renderer/contexts/GitChangesContext.tsx`
   - `src/renderer/main-process-api/GitWatcherService.ts`
   - `src/renderer/components/repository-maps/GitChangesButton.tsx` (if not needed)

   **Clean Up:**
   - Remove imports of deleted files
   - Remove unused IPC handlers for old git watcher
   - Update main process to remove GitRepositoryWatcher references

4. **Minor UI Fixes**
   - Fix search view toggle button functionality
   - Polish modified files UI and interactions
   - Add keyboard shortcuts and accessibility

5. **Documentation**
   - Update component documentation
   - Add hook usage examples
   - Document migration patterns for future reference