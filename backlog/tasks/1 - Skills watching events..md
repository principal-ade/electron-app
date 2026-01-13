---
status: Completed
priority: medium
createdDate: 2026-01-12
updatedDate: 2026-01-12
completedDate: 2026-01-12
---

# Skills watching events.

We added global skill watching recently and now want to incorporate watching of those global directories into our application.  Can you make a lifecycle off that explains how we would handle changes in the clones of the global skill directories

---

## Current Implementation Overview

The global skills system uses a **periodic sync model with Git-based change detection**. We want to enhance this with **real-time watching and user-confirmed syncing**:

- **Clone Locations**: `userData/agent-skills/clones/{directory-name}/`
- **Target Directories**: `~/.agent/skills/`, `~/.claude/skills/`, `~/.cursor/skills/`, `~/.windsurf/skills/`
- **Services**:
  - `SkillsConfigService` - Config management
  - `SkillsGitService` - Git operations
  - `SkillsSyncService` - Orchestration

## Desired Workflow (Watch-Notify-Confirm)

### Key Principle: **No Automatic Syncing**

Skills watching uses a **manual confirmation workflow** where users have full control:

1. **Watch** 👁️ - Monitor clone directories for file changes (via Repository Monitoring Server)
2. **Detect** 🔍 - Analyze changes and identify affected skills (*.md files)
3. **Notify** 🔔 - Show badge/notification when changes are pending
4. **Review** 📋 - User opens UI to see detailed list of pending changes
   - View diffs for each changed skill
   - Select which skills to sync (checkboxes)
   - Resolve conflicts if any exist
5. **Confirm** ✅ - User clicks "Commit & Sync" button
6. **Sync** ⚡ - Execute git operations and copy selected skills to target directories
7. **Complete** ✓ - Show success notification and update UI

### What This Means:
- **NO periodic automatic syncing** - Watching only, no auto-sync fallback
- **NO automatic sync on file change** - Changes accumulate as "pending"
- **YES user confirmation required** - Every sync must be manually triggered
- **YES selective syncing** - User can choose which skills to sync
- **YES conflict resolution** - User decides how to handle conflicts

This gives users complete visibility and control over what gets synced to their target directories.

## Visual Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                   SKILLS WATCHING WORKFLOW                       │
└─────────────────────────────────────────────────────────────────┘

   [App Starts]
        │
        ▼
   [Register Clone Directories with Repo Monitoring]
   (Phase 1: Initialization)
        │
        ▼
   [Repository Monitoring Server Watches Clones]
   (chokidar watching via GitWatcherAdapter)
        │
        │ (file changed in clone)
        ▼
   [WORKSPACE_CHANGED Event Emitted]
   (worker → main → renderer)
        │
        ▼
   [Analyze Changes & Store as Pending]
   (Phase 2: Detection)
   - Extract skill names from changed files
   - Get git diff for preview
   - Check for conflicts
        │
        ▼
   ┌───────────────────────────────────┐
   │  🔔 UI Shows Pending Changes      │
   │  Badge: "3 pending changes"       │
   │  (Phase 3: Notification)          │
   └───────────────────────────────────┘
        │
        │ (user waits... changes accumulate)
        │
        │ (user opens skills panel)
        ▼
   ┌───────────────────────────────────┐
   │  📋 Pending Changes Panel         │
   │                                   │
   │  Claude Skills (3 changes)        │
   │  ├─ ☑ commit.md (modified)        │
   │  ├─ ☑ review-pr.md (modified)     │
   │  └─ ☐ deprecated.md (deleted)     │
   │                                   │
   │  ⚠️ 1 conflict detected           │
   │  commit.md has local changes      │
   │  Resolution: ○ Keep ● Use Remote  │
   │                                   │
   │  [Review] [Commit & Sync] [Ignore]│
   └───────────────────────────────────┘
        │
        │ (user reviews, selects, resolves conflicts)
        │
        │ (user clicks "Commit & Sync")
        ▼
   [Validate Selection]
   (Phase 4: User Confirmation)
   - At least one change selected?
   - All conflicts resolved?
        │
        ▼
   ┌───────────────────────────────────┐
   │  ⚡ Syncing... (2 of 2 skills)    │
   │  [████████░░] 80%                 │
   │  Copying commit.md...             │
   └───────────────────────────────────┘
        │
        ▼
   [Git Fetch & Pull]
   (Phase 5: Git Operations)
   - Fetch from remote
   - Pull changes
   - Apply conflict resolutions
        │
        ▼
   [Copy Selected Skills to Target]
   (Phase 6: Sync)
   - Only copy user-selected skills
   - Update metadata
   - Track synced skills
        │
        ▼
   [Clear Pending Changes & Update UI]
   (Phase 7: Cleanup)
   - Remove from pending list
   - Clear badge
   - Show success toast
        │
        ▼
   ┌───────────────────────────────────┐
   │  ✓ Synced 2 skills to             │
   │    Claude Skills                  │
   └───────────────────────────────────┘
        │
        ▼
   [Back to Watching...]
   (loop continues)
