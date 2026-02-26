# Cache Sync Architecture

This document describes the repository cache synchronization mechanism that broadcasts file system changes from the worker process through the main process to all renderer windows.

## What Problem Does This Solve?

When users work with repositories, file changes need to be reflected in the UI:

- **Real-time updates** when files are created, modified, or deleted
- **Multi-window sync** so all open windows see the same state
- **Efficient updates** that don't overwhelm the UI with rapid changes

## Architecture Overview

### Process Flow

1. **Worker Process**: Monitors file system with chokidar, builds file trees
2. **Main Process**: Receives updates, broadcasts to all windows
3. **Renderer Process**: Receives cache sync events, updates UI

### Cache Slices

The cache is divided into independent slices:

| Slice | Contents |
|-------|----------|
| gitStatus | Branch name, uncommitted changes |
| fileTree | Full directory structure |
| packages | package.json data |
| gitRemote | Remote repository info |

Each slice has:
- **version**: Monotonic counter for ordering
- **hash**: Structural validation
- **timestamp**: When last updated

## Throttling Strategy

### Worker Level
- File tree rebuilds: 250ms debounce
- Package processing: 300ms debounce
- Max 2 concurrent builds

### Renderer Level
- 100ms batch flush interval
- Version validation (reject stale updates)
- Hash validation (detect structural changes)

## Design Decisions

### Why Broadcast to All Windows?

Using `BrowserWindow.getAllWindows().forEach()` ensures:
- All windows stay synchronized
- No complex routing logic
- New windows get current state

### Known Issues

**Main Thread Latency**: Broadcasting runs synchronously on the main thread. With many windows or frequent updates, this can block the event loop. Consider batching or async iteration for improvement.

## Common Workflows

1. **File created**: Watcher detects -> Cache invalidated -> Rebuild scheduled -> CACHE_SYNC broadcast
2. **Bulk operations**: Multiple changes debounced into single rebuild
3. **Window opened**: Initial cache state sent immediately
