# Window Opening Performance Analysis

## Overview

This document analyzes the performance bottlenecks in opening repository windows and proposes architectural improvements to decouple blocking operations from window initialization.

## Current Architecture

### Repository Window Opening Flow

```mermaid
sequenceDiagram
    participant User
    participant Renderer
    participant IPC
    participant Handler as WindowHandler
    participant Git as GitBranchService
    participant DB as RepositoryDB
    participant GitHub as GitHub API
    participant Window as BrowserWindow

    User->>Renderer: Click "Open Locally"
    Renderer->>IPC: OPEN_REPOSITORY_DASHBOARD
    IPC->>Handler: Handle request

    Note over Handler: BLOCKING: Parse repository data

    par Parallel Operations
        Handler->>Git: getBranchInfo(path)
        Note over Git: Runs 6+ git commands:<br/>- getCurrentBranch<br/>- getDefaultBranch<br/>- getAvailableBranches<br/>- getRemotes<br/>- getCurrentCommit<br/>- getBranchStatus
        Git-->>Handler: Branch info (500-2000ms)
    and
        Handler->>DB: getRepository(remoteUrl)
        DB-->>Handler: Repository data (50-200ms)
    end

    Note over Handler: BLOCKING: Check if avatar exists

    alt No avatar cached
        Handler->>GitHub: fetch(api.github.com/repos/...)
        Note over GitHub: Network call (500-2000ms)
        GitHub-->>Handler: Repository metadata
        Handler->>Handler: downloadAndCacheAvatar()
        Note over Handler: Fetch avatar image<br/>Convert to base64<br/>Save to storage (300-1000ms)
    end

    Handler->>Window: createSpecialWindow()
    Note over Window: Create BrowserWindow<br/>Initialize adapters (setImmediate)

    Handler->>Handler: setTimeout(200ms)
    Note over Handler: Wait for adapter init

    Handler->>Window: loadURL(repo-manager.html)

    Window->>Window: Load HTML/CSS/JS
    Window->>Window: Parse React app
    Window->>Window: ready-to-show event
    Window->>User: Window visible!

    Note over User,Window: Total time: 2-5 seconds
```

### Current Bottlenecks

```mermaid
graph TD
    A[User Opens Window] --> B{Git Branch Info}
    B -->|500-2000ms| C[Blocking]

    A --> D{Database Query}
    D -->|50-200ms| E[Blocking]

    A --> F{Avatar Check}
    F -->|Has Avatar?| G[Continue]
    F -->|No Avatar| H{GitHub API Call}
    H -->|500-2000ms| I[Blocking]
    I --> J{Download Avatar}
    J -->|300-1000ms| K[Blocking]
    K --> G

    G --> L[200ms setTimeout]
    L --> M[Window Creation]
    M --> N[ready-to-show]
    N --> O[Window Visible]

    style C fill:#f96,stroke:#333,stroke-width:2px
    style E fill:#f96,stroke:#333,stroke-width:2px
    style I fill:#f96,stroke:#333,stroke-width:2px
    style K fill:#f96,stroke:#333,stroke-width:2px
    style L fill:#f96,stroke:#333,stroke-width:2px
```

## Problem Analysis

### 1. Git Operations Block Window Opening

**Current Implementation:** `src/main/window/modernWindowHandlers.ts:224-240`

```typescript
if (repository.path) {
  try {
    const branchService = new GitBranchService();
    const branchInfo = await branchService.getBranchInfo(repository.path);
    currentBranch = branchInfo?.currentBranch;
  } catch (error) {
    console.error('[modernWindowHandlers] Failed to get branch info:', error);
  }
}
```

**Issues:**
- Blocks window creation until git commands complete
- Makes 6+ git subprocess calls serially
- Can take 500-2000ms depending on repository size
- TODO comment at `src/main/stores/RepositoryApiEventHandler.ts:465` acknowledges this is blocking

