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

**Implementation Flow**:

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

## Known Issues & Limitations

### 1. **Hard Page Reload Required**
- **Issue**: After moving, the UI does a full page reload
- **Why**: Workaround for missing proper event propagation
- **Impact**: Poor UX, loses UI state

### 2. **No Alexandria Update Event**
- **Issue**: `updateRepository()` doesn't broadcast `REPOSITORY_UPDATED` event
- **Why**: Event is only sent when using `refreshRepository()` method
- **Impact**: Other parts of app don't know path changed

### 3. **Git Watchers Not Updated**
- **Issue**: RepositoryMonitoringServer still watches old path
- **Why**: No notification mechanism for path changes
- **Impact**: File changes at new location not detected

### 4. **Open Windows Not Updated**
- **Issue**: If repository has an open window, it's not notified
- **Why**: No path change events broadcast to windows
- **Impact**: Open window may break or show stale data

### 5. **No Rollback on Partial Failure**
- **Issue**: If registry update fails after moving files, files aren't moved back
- **Why**: No transaction/rollback mechanism
- **Impact**: Can leave system in inconsistent state

### 6. **Single Event Broadcast**
- **Issue**: Only `MEMBERSHIP_CHANGED` event sent
- **Why**: Move operation treated as membership change only
- **Impact**: Components listening for path updates don't react

---

## Recommendations for Improvement

### Priority 1: Add Proper Event Propagation
```typescript
// In WorkspaceApiEventHandler.moveRepositoryToWorkspaceDirectory()
// After updating repository:

// Broadcast Alexandria repository update event
this.broadcastAlexandriaEvent(
  AlexandriaAPIEvent.REPOSITORY_UPDATED,
  updatedEntry
);

// Still broadcast workspace event
this.broadcastWorkspaceChange('membership-changed', undefined, workspaceId, repoId);
```

### Priority 2: Update Repository Monitoring
```typescript
// Notify RepositoryMonitoringServer of path change
await RepositoryMonitoringServer.updateRepositoryPath(
  repository.path,  // old path
  targetPath        // new path
);
```

### Priority 3: Remove Hard Reload
With proper events, the UI should update reactively:
```typescript
// Instead of window.location.reload()
// Just let event handlers update the UI
```

### Priority 4: Add Rollback Mechanism
```typescript
try {
  await fs.move(repository.path, targetPath);
  try {
    await this.service.updateRepository(entry.name, { path: targetPath });
  } catch (registryError) {
    // Rollback the file move
    await fs.move(targetPath, repository.path);
    throw registryError;
  }
} catch (error) {
  // Handle error
}
```

### Priority 5: Update Open Windows
```typescript
// After successful move
WindowService.notifyRepositoryPathChanged(
  repository.name,
  targetPath
);
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
**Last Updated**: 2025-11-11
**Author**: Claude Code
