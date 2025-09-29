# Git Event Library Integration Usage Guide

## Overview

The electron-app now integrates the `@principal-ai/repository-monitoring` library to provide typed git events (commit, branch-switch, merge, dirty-state-change) alongside file watching. Both systems work together:
- **File watching**: Detects source file changes, triggers file tree rebuilds
- **Git event watching**: Detects git state changes, provides typed events with metadata

## Architecture

### Event Types
- **GIT_STATUS_CHANGED**: Existing event for git status snapshots (what is)
- **GIT_STATE_EVENT**: New event for git state transitions (what changed)

### Components
1. **GitWatcherAdapter** - Bridges the library with our system
   - Subscribes to specific events: `commit`, `branch-switch`, `merge`, `dirty-state-change`
   - Maps library's `GitEvent` to our `GitStateEvent`
2. **RepositoryMonitoringServer** - Integrates both file watching and git events
   - File watching via Chokidar for source changes
   - Git event watching via the library
3. **IPC Handlers** - Forward events from worker to renderer
   - `GIT_STATUS_CHANGED` for status snapshots
   - `GIT_STATE_EVENT` for git state transitions

## Configuration

The library is automatically enabled when git watching is enabled for a repository.

Optional: Configure debounce delay (default 500ms):
```bash
GIT_WATCHER_DEBOUNCE_MS=300 npm run dev
```

## Testing

### Quick Test
Run the standalone test script:
```bash
node test-git-events.js /path/to/repo
```

Then try:
- Making a commit
- Switching branches
- Staging/unstaging files
- Performing a merge

### In the App
1. Open a repository with git watching enabled
2. Check the console for messages like:
   - `[GitWatcherAdapter] Starting git event watching`
   - `[GitWatcherAdapter] Git state event detected`
3. Perform git operations and watch for events

## Event Structure

### Git State Event
```typescript
interface GitStateEvent {
  type: 'commit' | 'branch-switch' | 'merge' | 'dirty-state-change';
  repoPath: string;
  branch: string;
  fullSha: string;
  shortSha: string;
  isDirty: boolean;
  timestamp: number;
  previousBranch?: string; // For branch switches
  previousSha?: string;    // For commits
}
```

### Affected Cache Fields
Each event type triggers different cache updates:
- **commit**: `['gitStatus', 'lastCommit']`
- **branch-switch**: `['gitStatus', 'gitBranch', 'fileTree']`
- **merge**: `['gitStatus', 'fileTree', 'lastCommit']`
- **dirty-state-change**: `['gitStatus']`

## How The Two Systems Work Together

1. **File watcher (Chokidar)** watches working directory for source changes
2. **Git watcher (Library)** watches `.git/` metadata for git operations
3. **File changes** → Clear file tree/package caches
4. **Git events** → Emit typed events with metadata → Targeted cache updates
5. **Both run simultaneously**, handling different concerns

## Benefits Over Old System

| Old System | New System |
|------------|------------|
| Watches ALL files | Watches only `.git/` |
| Triggers on ANY change | Knows what changed |
| Runs full git status | Targeted updates |
| No event types | Typed events |
| No SHA tracking | Full SHA info |

## System Integration

The two systems are complementary:
1. File watching handles source file changes
2. Library handles git state events
3. Both are enabled together when git watching is turned on
4. They work independently without interfering

## Troubleshooting

### Events not firing?
- Check git watching is enabled for the repository
- Look for `[GitWatcherAdapter] Starting git event watching` in logs
- Verify repository has `.git` directory

### Performance issues?
- Adjust `GIT_WATCHER_DEBOUNCE_MS` (higher = less frequent)
- Check how many repositories are being watched

### Debugging
Enable verbose logging:
```bash
DEBUG=* npm run dev
```

## Next Steps

The integration is complete and active. Future enhancements:
1. Enhance UI to show event-specific notifications (e.g., "New commit detected!")
2. Add event history/timeline features
3. Use event metadata for richer UI updates
4. Add event-based automation triggers