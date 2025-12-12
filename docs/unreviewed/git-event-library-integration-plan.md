# Git Event Library Integration Plan

## Overview
This document outlines the implementation plan to integrate the `@principal-ai/repository-monitoring` library's new git event watching capabilities into the electron-app codebase.

## Current Architecture

```mermaid
flowchart TB
    subgraph Worker["Worker Process (Utility)"]
        RMS[RepositoryMonitoringServer]
        Chokidar[Chokidar Watcher]
        GitCore[GitCore]

        Chokidar -->|"File change"| RMS
        RMS -->|"git status"| GitCore
        GitCore -->|"Status data"| RMS
    end

    subgraph Main["Main Process"]
        RMM[RepositoryMonitoringManager]
        IPC[IPC Handlers]

        RMS -->|"GIT_STATUS_CHANGED"| RMM
        RMM --> IPC
    end

    subgraph Renderer["Renderer Process"]
        RDC[RepositoryDataCache]
        UI[UI Components]

        IPC -->|"IPC Event"| RDC
        RDC -->|"Update"| UI
    end

```

## Current Architecture Analysis

### Existing Components
1. **RepositoryMonitoringServer** (`src/repository-monitoring-server/RepositoryMonitoringServer.ts`)
   - Currently uses custom chokidar watchers for `.git` directory
   - Has methods: `setupMinimalGitWatching`, `setupFallbackGitWatching`
   - Emits `MonitoringInternalEvent.GIT_STATUS_CHANGED` events

2. **RepositoryMonitoringManager** (`src/main/repository-monitoring/RepositoryMonitoringManager.ts`)
   - Manages worker process lifecycle
   - Forwards events from worker to main process

3. **IPC Handlers** (`src/main/repository-monitoring/ipcHandlers.ts`)
   - Handles repository registration/unregistration
   - Manages git status requests

4. **RepositoryDataCache** (`src/renderer/services/RepositoryDataCache.ts`)
   - Event-driven cache for repository data
   - Has `queueUpdate` method for triggering refreshes
   - Maintains git status, file tree, and other repository data

## How Both Systems Work Together

```mermaid
flowchart TB
    subgraph FileSystem["File System Events"]
        FS1[Source file changes<br/>.ts, .js, .md]
        FS2[Package.json changes]
        FS3[Config changes]
    end

    subgraph GitEvents["Git Events"]
        GE1[Commits]
        GE2[Branch switches]
        GE3[Merges]
        GE4[Stage/unstage]
    end

    subgraph Watchers["Two Complementary Watchers"]
        CW[Chokidar Watcher<br/>Watches working directory]
        LW[Library Watcher<br/>Watches .git/ only]
    end

    subgraph Updates["Different Update Triggers"]
        U1[Rebuild file tree]
        U2[Update packages]
        U3[Refresh git status]
        U4[Update branch info]
        U5[Update commit SHA]
    end

    FS1 --> CW --> U1
    FS2 --> CW --> U2
    FS3 --> CW --> U1

    GE1 --> LW --> U5
    GE2 --> LW --> U4
    GE3 --> LW --> U3
    GE4 --> LW --> U3

```

## Target Architecture with Library

```mermaid
flowchart TB
    subgraph Worker["Worker Process (Utility)"]
        RMS[RepositoryMonitoringServer]
        GWA[GitWatcherAdapter]
        RM[["@principal-ai/repository-monitoring<br/>RepositoryMonitor"]]

        RM -->|"GitWatchEvent"| GWA
        GWA -->|"Map to internal"| RMS
    end

    subgraph Main["Main Process"]
        RMM[RepositoryMonitoringManager]
        IPC[IPC Handlers]

        RMS -->|"Enhanced GIT_STATUS_CHANGED<br/>(with event type)"| RMM
        RMM --> IPC
    end

    subgraph Renderer["Renderer Process"]
        RDC[RepositoryDataCache]
        UI[UI Components]

        IPC -->|"Rich IPC Event"| RDC
        RDC -->|"Targeted Update"| UI
    end

```

## Integration Points

### 1. Library Integration in RepositoryMonitoringServer
**File**: `src/repository-monitoring-server/RepositoryMonitoringServer.ts`

