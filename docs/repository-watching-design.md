# Repository Watching Implementation Design

## Executive Summary

This document outlines the design for migrating the existing main process git watching implementation to an enhanced utility process architecture, leveraging Git's FSMonitor feature to provide real-time updates of file changes and git status with minimal system overhead.

## Current State

The application currently has a git watching implementation (`GitRepositoryWatcher`) that runs in the main process using:
- **Chokidar** for file system watching
- **Direct git commands** via gitClientFactory
- **IPC events** to notify renderer processes
- **Debounced status checks** on file changes

### Issues with Current Implementation
1. **Performance**: Heavy git operations block the main process
2. **Scalability**: Watching multiple large repos impacts main process responsiveness
3. **Stability**: Watcher crashes can affect the entire main process
4. **Resource Usage**: No isolation for memory/CPU intensive operations

## Problem Statement

The application needs to:
- Display real-time git status for multiple repositories
- Update UI when files change (added, modified, deleted)
- Handle large repositories efficiently (10,000+ files)
- Minimize CPU and battery usage
- Work across macOS, Windows, and Linux

## Solution Overview

Migrate git watching from main process to utility process with:
1. **Process isolation** for stability and performance
2. **Git FSMonitor** for accelerated git operations
3. **Minimal file system watching** (only `.git/` directory)
4. **Existing Repository Monitoring Service** as the foundation
5. **Graceful fallback** when FSMonitor is unavailable

### Benefits of Migration

1. **Main Process Protection**
   - Git operations no longer block UI responsiveness
   - Watcher crashes don't affect application stability
   - Reduced memory footprint in main process

2. **Better Resource Management**
   - Isolated CPU/memory usage tracking
   - Can restart monitoring without affecting app
   - Independent scaling for large repositories

3. **Enhanced Performance**
   - FSMonitor reduces git status from seconds to milliseconds
   - Parallel processing of multiple repositories
   - Optimized IPC batching for status updates

4. **Improved Developer Experience**
   - Unified monitoring architecture
   - Easier debugging with process isolation
   - Better error recovery mechanisms

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Renderer Process                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │         GitChangesContext (existing)              │  │
│  │         - UI state management                     │  │
│  │         - Consumes status updates                 │  │
│  └────────────────▲─────────────────────────────────┘  │
│                   │                                      │
│  ┌────────────────┴─────────────────────────────────┐  │
│  │    RepositoryMonitoringService (enhanced)        │  │
│  │    - Repository registration                      │  │
│  │    - FileTree caching                            │  │
│  │    - Status event forwarding                     │  │
│  └────────────────▲─────────────────────────────────┘  │
└───────────────────┼──────────────────────────────────────┘
                    │ IPC
┌───────────────────┼──────────────────────────────────────┐
│                   │     Main Process                      │
│  ┌────────────────▼─────────────────────────────────┐  │
│  │   RepositoryMonitoringManager                     │  │
│  │   - Utility process lifecycle management          │  │
│  │   - IPC message routing                          │  │
│  │   - Resource monitoring                          │  │
│  │   - Crash recovery                               │  │
│  └────────────────┬─────────────────────────────────┘  │
└───────────────────┼──────────────────────────────────────┘
                    │ IPC (parentPort)
┌───────────────────┼──────────────────────────────────────┐
│                   │  Utility Process (Isolated)          │
│  ┌────────────────▼─────────────────────────────────┐  │
│  │   Repository Monitoring Server (enhanced)         │  │
│  │   - FSMonitor management                         │  │
│  │   - Minimal file watching                        │  │
│  │   - Git status polling                           │  │
│  │   - Event debouncing                             │  │
│  │   - Isolated process for stability               │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Data Flow

1. Renderer requests repository registration via IPC to main process
2. Main process forwards request to utility process via RepositoryMonitoringManager
3. Utility process (Repository Monitoring Server) registers repository
4. FSMonitor enabled for repository in utility process (if available)
5. Minimal watchers established on `.git/` directory in utility process
6. File system events trigger debounced git status check in utility process
7. Git status check (accelerated by FSMonitor) executes in isolated process
8. Status changes sent to main process via parentPort IPC
9. Main process forwards status updates to renderer via standard IPC
10. UI updates reflect new git status

## Detailed Implementation

### Process Isolation Architecture