### 2. GitHub API Calls Block Window Opening

**Current Implementation:** `src/main/window/modernWindowHandlers.ts:260-273`

```typescript
if (existingRepo && !existingRepo.avatarUrl && vcsType === 'github') {
  console.log('[modernWindowHandlers] Fetching avatar for repository:', remoteUrl);
  try {
    existingRepo = await repositoryHandler.refreshRepositoryMetadata(remoteUrl);
  } catch (error) {
    console.error('[modernWindowHandlers] Failed to refresh metadata:', error);
  }
}
```

**Issues:**
- Network call to `api.github.com` (500-2000ms)
- Downloads and converts avatar to base64 (300-1000ms)
- Blocks window creation for cosmetic data
- User sees nothing while waiting for avatar

### 3. Artificial 200ms Delay

**Current Implementation:** `src/main/window/modernWindowHandlers.ts:389-395`

```typescript
setTimeout(() => {
  console.log('[ModernWindow] Loading repository dashboard URL after adapter init delay:', url);
  window.window.loadURL(url);
}, 200);
```

**Issues:**
- Hardcoded delay to ensure adapters initialize
- Adds 200ms to every window open
- Should use event-driven approach instead

## Proposed Architecture

### Decoupled Repository Window Opening

```mermaid
sequenceDiagram
    participant User
    participant Renderer
    participant IPC
    participant Handler as WindowHandler
    participant DB as RepositoryDB
    participant Window as BrowserWindow
    participant Background as Background Jobs
    participant Git as GitBranchService
    participant GitHub as GitHub API

    User->>Renderer: Click "Open Locally"
    Renderer->>IPC: OPEN_REPOSITORY_DASHBOARD
    IPC->>Handler: Handle request

    Note over Handler: Only fetch essential data

    Handler->>DB: getRepository(remoteUrl)
    DB-->>Handler: Cached repository data (50ms)

    Handler->>Window: createSpecialWindow()
    Note over Window: Create BrowserWindow<br/>Initialize adapters

    Handler->>Window: loadURL with cached data
    Note over Window: Show window immediately<br/>with loading states

    Window->>User: Window visible! (200-300ms)

    par Non-blocking Background Operations
        Background->>Git: getBranchInfo(path)
        Note over Git: Fetch git status async
        Git-->>Window: IPC: Update branch info
        Window->>User: UI updates with branch
    and
        Background->>GitHub: Lazy fetch metadata
        Note over GitHub: Only if needed
        GitHub-->>Window: IPC: Update avatar/metadata
        Window->>User: UI updates with avatar
    end

    Note over User: Total time to visible: 200-500ms<br/>Progressive enhancement: +500-2000ms
```

### Atomic Git Operations Architecture

```mermaid
graph LR
    A[Window Opens] --> B[Show Immediately]
    B --> C[Loading State UI]

    C --> D{User Action}
    D -->|Click Refresh| E[Fetch Git Status]
    D -->|Auto Interval| E
    D -->|GitHub Webhook| E

    E --> F[Git Branch Service]
    F --> G[Update UI]

    H[Background Service] -->|Periodic Check| E
    I[GitHub Hooks] -->|Event Driven| E

    style B fill:#9f6,stroke:#333,stroke-width:2px
    style C fill:#9f6,stroke:#333,stroke-width:2px
    style E fill:#69f,stroke:#333,stroke-width:2px
    style H fill:#f96,stroke:#333,stroke-width:2px
    style I fill:#f96,stroke:#333,stroke-width:2px
```

### Progressive Data Loading

```mermaid
stateDiagram-v2
    [*] --> WindowRequest
    WindowRequest --> FetchMinimalData: Get cached data only
    FetchMinimalData --> CreateWindow: <100ms
    CreateWindow --> ShowWindow: Display with loading states

    ShowWindow --> LoadingState

    state LoadingState {
        [*] --> ShowSkeleton
        ShowSkeleton --> WaitingForData

        WaitingForData --> GotGitData: Git status arrives
        WaitingForData --> GotMetadata: Metadata arrives

        GotGitData --> PartiallyLoaded
        GotMetadata --> PartiallyLoaded

        PartiallyLoaded --> FullyLoaded: All data received
    }

    LoadingState --> [*]
```