Replace custom git watching with library:
- Import `RepositoryMonitor` from `@principal-ai/repository-monitoring`
- Replace `setupMinimalGitWatching` and `setupFallbackGitWatching` methods
- Subscribe to `GitWatchEvent` from the library
- Map library events to existing `MonitoringInternalEvent.GIT_STATUS_CHANGED`

### 2. Event Type Mapping
**File**: `src/repository-monitoring-server/types.ts`

Add new interface for library events:
```typescript
interface GitWatchEventMapping {
  libraryEvent: GitWatchEvent; // from @principal-ai/repository-monitoring
  internalEvent: MonitoringInternalEvent.GIT_STATUS_CHANGED;
  cacheFields: string[]; // ['gitStatus', 'fileTree'] for merges
}
```

### 3. Event Forwarding Enhancement
**File**: `src/main/repository-monitoring/RepositoryMonitoringManager.ts`

Enhance event forwarding to include richer git event data:
- Pass through event type (commit/branch-switch/merge/dirty-state-change)
- Include SHA and branch information
- Forward to RepositoryDataCache with appropriate cache fields

### 4. Cache Update Triggering
**File**: `src/renderer/services/RepositoryDataCache.ts`

Enhance cache update logic:
- Accept git event type in `queueUpdate`
- Trigger appropriate cache refreshes based on event type
- Add 'fileTree' refresh for merge events

## Event Flow Comparison

### Current Event Flow
```mermaid
sequenceDiagram
    participant FS as File System
    participant CH as Chokidar
    participant RMS as RepositoryMonitoringServer
    participant GC as GitCore
    participant RMM as RepositoryMonitoringManager
    participant IPC as IPC Handlers
    participant RDC as RepositoryDataCache

    FS->>CH: Any file change
    CH->>RMS: handleGitChange() [debounced 800-2000ms]
    RMS->>RMS: Clear caches
    RMS->>GC: git status
    GC-->>RMS: Status data
    RMS->>RMM: GIT_STATUS_CHANGED event
    RMM->>IPC: Forward event
    IPC->>RDC: Update all git fields
    RDC->>RDC: Refresh everything
```

### New Event Flow with Library
```mermaid
sequenceDiagram
    participant GIT as .git Directory
    participant LIB as @principal-ai/repository-monitoring
    participant GWA as GitWatcherAdapter
    participant RMS as RepositoryMonitoringServer
    participant RMM as RepositoryMonitoringManager
    participant IPC as IPC Handlers
    participant RDC as RepositoryDataCache

    GIT->>LIB: .git/HEAD, refs, index change
    LIB->>LIB: Detect event type
    LIB->>GWA: GitWatchEvent {type, sha, branch}
    GWA->>RMS: Enhanced GIT_STATUS_CHANGED
    RMS->>RMM: Forward with event type
    RMM->>IPC: Forward enhanced event
    IPC->>RDC: queueUpdate(repoPath, fields)
    RDC->>RDC: Targeted refresh based on event type
```

## Implementation Steps

### Phase 1: Library Setup (Day 1)
1. ✅ Install `@principal-ai/repository-monitoring@latest`
2. Create adapter module for library integration
3. Add TypeScript types for library interfaces

### Phase 2: Replace Git Watching (Day 1-2)
1. Create `GitWatcherAdapter` class in `RepositoryMonitoringServer`
2. Initialize `RepositoryMonitor` instance per repository
3. Subscribe to `GitWatchEvent` events
4. Map events to existing internal event structure
5. Remove legacy chokidar-based git watching code

### Phase 3: Event Pipeline Enhancement (Day 2)
1. Update event payload types in `types.ts`
2. Enhance `RepositoryMonitoringManager` to forward rich event data
3. Update IPC event handlers to process new event structure
4. Modify `RepositoryDataCache.queueUpdate` to handle event types

### Phase 4: Testing & Validation (Day 3)
1. Unit tests for GitWatcherAdapter
2. Integration tests for event flow
3. Manual testing of git operations:
   - Commits trigger updates
   - Branch switches refresh UI
   - Merges update file tree
   - Dirty state changes are reflected

### Phase 5: Cleanup & Optimization (Day 3-4)
1. Remove redundant git status calls from file change handler
2. Keep file watching for source changes, use library for git events
3. Optimize debounce settings for both systems
4. Document how both systems complement each other