The repository monitoring runs in a dedicated Electron utility process for several key benefits:

#### Benefits of Utility Process Isolation

1. **Stability**: Crashes in monitoring don't affect main or renderer processes
2. **Performance**: Heavy git operations don't block UI or main process
3. **Resource Management**: Can be restarted independently if memory grows
4. **Security**: Isolated process with limited access to system resources
5. **Scalability**: Can spawn multiple monitoring processes if needed

#### Inter-Process Communication

```typescript
// Main Process (RepositoryMonitoringManager)
class RepositoryMonitoringManager {
  private worker: UtilityProcess | null = null;

  async spawnWorker(): Promise<void> {
    this.worker = utilityProcess.fork(workerPath, [], {
      serviceName: 'repository-monitoring',
      stdio: 'pipe'
    });

    // Handle messages from utility process
    this.worker.on('message', (message: ServerToMainMessage) => {
      this.handleWorkerMessage(message);
    });
  }

  // Send message to utility process
  private sendToWorker(message: MainToServerMessage): Promise<any> {
    const id = uuidv4();
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker?.postMessage({ ...message, id });
    });
  }
}

// Utility Process (worker-entry.ts)
if (process.parentPort) {
  // Electron utility process communication
  process.parentPort.on('message', handleMessage);

  function sendToMain(message: ServerToMainMessage) {
    process.parentPort.postMessage(message);
  }
}
```

### 1. FSMonitor Integration

#### Enable FSMonitor

```typescript
class FSMonitorManager {
  private readonly MIN_GIT_VERSION = '2.36.0';
  private fsMonitorStatus = new Map<string, boolean>();

  async enableForRepository(repoPath: string): Promise<boolean> {
    try {
      // Check git version
      const version = await this.getGitVersion(repoPath);
      if (!this.isVersionSupported(version)) {
        console.log(`Git version ${version} doesn't support builtin FSMonitor`);
        return false;
      }

      // Enable FSMonitor and untracked cache
      await this.execGit(repoPath, ['config', 'core.fsmonitor', 'builtin']);
      await this.execGit(repoPath, ['config', 'core.untrackedcache', 'true']);

      // Verify it's working
      const fsmonitorValue = await this.execGit(repoPath, ['config', 'core.fsmonitor']);
      const success = fsmonitorValue.trim() === 'builtin';

      this.fsMonitorStatus.set(repoPath, success);
      return success;
    } catch (error) {
      console.error(`Failed to enable FSMonitor for ${repoPath}:`, error);
      this.fsMonitorStatus.set(repoPath, false);
      return false;
    }
  }

  hasFSMonitor(repoPath: string): boolean {
    return this.fsMonitorStatus.get(repoPath) || false;
  }
}
```

### 2. Watching Strategy

#### Minimal Watching (with FSMonitor)

```typescript
class MinimalGitWatcher {
  private watchers = new Map<string, FSWatcher[]>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  async watch(repoPath: string): Promise<void> {
    const gitDir = path.join(repoPath, '.git');
    const watchers: FSWatcher[] = [];

    // Critical git files to watch
    const watchTargets = [
      'index',           // Staging area changes
      'HEAD',            // Branch switches
      'FETCH_HEAD',      // Remote fetches
      'COMMIT_EDITMSG',  // Active commits
      'refs/heads',      // Local branches
      'refs/remotes',    // Remote branches
    ];

    for (const target of watchTargets) {
      const targetPath = path.join(gitDir, target);
      if (fs.existsSync(targetPath)) {
        const watcher = fs.watch(targetPath, { recursive: target.includes('refs') },
          (event) => this.handleGitChange(repoPath, target, event)
        );
        watchers.push(watcher);
      }
    }

    this.watchers.set(repoPath, watchers);
  }

  private handleGitChange(repoPath: string, target: string, event: string) {
    // Clear existing debounce timer
    const existingTimer = this.debounceTimers.get(repoPath);
    if (existingTimer) clearTimeout(existingTimer);

    // Debounce duration based on change type
    const delay = target === 'index' ? 500 : 1000;

    const timer = setTimeout(() => {
      this.checkGitStatus(repoPath, target);
      this.debounceTimers.delete(repoPath);
    }, delay);

    this.debounceTimers.set(repoPath, timer);
  }