## Implementation Plan

### Phase 1: Decouple Git Operations

#### 1.1 Create Git Status Event System

**New file:** `src/main/services/GitStatusService.ts`

```mermaid
classDiagram
    class GitStatusService {
        -cache: Map~string,GitStatus~
        -updateCallbacks: Map~string,Function[]~
        +getStatus(path): GitStatus | null
        +refreshStatus(path): Promise~GitStatus~
        +subscribeToUpdates(path, callback): unsubscribe
        +startPolling(path, interval): stopPolling
    }

    class GitStatus {
        +currentBranch: string
        +defaultBranch: string
        +availableBranches: string[]
        +remotes: Remote[]
        +branchStatus: BranchStatus
        +lastUpdated: number
        +isStale: boolean
    }

    class WindowRenderer {
        +repository: Repository
        +gitStatus: GitStatus | null
        +isLoadingGitStatus: boolean
    }

    GitStatusService --> GitStatus
    WindowRenderer --> GitStatus
    GitStatusService ..> WindowRenderer: IPC Updates
```

#### 1.2 Update Window Handler

**Changes to:** `src/main/window/modernWindowHandlers.ts`

```typescript
// BEFORE (Blocking)
if (repository.path) {
  try {
    const branchService = new GitBranchService();
    const branchInfo = await branchService.getBranchInfo(repository.path);
    currentBranch = branchInfo?.currentBranch;
  } catch (error) {
    console.error('[modernWindowHandlers] Failed to get branch info:', error);
  }
}

// AFTER (Non-blocking)
let currentBranch: string | undefined;
if (repository.path) {
  // Try to get cached status first
  const cachedStatus = gitStatusService.getCachedStatus(repository.path);
  currentBranch = cachedStatus?.currentBranch;

  // Trigger async refresh (doesn't block)
  gitStatusService.refreshStatus(repository.path).then((status) => {
    // Send update to window via IPC
    window.webContents.send('git-status-updated', status);
  });
}
```

#### 1.3 Update Renderer to Handle Async Git Data

**Changes to:** `src/renderer/repo-manager/RepoManagerApp.tsx`

```typescript
const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
const [isLoadingGitStatus, setIsLoadingGitStatus] = useState(true);

useEffect(() => {
  if (!repository?.localPath) return;

  // Subscribe to git status updates
  const unsubscribe = GitStatusService.onStatusUpdate(
    repository.localPath,
    (status) => {
      setGitStatus(status);
      setIsLoadingGitStatus(false);
    }
  );

  return unsubscribe;
}, [repository?.localPath]);

// User-triggered refresh
const handleRefreshGitStatus = async () => {
  if (!repository?.localPath) return;
  setIsLoadingGitStatus(true);
  await GitStatusService.refreshStatus(repository.localPath);
};
```

### Phase 2: Decouple GitHub API Calls

#### 2.1 Lazy Load Metadata

**Changes to:** `src/main/window/modernWindowHandlers.ts`

```typescript
// BEFORE (Blocking)
if (existingRepo && !existingRepo.avatarUrl && vcsType === 'github') {
  existingRepo = await repositoryHandler.refreshRepositoryMetadata(remoteUrl);
}

// AFTER (Non-blocking)
if (existingRepo && !existingRepo.avatarUrl && vcsType === 'github') {
  // Don't block - fetch in background after window opens
  repositoryHandler.refreshRepositoryMetadata(remoteUrl).then((updated) => {
    // Broadcast update to all interested windows
    broadcastRepositoryMetadataUpdated(remoteUrl, updated);
  });
}
```

