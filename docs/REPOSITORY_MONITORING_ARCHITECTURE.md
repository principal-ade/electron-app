# Repository Monitoring Architecture

This document describes the architecture and interaction between the Electron app and the Repository Monitoring Server, with particular focus on git process management.

## Table of Contents

1. [Overview](#overview)
2. [Process Architecture](#process-architecture)
3. [Communication Flow](#communication-flow)
4. [Git Process Spawning](#git-process-spawning)
5. [Known Issues](#known-issues)
6. [Key Files Reference](#key-files-reference)

---

## Overview

The desktop app uses a **multi-process architecture** where heavy repository monitoring operations are offloaded to a dedicated worker process. This separation prevents blocking the main Electron process and UI thread.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ELECTRON APP                                    │
│                                                                              │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────┐   │
│  │  Renderer        │    │  Main Process    │    │  Utility Process     │   │
│  │  (React UI)      │◄──►│  (Node.js)       │◄──►│  (Worker)            │   │
│  │                  │    │                  │    │                      │   │
│  │  - Displays      │    │  - IPC routing   │    │  - Git operations    │   │
│  │    git status    │    │  - Window mgmt   │    │  - File watching     │   │
│  │  - File trees    │    │  - Event relay   │    │  - Cache management  │   │
│  │  - Branch info   │    │                  │    │  - Package analysis  │   │
│  └──────────────────┘    └──────────────────┘    └──────────────────────┘   │
│           │                       │                        │                 │
│           │    ipcRenderer        │     postMessage        │                 │
│           └───────────────────────┴────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Process Architecture

### Three-Process Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            PROCESS HIERARCHY                                 │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────┐
                    │    RENDERER PROCESS     │
                    │    (BrowserWindow)      │
                    │                         │
                    │  RepositoryMonitoring-  │
                    │  Service.ts             │
                    │  (static API calls)     │
                    └───────────┬─────────────┘
                                │
                    ipcRenderer.invoke()
                    ipcRenderer.on()
                                │
                                ▼
                    ┌─────────────────────────┐
                    │     MAIN PROCESS        │
                    │     (Electron Main)     │
                    │                         │
                    │  ┌───────────────────┐  │
                    │  │ ipcHandlers.ts    │  │
                    │  │ (IPC routing)     │  │
                    │  └─────────┬─────────┘  │
                    │            │            │
                    │  ┌─────────▼─────────┐  │
                    │  │ Repository-       │  │
                    │  │ MonitoringManager │  │
                    │  │ (singleton)       │  │
                    │  └─────────┬─────────┘  │
                    └────────────┼────────────┘
                                 │
                    utilityProcess.fork()
                    postMessage() / on('message')
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │   UTILITY PROCESS       │
                    │   (repository-          │
                    │    monitoring-server)   │
                    │                         │
                    │  ┌───────────────────┐  │
                    │  │ worker-entry.ts   │  │
                    │  │ (message handler) │  │
                    │  └─────────┬─────────┘  │
                    │            │            │
                    │  ┌─────────▼─────────┐  │
                    │  │ Repository-       │  │
                    │  │ MonitoringServer  │  │
                    │  │                   │  │
                    │  │ ┌───────────────┐ │  │
                    │  │ │ GitCore       │ │  │
                    │  │ │ (spawns git)  │─┼──┼──► git processes
                    │  │ └───────────────┘ │  │
                    │  │ ┌───────────────┐ │  │
                    │  │ │ GitWatcher-   │ │  │
                    │  │ │ Adapter       │ │  │
                    │  │ └───────────────┘ │  │
                    │  │ ┌───────────────┐ │  │
                    │  │ │ FileTree-     │ │  │
                    │  │ │ Builder       │ │  │
                    │  │ └───────────────┘ │  │
                    │  └───────────────────┘  │
                    └─────────────────────────┘
```

### Process Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PROCESS LIFECYCLE                                   │
└─────────────────────────────────────────────────────────────────────────────┘

    App Start
        │
        ▼
┌───────────────────┐
│ initialization.ts │
│ registers IPC     │
│ handlers          │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐       ┌─────────────────────────────────────┐
│ Repository-       │       │  Worker Process                     │
│ MonitoringManager │       │                                     │
│ created           │       │                                     │
│ (autoStart: true) │──────►│  utilityProcess.fork()              │
└────────┬──────────┘       │         │                           │
         │                  │         ▼                           │
         │                  │  ┌─────────────────────────────┐    │
         │                  │  │ Load worker-entry.ts        │    │
         │                  │  │ Initialize Server           │    │
         │                  │  │ Send 'ready' message        │    │
         │                  │  └──────────────┬──────────────┘    │
         │                  │                 │                   │
         │◄─────────────────┼─────────────────┘                   │
         │  'ready' msg     │                                     │
         ▼                  └─────────────────────────────────────┘
┌───────────────────┐
│ Ready to accept   │
│ requests          │
└────────┬──────────┘
         │
         │ [App Running - bidirectional IPC]
         │
         ▼
┌───────────────────┐
│ App quit or       │
│ stop() called     │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ worker.kill()     │
│ Cleanup complete  │
└───────────────────┘


    ┌─────────────────────────────────────────────────────────────┐
    │                    CRASH RECOVERY                           │
    │                                                             │
    │  Worker Exit Detected                                       │
    │         │                                                   │
    │         ▼                                                   │
    │  ┌─────────────────┐     Yes    ┌────────────────────────┐  │
    │  │ shutdownRequested├──────────►│ No restart, cleanup    │  │
    │  │ == true?        │            └────────────────────────┘  │
    │  └────────┬────────┘                                        │
    │           │ No                                              │
    │           ▼                                                 │
    │  ┌─────────────────┐     Yes    ┌────────────────────────┐  │
    │  │ restartAttempts │───────────►│ Emit 'fatal-error'     │  │
    │  │ >= 3?           │            │ Stop trying            │  │
    │  └────────┬────────┘            └────────────────────────┘  │
    │           │ No                                              │
    │           ▼                                                 │
    │  ┌─────────────────┐                                        │
    │  │ Wait backoff    │  (1s, 2s, 3s exponential)              │
    │  │ Restart worker  │                                        │
    │  └─────────────────┘                                        │
    └─────────────────────────────────────────────────────────────┘
```

---

## Communication Flow

### Message Protocol

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MESSAGE PROTOCOL                                     │
└─────────────────────────────────────────────────────────────────────────────┘

    MAIN → WORKER (Request)              WORKER → MAIN (Response)
    ┌────────────────────────┐           ┌────────────────────────┐
    │ MainToServerMessage    │           │ ServerToMainMessage    │
    ├────────────────────────┤           ├────────────────────────┤
    │ id: string (UUID)      │           │ type: 'response'       │
    │ type: MessageType      │           │ id: string (matches)   │
    │ path?: string          │           │ result?: unknown       │
    │ dependencyRequest?: {} │           │ error?: string         │
    └────────────────────────┘           └────────────────────────┘

    WORKER → MAIN (Event Push)
    ┌────────────────────────┐
    │ ServerToMainMessage    │
    ├────────────────────────┤
    │ type: 'event'          │
    │ event: {               │
    │   name: string         │
    │   data: unknown        │
    │ }                      │
    └────────────────────────┘
```

### Request Types

| Message Type | Direction | Description |
|-------------|-----------|-------------|
| `register` | Main → Worker | Register a repository for monitoring |
| `unregister` | Main → Worker | Stop monitoring a repository |
| `getFileTree` | Main → Worker | Get file structure |
| `getGitStatus` | Main → Worker | Get current git status |
| `getGitStatusWithFiles` | Main → Worker | Get git status with file lists |
| `enableGitWatching` | Main → Worker | Start watching for git changes |
| `disableGitWatching` | Main → Worker | Stop watching for git changes |
| `getGitRemoteInfo` | Main → Worker | Get remote branch info |
| `getPackages` | Main → Worker | Get package.json analysis |
| `refresh` | Main → Worker | Force cache refresh |

### Event Types (Worker → Main → Renderer)

| Event | Description |
|-------|-------------|
| `git-status-changed` | Git status updated (branch, dirty, staged) |
| `git-state-event` | Git state transition (commit, branch-switch) |
| `workspace-change` | File added/changed/deleted |
| `cache-sync` | Cache slice updated |
| `metrics-updated` | Resource metrics changed |
| `build-artifacts-detected` | Build output files detected |

### Request/Response Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REQUEST/RESPONSE FLOW EXAMPLE                             │
│                    (getGitStatus)                                            │
└─────────────────────────────────────────────────────────────────────────────┘

    RENDERER                 MAIN PROCESS              WORKER
       │                          │                       │
       │  invoke('get-git-       │                       │
       │  status', path)         │                       │
       │─────────────────────────►                       │
       │                          │                       │
       │                    ┌─────┴─────┐                │
       │                    │ Generate  │                │
       │                    │ UUID      │                │
       │                    │ Store in  │                │
       │                    │ pending-  │                │
       │                    │ Requests  │                │
       │                    └─────┬─────┘                │
       │                          │                       │
       │                          │  postMessage({       │
       │                          │    id: 'uuid-123',   │
       │                          │    type: 'getGit-    │
       │                          │          Status',    │
       │                          │    path: '/repo'     │
       │                          │  })                  │
       │                          │──────────────────────►
       │                          │                       │
       │                          │               ┌───────┴───────┐
       │                          │               │ GitCore.      │
       │                          │               │ getDetailed-  │
       │                          │               │ Status()      │
       │                          │               └───────┬───────┘
       │                          │                       │
       │                          │                       │ ─┐
       │                          │                       │  │ Spawns
       │                          │                       │  │ 4 git
       │                          │                       │  │ processes
       │                          │                       │ ─┘
       │                          │                       │
       │                          │  postMessage({       │
       │                          │    type: 'response', │
       │                          │    id: 'uuid-123',   │
       │                          │    result: {...}     │
       │                          │  })                  │
       │                          │◄──────────────────────
       │                          │                       │
       │                    ┌─────┴─────┐                │
       │                    │ Match ID  │                │
       │                    │ Resolve   │                │
       │                    │ promise   │                │
       │                    └─────┬─────┘                │
       │                          │                       │
       │  return result           │                       │
       │◄─────────────────────────                       │
       │                          │                       │
```

### Event Broadcasting Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EVENT BROADCASTING FLOW                                   │
│                    (git-status-changed)                                      │
└─────────────────────────────────────────────────────────────────────────────┘

    WORKER                    MAIN PROCESS              RENDERER(S)
       │                          │                       │
       │  File change detected    │                       │
       │  by GitWatcherAdapter    │                       │
       │                          │                       │
  ┌────┴────┐                     │                       │
  │ Build   │                     │                       │
  │ new git │                     │                       │
  │ status  │                     │                       │
  └────┬────┘                     │                       │
       │                          │                       │
       │  postMessage({          │                       │
       │    type: 'event',       │                       │
       │    event: {             │                       │
       │      name: 'git-        │                       │
       │            status-      │                       │
       │            changed',    │                       │
       │      data: {...}        │                       │
       │    }                    │                       │
       │  })                     │                       │
       │─────────────────────────►                       │
       │                          │                       │
       │                    ┌─────┴─────┐                │
       │                    │ Get all   │                │
       │                    │ Browser-  │                │
       │                    │ Windows   │                │
       │                    └─────┬─────┘                │
       │                          │                       │
       │                          │  webContents.send(   │
       │                          │    'repository-      │
       │                          │     monitoring:      │
       │                          │     git-status-      │
       │                          │     changed',        │
       │                          │    data              │
       │                          │  )                   │  Window 1
       │                          │──────────────────────►
       │                          │                       │
       │                          │──────────────────────►  Window 2
       │                          │                       │
       │                          │──────────────────────►  Window N
       │                          │                       │
```

---

## Git Process Spawning

### Git Command Execution Points

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GIT PROCESS SPAWNING LOCATIONS                            │
└─────────────────────────────────────────────────────────────────────────────┘

                         RepositoryMonitoringServer
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
            ▼                       ▼                       ▼
    ┌───────────────┐      ┌───────────────┐      ┌───────────────┐
    │  GitCore.ts   │      │ GitRemote-    │      │ GitWatcher-   │
    │               │      │ Service.ts    │      │ Adapter.ts    │
    └───────┬───────┘      └───────┬───────┘      └───────┬───────┘
            │                      │                      │
            ▼                      ▼                      ▼
    ┌───────────────┐      ┌───────────────┐      ┌───────────────┐
    │ execSync()    │      │ execSync()    │      │ @principal-ai/│
    │               │      │               │      │ repository-   │
    │ git status    │      │ git ls-remote │      │ monitoring    │
    │ git rev-parse │      │ (3 parallel)  │      │ library       │
    │ git log       │      │               │      │               │
    │ git diff      │      │               │      │               │
    │ (4+ parallel) │      │               │      │               │
    └───────────────┘      └───────────────┘      └───────────────┘
```

### getDetailedStatus() - Primary Git Spawning Point

This is the most frequently called function and spawns **4 parallel git processes**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    getDetailedStatus() FLOW                                  │
│                    File: GitCore.ts:432-437                                  │
└─────────────────────────────────────────────────────────────────────────────┘

    getDetailedStatus(repoPath)
              │
              ▼
    ┌─────────────────────────────────────────────────────────────┐
    │                    Promise.all([                            │
    │                                                             │
    │      ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
    │      │ getStatus()  │  │getAheadCount │  │getBehindCount│   │
    │      │              │  │    ()        │  │    ()        │   │
    │      │ git status   │  │ git rev-list │  │ git rev-list │   │
    │      │ --porcelain  │  │ --count      │  │ --count      │   │
    │      └──────────────┘  └──────────────┘  └──────────────┘   │
    │                                                             │
    │      ┌──────────────┐                                       │
    │      │ isDirty()    │                                       │
    │      │              │                                       │
    │      │ git status   │                                       │
    │      │ --porcelain  │                                       │
    │      └──────────────┘                                       │
    │                                                             │
    │    ])  // 4 processes spawned in parallel                   │
    └─────────────────────────────────────────────────────────────┘
              │
              ▼
        Returns combined GitStatusMetadata
```

### File Change → Git Status Refresh Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FILE CHANGE TRIGGERS GIT PROCESSES                        │
└─────────────────────────────────────────────────────────────────────────────┘

    Chokidar (File Watcher)
              │
              │ File add/change/unlink detected
              ▼
    ┌─────────────────────────┐
    │ GitWatcherAdapter.      │
    │ handleWorkspaceChange() │
    │ (GitWatcherAdapter.ts   │
    │  :251-279)              │
    └───────────┬─────────────┘
                │
                │ Emits WORKSPACE_CHANGED event
                ▼
    ┌─────────────────────────┐
    │ RepositoryMonitoring-   │
    │ Server.handleWorkspace- │
    │ ChangeEvent()           │
    │ (:920-978)              │
    └───────────┬─────────────┘
                │
                ├──────────────────────────────────┐
                │                                  │
                ▼                                  ▼
    ┌─────────────────────────┐     ┌─────────────────────────┐
    │ scheduleCacheRebuild()  │     │ scheduleGitStatus-      │
    │                         │     │ Refresh()               │
    │ Rebuilds file tree      │     │                         │
    │ and packages            │     │ Sets 300-500ms timeout  │
    └─────────────────────────┘     └───────────┬─────────────┘
                                                │
                                    After timeout expires
                                                │
                                                ▼
                                    ┌─────────────────────────┐
                                    │ buildGitStatusSlice()   │
                                    │                         │
                                    │ Calls GitCore.          │
                                    │ getDetailedStatus()     │
                                    └───────────┬─────────────┘
                                                │
                                                ▼
                                    ┌─────────────────────────┐
                                    │ 4 PARALLEL GIT          │
                                    │ PROCESSES SPAWNED       │
                                    │                         │
                                    │ • git status --porcelain│
                                    │ • git status --porcelain│
                                    │ • git rev-list (ahead)  │
                                    │ • git rev-list (behind) │
                                    └─────────────────────────┘
```

### Git Remote Info - Network Calls

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GIT REMOTE INFO FLOW                                      │
│                    File: GitRemoteService.ts                                 │
└─────────────────────────────────────────────────────────────────────────────┘

    getGitRemoteInfo(repoPath)
              │
              ▼
    ┌─────────────────────────────────────────────────────────────┐
    │                    Promise.allSettled([                     │
    │                                                             │
    │   ┌────────────────────┐  ┌────────────────────┐           │
    │   │fetchDefaultBranch()│  │fetchRemoteBranches()│           │
    │   │                    │  │                    │           │
    │   │ git ls-remote      │  │ git ls-remote      │           │
    │   │ --symref origin    │  │ --heads origin     │           │
    │   │ HEAD               │  │                    │           │
    │   └────────────────────┘  └────────────────────┘           │
    │                                                             │
    │   ┌────────────────────┐                                   │
    │   │checkRemote-        │                                   │
    │   │Accessibility()     │                                   │
    │   │                    │                                   │
    │   │ git ls-remote      │                                   │
    │   │ --exit-code origin │                                   │
    │   └────────────────────┘                                   │
    │                                                             │
    │    ])  // 3 network-dependent processes in parallel         │
    └─────────────────────────────────────────────────────────────┘

    WARNING: These are network calls that can hang if remote
             is unreachable. May leave orphaned processes.
```

---

## Known Issues

### Issue 1: Rapid Git Process Accumulation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PROBLEM: RAPID GIT SPAWNING                               │
└─────────────────────────────────────────────────────────────────────────────┘

    Timeline when files change rapidly (e.g., during npm install):

    T+0ms    File change detected
             └─► scheduleGitStatusRefresh(300ms delay)

    T+50ms   Another file change
             └─► scheduleGitStatusRefresh(300ms delay)  [NEW TIMER]

    T+100ms  Another file change
             └─► scheduleGitStatusRefresh(300ms delay)  [NEW TIMER]

    T+300ms  First timer fires
             └─► Spawn 4 git processes

    T+350ms  Second timer fires
             └─► Spawn 4 MORE git processes (8 total now)

    T+400ms  Third timer fires
             └─► Spawn 4 MORE git processes (12 total now)

    ... processes pile up if file changes continue ...

    ROOT CAUSE: No deduplication or coalescing of refresh requests
```

### Issue 2: No Process Cleanup on Worker Exit

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PROBLEM: ORPHANED GIT PROCESSES                           │
└─────────────────────────────────────────────────────────────────────────────┘

    Worker Process                              Git Processes
         │                                           │
         │  execSync('git status')───────────────────►│ git status
         │                                           │ (running)
         │  execSync('git rev-list')─────────────────►│ git rev-list
         │                                           │ (running)
         │                                           │
         X  Worker crashes or killed                 │
                                                     │
                                                     │ git status
                                                     │ (ORPHANED - no parent)
                                                     │
                                                     │ git rev-list
                                                     │ (ORPHANED - no parent)

    Current cleanup code (CLIBridge.ts:174-182):
    - Clears pending request promises
    - Does NOT kill spawned child processes
```

### Issue 3: FSMonitor Daemon Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PROBLEM: FSMONITOR DAEMON ISSUES                          │
│                    File: GitCore.ts:215-298                                  │
└─────────────────────────────────────────────────────────────────────────────┘

    enableFSMonitor()
          │
          ▼
    ┌─────────────────┐
    │ Check if daemon │
    │ running         │
    │ git fsmonitor-- │
    │ daemon status   │
    └────────┬────────┘
             │
             │ Not running
             ▼
    ┌─────────────────┐
    │ Start daemon    │
    │ git fsmonitor-- │     ─┐
    │ daemon start    │      │ If this fails but doesn't
    └────────┬────────┘      │ throw, daemon may be in
             │               │ bad state
             │ Retry loop    │
             ▼              ─┘
    ┌─────────────────┐
    │ Check status    │
    │ again...        │
    │ (up to N times) │
    └─────────────────┘

    PROBLEM: No backoff between retries
             May spawn multiple daemon start attempts
             Zombie daemons possible on partial failure
```

### Issue 4: Timer Management Gaps

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PROBLEM: UNCLEARED TIMERS                                 │
│                    File: RepositoryMonitoringServer.ts                       │
└─────────────────────────────────────────────────────────────────────────────┘

    Maps tracking timers:
    ┌─────────────────────────────────────────────────┐
    │ gitStatusRefreshTimers: Map<string, Timeout>   │  ✓ Cleared on disable
    │ rebuildTimers: Map<string, Timeout>            │  ✗ NOT cleared
    └─────────────────────────────────────────────────┘

    disableGitWatching(repoPath):
        gitStatusRefreshTimers.delete(repoPath)  // ✓ Done
        // rebuildTimers NOT cleared             // ✗ Missing

    RESULT: Orphaned rebuildTimers may continue firing
            after git watching is disabled
```

---

## Key Files Reference

### Electron App (Main Process)

| File | Purpose |
|------|---------|
| `src/main/initialization.ts` | Registers IPC handlers on app start |
| `src/main/repository-monitoring/ipcHandlers.ts` | Routes IPC calls to manager |
| `src/window/main-process-api-implementations/repositoryMonitoringApi.ts` | Preload bridge API |

### Repository Monitoring Server

| File | Purpose |
|------|---------|
| `src/main/RepositoryMonitoringManager.ts` | Manages worker lifecycle, request routing |
| `src/worker/worker-entry.ts` | Worker entry point, message handling |
| `src/worker/RepositoryMonitoringServer.ts` | Core monitoring logic |
| `src/worker/GitWatcherAdapter.ts` | File system watching, git event detection |
| `src/worker/GitRemoteService.ts` | Remote branch queries |
| `src/shared/repository-core/GitCore.ts` | Git command execution |
| `src/worker/types.ts` | Message types and interfaces |

### Shared

| File | Purpose |
|------|---------|
| `src/shared/RepositoryMonitoringAPI.ts` | API event names, type definitions |

---

## Recommended Fixes

1. **Add request deduplication** - If a git status request is in-flight, queue subsequent requests instead of spawning new processes

2. **Implement debouncing** - Coalesce rapid file changes into single git status refresh (e.g., 500ms window)

3. **Track spawned processes** - Maintain a Set of active child process PIDs for cleanup

4. **Add process cleanup on exit** - Kill all tracked processes when worker exits

5. **Clear all timers** - Ensure both `gitStatusRefreshTimers` and `rebuildTimers` are cleared on disable

6. **Add timeouts to git commands** - Kill git processes that exceed reasonable time limits

7. **Implement process pooling** - Limit concurrent git processes (e.g., max 4 per repository)