  private async checkGitStatus(repoPath: string, trigger: string) {
    console.log(`Git change detected in ${trigger}, checking status for ${repoPath}`);

    // With FSMonitor, this is fast (~50-200ms)
    const startTime = performance.now();
    const status = await GitService.getDetailedChanges(repoPath);
    const duration = performance.now() - startTime;

    console.log(`Status check completed in ${duration}ms`);

    // Emit status update
    this.emit('status-changed', { repoPath, status, trigger, duration });
  }
}
```

#### Fallback Watching (without FSMonitor)

```typescript
class FallbackWatcher {
  private watcher: ChokidarnWatcher | null = null;

  async watch(repoPath: string): Promise<void> {
    // More aggressive watching needed without FSMonitor
    this.watcher = chokidar.watch(repoPath, {
      ignored: [
        '**/node_modules/**',
        '**/.git/objects/**',  // Ignore git objects
        '**/.git/logs/**',      // Ignore git logs
        '**/dist/**',
        '**/build/**'
      ],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      }
    });

    // Much longer debounce needed without FSMonitor
    const debouncedCheck = debounce(
      () => this.checkGitStatus(repoPath),
      2000  // 2 seconds - git status is slower
    );

    this.watcher
      .on('add', debouncedCheck)
      .on('change', debouncedCheck)
      .on('unlink', debouncedCheck);
  }
}
```

### 3. Repository Monitoring Server Enhancement (Utility Process)

```typescript
// In src/repository-monitoring-server/RepositoryMonitoringServer.ts
// This runs in an isolated Electron utility process
class EnhancedRepositoryWatcher {
  private fsMonitor: FSMonitorManager;
  private watchers: Map<string, MinimalGitWatcher | FallbackWatcher>;
  private statusCache: Map<string, { status: GitStatus, timestamp: number }>;
  private readonly CACHE_DURATION = 1000; // 1 second cache

  async registerRepository(repoPath: string): Promise<void> {
    // Step 1: Try to enable FSMonitor
    const hasFSMonitor = await this.fsMonitor.enableForRepository(repoPath);

    // Step 2: Choose watching strategy
    const watcher = hasFSMonitor
      ? new MinimalGitWatcher()
      : new FallbackWatcher();

    // Step 3: Start watching
    await watcher.watch(repoPath);

    // Step 4: Listen for status changes
    watcher.on('status-changed', (event) => {
      this.handleStatusChange(event);
    });

    this.watchers.set(repoPath, watcher);

    // Step 5: Initial status check
    await this.refreshStatus(repoPath);

    console.log(`Repository registered: ${repoPath} (FSMonitor: ${hasFSMonitor})`);
  }

  private async handleStatusChange(event: StatusChangeEvent) {
    const { repoPath, status, trigger, duration } = event;

    // Update cache
    this.statusCache.set(repoPath, {
      status,
      timestamp: Date.now()
    });

    // Broadcast to renderer processes
    this.broadcast('git-status-updated', {
      repoPath,
      status,
      trigger,
      duration,
      hasFSMonitor: this.fsMonitor.hasFSMonitor(repoPath)
    });
  }

  async getStatus(repoPath: string): Promise<GitStatus | null> {
    // Check cache first
    const cached = this.statusCache.get(repoPath);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.status;
    }

    // Fetch fresh status
    return this.refreshStatus(repoPath);
  }

  private async refreshStatus(repoPath: string): Promise<GitStatus> {
    const startTime = performance.now();
    const status = await GitService.getDetailedChanges(repoPath);
    const duration = performance.now() - startTime;

    // Log performance metrics
    if (duration > 500) {
      console.warn(`Slow git status for ${repoPath}: ${duration}ms`);
      if (!this.fsMonitor.hasFSMonitor(repoPath)) {
        console.log(`Consider enabling FSMonitor for better performance`);
      }
    }

    return status;
  }
}
```

### 4. Performance Optimizations

#### Intelligent Debouncing

```typescript
class SmartDebouncer {
  private timers = new Map<string, NodeJS.Timeout>();
  private lastEvents = new Map<string, number>();