#### 2.2 Create Metadata Cache Service

```mermaid
graph TD
    A[Window Opens] --> B[Check Cache]
    B -->|Hit| C[Use Cached Data]
    B -->|Miss| D[Use Fallback Avatar]

    D --> E[Window Shows]
    C --> E

    E --> F[Background Fetch]
    F --> G[Update Cache]
    G --> H[Broadcast Update]
    H --> I[Windows Update UI]

    J[Periodic Job] -->|Every 1hr| F
    K[User Refresh] --> F

    style E fill:#9f6,stroke:#333,stroke-width:2px
    style F fill:#69f,stroke:#333,stroke-width:2px
```

### Phase 3: Remove Artificial Delays

#### 3.1 Event-Driven Adapter Initialization

**Changes to:** `src/main/window/modernWindowManager.ts`

```typescript
// BEFORE
setTimeout(() => {
  window.window.loadURL(url);
}, 200);

// AFTER
// Wait for adapters to be ready, then load
this.waitForAdaptersReady().then(() => {
  window.window.loadURL(url);
});

private async waitForAdaptersReady(): Promise<void> {
  const promises: Promise<void>[] = [];

  if (this.features.fileSystemAdapter) {
    promises.push(this.fileSystemAdapter.ready());
  }
  if (this.features.githubAdapter) {
    promises.push(this.githubAdapter.ready());
  }
  if (this.features.windowManagerAdapter) {
    promises.push(this.windowManagerAdapter.ready());
  }

  await Promise.all(promises);
}
```

### Phase 4: Future Event-Driven Architecture

#### 4.1 GitHub Webhook Integration

```mermaid
sequenceDiagram
    participant GitHub
    participant Webhook as Webhook Server
    participant App as Electron App
    participant Window as Repo Window

    GitHub->>Webhook: Push event
    Webhook->>App: Forward event
    App->>App: Parse event data
    App->>Window: IPC: Repository updated
    Window->>Window: Show notification

    alt User accepts
        Window->>App: Refresh git status
        App->>Window: Updated data
    else User dismisses
        Window->>Window: Ignore
    end
```

#### 4.2 User-Controlled Refresh

```mermaid
graph TD
    A[Repository Window] --> B[Git Status Section]
    B --> C[Current Branch: main]
    B --> D[Last Updated: 2m ago]
    B --> E[Refresh Button]

    E -->|Click| F{Refresh Type}
    F -->|Quick| G[Fetch Branch Only]
    F -->|Full| H[Fetch All Git Data]

    G --> I[Update UI]
    H --> I

    J[Auto Refresh] -->|Every 5m| G
    K[GitHub Webhook] -->|Event| G

    style E fill:#69f,stroke:#333,stroke-width:2px
    style J fill:#f96,stroke:#333,stroke-width:2px
    style K fill:#f96,stroke:#333,stroke-width:2px
```

## Expected Performance Improvements

### Before vs After Comparison

```mermaid
gantt
    title Window Opening Timeline Comparison
    dateFormat X
    axisFormat %Lms

    section Current (Blocking)
    Database Query: 0, 200
    Git Branch Info: 0, 1500
    GitHub API Call: 0, 2000
    Avatar Download: 0, 800
    200ms Delay: 2000, 200
    Window Creation: 2200, 300
    Window Visible: milestone, 2500, 0

    section Proposed (Non-blocking)
    Database Query: 0, 50
    Window Creation: 50, 200
    Window Visible: milestone, 250, 0
    Git Branch Info (Async): 250, 1000
    GitHub API Call (Async): 250, 1500
    UI Updates: 1250, 100
```

### Metrics

| Metric | Current | Proposed | Improvement |
|--------|---------|----------|-------------|
| Time to window visible | 2-5 seconds | 200-500ms | **80-90% faster** |
| Blocking operations | 4 | 1 | **75% reduction** |
| Network calls blocking UI | 2 | 0 | **100% reduction** |
| User perceived performance | Poor | Excellent | **Instant feedback** |