```

## Change Handling Lifecycle (Integrated with Repository Monitoring)

### Phase 1: Initialization & Registration

```
Application Start
    ↓
initializeServices() (initialization.ts)
    ├── Repository Monitoring Server starts (worker process)
    └── registerFileSystemIpcHandlers() (fileSystemHandlers.ts:142)
    ↓
Skills Services Instantiation (fileSystemHandlers.ts:1140-1147)
    ├── SkillsConfigService.initialize()
    │   ├── Load config from ~/.config/agent-skills/config.json
    │   ├── Validate global directory configurations
    │   └── Return configuration object
    ├── SkillsGitService.initialize()
    │   ├── Verify git client availability
    │   └── Set up repository references
    └── SkillsSyncService.initialize()
        ├── Get sync configuration
        ├── Register clone directories with Repository Monitoring
        │   └── For each enabled directory:
        │       ├── RepositoryMonitoringService.register(localClonePath)
        │       └── RepositoryMonitoringService.acquireWatch(localClonePath, watchRef)
        ├── Set up IPC event listeners (WORKSPACE_CHANGED, GIT_STATUS_CHANGED)
        ├── Set up periodic sync timer (if autoSyncInterval > 0)
        └── Trigger startup sync (if syncOnStartup enabled, 5s delay)
```

**Key Files**:
- `src/main/initialization.ts`
- `src/main/repository-monitoring/ipcHandlers.ts` - Repository monitoring IPC
- `src/main/file-system/fileSystemHandlers.ts:1140-1147` - Skills service setup
- `src/main/services/SkillsSyncService.ts:47-80` - Skills initialization

### Phase 2: Real-Time File Watching & Change Detection

```
Repository Monitoring Server (Worker Process)
    ↓
GitWatcherAdapter monitors localClonePath
    ├── chokidar watches for file changes
    ├── Ignores .git/, node_modules/, etc.
    └── Detects: 'add', 'change', 'unlink' events
    ↓
File Change Detected in Clone
    ↓
Worker Process → Main Process (IPC)
    ├── Emits: WORKSPACE_CHANGED event
    │   └── Payload: { repoPath: localClonePath, changes: [...] }
    └── Emits: GIT_STATUS_CHANGED event (if git status changed)
        └── Payload: { repoPath, branch, ahead, behind, dirty, ... }
    ↓
Main Process (ipcHandlers.ts)
    ├── Receives events from worker
    └── Broadcasts to relevant windows
        └── webContents.send(event, payload)
    ↓
Skills Service (Renderer)
    ├── Receives: RepositoryMonitoringAPIEvent.WORKSPACE_CHANGED
    ├── handleCloneChange(clonePath, changes)
    │   ├── Find GlobalSkillDirectory by localClonePath
    │   ├── Filter: only if directory.enabled
    │   ├── Debounce: 1000ms (batch rapid changes)
    │   └── Analyze changes:
    │       ├── Identify affected skill files (*.md)
    │       ├── Get git diff for each changed skill
    │       └── Store pending changes in state
    └── Update UI state with pending changes
```

**Event Flow**:
```
Clone Directory File Change
    → GitWatcherAdapter (worker)
    → RepositoryMonitoringServer (worker)
    → Main Process IPC Handler
    → Renderer Windows (broadcast)
    → SkillsSyncService event listener
    → Analyze and store pending changes
    → Update UI badge/notification
```

**Key Files**:
- `@principal-ai/repository-monitoring-server` - Worker process with GitWatcherAdapter
- `src/main/repository-monitoring/ipcHandlers.ts:602-613` - Event forwarding
- `src/main/services/SkillsSyncService.ts` - Event listeners and change tracking

### Phase 3: User Notification & Review

```
Pending Changes Detected
    ↓
Update UI Indicators
    ├── Show badge on skills settings icon (e.g., "2 pending")
    ├── Optional: Show desktop notification
    │   └── "Global skills have changed. Review changes?"
    └── Update skills panel status indicator
    ↓
User Opens Skills Panel
    ↓
Display Pending Changes UI
    ├── List each directory with changes
    │   ├── Directory name (e.g., "Claude Skills")
    │   ├── Change count (e.g., "3 modified, 1 added")
    │   └── Expandable details:
    │       ├── For each changed skill:
    │       │   ├── Skill name
    │       │   ├── Change type (modified/added/deleted)
    │       │   ├── Git diff preview
    │       │   └── Checkbox to include/exclude
    │       └── "View All Changes" button
    ├── Conflict warnings (if any)
    │   └── "⚠️ 2 skills conflict with local modifications"
    └── Action buttons:
        ├── "Review Changes" - Opens diff viewer
        ├── "Commit & Sync" - Primary action
        ├── "Discard Changes" - Revert to remote
        └── "Ignore" - Dismiss notification