  debounce(key: string, fn: Function, delay: number): void {
    const now = Date.now();
    const lastEvent = this.lastEvents.get(key) || 0;
    const timeSinceLastEvent = now - lastEvent;

    // Adaptive delay based on event frequency
    let adaptiveDelay = delay;
    if (timeSinceLastEvent < 100) {
      // Rapid events - increase delay
      adaptiveDelay = delay * 2;
    } else if (timeSinceLastEvent > 5000) {
      // Infrequent events - reduce delay
      adaptiveDelay = delay / 2;
    }

    // Clear existing timer
    const existingTimer = this.timers.get(key);
    if (existingTimer) clearTimeout(existingTimer);

    // Set new timer
    const timer = setTimeout(() => {
      fn();
      this.timers.delete(key);
    }, adaptiveDelay);

    this.timers.set(key, timer);
    this.lastEvents.set(key, now);
  }
}
```

#### Batch Status Updates

```typescript
class BatchedStatusUpdater {
  private pendingUpdates = new Map<string, GitStatus>();
  private batchTimer: NodeJS.Timeout | null = null;

  queueUpdate(repoPath: string, status: GitStatus): void {
    this.pendingUpdates.set(repoPath, status);

    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flush(), 100);
    }
  }

  private flush(): void {
    if (this.pendingUpdates.size === 0) return;

    // Send all updates in one IPC message
    const updates = Array.from(this.pendingUpdates.entries());
    this.broadcast('batch-status-update', updates);

    this.pendingUpdates.clear();
    this.batchTimer = null;
  }
}
```

## Performance Benchmarks

### Expected Performance Characteristics

| Repository Size | Without FSMonitor | With FSMonitor | Improvement |
|----------------|------------------|----------------|-------------|
| Small (< 1k files) | 100-200ms | 50-100ms | 2x |
| Medium (1k-10k files) | 500-2000ms | 100-200ms | 5-10x |
| Large (10k-50k files) | 2-10 seconds | 200-500ms | 10-20x |
| Huge (50k+ files) | 10-30 seconds | 300-800ms | 20-40x |

### Memory Usage

| Watching Strategy | Memory per Repo | CPU Usage |
|------------------|-----------------|-----------|
| Full tree watching (fallback) | 10-50MB | High (continuous) |
| Minimal watching (w/ FSMonitor) | 1-5MB | Low (event-driven) |
| No watching (polling only) | < 1MB | Spike during polls |

## Migration Strategy

### Existing Components to Replace

1. **Main Process Components**
   - `src/main/file-system/GitRepositoryWatcher.ts` - Current watcher implementation
   - `src/main/file-system/gitWatcherHandlers.ts` - IPC handlers
   - `src/main/file-system/gitRepositoryService.ts` - Git operations

2. **Renderer Components (Keep but Update)**
   - `src/renderer/main-process-api/GitWatcherService.ts` - API wrapper
   - `src/renderer/contexts/GitChangesContext.tsx` - UI state management

### Migration Approach

#### Step 1: Parallel Implementation
- Keep existing `GitRepositoryWatcher` operational
- Implement new watching in `RepositoryMonitoringServer` (utility process)
- Add feature flag to switch between implementations

#### Step 2: API Compatibility Layer
```typescript
// Main process adapter to route to utility process
class GitWatcherAdapter {
  async watchRepository(repoPath: string) {
    if (useUtilityProcess) {
      return repositoryMonitoringManager.watchRepository(repoPath);
    }
    return gitRepositoryWatcher.watchRepository(repoPath);
  }
}
```

#### Step 3: Gradual Migration
1. Start with new repositories using utility process
2. Migrate existing watched repos one by one
3. Monitor performance metrics
4. Full cutover when stable

## First Step: Git Status Integration with Monitoring Server ✅ COMPLETED

### MVP Implementation
Start with simple git status functionality in the existing repository monitoring server to validate the architecture:

#### 1. Add Git Status Messages to Server Types
```typescript
// src/repository-monitoring-server/types.ts
export type MainToServerMessageType =
  | 'getFileTree'
  | 'getMetrics'
  | 'getGitStatus'        // NEW: Get git status
  | 'enableGitWatching'   // NEW: Enable git watching
  | 'disableGitWatching'  // NEW: Disable git watching
  // ... existing types

export interface GitStatus {
  repoPath: string;
  branch: string;
  isDirty: boolean;
  hasUntracked: boolean;
  hasStaged: boolean;
  ahead: number;
  behind: number;
  watchingEnabled: boolean;
}
```

#### 2. Add Git Operations to Repository Monitoring Server
```typescript
// src/repository-monitoring-server/RepositoryMonitoringServer.ts
class RepositoryMonitoringServer {
  private gitWatchers = new Map<string, boolean>();

