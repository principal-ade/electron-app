# Repository Monitoring - Git Watching Implementation

## Overview
The Repository Monitoring Server now includes real-time git status monitoring that detects file changes and updates git status automatically. This replaces the old file watcher system with a more efficient, git-aware monitoring solution.

## Architecture

### Key Components

1. **RepositoryMonitoringServer** (`src/repository-monitoring-server/RepositoryMonitoringServer.ts`)
   - Main coordinator for git watching
   - Manages FSMonitor detection and fallback strategies
   - Handles debounced git status checks

2. **GitCore** (`src/shared/repository-core/GitCore.ts`)
   - Provides git operations without Electron dependencies
   - Handles FSMonitor detection and configuration
   - Executes git commands via child_process

3. **Repository State Management**
   ```typescript
   interface RepositoryState {
     path: string;
     lastUpdated: Date;
     isWatching: boolean;
     gitWatchingEnabled?: boolean;
     fsMonitorEnabled?: boolean;
     watchingMode?: 'minimal' | 'fallback' | 'none';
     lastGitStatus?: GitStatus;
   }
   ```

## Git Watching Strategy

### FSMonitor Detection
The system first attempts to enable git's FSMonitor feature for optimized performance:

1. **Check Git Version**: FSMonitor requires git >= 2.36.0
2. **Enable FSMonitor**: Configure `core.fsmonitor` and start daemon
3. **Verify Operation**: Check if FSMonitor daemon is actually running

**Important Note**: Apple's built-in git has a broken FSMonitor implementation. Users should install git via Homebrew for FSMonitor support.

### Watching Modes

#### 1. Minimal Mode (FSMonitor Enabled)
When FSMonitor is available, we use shallow directory watching:
```typescript
const watcher = watch(repoPath, {
  depth: 2, // Shallow watching to avoid too many file handles
  ignoreInitial: true,
  persistent: true,
  ignored: (path: string) => {
    // Ignore .git directory and common build directories
    if (path.includes('/.git/') || path.endsWith('/.git')) return true;
    if (path.includes('/node_modules/')) return true;
    if (path.includes('/.next/') || path.includes('/dist/')) return true;
    return false;
  },
  awaitWriteFinish: {
    stabilityThreshold: 300, // Fast since FSMonitor helps
    pollInterval: 100,
  },
});
```

#### 2. Fallback Mode (No FSMonitor)
When FSMonitor is unavailable, we still use shallow watching but with more aggressive debouncing:
```typescript
const watcher = watch(repoPath, {
  depth: 2, // Still shallow to avoid EMFILE errors
  // ... same ignore patterns ...
  awaitWriteFinish: {
    stabilityThreshold: 500, // More aggressive debouncing
    pollInterval: 100,
  },
});
```

### Key Design Decisions

1. **Shallow Watching Only**: Both modes use `depth: 2` to avoid "too many open files" errors
2. **Directory-Based Detection**: We don't track individual files, just detect that something changed
3. **Git Status as Source of Truth**: File changes trigger `git status` which provides the actual change details
4. **Debounced Updates**: Changes are debounced (800ms with FSMonitor, 2000ms without) to prevent loops

## IPC Communication

### Events Flow
1. File system change detected by chokidar
2. Debounced handler triggers `git status`
3. Server emits `GIT_STATUS_CHANGED` event to main process
4. Main process forwards to renderer via IPC
5. React components update via `useRepositoryGitStatus` hook

### Message Types
```typescript
enum MonitoringInternalEvent {
  GIT_STATUS_CHANGED = 'git-status-changed',
}

interface GitStatus {
  repoPath: string;
  branch: string;
  isDirty: boolean;
  hasUntracked: boolean;
  hasStaged: boolean;
  ahead: number;
  behind: number;
  watchingEnabled: boolean;
}

interface GitStatusWithFiles extends GitStatus {
  modifiedFiles: string[];
  untrackedFiles: string[];
  stagedFiles: string[];
  createdFiles: string[];
  deletedFiles: string[];
}
```

## React Integration