## Data Flow for Different Event Types

```mermaid
flowchart LR
    subgraph Events["Git Event Types"]
        E1[Commit Event]
        E2[Branch Switch]
        E3[Merge Event]
        E4[Dirty State Change]
    end

    subgraph Actions["Cache Update Actions"]
        A1[Update gitStatus]
        A2[Update gitBranch]
        A3[Refresh fileTree]
        A4[Update lastCommit]
    end

    E1 --> A1
    E1 --> A4

    E2 --> A1
    E2 --> A2
    E2 --> A3

    E3 --> A1
    E3 --> A3
    E3 --> A4

    E4 --> A1

```

## GitWatcherAdapter Class Design

```mermaid
classDiagram
    class GitWatcherAdapter {
        -repositoryMonitors: Map~string, RepositoryMonitor~
        -eventHandlers: Map~string, Function~
        -server: RepositoryMonitoringServer
        +constructor(server: RepositoryMonitoringServer)
        +startWatching(repoPath: string): Promise~void~
        +stopWatching(repoPath: string): Promise~void~
        -handleGitWatchEvent(event: GitWatchEvent): void
        -mapEventToInternal(event: GitWatchEvent): InternalEvent
        -determineUpdateFields(eventType: string): string[]
    }

    class RepositoryMonitor {
        +on(event: string, handler: Function): void
        +start(): Promise~void~
        +stop(): Promise~void~
    }

    class GitWatchEvent {
        +type: string
        +repoPath: string
        +branch: string
        +fullSha: string
        +shortSha: string
        +isDirty: boolean
        +timestamp: number
    }

    GitWatcherAdapter ..> RepositoryMonitor : uses
    GitWatcherAdapter ..> GitWatchEvent : processes
```

## File Changes Summary

### Modified Files
1. `src/repository-monitoring-server/RepositoryMonitoringServer.ts`
   - Replace git watching implementation
   - Add library integration

2. `src/repository-monitoring-server/types.ts`
   - Add GitWatchEvent interface
   - Enhance event payload types

3. `src/main/repository-monitoring/RepositoryMonitoringManager.ts`
   - Update event forwarding logic

4. `src/renderer/services/RepositoryDataCache.ts`
   - Enhance queueUpdate method
   - Add event-type based cache invalidation

### New Files
1. `src/repository-monitoring-server/GitWatcherAdapter.ts`
   - Adapter for library integration
   - Event mapping logic

2. `src/repository-monitoring-server/GitWatcherAdapter.test.ts`
   - Unit tests for adapter

## Configuration

### Environment Variables
- `GIT_WATCHER_DEBOUNCE_MS`: Debounce delay (default: 500ms)
- `GIT_WATCHER_MODE`: 'watch' | 'poll' (default: 'watch')

### Feature Flags
- `USE_LIBRARY_GIT_WATCHER`: Enable library integration (default: false initially)

## Risk Mitigation

1. **Backward Compatibility**
   - Maintain existing event structure initially
   - Use feature flag for gradual rollout
   - Keep legacy code path during transition

2. **Performance**
   - Configure appropriate debounce delays
   - Limit watched paths to `.git` metadata
   - Monitor memory usage with multiple repositories

3. **Error Handling**
   - Graceful fallback if library fails
   - Clear error messages for debugging
   - Maintain repository state consistency

## Success Metrics

1. **Functional**
   - Git events detected within 500ms
   - All event types properly handled
   - No missed updates

2. **Performance**
   - CPU usage < 5% during idle
   - Memory usage stable with 10+ repositories
   - Event processing < 100ms

3. **Reliability**
   - No crashes during git operations
   - Proper cleanup on repository unregister
   - Consistent state after restarts

## Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 1: Library Setup | 0.5 day | ✅ Complete |
| Phase 2: Replace Git Watching | 1.5 days | Pending |
| Phase 3: Event Pipeline | 1 day | Pending |
| Phase 4: Testing | 1 day | Pending |
| Phase 5: Cleanup | 1 day | Pending |
| **Total** | **5 days** | |

## Integration Testing Strategy

