# Repository Monitoring Event Flow

This document describes how repository file system monitoring events flow from the worker process through the application.

## What Problem Does This Solve?

When working with repositories, the application needs to:

- **Monitor file changes** in real-time
- **Update multiple UI components** (git status, file tree, packages)
- **Maintain cache consistency** across all windows

## Architecture Overview

### Process Hierarchy

1. **Worker Process** (Node.js Utility Process)
   - GitWatcherAdapter: chokidar-based file monitoring
   - FileTreeBuilder: Constructs directory trees
   - PackageProcessor: Parses package.json files
   - GitRemoteService: Fetches remote repository info

2. **Main Process** (Electron)
   - RepositoryMonitoringManager: Coordinates worker communication
   - IPC Handlers: Routes requests and broadcasts events
   - BrowserWindow broadcast: Sends updates to all windows

3. **Renderer Process** (React)
   - RepositoryMonitoringService: Service wrapper
   - React Contexts: GitChangesContext, RepositoryPanelContext, WorkspacesPanelContext

### Cache Registry

The `RepositoryCacheRegistry` maintains four cache slices:
- **gitStatus**: Branch and uncommitted changes
- **fileTree**: Full directory structure
- **packages**: Parsed package.json data
- **gitRemote**: Remote repository information

## Communication Patterns

### Worker <-> Main
- `postMessage()`: Main to worker commands
- `parentPort.postMessage()`: Worker to main responses/events

### Main <-> Renderer
- `ipcRenderer.invoke()`: Request-response calls
- `webContents.send()`: Event broadcasts

## Design Decisions

### Why Separate Worker Process?

File monitoring and tree building are CPU-intensive. Running in a utility process:
- Keeps main process responsive
- Isolates crashes
- Enables parallel processing for multiple repositories

### Why Multiple React Contexts?

Different UI components need different data:
- GitChangesContext: For source control views
- RepositoryPanelContext: For file explorer
- WorkspacesPanelContext: For workspace management