### useRepositoryGitStatus Hook
Provides real-time git status to React components:
```typescript
const {
  gitStatus,
  gitStatusWithFiles,
  modifiedFiles,
  untrackedFiles,
  stagedFiles,
  allModifiedFiles, // Memoized array of all changed files
  loading,
  error,
  refresh,
} = useRepositoryGitStatus(repoPath);
```

Key features:
- Automatic subscription to git status changes
- Memoized arrays to prevent re-renders
- Automatic cleanup on unmount

### UI Components
The monitoring status is displayed in:
- **SystemMonitor**: Shows repositories with watching mode (FSMonitor/Fallback)
- **RepositoryManager**: Enables watching when repository is opened
- **RepositoryExplorationView**: Uses git status to highlight modified files

## Migration from Old File Watcher

### Components Still Using Old Watcher
These components need to be migrated to use the new monitoring system:

1. **FileTreeSourceService** (`src/renderer/services/FileTreeSourceService.ts`)
   - Currently uses chokidar directly
   - Should subscribe to repository monitoring events instead

2. **FileTreeInvalidator** (`src/renderer/services/FileTreeInvalidator.ts`)
   - Uses FileTreeSourceService's watcher
   - Should listen to git status changes from monitoring service

3. **MonitoredFileTreeService** (`src/renderer/services/MonitoredFileTreeService.ts`)
   - Wrapper around FileTreeSourceService
   - Should be updated to use RepositoryMonitoringService

### Migration Steps

1. **Update FileTreeSourceService**:
   ```typescript
   // Instead of:
   this.watcher = chokidar.watch(directory, { ... });

   // Use:
   RepositoryMonitoringService.enableGitWatching(directory);
   window.mainProcess.repositoryMonitoring.onGitStatusChanged((status) => {
     if (status.repoPath === directory) {
       this.handleFileChange();
     }
   });
   ```

2. **Update FileTreeInvalidator**:
   - Remove direct watcher management
   - Subscribe to repository monitoring events
   - Use git status to determine what needs invalidation

3. **Remove Old Dependencies**:
   - Remove direct chokidar usage from services
   - Clean up old watcher management code
   - Update tests to use new monitoring API

## Performance Characteristics

### With FSMonitor
- Git status execution: ~50-200ms
- File change detection: Near instant
- Debounce delay: 800ms
- Overall latency: ~1 second

### Without FSMonitor (Fallback)
- Git status execution: ~200-500ms
- File change detection: Near instant
- Debounce delay: 2000ms
- Overall latency: ~2.5 seconds

### Resource Usage
- File handles: Limited by depth=2 watching
- CPU: Minimal (event-driven)
- Memory: ~10-20MB per watched repository

## Troubleshooting

### FSMonitor Not Working
**Symptom**: UI shows "WATCHING (Fallback)" even though git version is >= 2.36.0

**Solutions**:
1. Check git installation: `which git`
2. If using Apple's git (`/usr/bin/git`), install Homebrew git:
   ```bash
   brew install git
   echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc
   ```
3. Verify FSMonitor support: `git fsmonitor--daemon status`

### File Changes Not Detected
**Symptom**: Editing files doesn't trigger UI updates

**Check**:
1. Verify watching is enabled in SystemMonitor view
2. Check browser console for git status events
3. Ensure edited files aren't in .gitignore
4. Check repository monitoring logs in terminal

### Too Many Open Files (EMFILE)
**Symptom**: Error "EMFILE: too many open files"

**This should not happen** with current implementation (depth=2), but if it does:
1. Check system limits: `ulimit -n`
2. Increase limits: `ulimit -n 4096`
3. Verify depth=2 is being respected
4. Check for other processes consuming file handles

## Future Enhancements

1. **Selective Watching**: Allow watching specific directories within a repository
2. **Performance Metrics**: Track and display git status execution times
3. **Smart Invalidation**: Use git diff to invalidate only changed file trees
4. **Batch Operations**: Group multiple file changes into single status check
5. **WebSocket Support**: Real-time updates for web-based clients