  async getGitStatus(repoPath: string): Promise<GitStatus> {
    const git = await gitClientFactory.getClient(repoPath);
    // Get status using existing git operations
    const status = await this.computeGitStatus(git, repoPath);
    return {
      ...status,
      watchingEnabled: this.gitWatchers.get(repoPath) || false
    };
  }

  async enableGitWatching(repoPath: string): Promise<void> {
    this.gitWatchers.set(repoPath, true);
    // Start simple polling for now (FSMonitor later)
    this.startGitPolling(repoPath);
  }

  async disableGitWatching(repoPath: string): Promise<void> {
    this.gitWatchers.set(repoPath, false);
    this.stopGitPolling(repoPath);
  }
}
```

#### 3. Update Monitoring Status Display
```typescript
// Enhanced monitoring status to include git info
interface MonitoringStatus {
  repositories: Array<{
    path: string;
    gitStatus?: GitStatus;  // NEW: Include git status
    watchingEnabled: boolean;
  }>;
  currentMemory: number;
  currentCpu: number;
  history: ResourceSnapshot[];
}
```

#### 4. Add UI Controls for Git Watching
```typescript
// In SystemMonitor component, add toggle for each repo
<div className="repo-item">
  <span>{repo.path}</span>
  <button onClick={() => toggleGitWatching(repo.path)}>
    {repo.watchingEnabled ? '⏸️ Disable' : '▶️ Enable'} Git Watch
  </button>
  {repo.gitStatus && (
    <div className="git-status">
      Branch: {repo.gitStatus.branch}
      {repo.gitStatus.isDirty && ' •'}
    </div>
  )}
