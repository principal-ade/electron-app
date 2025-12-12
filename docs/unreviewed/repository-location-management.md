# Repository Location Management

## Overview

This document covers the **already implemented** functionality for managing repository locations within workspaces. This feature allows users to move existing repository clones to their workspace's designated directory.

The system provides functionality to:
1. Check if a repository is located in a workspace's suggested clone directory
2. Move a repository to a workspace's suggested clone directory
3. Update the Alexandria registry with the new path
4. Broadcast events when repositories are moved

---

## API Methods

### `isRepositoryInWorkspaceDirectory`

**File**: `src/main/stores/WorkspaceApiEventHandler.ts:144-166`

Checks if a repository is currently located under the workspace's `suggestedClonePath`.

```typescript
async isRepositoryInWorkspaceDirectory(
  repository: AlexandriaEntry,
  workspaceId: string
): Promise<boolean | null>
```

**Parameters**:
- `repository` - The AlexandriaEntry to check
- `workspaceId` - The workspace ID to check against

**Returns**:
- `true` - Repository is in the workspace directory
- `false` - Repository is NOT in the workspace directory
- `null` - Workspace has no `suggestedClonePath` configured

**Implementation Details**:
- Normalizes both paths for comparison
- Adds path separator to ensure directory boundary matching
- Uses `path.normalize()` for cross-platform compatibility

**Example**:
```typescript
// Workspace suggestedClonePath: /Users/me/Code/Personal
// Repository path: /Users/me/Code/Personal/my-repo
// Returns: true

// Repository path: /Users/me/Downloads/my-repo
// Returns: false

// Workspace has no suggestedClonePath
// Returns: null
```

---

### `moveRepositoryToWorkspaceDirectory`

**File**: `src/main/stores/WorkspaceApiEventHandler.ts:168-208`

Physically moves a repository directory to the workspace's `suggestedClonePath` and updates the Alexandria registry.

```typescript
async moveRepositoryToWorkspaceDirectory(
  repository: AlexandriaEntry,
  workspaceId: string
): Promise<string>
```

**Parameters**:
- `repository` - The AlexandriaEntry to move
- `workspaceId` - The destination workspace ID

**Returns**:
- `string` - The new absolute path of the repository

**Throws**:
- Error if workspace not found
- Error if workspace has no `suggestedClonePath`
- Error if target path already exists
- Error if file move fails

**Current Implementation Flow**:

```
1. ✅ Validate workspace exists
2. ✅ Validate workspace has suggestedClonePath
3. ✅ Construct target path: suggestedClonePath + repoName
4. ✅ Check target path doesn't exist
5. ✅ Ensure workspace directory exists
6. ✅ Move files using fs.move() with overwrite: false
7. ✅ Update Alexandria registry with new path
8. ✅ Broadcast MEMBERSHIP_CHANGED event
9. ✅ Return new path
```

**Recommended Implementation Flow** (with unregister/re-register):

```
1. ✅ Validate workspace exists
2. ✅ Validate workspace has suggestedClonePath
3. ✅ Check if repository has open window (PREVENT if true)
4. ✅ Construct target path: suggestedClonePath + repoName
5. ✅ Check target path doesn't exist
6. ⚡ NEW: Unregister repository from monitoring server
7. ⚡ NEW: Disable git watching if enabled
8. ✅ Ensure workspace directory exists
9. ✅ Move files using fs.move() with overwrite: false
10. ✅ Update Alexandria registry with new path
11. ⚡ NEW: Re-register repository with new path
12. ⚡ NEW: Re-enable git watching if it was enabled
13. ⚡ NEW: Broadcast REPOSITORY_UPDATED event (Alexandria)
14. ✅ Broadcast MEMBERSHIP_CHANGED event (Workspace)
15. ✅ Return new path
```

**Preventative Checks**:
- Workspace exists
- Workspace has `suggestedClonePath` configured
- Target path doesn't already exist
- Uses `overwrite: false` to prevent accidents

**What Gets Updated**:
- **File System**: Repository directory physically moved
- **Alexandria Registry**: `path` field in repository entry updated
- **Persisted**: Changes saved to `projects.json`

**What DOESN'T Get Updated** (Current Limitations):
- ❌ Git watchers (FSMonitor) - still watching old path
- ❌ Repository Monitoring Server - not notified of path change
- ❌ Open repository windows - not notified of path change
- ❌ Cached file trees - may reference old path

---

## Event Broadcasting

### Events Sent

**MEMBERSHIP_CHANGED Event**:
```typescript
{
  type: 'membership-changed',
  workspaceId: string,
  repositoryId: string
}
```