```

**UI Components**:
```typescript
// Pending changes state
interface PendingSkillChanges {
  directoryId: string;
  displayName: string;
  changes: SkillChange[];
  conflicts: SkillConflict[];
  lastDetected: Date;
}

interface SkillChange {
  skillName: string;
  changeType: 'added' | 'modified' | 'deleted';
  diff?: string;
  include: boolean;  // User can select/deselect
}

interface SkillConflict {
  skillName: string;
  cloneVersion: string;
  targetVersion: string;
  resolutionRequired: boolean;
}
```

**Key Files**:
- `src/renderer/principal-window/views/SkillBrowserView/PendingChangesPanel.tsx` - New UI component
- `src/renderer/hooks/useSkillsPendingChanges.ts` - React hook for pending changes state

### Phase 4: User Confirms Commit & Sync

```
User Clicks "Commit & Sync" Button
    ↓
Validate User Selection
    ├── Check that at least one change is included
    ├── Verify all conflicts are resolved (if resolutionStrategy = 'prompt')
    └── Confirm directory is still enabled
    ↓
Show Progress UI
    ├── Progress bar or spinner
    ├── Status text: "Fetching updates..."
    └── Cancel button (optional)
    ↓
Trigger Sync Operation
    └── Call: SkillsSyncService.syncSingleDirectory(directoryId, userSelection)
        └── Passes user's change selections and conflict resolutions
```

**User Selection Data**:
```typescript
interface UserSyncSelection {
  directoryId: string;
  includedChanges: string[];  // Skill names user selected
  conflictResolutions: Map<string, 'keep-local' | 'use-remote'>;
  commitMessage?: string;     // Optional custom commit message
}
```

**Key Files**:
- `src/renderer/principal-window/views/SkillBrowserView/PendingChangesPanel.tsx` - Collects user selection
- `src/main/services/SkillsSyncService.ts` - syncSingleDirectory method

### Phase 5: Git Operations (Fetch & Pull from Remote)

```
syncSingleDirectory(directoryId, userSelection)
    ↓
Step 1: Ensure Clone Exists
    ├── SkillsGitService.ensureClone()
    │   ├── Check if localClonePath exists
    │   ├── If NO: git clone {repository} {localClonePath}
    │   └── If YES: proceed
    ↓
Step 2: Fetch Remote Updates
    ├── Update UI: "Fetching from remote..."
    ├── SkillsGitService.fetchUpdates()
    │   ├── Get current commit SHA: git rev-parse HEAD
    │   ├── Fetch from remote: git fetch origin
    │   ├── Get remote SHA: git rev-parse origin/{branch}
    │   ├── Compare SHAs (beforeSha !== remoteSha)
    │   └── Return { hasUpdates: true, changedPaths: [...], currentSha }
    ↓
Step 3: Pull Changes to Clone
    ├── Update UI: "Pulling changes..."
    ├── SkillsGitService.pullChanges()
    │   ├── git pull origin {branch}
    │   ├── Handle merge conflicts (if any)
    │   └── Return updated commit SHA
    ↓
Step 4: Apply User's Conflict Resolutions
    ├── For each conflict in userSelection.conflictResolutions:
    │   ├── If 'keep-local': git checkout --ours {file}
    │   └── If 'use-remote': git checkout --theirs {file}
    └── git add {resolved files}
```

**Key Implementation** (`SkillsGitService.ts:113-166`):
```typescript
async fetchUpdates(): Promise<FetchUpdatesResult> {
  const beforeSha = await this.getCurrentCommitSha();
  const git = await GitClientFactory.getClient(localPath);
  await git.raw(['fetch'], { cwd: localPath });

  const remoteSha = await git.raw(['rev-parse', `origin/${config.branch}`]);
  const hasUpdates = beforeSha !== remoteSha.trim();

  if (hasUpdates) {
    const diffResult = await git.raw(['diff', '--name-only', beforeSha, remoteSha]);
    const changedPaths = diffResult.trim().split('\n');
    return { hasUpdates: true, changedPaths, currentSha };
  }

  return { hasUpdates: false, currentSha: beforeSha };
}
```

### Phase 6: Sync to Target Directories

```
Clone Updated with Remote Changes
    ↓
Step 1: Filter Skills Based on User Selection
    ├── Get userSelection.includedChanges (skill names to sync)
    ├── Filter changed files to only included skills
    └── Skip any skills user unchecked
    ↓