```mermaid
flowchart TB
    subgraph TestScenarios["Test Scenarios"]
        T1[Make a commit]
        T2[Switch branches]
        T3[Perform merge]
        T4[Stage/unstage files]
    end

    subgraph Validations["Expected Outcomes"]
        V1[UI shows new SHA]
        V2[Branch name updates]
        V3[File tree refreshes]
        V4[Dirty indicator toggles]
    end

    subgraph Metrics["Success Metrics"]
        M1[Event latency < 500ms]
        M2[Correct event type]
        M3[No duplicate events]
        M4[Cache consistency]
    end

    T1 --> V1
    T2 --> V2
    T3 --> V3
    T4 --> V4

    V1 --> M1
    V2 --> M2
    V3 --> M3
    V4 --> M4

```

## What We're Actually Adding (Not Migrating!)

### Current System Limitations
```mermaid
flowchart LR
    subgraph Current["What We Have Now"]
        C1[File changes detected]
        C2[Run git status]
        C3[Send generic update]
        C1 --> C2 --> C3
    end

    subgraph Missing["What We DON'T Have"]
        M1[❌ No commit detection]
        M2[❌ No branch switch events]
        M3[❌ No merge detection]
        M4[❌ No event types]
        M5[❌ No SHA tracking]
    end

```

### New Capabilities from Library
```mermaid
flowchart LR
    subgraph NewEvents["NEW Event Types We're Adding"]
        N1[✅ Commit Event<br/>SHA, message, timestamp]
        N2[✅ Branch Switch Event<br/>from/to branch names]
        N3[✅ Merge Event<br/>merge commit SHA]
        N4[✅ Dirty State Event<br/>staged/unstaged files]
    end

    subgraph Benefits["What This Enables"]
        B1[Smart cache invalidation]
        B2[Event-specific UI updates]
        B3[Better performance]
        B4[Rich git information]
    end

    N1 --> B1
    N2 --> B2
    N3 --> B1
    N4 --> B3

```

## Implementation Approach (Not Migration!)

```mermaid
stateDiagram-v2
    [*] --> Step1: Current: Generic file watching

    Step1 --> Step2: ADD library integration
    note right of Step2
        Keep existing system working
        Add NEW event handlers alongside
    end note

    Step2 --> Step3: Handle BOTH event types
    note right of Step3
        Old: Generic git status updates
        New: Typed git events (commit/branch/merge)
    end note

    Step3 --> Step4: Enhance UI to use new events
    note right of Step4
        UI can now respond to specific events
        Show "New commit!", "Branch switched!", etc.
    end note

    Step4 --> Step5: Phase out generic watching
    note right of Step5
        Once new events proven stable
        Remove old Chokidar watchers
    end note

    Step5 --> [*]: Library-based event system
```

## Concrete Example: What Changes

### Before (Current System)
```typescript
// User makes a commit
// System: "Some file changed, let me check git status"
handleGitChange() {
  const status = await git.status();  // Generic status check
  emit('GIT_STATUS_CHANGED', status); // Generic event
}

// UI receives:
{
  branch: "main",
  isDirty: false,
  // That's it! No idea a commit happened
}
```

### After (With Library)
```typescript
// User makes a commit
// Library: "Detected a commit event!"
onGitWatchEvent(event: GitWatchEvent) {
  if (event.type === 'commit') {
    emit('GIT_STATUS_CHANGED', {
      ...existingStatus,
      eventType: 'commit',        // NEW!
      sha: event.fullSha,          // NEW!
      shortSha: event.shortSha,    // NEW!
      timestamp: event.timestamp   // NEW!
    });
  }
}

// UI receives:
{
  branch: "main",
  isDirty: false,
  eventType: "commit",           // UI knows this is a commit!
  sha: "abc123...",              // UI can show the SHA
  timestamp: 1234567890          // UI can show when
}

// UI can now show: "✅ New commit: abc123"
```

## Why This Isn't Really a "Migration"

We're not migrating from one event system to another. We're:
1. **Adding** a proper event system (we don't have one now)
2. **Enhancing** our generic file watching with specific git events
3. **Keeping** the existing system working during the transition
4. **Enriching** the data flow with new event types and metadata

The word "migration" was misleading - this is really an **enhancement** that adds capabilities we don't currently have!

## Next Actions

1. Create `GitWatcherAdapter` class
2. Set up library integration with feature flag
3. Write unit tests for adapter
4. Begin phased migration with single repository
5. Monitor and validate event flow