**Events NOT Sent**:
- ❌ `REPOSITORY_UPDATED` from Alexandria - path change not broadcast
- ❌ Repository monitoring events
- ❌ File system watch events

This creates a gap where other parts of the app don't know the repository path changed.

---

## UI Integration

### LocalProjectCard Component

**File**: `src/renderer/panels/components/LocalProjectCard.tsx:149-178`

Displays a "Move to workspace" button when:
- Repository is in a workspace
- Workspace has a `suggestedClonePath` configured
- Repository is NOT already in the workspace directory

**User Flow**:
1. User sees "Move to workspace" button with workspace path
2. User clicks button
3. Confirmation dialog appears
4. User confirms
5. Repository is moved
6. Success message shown
7. **Hard page reload** (`window.location.reload()`)

**Current Implementation**:
```typescript
const handleMoveToWorkspace = async (e: React.MouseEvent) => {
  e.stopPropagation();

  if (!confirm(`Move ${entry.name} to ${workspace.suggestedClonePath}?`)) {
    return;
  }

  try {
    setIsMoving(true);
    const newPath = await WorkspaceService.moveRepositoryToWorkspaceDirectory(
      entry,
      workspace.id
    );

    // Update local entry
    entry.path = newPath as typeof entry.path;
    setIsInWorkspaceDirectory(true);

    alert(`Successfully moved ${entry.name} to workspace directory!`);

    // Force reload to refresh all data
    window.location.reload();
  } catch (error) {
    alert(`Failed to move repository: ${error.message}`);
  } finally {
    setIsMoving(false);
  }
};
```

---

## Repository Monitoring System

### How Monitoring Works

**Key Finding**: Repositories are registered with the monitoring server **on app startup**, NOT when windows are opened.

#### Registration Lifecycle

**File**: `src/main/repository-monitoring/RepositoryRegistrationManager.ts`

1. **On App Startup**:
   - ALL repositories from Alexandria registry are registered
   - Happens in batches of 5 at a time
   - Registration is independent of windows being open

2. **Git Watching** (Conditional):
   - Can be enabled on startup via user preference: `enableGitWatchingOnStartup`
   - Default is **OFF** - watching only enabled when repository windows open
   - If OFF, monitoring server registers repos but doesn't enable FSMonitor

3. **Lifecycle Flow**:
   ```
   App Start → Register ALL repos → (Optional) Enable git watching for all
   Window Open → Enable git watching for specific repo (if not already enabled)
   ```

#### Important Distinction

- **Registered** = Repository known to monitoring server, basic state tracked
- **Watched** = FSMonitor enabled, actively tracking git changes with file watchers

### When to Unregister Before Moving

Since repositories are always registered, you should **unregister before moving** to avoid:
- Stale path references in monitoring server's internal map
- File watchers trying to watch non-existent old path
- Cache entries keyed by old path becoming invalid

---

## Feed Panels Requiring Event Updates

### High Priority (Must Update After Move)

#### 1. **Local Projects Panel** (`local-projects`)
- **Component**: `src/renderer/panels/components/LocalProjectsPanel.tsx`
- **Uses repository paths**: YES - displays all local repositories with paths
- **Impact**: Shows stale paths after move
- **Required Event**: `REPOSITORY_UPDATED` from Alexandria

#### 2. **Workspace Repositories Panel** (`workspace-entries`)
- **Component**: `src/renderer/panels/components/WorkspaceEntriesPanel.tsx`
- **Uses repository paths**: YES - displays repos in workspace
- **Impact**: Shows stale paths, "Move" button appears incorrectly
- **Critical**: This is where the "Move to workspace" button lives!
- **Required Event**: `REPOSITORY_UPDATED` + `MEMBERSHIP_CHANGED`

#### 3. **Git-Sync Diagnostic Panel** (`git-sync-diagnostic`) *[Optional Panel]*
- **Component**: `src/renderer/panels/components/GitSyncDiagnosticPanel.tsx`
- **Uses repository paths**: YES - diagnostic data tied to paths
- **Impact**: Diagnostics reference wrong path
- **Required Event**: `REPOSITORY_UPDATED`

### Medium Priority (May Need Update)

#### 4. **README Viewer Panel** (`readme-viewer`)
- **Component**: `src/renderer/panels/components/GitHubReadmePanel.tsx`
- **Uses repository paths**: MAYBE - if it caches local README paths
- **Impact**: May show stale content
- **Required Event**: `REPOSITORY_UPDATED` (if caching local paths)