Step 2: Copy Skills to Target Directory
    ├── Update UI: "Copying skills to target..."
    ├── For each included skill:
    │   ├── Read file from clone: fs.readFile(clonePath/skill.md)
    │   ├── Write to target: fs.writeFile(targetPath/skill.md)
    │   ├── Update .metadata.json:
    │   │   ├── lastSyncedAt: now()
    │   │   ├── sourceCommit: currentSha
    │   │   └── syncedBy: 'user-confirmed'
    │   └── Track successfully synced skills
    ↓
Step 3: Handle Deleted Skills (if any)
    ├── For deleted skills in userSelection:
    │   ├── Remove from target directory
    │   └── Update .metadata.json
    ↓
Step 4: Update Sync State
    ├── Set lastSyncSuccess = now()
    ├── Clear pending changes for this directory
    ├── Update directory.lastSyncedAt timestamp
    └── Persist updated config to disk
    ↓
Step 5: Emit Success Event
    ├── Emit: SKILLS_SYNCED event
    │   └── Payload: { directoryId, syncedSkills: [...], timestamp }
    └── Update UI: "Sync complete! ✓"
```

**Progress Updates During Sync**:
```typescript
// Progress events sent to UI
interface SyncProgressEvent {
  directoryId: string;
  stage: 'fetching' | 'pulling' | 'copying' | 'complete' | 'error';
  message: string;
  progress?: number;  // 0-100
  details?: {
    current?: number;
    total?: number;
    skillName?: string;
  };
}
```

**Key Files**:
- `src/main/services/SkillsGitService.ts:168-217` (pullChanges)
- `src/main/services/SkillsSyncService.ts:236-339` (syncSingleDirectory)
- `src/main/services/SkillsConfigService.ts` (metadata management)

### Phase 7: UI Updates & Cleanup

```
Sync Complete Event Received
    ↓
Step 1: Clear Pending Changes State
    ├── Remove synced directory from pending changes list
    ├── Clear badge/notification indicator
    └── Update last sync timestamp in UI
    ↓
Step 2: Show Success Notification
    ├── Toast notification: "✓ Synced 5 skills to Claude Skills"
    ├── Optional: Desktop notification
    └── Update directory status indicator
    ↓
Step 3: Refresh Skills List
    ├── Reload skills from target directory
    ├── Highlight newly synced skills (temporary visual indicator)
    └── Update skills browser if open
    ↓
Step 4: Log Sync Activity
    ├── Add entry to sync history/log
    │   └── { timestamp, directory, skillCount, commit }
    └── Persist sync history for user reference