</div>
```

### Testing Plan for First Step

1. **Manual Testing**
   - Register a repository in monitoring
   - Enable git watching via UI toggle
   - Make file changes and verify status updates
   - Disable watching and verify it stops

2. **Performance Validation**
   - Monitor CPU/memory with watching enabled
   - Compare with main process implementation
   - Verify utility process isolation works

3. **Error Recovery**
   - Test utility process crash recovery
   - Verify watching resumes after restart

### Implementation Steps

1. **Update Server Types** (`src/repository-monitoring-server/types.ts`)
   - Add `GitStatus` interface
   - Add new message types for git operations
   - Export git-related types

2. **Enhance Server Implementation** (`src/repository-monitoring-server/RepositoryMonitoringServer.ts`)
   - Import git client factory
   - Add `getGitStatus` method
   - Add `enableGitWatching` and `disableGitWatching` methods
   - Implement basic polling mechanism

3. **Update Worker Entry** (`src/repository-monitoring-server/worker-entry.ts`)
   - Add cases for new message types
   - Handle git status requests
   - Handle enable/disable watching

4. **Update Manager in Main Process** (`src/main/repository-monitoring/RepositoryMonitoringManager.ts`)
   - Add methods to forward git operations
   - Update `getMonitoringStatus` to include git info

5. **Add IPC Handlers** (`src/main/repository-monitoring/ipcHandlers.ts`)
   - Add handlers for git status operations
   - Add handlers for enable/disable watching

6. **Update Frontend API** (`src/shared/main-process-api-interfaces/RepositoryMonitoringAPI.ts`)
   - Add git status types and events
   - Update monitoring status interface

7. **Enhance UI Component** (if monitoring UI exists)
   - Add git status display
   - Add enable/disable toggle buttons
   - Show branch and dirty status

### Success Criteria

- [x] Can get git status through utility process
- [x] Can enable/disable watching per repository
- [x] Status updates appear in monitoring UI
- [x] Memory/CPU usage stays in utility process
- [x] Process crashes don't affect main app
- [x] Status polling works without blocking

### Implementation Completed (Current State)

#### What Was Built
1. **FSMonitor Integration**
   - Git version detection for FSMonitor support (>= 2.36)
   - Automatic enablement of FSMonitor when available
   - Smart watching strategy: minimal (`.git/` only) with FSMonitor, broader fallback without

2. **Shared Event System**
   - Created `MonitoringInternalEvent` enum for internal server→main communication
   - Using `RepositoryMonitoringAPIEvent` enum for main→renderer IPC
   - Proper TypeScript types throughout (`GitStatus` instead of `any`)

3. **File Watching Strategy**
   - With FSMonitor: Watch only critical git files (index, HEAD, refs)
   - Without FSMonitor: Watch repository with intelligent ignores
   - Adaptive debouncing: 500ms with FSMonitor, 2000ms without

4. **UI Integration**
   - SystemMonitor component shows git status for each repository
   - "Status" button for manual refresh
   - "Watch" button to enable/disable watching
   - Real-time updates when files change
   - Shows: branch, dirty state, untracked files, staged files, ahead/behind counts

5. **Testing**
   - Unit tests for RepositoryMonitoringServer git operations
   - Mocked ES module dependencies for Jest compatibility
   - All git-related tests passing

## Next Steps

### Phase 1: Replace Main Process Implementation ⏳ IN PROGRESS
Now that the utility process git watching is functional, we need to:

1. **Create Compatibility Layer**
   - [ ] Update `GitWatcherService` in renderer to use RepositoryMonitoringAPI
   - [ ] Modify `GitChangesContext` to consume events from monitoring service
   - [ ] Add feature flag to switch between old and new implementation

2. **Enhanced Features**
   - [ ] Implement batch status updates for multiple repositories
   - [ ] Add file change details (which files changed)
   - [ ] Include commit history in status response
   - [ ] Add support for submodules

3. **Performance Optimizations**
   - [x] FSMonitor support (completed)
   - [x] Adaptive debouncing (completed)
   - [ ] Implement intelligent caching of git status
   - [ ] Add metrics collection for monitoring performance
   - [ ] Optimize IPC message batching

### Phase 2: Complete Migration
- [ ] Remove old `GitRepositoryWatcher` from main process
- [ ] Remove `gitWatcherHandlers.ts`
- [ ] Update all UI components to use new API
- [ ] Migrate settings/preferences for git watching
- [ ] Update documentation

### Phase 3: Advanced Features
- [ ] Add support for multiple git worktrees
- [ ] Implement smart diffing (show what changed)
- [ ] Add commit graph visualization data
- [ ] Support for git LFS status
- [ ] Integration with git hooks

## Migration Plan (Updated)

### Completed ✅
- [x] Implement FSMonitor support in utility process
- [x] Add git version detection in utility process
- [x] Create minimal watching strategy in utility process
- [x] Implement fallback watching strategy
- [x] Ensure utility process crash recovery works
- [x] Enhance Repository Monitoring Server with git watching
- [x] Update IPC interfaces for git operations
- [x] Implement adaptive debouncing in utility process
- [x] Add utility process resource monitoring
- [x] Basic UI integration in SystemMonitor

### In Progress 🚧
- [ ] Create GitWatcherAdapter in main process for compatibility
- [ ] Update existing GitChangesContext to use new service
- [ ] Add performance monitoring across process boundary
- [ ] Create feature flag system for gradual rollout

### Pending ⏰
- [ ] Full migration of all git watching consumers
- [ ] Performance benchmarking
- [ ] Production testing with large repositories
- [ ] Test with large repositories (Linux kernel, Chromium)
- [ ] Cross-platform testing (Windows, macOS, Linux)
- [ ] Performance benchmarking
- [ ] Parallel run both implementations with metrics

## Technical Notes

### Key Files Modified

1. **Utility Process (Repository Monitoring Server)**
   - `src/repository-monitoring-server/types.ts` - Added `GitStatus` type and `MonitoringInternalEvent` enum
   - `src/repository-monitoring-server/RepositoryMonitoringServer.ts` - Git watching implementation
   - `src/repository-monitoring-server/worker-entry.ts` - Message handling for git operations

2. **Shared Core**
   - `src/shared/repository-core/GitCore.ts` - FSMonitor support and detailed status

3. **Main Process**
   - `src/main/repository-monitoring/RepositoryMonitoringManager.ts` - Forward git operations
   - `src/main/repository-monitoring/ipcHandlers.ts` - IPC handlers for git operations

4. **Frontend**
   - `src/shared/main-process-api-interfaces/RepositoryMonitoringAPI.ts` - API types
   - `src/window/main-process-api-implementations/repositoryMonitoringApi.ts` - Preload implementation
   - `src/renderer/principal-window/views/SystemMonitor/SystemMonitor.tsx` - UI integration

### Important Implementation Details

1. **FSMonitor Detection**: Checks git version >= 2.36 before enabling
2. **Event Flow**: Utility Process → Main Process → Renderer (two-hop IPC)
3. **Debouncing**: 500ms with FSMonitor, 2000ms without (adaptive based on detection)
4. **File Watching**: Minimal (`.git/` only) with FSMonitor, broader without
5. **Type Safety**: Using enums for events, proper TypeScript types throughout

### Known Issues and Limitations

1. **Jest Configuration**: Had to mock ES modules (`globby`, `@principal-ai/*`) for tests
2. **Test Environment**: Repository monitoring manager tests fail due to missing webpack bundle
3. **Performance**: Not yet benchmarked against main process implementation
4. **Coverage**: Only basic git status - no file change details yet
- [ ] A/B test with subset of users

### Phase 4: Rollout & Cleanup (Week 4)
- [ ] Enable utility process watching by default
- [ ] Monitor error rates and performance
- [ ] Remove old GitRepositoryWatcher implementation
- [ ] Update documentation
- [ ] Clean up feature flags

## Configuration

### User Settings

```typescript
interface WatchingConfig {
  // Enable FSMonitor globally
  enableFSMonitor: boolean; // default: true

  // Debounce delays (ms)
  gitIndexDebounce: number; // default: 500
  gitRefsDebounce: number;   // default: 1000
  fallbackDebounce: number;  // default: 2000

  // Performance tuning
  maxWatchedRepos: number;   // default: 10
  statusCacheTTL: number;    // default: 1000

  // Feature flags
  useMinimalWatching: boolean; // default: true
  enableBatchUpdates: boolean; // default: true
}
```

### Repository-Specific Overrides

```typescript
interface RepoWatchConfig {
  repoPath: string;
  forceFullWatching?: boolean;  // Override minimal watching
  disableFSMonitor?: boolean;   // Disable FSMonitor for this repo
  customDebounce?: number;      // Custom debounce delay
}
```

## Error Handling

### Utility Process Failures

1. **Process crash** → RepositoryMonitoringManager auto-restarts (max 3 attempts)
2. **Memory overflow** → Monitor memory usage, restart if threshold exceeded
3. **IPC timeout** → Implement request timeouts with automatic retry
4. **Startup failure** → Fallback to main process monitoring (degraded mode)

### FSMonitor Failures

1. Git version too old → Fall back to traditional watching
2. FSMonitor crashes → Detect and restart within utility process
3. Platform incompatibility → Use platform-specific alternatives

### Watching Failures

1. Too many file handles → Implement watcher pooling in utility process
2. Permission denied → Gracefully degrade, notify main process and user
3. Network drives → Disable watching, use polling
4. Utility process unresponsive → Kill and restart process

## Security Considerations

1. **Path validation**: Validate all repository paths
2. **Symlink handling**: Don't follow symlinks outside repo
3. **Git hooks**: FSMonitor doesn't execute hooks
4. **Resource limits**: Cap maximum watched repositories

## Testing Strategy

### Unit Tests
- FSMonitor enablement logic
- Debouncing behavior
- Cache invalidation
- Event batching

### Integration Tests
- End-to-end status updates
- Multi-repository handling
- Performance regression tests
- Platform-specific behavior

### Performance Tests
- Large repository handling
- Rapid file change scenarios
- Memory leak detection
- CPU usage monitoring

## Monitoring and Metrics

Track the following metrics:
- FSMonitor adoption rate
- Average git status duration
- Watcher resource usage
- Update latency (file change → UI update)
- Error rates by platform

## Future Enhancements

1. **Watchman Integration**: Use Facebook's Watchman where available
2. **Custom FSMonitor Hook**: Implement custom hook for specific needs
3. **Predictive Caching**: Pre-fetch status for likely operations
4. **WebSocket Updates**: Push updates to web-based clients
5. **Distributed Watching**: Share watching across Electron processes

## Conclusion

This implementation provides:
- ✅ Efficient repository watching with minimal overhead
- ✅ Real-time git status updates
- ✅ Scalability to large repositories
- ✅ Cross-platform compatibility
- ✅ Graceful degradation when features unavailable

The hybrid approach of FSMonitor + minimal watching delivers the best balance of performance and functionality for our Electron application.