#### 5. **Recent Commits Panel** (`recent-commits`)
- **Component**: `src/renderer/panels/components/RecentCommitsPanel.tsx`
- **Uses repository paths**: MAYBE - if it uses local git commands
- **Impact**: May show wrong commits
- **Required Event**: `REPOSITORY_UPDATED` (if using local git)

### Low Priority (No Update Needed)

These panels do NOT depend on repository paths:
- **Workspaces Panel** (`workspaces-list`) - Already subscribes to workspace events
- **GitHub Projects Panel** (`github-projects`) - GitHub API data only
- **Starred Panel** (`github-starred`) - GitHub starred repos
- **Graphs Panel** (`graphs-list`) - Graph metadata only
- **Live Presence Panel** (`presence`) - Shows who's online
- **GitHub Network Panel** (`github-social`) - GitHub social data

---

## Known Issues & Limitations

### 1. **Hard Page Reload Required**
- **Issue**: After moving, the UI does a full page reload
- **Why**: Workaround for missing proper event propagation
- **Impact**: Poor UX, loses UI state

### 2. **No Alexandria Update Event**
- **Issue**: `updateRepository()` doesn't broadcast `REPOSITORY_UPDATED` event
- **Why**: Event is only sent when using `refreshRepository()` method
- **Impact**: Feed panels show stale paths after move

### 3. **Repository Not Unregistered Before Move**
- **Issue**: Repository remains registered with old path during move
- **Why**: No unregister step in move flow
- **Impact**: Monitoring server has stale path reference

### 4. **Git Watchers Not Updated**
- **Issue**: If git watching enabled, FSMonitor still watches old path
- **Why**: No notification mechanism for path changes
- **Impact**: File changes at new location not detected

### 5. **Open Windows Not Updated**
- **Issue**: If repository has an open window, it's not notified
- **Why**: No path change events broadcast to windows
- **Impact**: Open window may break or show stale data

### 6. **No Rollback on Partial Failure**
- **Issue**: If registry update fails after moving files, files aren't moved back
- **Why**: No transaction/rollback mechanism
- **Impact**: Can leave system in inconsistent state

### 7. **Single Event Broadcast**
- **Issue**: Only `MEMBERSHIP_CHANGED` event sent
- **Why**: Move operation treated as membership change only
- **Impact**: Feed panels listening for path updates don't react

---

## Recommendations for Improvement

### Priority 1: Prevent Move if Window is Open ⚡ CRITICAL
```typescript
// In WorkspaceApiEventHandler.moveRepositoryToWorkspaceDirectory()
// Before moving:

const isWindowOpen = await WindowService.isRepositoryWindowOpen(repository);
if (isWindowOpen) {
  throw new Error(
    'Cannot move repository while it has an open window. ' +
    'Please close the repository window first.'
  );
}
```

### Priority 2: Unregister Before Move, Re-register After ⚡ CRITICAL
```typescript
// In WorkspaceApiEventHandler.moveRepositoryToWorkspaceDirectory()

// 1. Check if watching is enabled (so we can restore it)
const wasWatching = await this.monitoringManager.isGitWatchingEnabled(repository.path);

// 2. Disable watching and unregister
if (wasWatching) {
  await this.monitoringManager.disableGitWatching(repository.path);
}
await this.monitoringManager.unregisterRepository(repository.path);

// 3. Move files
await fs.move(repository.path, targetPath, { overwrite: false });

// 4. Update registry
await this.service.updateRepository(entry.name, { path: targetPath });

// 5. Re-register with new path
await this.monitoringManager.registerRepository(targetPath);
if (wasWatching) {
  await this.monitoringManager.enableGitWatching(targetPath);
}
```

### Priority 3: Broadcast REPOSITORY_UPDATED Event ⚡ CRITICAL
```typescript
// In WorkspaceApiEventHandler.moveRepositoryToWorkspaceDirectory()
// After updating repository:

// Get updated entry from registry
const updatedEntry = await this.service.getRepository(entry.name);

// Broadcast Alexandria repository update event for Feed panels
this.broadcastAlexandriaEvent(
  AlexandriaAPIEvent.REPOSITORY_UPDATED,
  updatedEntry
);

// Still broadcast workspace event
this.broadcastWorkspaceChange('membership-changed', undefined, workspaceId, repoId);
```

**Feed Panels that will update**:
- ✅ Local Projects Panel - receives `REPOSITORY_UPDATED`
- ✅ Workspace Repositories Panel - receives `REPOSITORY_UPDATED` + `MEMBERSHIP_CHANGED`
- ✅ Git-Sync Diagnostic Panel - receives `REPOSITORY_UPDATED`