```

**UI State Management**:
```typescript
// React hook for managing pending changes
function useSkillsPendingChanges() {
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingSkillChanges>>();

  // Listen for workspace change events
  useEffect(() => {
    const handler = (event: WorkspaceChangeEventPayload) => {
      // Add/update pending changes
      analyzePendingChanges(event.repoPath, event.changes);
    };

    ipcRenderer.on(RepositoryMonitoringAPIEvent.WORKSPACE_CHANGED, handler);
    return () => ipcRenderer.off(RepositoryMonitoringAPIEvent.WORKSPACE_CHANGED, handler);
  }, []);

  // Listen for sync complete events
  useEffect(() => {
    const handler = (event: SkillsSyncedEvent) => {
      // Clear pending changes for synced directory
      setPendingChanges(prev => {
        const next = new Map(prev);
        next.delete(event.directoryId);
        return next;
      });
    };

    ipcRenderer.on(FileSystemAPIEvent.SKILLS_SYNCED, handler);
    return () => ipcRenderer.off(FileSystemAPIEvent.SKILLS_SYNCED, handler);
  }, []);

  return {
    pendingChanges,
    hasPendingChanges: pendingChanges.size > 0,
    totalPendingCount: Array.from(pendingChanges.values())
      .reduce((sum, pc) => sum + pc.changes.length, 0)
  };
}
```

**Renderer Integration**:
- `src/renderer/hooks/useSkillsPendingChanges.ts` - React hook for pending changes
- `src/renderer/principal-window/views/SkillBrowserView/PendingChangesPanel.tsx` - Pending changes UI
- `src/renderer/principal-window/views/SkillBrowserView/GlobalDirectoriesConfig.tsx` - Directory management UI

## Error Handling Throughout Lifecycle

### Error Categories

1. **Network Errors** (Phase 3: fetchUpdates)
   ```
   Git Fetch Failed
       ↓
   Catch Exception
       ├── Log error details
       ├── Set syncState.lastError = error.message
       ├── Increment retry counter
       └── If retries < maxRetries:
           └── Schedule retry with exponential backoff
   ```

2. **Merge Conflicts** (Phase 4: pullChanges)
   ```
   Git Pull Conflict
       ↓
   Detect Conflict State
       ├── Parse git status output
       ├── Identify conflicting files
       ├── Add to syncState.conflictingSkills
       └── Apply conflict resolution strategy
           ├── If 'prompt': notify user and wait
           └── If 'overwrite': git reset --hard origin/{branch}
   ```

3. **Filesystem Errors** (Phase 4: copy operations)
   ```
   Copy Failed
       ↓
   Catch EACCES / ENOENT / etc
       ├── Log specific error
       ├── Mark skill as failed in syncState
       ├── Continue with other skills (don't abort entire sync)
       └── Report partial sync success
   ```

4. **Configuration Errors** (Phase 1: initialization)
   ```
   Invalid Config
       ↓
   Validation Failed
       ├── Log validation errors
       ├── Use default configuration
       ├── Notify user of config issues
       └── Attempt to auto-repair config.json
   ```

## Integration with Repository Monitoring Server

### Architecture Overview

The application already has a **Repository Monitoring Server** (`@principal-ai/repository-monitoring-server`) that runs as a separate worker process and provides:
- Git repository watching via `GitWatcherAdapter` (using chokidar)
- File change detection and events
- Git status monitoring
- Centralized IPC communication

**Key Files**:
- `src/main/repository-monitoring/ipcHandlers.ts` - IPC handlers and event forwarding
- Repository Monitoring Server worker process - Handles watching and git operations

### Leveraging Repository Monitoring for Skills

Since each global skill directory clone is a **git repository**, we should register them with the Repository Monitoring Server:

```
Skills Watching Lifecycle Using Repository Monitoring Server
    ↓
Initialization Phase (SkillsSyncService.initialize)
    ├── Existing: Load config and set up periodic sync
    └── NEW: Register skill clone directories with Repository Monitoring
        └── For each enabled GlobalSkillDirectory:
            ├── Call RepositoryMonitoringService.register(localClonePath)
            └── Call RepositoryMonitoringService.acquireWatch(localClonePath, watchRef)
    ↓
Repository Monitoring Server (Worker Process)
    ├── GitWatcherAdapter watches each clone directory
    ├── Detects file changes (add, change, unlink)
    ├── Emits WORKSPACE_CHANGED events
    └── Emits GIT_STATUS_CHANGED events
    ↓
IPC Event Forwarding (ipcHandlers.ts)
    ├── manager.on('workspace-changed', payload => ...)
    └── Broadcasts to relevant renderer windows
    ↓
Skills Service Receives Events
    ├── Listen for RepositoryMonitoringAPIEvent.WORKSPACE_CHANGED
    ├── Filter events by localClonePath
    ├── Debounce rapid changes (500-1000ms)
    └── Trigger: syncSingleDirectory(directoryId)
        └── (Proceeds through Phase 2-5: fetch, pull, analyze, sync)
```

### Implementation Using Repository Monitoring

**1. Register Clone Directories on Initialization**:
```typescript
// In SkillsSyncService.ts
import { RepositoryMonitoringService } from '../../renderer/main-process-api/RepositoryMonitoringService';
import { RepositoryMonitoringAPIEvent } from '@principal-ai/repository-monitoring-server';

async initialize(): Promise<void> {
  const config = await this.configService.getConfig();
  await this.gitService.initialize();

  // Register each clone directory with repository monitoring
  for (const directory of config.globalDirectories) {
    if (directory.enabled && directory.localClonePath) {
      try {
        // Register the clone as a monitored repository
        await RepositoryMonitoringService.register(directory.localClonePath);

        // Acquire a watch reference for this skill directory
        await RepositoryMonitoringService.acquireWatch(
          directory.localClonePath,
          `skills-sync-${directory.id}`
        );

        console.log(`Registered skill clone for monitoring: ${directory.localClonePath}`);
      } catch (error) {
        console.error(`Failed to register skill clone ${directory.id}:`, error);
      }
    }
  }

  // Set up periodic sync if enabled
  if (config.autoSyncInterval && config.autoSyncInterval > 0) {
    this.startPeriodicSync(config.autoSyncInterval);
  }

  // Set up event listeners for file changes
  this.setupRepositoryMonitoringListeners();

  // Sync on startup if enabled
  if (config.syncOnStartup) {
    setTimeout(() => this.sync().catch(console.error), 5000);
  }
}
```

**2. Listen for Repository Events**:
```typescript
// In SkillsSyncService.ts
private debounceTimers = new Map<string, NodeJS.Timeout>();

private setupRepositoryMonitoringListeners(): void {
  // Listen for workspace changes (file add/change/delete)
  ipcRenderer.on(
    RepositoryMonitoringAPIEvent.WORKSPACE_CHANGED,
    (_event, payload: WorkspaceChangeEventPayload) => {
      this.handleCloneChange(payload.repoPath, payload.changes);
    }
  );

  // Listen for git status changes (commits, branch switches)
  ipcRenderer.on(
    RepositoryMonitoringAPIEvent.GIT_STATUS_CHANGED,
    (_event, payload: GitStatusWithFiles) => {
      this.handleGitStatusChange(payload.repoPath, payload);
    }
  );
}

private async handleCloneChange(
  clonePath: string,
  changes: FileChange[]
): Promise<void> {
  // Find the directory that owns this clone
  const config = await this.configService.getConfig();
  const directory = config.globalDirectories.find(
    d => d.localClonePath === clonePath
  );

  if (!directory || !directory.enabled) return;

  console.log(`File changes detected in ${directory.displayName}:`, changes);

  // Debounce rapid changes (batch within 1 second)
  clearTimeout(this.debounceTimers.get(directory.id));

  this.debounceTimers.set(directory.id, setTimeout(async () => {
    if (!this.isSyncing) {
      console.log(`Triggering sync for ${directory.displayName} due to file changes`);
      await this.syncSingleDirectory(directory.id);
    } else {
      console.log(`Sync already in progress for ${directory.displayName}, skipping`);
    }
  }, 1000));
}

private async handleGitStatusChange(
  clonePath: string,
  status: GitStatusWithFiles
): Promise<void> {
  // Find the directory
  const config = await this.configService.getConfig();
  const directory = config.globalDirectories.find(
    d => d.localClonePath === clonePath
  );

  if (!directory || !directory.enabled) return;

  // Git status changed - likely a commit or branch switch
  // This is different from file changes, so handle accordingly
  console.log(`Git status changed in ${directory.displayName}:`, {
    branch: status.branch,
    ahead: status.ahead,
    behind: status.behind,
    dirty: status.dirty
  });

  // If changes were pulled from remote (behind count decreased), sync to targets
  if (status.behind === 0 && !status.dirty) {
    await this.syncSingleDirectory(directory.id);
  }
}
```

**3. Cleanup on Shutdown**:
```typescript
// In SkillsSyncService.ts
async cleanup(): Promise<void> {
  const config = await this.configService.getConfig();

  // Release all watch references
  for (const directory of config.globalDirectories) {
    if (directory.localClonePath) {
      try {
        await RepositoryMonitoringService.releaseWatch(
          directory.localClonePath,
          `skills-sync-${directory.id}`
        );

        // Optionally unregister if no other watchers
        await RepositoryMonitoringService.unregister(directory.localClonePath);
      } catch (error) {
        console.error(`Failed to cleanup monitoring for ${directory.id}:`, error);
      }
    }
  }

  // Clear debounce timers
  this.debounceTimers.forEach(timer => clearTimeout(timer));
  this.debounceTimers.clear();
}
```

### Benefits of Using Repository Monitoring Server

1. **No Duplicate Watching Infrastructure**: Reuses existing chokidar watchers
2. **Centralized Process Management**: Worker process isolation prevents blocking
3. **Git-Aware**: Automatically gets git status, branch info, commit detection
4. **Event Broadcasting**: Built-in IPC event system to all windows
5. **Resource Efficient**: Single worker process handles all repository watching
6. **Reference Counting**: Automatic cleanup when watchers are released
7. **Proven Architecture**: Already tested and used for main repository monitoring

### Configuration Additions

Update the config schema to track monitoring state:

```typescript
interface GlobalSkillDirectory {
  id: string;
  path: string;
  displayName: string;
  enabled: boolean;
  isCustom: boolean;
  localClonePath: string;
  lastSyncedAt?: string;

  // NEW: Repository monitoring integration
  isMonitored?: boolean;        // Registered with repo monitoring
  watchReference?: string;      // Watch reference ID
}
```

## State Machine Diagram

```
┌─────────────┐
│   IDLE      │ ← Initial state
└─────────────┘
       ↓ (Timer tick or manual trigger)
┌─────────────┐
│  FETCHING   │ ← Checking for remote updates
└─────────────┘
       ↓
   ┌───┴────┐
   │        │
No Updates  Updates Detected
   │        │
   │    ┌─────────────┐
   │    │  PULLING    │ ← Applying changes to clone
   │    └─────────────┘
   │        ↓
   │    ┌─────────────┐
   │    │  ANALYZING  │ ← Identifying conflicts
   │    └─────────────┘
   │        ↓
   │    ┌───┴─────┐
   │    │         │
   │  Conflicts  No Conflicts
   │    │         │
   │    │         │
   │ ┌─────────────┐  │
   │ │ RESOLVING   │  │ ← Waiting for user input
   │ └─────────────┘  │
   │        │         │
   └────────┴─────────┘
            ↓
     ┌─────────────┐
     │   SYNCING   │ ← Copying to target directories
     └─────────────┘
            ↓
     ┌─────────────┐
     │  COMPLETE   │ ← Update metadata & state
     └─────────────┘
            ↓
     ┌─────────────┐
     │   IDLE      │ ← Back to idle
     └─────────────┘
```

## Configuration Schema

```typescript
interface SkillsSyncConfig {
  // Sync behavior
  autoSyncInterval: number;        // Minutes between syncs (0 = disabled)
  syncOnStartup: boolean;          // Sync 5s after app launch
  conflictResolution: 'preserve-local' | 'overwrite' | 'prompt';

  // NEW: Real-time watching
  enableRealtimeWatch: boolean;    // Watch clone directories for changes
  watchDebounceMs: number;         // Debounce delay for watch events

  // Directories
  globalDirectories: GlobalSkillDirectory[];

  // Repository
  repository: string;              // Git remote URL
  branch: string;                  // Git branch to track

  // Retry logic
  maxRetries: number;
  retryBackoffMs: number;
}
```

## IPC Event Flow

```
Renderer Process                Main Process
      │                              │
      ├─ SYNC_GLOBAL_SKILLS ────────→│
      │                              ├─ SkillsSyncService.sync()
      │                              │
      │                              ├─ (Phase 2-4 execution)
      │                              │
      │←─ SYNC_STATUS_UPDATED ───────┤
      │  { state: FETCHING }         │
      │                              │
      │←─ SYNC_STATUS_UPDATED ───────┤
      │  { state: PULLING }          │
      │                              │
      │←─ SYNC_STATUS_UPDATED ───────┤
      │  { state: ANALYZING }        │
      │                              │
      │←─ SKILL_CONFLICT_DETECTED ───┤ (if conflicts)
      │  { conflicts: [...] }        │
      │                              │
      ├─ RESOLVE_SKILL_CONFLICT ────→│ (user decision)
      │  { skillId, action }         │
      │                              │
      │←─ SYNC_STATUS_UPDATED ───────┤
      │  { state: SYNCING }          │
      │                              │
      │←─ SYNC_COMPLETE ─────────────┤
      │  { success: true,            │
      │    changedSkills: [...] }    │
      │                              │
```

## Implementation Tasks

### Phase 1: Repository Monitoring Integration (Foundation)
- [ ] Update `SkillsSyncService.initialize()` to register clone directories
  - [ ] Call `RepositoryMonitoringService.register(localClonePath)` for each enabled directory
  - [ ] Call `RepositoryMonitoringService.acquireWatch(localClonePath, watchRef)` with unique reference ID
  - [ ] Handle registration failures gracefully
- [ ] Implement `setupRepositoryMonitoringListeners()` method
  - [ ] Listen for `WORKSPACE_CHANGED` events
  - [ ] Listen for `GIT_STATUS_CHANGED` events
  - [ ] Filter events by `localClonePath` to identify relevant directories
- [ ] Implement `handleCloneChange()` event handler
  - [ ] Find corresponding `GlobalSkillDirectory` by `localClonePath`
  - [ ] Debounce rapid changes (1000ms) to batch events
  - [ ] Analyze changed files to identify affected skills (*.md files)
  - [ ] Store pending changes in state (don't auto-sync)
- [ ] Add `cleanup()` method
  - [ ] Release watch references on shutdown: `releaseWatch(localClonePath, watchRef)`
  - [ ] Clear debounce timers
  - [ ] Optionally unregister repositories
- [ ] Update `GlobalSkillDirectory` interface
  - [ ] Add `isMonitored?: boolean` - Tracking registration state
  - [ ] Add `watchReference?: string` - Watch reference ID
  - [ ] Add `pendingChangesCount?: number` - Number of pending changes
- [ ] Test event flow
  - [ ] Verify: file change → worker → main → renderer → state update
  - [ ] Test multiple directories simultaneously
  - [ ] Test cleanup on app shutdown

### Phase 2: Pending Changes UI (User Notification)
- [ ] Create `PendingChangesPanel.tsx` component
  - [ ] Display list of directories with pending changes
  - [ ] Show change count and types (added/modified/deleted)
  - [ ] Expandable details for each changed skill
  - [ ] Git diff preview for each change
  - [ ] Checkboxes to include/exclude specific skills
  - [ ] Conflict warnings with resolution options
- [ ] Create `useSkillsPendingChanges.ts` React hook
  - [ ] State management for pending changes Map
  - [ ] Listen for `WORKSPACE_CHANGED` events
  - [ ] Listen for `SKILLS_SYNCED` events to clear state
  - [ ] Compute total pending count for badges
  - [ ] Provide methods to analyze and filter changes
- [ ] Add UI indicators
  - [ ] Badge on skills settings icon (e.g., "3 pending")
  - [ ] Status indicator in GlobalDirectoriesConfig
  - [ ] Optional: Desktop notification when changes detected
- [ ] Implement change analysis
  - [ ] Parse file change events to extract skill names
  - [ ] Call git diff to get change details
  - [ ] Detect conflicts with target directory files
  - [ ] Store change metadata (type, diff, timestamp)

### Phase 3: User-Confirmed Sync (Action Buttons)
- [ ] Add action buttons to PendingChangesPanel
  - [ ] "Review Changes" - Opens detailed diff viewer
  - [ ] "Commit & Sync" - Primary action (triggers sync)
  - [ ] "Discard Changes" - Revert clone to remote state
  - [ ] "Ignore" - Dismiss notification (keep changes pending)
- [ ] Implement "Commit & Sync" flow
  - [ ] Validate user selection (at least one change included)
  - [ ] Verify conflicts are resolved
  - [ ] Show progress UI (spinner, status text)
  - [ ] Call `SkillsSyncService.syncSingleDirectory(directoryId, userSelection)`
  - [ ] Pass user's change selections and conflict resolutions
- [ ] Create `UserSyncSelection` data structure
  - [ ] Track which skills user selected
  - [ ] Track conflict resolutions per skill
  - [ ] Optional: custom commit message
- [ ] Implement progress updates
  - [ ] Emit `SYNC_PROGRESS` events during sync
  - [ ] Update UI with current stage (fetching/pulling/copying)
  - [ ] Show progress percentage and current skill being processed
  - [ ] Handle cancellation (if implemented)

### Phase 4: Enhanced Sync Logic (Selective Sync)
- [ ] Update `syncSingleDirectory()` to accept `UserSyncSelection`
  - [ ] Filter changed files based on user's included skills
  - [ ] Skip skills user unchecked
  - [ ] Apply user's conflict resolutions
- [ ] Implement selective file copying
  - [ ] Only copy skills user selected
  - [ ] Respect user's conflict resolution choices
  - [ ] Update metadata for synced skills only
- [ ] Add progress reporting
  - [ ] Emit progress events at each stage
  - [ ] Track current/total skills being synced
  - [ ] Report errors per-skill (don't fail entire sync)
- [ ] Emit `SKILLS_SYNCED` event on completion
  - [ ] Include list of synced skills
  - [ ] Include timestamp and commit SHA
  - [ ] Trigger UI cleanup and refresh

### Phase 5: Conflict Resolution
- [ ] Create conflict resolution UI
  - [ ] Side-by-side diff viewer
  - [ ] "Keep Local" vs "Use Remote" buttons per conflict
  - [ ] "Resolve All" batch action
  - [ ] Preview of resolved state
- [ ] Implement conflict detection
  - [ ] Compare clone version vs target version
  - [ ] Check timestamps and content hashes
  - [ ] Identify files modified in both locations
- [ ] Add resolution strategies
  - [ ] User-selected per-skill resolution
  - [ ] Default strategy preference (save in config)
  - [ ] Conflict history/tracking

### Phase 6: Testing & Polish
- [ ] Unit tests
  - [ ] Test event handling and debouncing
  - [ ] Test pending changes state management
  - [ ] Test selective sync logic
  - [ ] Test conflict resolution
- [ ] Integration tests
  - [ ] Full flow: watch → detect → notify → sync
  - [ ] Multiple directories with simultaneous changes
  - [ ] Conflict scenarios
  - [ ] Error handling and recovery
- [ ] Performance testing
  - [ ] Large number of pending changes
  - [ ] Rapid file changes (debouncing effectiveness)
  - [ ] Memory usage with multiple watched directories
- [ ] User experience polish
  - [ ] Smooth animations and transitions
  - [ ] Clear error messages
  - [ ] Helpful tooltips and guidance
  - [ ] Keyboard shortcuts for common actions

### Phase 7: Optional Enhancements
- [ ] Sync history log
  - [ ] Track all sync operations
  - [ ] Show timestamp, directory, skill count, commit
  - [ ] Allow viewing past sync events
- [ ] Auto-sync option (per directory)
  - [ ] Config flag to enable automatic syncing
  - [ ] Still show notification but auto-confirm
  - [ ] Safety: only for non-conflicting changes
- [ ] Batch operations
  - [ ] "Sync All" button for multiple directories
  - [ ] "Resolve All Conflicts" with same strategy
- [ ] Advanced diff viewer
  - [ ] Syntax highlighting for markdown
  - [ ] Inline editing to resolve conflicts
  - [ ] Copy changes between versions

## Key Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| `src/main/services/SkillsSyncService.ts` | 47-80 | Initialization & periodic sync setup |
| `src/main/services/SkillsSyncService.ts` | 82-137 | Main sync orchestration |
| `src/main/services/SkillsSyncService.ts` | 236-339 | Single directory sync logic |
| `src/main/services/SkillsGitService.ts` | 113-166 | Git-based change detection |
| `src/main/services/SkillsGitService.ts` | 168-217 | Pull changes implementation |
| `src/main/services/SkillsConfigService.ts` | 25-305 | Configuration management |
| `src/main/file-system/fileSystemHandlers.ts` | 1140-1147 | Service instantiation |
| `src/shared/main-process-api-interfaces/FileSystemAPI.ts` | - | Type definitions & IPC events |