## Implementation Checklist

### Phase 1: Git Decoupling
- [ ] Create `GitStatusService` with caching
- [ ] Add IPC handlers for git status updates
- [ ] Update `modernWindowHandlers.ts` to use async git calls
- [ ] Add loading states to repository window UI
- [ ] Add manual refresh button for git status
- [ ] Implement status staleness detection
- [ ] Add periodic refresh capability

### Phase 2: Metadata Decoupling
- [ ] Create `RepositoryMetadataService` with caching
- [ ] Move GitHub API calls to background
- [ ] Add fallback avatars (use GitHub URL placeholder)
- [ ] Broadcast metadata updates to open windows
- [ ] Implement cache expiration (1 hour)
- [ ] Add manual metadata refresh option

### Phase 3: Delay Removal
- [ ] Add `ready()` method to all adapters
- [ ] Replace `setTimeout` with `waitForAdaptersReady()`
- [ ] Add adapter initialization timeout (5s)
- [ ] Add error handling for adapter init failures

### Phase 4: Event-Driven (Future)
- [ ] Design GitHub webhook integration
- [ ] Create webhook server for localhost
- [ ] Add webhook configuration UI
- [ ] Implement event parsing and routing
- [ ] Add user preferences for auto-refresh intervals
- [ ] Create notification system for repository changes

## Migration Strategy

### Step 1: Add New Services (Non-breaking)
Add the new `GitStatusService` and `RepositoryMetadataService` alongside existing code. These services should include the old blocking behavior as a fallback.

### Step 2: Feature Flag
Add a feature flag to toggle between old and new behavior:
```typescript
const USE_ASYNC_GIT_STATUS = process.env.ASYNC_GIT_STATUS === 'true';
```

### Step 3: Gradual Rollout
1. Internal testing with feature flag enabled
2. Beta release with opt-in
3. Default enabled for new windows
4. Remove old code after 2 releases

### Step 4: Monitor Performance
Track metrics:
- Time to window visible
- User interactions with refresh button
- Cache hit rates
- Error rates for async operations

## Benefits

### Immediate (Phase 1-3)
- **Instant window opening** (200-500ms vs 2-5 seconds)
- **Better user experience** (progressive loading)
- **More responsive app** (no blocking operations)
- **Reduced network load** (cached data)

### Future (Phase 4)
- **Real-time updates** (GitHub webhooks)
- **User control** (manual refresh, intervals)
- **Scalability** (event-driven architecture)
- **Extensibility** (easy to add more data sources)

## Risks & Mitigations

### Risk: Stale Data
**Mitigation:**
- Show "last updated" timestamp
- Visual indicator for stale data
- Easy refresh button
- Automatic background refresh

### Risk: Race Conditions
**Mitigation:**
- Use proper state management
- Cancel in-flight requests on window close
- Sequence ID for updates

### Risk: Error Handling
**Mitigation:**
- Graceful fallbacks for failed requests
- Retry logic with exponential backoff
- Clear error messages to user
- Fallback to blocking mode on repeated failures

## References

### Related Files
- `src/main/window/modernWindowHandlers.ts` - Window opening handlers
- `src/main/window/modernWindowManager.ts` - Window creation
- `src/main/version-control-providers/gitBranchService.ts` - Git operations
- `src/main/stores/RepositoryApiEventHandler.ts` - Repository metadata
- `src/renderer/repo-manager/RepoManagerApp.tsx` - Repository window UI

### Related Issues
- TODO at `src/main/stores/RepositoryApiEventHandler.ts:465` - Blocking git operations
- TODO at `src/main/version-control-providers/gitBranchService.ts:88` - Remote operations

### Design Documents
- `docs/design/GIT_REMOTE_INFORMATION_ARCHITECTURE.md` (referenced in TODOs)