### Priority 4: Remove Hard Reload
With proper events, the UI should update reactively:
```typescript
// In LocalProjectCard.tsx handleMoveToWorkspace()
// Remove this line:
// window.location.reload();

// Instead, just update local state and let events propagate:
entry.path = newPath as typeof entry.path;
setIsInWorkspaceDirectory(true);
alert(`Successfully moved ${entry.name} to workspace directory!`);
// Events will update all panels automatically
```

### Priority 5: Add Rollback Mechanism
```typescript
try {
  // Unregister
  await this.monitoringManager.unregisterRepository(repository.path);

  // Move files
  await fs.move(repository.path, targetPath, { overwrite: false });

  try {
    // Update registry
    await this.service.updateRepository(entry.name, { path: targetPath });

    // Re-register with new path
    await this.monitoringManager.registerRepository(targetPath);
  } catch (registryError) {
    // Rollback: move files back and re-register old path
    await fs.move(targetPath, repository.path);
    await this.monitoringManager.registerRepository(repository.path);
    throw registryError;
  }
} catch (error) {
  // Handle error
  throw new Error(`Failed to move repository: ${error.message}`);
}
```

---

## IPC Integration

### IPC Events
```typescript
IS_REPOSITORY_IN_WORKSPACE_DIRECTORY = 'workspace:is-repository-in-directory'
MOVE_REPOSITORY_TO_WORKSPACE_DIRECTORY = 'workspace:move-repository-to-directory'
```

### Preload Bridge
**File**: `src/window/main-process-api-implementations/workspaceApi.ts`

```typescript
isRepositoryInWorkspaceDirectory(
  repository: AlexandriaEntry,
  workspaceId: string
): Promise<boolean | null>

moveRepositoryToWorkspaceDirectory(
  repository: AlexandriaEntry,
  workspaceId: string
): Promise<string>
```

### Renderer Service
**File**: `src/renderer/main-process-api/WorkspaceService.ts`

```typescript
static async isRepositoryInWorkspaceDirectory(
  repository: AlexandriaEntry,
  workspaceId: string
): Promise<boolean | null>

static async moveRepositoryToWorkspaceDirectory(
  repository: AlexandriaEntry,
  workspaceId: string
): Promise<string>
```

---

## Usage Example

```typescript
// Check if repo needs to be moved
const workspace = await WorkspaceService.getWorkspace(workspaceId);
const needsMove = await WorkspaceService.isRepositoryInWorkspaceDirectory(
  repository,
  workspaceId
);

if (workspace.suggestedClonePath && needsMove === false) {
  // Show "Move to workspace" button
  const newPath = await WorkspaceService.moveRepositoryToWorkspaceDirectory(
    repository,
    workspaceId
  );

  console.log(`Repository moved to: ${newPath}`);
  // UI should react to events, but currently requires page reload
}
```

---

## Testing Considerations

### Unit Tests
- [ ] Test path normalization logic
- [ ] Test directory boundary detection
- [ ] Test error cases (workspace not found, no suggestedClonePath, target exists)

### Integration Tests
- [ ] Test physical file move
- [ ] Test registry update after move
- [ ] Test event broadcasting
- [ ] Test rollback on failure

### E2E Tests
- [ ] Test UI button visibility
- [ ] Test move confirmation dialog
- [ ] Test successful move flow
- [ ] Test error handling in UI
- [ ] Test that UI updates after move (once event propagation fixed)

---

## Related Documentation

- [WORKSPACE_INTEGRATION_PLAN.md](./WORKSPACE_INTEGRATION_PLAN.md) - Overall workspace integration plan
- [MULTI_WORKSPACE_MEMBERSHIP_DESIGN.md](./MULTI_WORKSPACE_MEMBERSHIP_DESIGN.md) - Multi-workspace membership design

---

**Document Status**: Complete
**Created**: 2025-11-11
**Last Updated**: 2025-11-11 - Added repository monitoring system details, Feed panel dependencies, and unregister/re-register recommendations
**Author**: Claude Code

## Summary of Key Findings

1. **Repositories are registered on app startup**, not when windows are opened
2. **Unregister before moving** to avoid stale references in monitoring server
3. **Three Feed panels require event updates** after move:
   - Local Projects Panel
   - Workspace Repositories Panel
   - Git-Sync Diagnostic Panel
4. **Broadcast both events** for complete update:
   - `REPOSITORY_UPDATED` (Alexandria) for Feed panels
   - `MEMBERSHIP_CHANGED` (Workspace) for workspace state
5. **Prevent move if window is open** to avoid breaking open repository dashboards
