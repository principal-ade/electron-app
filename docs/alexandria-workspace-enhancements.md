# Alexandria Workspace Enhancements

**Date:** 2026-01-23
**Status:** In Progress
**Goal:** Enhance Alexandria Workspace to support single-repository workflows and eventually deprecate Dev Workspace window

## Overview

This document tracks the implementation of enhancements to the Alexandria Workspace window to support both multi-repository workspace management and single-repository focused workflows. The ultimate goal is to provide a unified workspace experience that can replace the Dev Workspace window.

## Completed Work

### 1. Added PanelIconSidebar to Alexandria Workspace

**Files Modified:**
- `src/renderer/alexandria-workspace/AlexandriaWorkspaceLayout.tsx`

**Changes:**
- Added icon-based sidebar (80px wide) on the left side of the window
- Imported missing panel packages:
  - `@industry-theme/backlogmd-kanban-panel` (Kanban, Tasks, Milestones)
  - `@industry-theme/agent-panels` (Skills, Agents)
  - `@industry-theme/github-panels` (GitHub Issues)
  - `@industry-theme/repository-composition-panels` (Git Changes, Package Composition)
  - `@principal-ade/code-quality-panels` (Code Quality)
- Added 15+ new panel definitions from Dev Workspace
- Integrated `PanelIconSidebar` component with 9 quick-access panel icons

**Result:** Alexandria Workspace now has the same sidebar and panel options as Dev Workspace.

### 2. Added Repository-Based Opening

**Files Modified:**
- `src/shared/main-process-api-interfaces/WindowAPI.ts`
- `src/renderer/main-process-api/WindowService.ts`
- `src/main/window/modernWindowHandlers.ts`
- `src/renderer/alexandria-workspace/AlexandriaWorkspaceApp.tsx`
- `src/window/main-process-api-implementations/windowApi.ts`
- `src/renderer/contexts/ProjectsPanelContext.tsx`

**New Interface:**
```typescript
interface AlexandriaWorkspaceOptions {
  workspaceId?: string;
  repositoryPath?: string;
  repositoryId?: string; // PURL or github.id
}
```

**Changes:**
- `openAlexandriaWorkspace()` now accepts options object instead of just `workspaceId`
- Added convenience method: `openAlexandriaWorkspaceFromRepository(repositoryPath, repositoryId?)`
- Main process handler supports two modes:
  - **Workspace mode**: Opens with existing workspace (original behavior)
  - **Temp mode**: Creates temporary single-repo workspace (new)
- AlexandriaWorkspaceApp handles both modes:
  - Workspace mode: Loads workspace + all repos
  - Temp mode: Creates temp workspace with single repository

**Window Naming:**
- Workspace mode: `alexandria-workspace-{workspaceId}`
- Temp mode: `alexandria-workspace-temp-{sanitized-repo-id}`

**File Monitoring:**
- Workspace mode: Monitors all repositories in workspace
- Temp mode: Monitors only the single repository

### 3. Added "Workspace" Button to Dev Workspace

**Files Modified:**
- `src/renderer/dev-workspace/DevWorkspaceTitlebar.tsx`
- `src/renderer/dev-workspace/DevWorkspaceApp.tsx`

**Changes:**
- Added "Workspace" button to dev workspace titlebar (appears on hover)
- Button opens current repository in Alexandria Workspace (temp mode)
- Uses `Layers` icon, positioned next to "Web" and "Actions" buttons

**Usage:** Allows users to test the new Alexandria Workspace functionality from Dev Workspace.

## Current Architecture

### Window Opening Modes

```
┌─────────────────────────────────────────────────────┐
│                Opening Modes                         │
├─────────────────────────────────────────────────────┤
│                                                      │
│  1. From Workspace List                             │
│     → Opens with workspaceId                        │
│     → Shows all repos in workspace                  │
│     → Standard workspace management                 │
│                                                      │
│  2. From Repository (NEW)                           │
│     → Opens with repositoryPath + repositoryId      │
│     → Creates temp workspace                        │
│     → Shows only that one repository                │
│     → Single-repo focused experience                │
│                                                      │
│  3. From Dev Workspace Button (NEW)                 │
│     → Calls openAlexandriaWorkspaceFromRepository() │
│     → Same as mode #2                               │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Temp Workspace Mode Details

**Created Workspace:**
```typescript
{
  id: `temp-${timestamp}`,
  name: 'Repository Workspace',
  createdAt: Date.now(),
  updatedAt: Date.now()
}
```

**Features:**
- Single repository in list
- Auto-selected on load
- All panels work with single repo context
- No workspace change subscriptions (temp only)

## Design Decisions

### 1. Window Deduplication - Deferred

**Decision:** Don't solve window deduplication at the window handler level yet.

**Rationale:**
- Picker modal (future work) will handle workspace selection BEFORE window creation
- By the time window is created, user has already decided:
  - Focus existing workspace window
  - Open different workspace window
  - Create new workspace
- This keeps the implementation simpler for now

### 2. Temp Workspace Approach

**Decision:** Create temporary workspace in UI when no `workspaceId` provided.

**Benefits:**
- Simpler main process (no workspace resolution logic)
- Faster window opening
- Flexible UI for future picker modal
- Easy state management

**Trade-offs:**
- Window naming uses repository ID (temp windows are repo-specific)
- File monitoring limited to single repo until workspace selected
- Workspace subscriptions disabled in temp mode

### 3. Default Behavior

**Decision:** Always open in temp workspace mode when opening from repository (for now).

**Rationale:**
- Workspace picker modal is future work
- Temp mode provides immediate single-repo focused experience
- Users can manually add to workspace later
- Avoids complexity of workspace resolution

## Future Work

### Phase 1: Workspace Picker Modal (High Priority)

**Goal:** Give users control over workspace context when opening a repository.

**Implementation:**
1. Create `WorkspacePickerModal` component
2. Add `WorkspaceService.getWorkspacesContainingRepository(repositoryId)`
3. Show modal when opening repository:
   - List workspaces containing this repo
   - Show workspace metadata (name, repo count, last used)
   - Options:
     - Open in existing workspace
     - Create new workspace
     - Open standalone (temp mode)

**Modal Trigger Points:**
- Local Projects panel "Open in Workspace" action
- Menu items
- Dock clicks
- Any other repo → workspace transitions

**Benefits:**
- User controls workspace context
- Can choose between multiple workspaces
- Option to create new workspace on the fly
- Resolves window deduplication naturally

### Phase 2: Workspace Switcher in Alexandria Window

**Goal:** Allow users to switch workspaces without closing/reopening window.

**Features:**
- Workspace dropdown in titlebar or sidebar
- Switch workspace → reload repos in-place
- Update URL and file monitoring
- Smooth transition (no window flicker)

### Phase 3: Enhanced Single-Repo Experience

**Goal:** Make single-repo mode feel first-class.

**Features:**
- "Add to Workspace" button in temp mode
- Quick workspace creation from temp mode
- Suggest related repos (same org, dependencies)
- Persistent single-repo workspaces (save preference)

### Phase 4: Deprecate Dev Workspace

**Goal:** Remove Dev Workspace window entirely.

**Requirements Before Deprecation:**
1. ✅ All Dev Workspace panels available in Alexandria
2. ✅ Icon sidebar for quick panel switching
3. ✅ Single-repo mode working
4. ⏳ Workspace picker modal implemented
5. ⏳ User testing and feedback
6. ⏳ Migration path for existing users
7. ⏳ Keyboard shortcuts aligned
8. ⏳ Performance parity

**Migration Strategy:**
- Add "Open in Alexandria Workspace" to all repo entry points
- Gradually make Alexandria Workspace the default
- Keep Dev Workspace as fallback for one release
- Remove Dev Workspace in subsequent release

## Technical Notes

### File Monitoring

**Current Implementation:**
```typescript
// Workspace mode - monitor all repos
const repositories = await service.getRepositoriesInWorkspace(workspaceId);
await Promise.allSettled(
  reposWithPaths.map(repo =>
    monitoringManager.acquireWatch(repo.path, watchReferenceId)
  )
);

// Temp mode - monitor single repo
await monitoringManager.acquireWatch(repositoryPath, watchReferenceId);
```

**Cleanup:** Both modes release watches on window close.

### URL Parameters

**Workspace Mode:**
```
?workspaceId=uuid&repositoryPath=/path/to/repo
```

**Temp Mode:**
```
?repositoryPath=/path/to/repo&repositoryId=pkg:github/owner/repo
```

### Window Metadata

```typescript
{
  primaryType: PrimaryWindowType.WORKSPACE,
  displayName: workspaceName || repositoryName,
  workspaceId: workspaceId || undefined,
  purpose: windowName
}
```

## Testing Checklist

- [ ] Open Alexandria Workspace from workspace list
- [ ] Open Alexandria Workspace from repository (temp mode)
- [ ] Click "Workspace" button in Dev Workspace
- [ ] Verify all panels load correctly
- [ ] Test panel switching via icon sidebar
- [ ] Verify file monitoring works in both modes
- [ ] Test terminal context in both modes
- [ ] Verify git status updates in both modes
- [ ] Test workspace subscriptions (workspace mode only)
- [ ] Test repository panel in both modes
- [ ] Verify window titles are correct
- [ ] Test window deduplication (workspace mode)

## Questions & Considerations

### Window Deduplication Strategy

**Current State:** Window names based on repository in temp mode, workspace in workspace mode.

**Potential Issues:**
- Opening "repo A" in temp mode creates window
- User picks "Workspace X" in modal
- Window now shows "Workspace X" content
- Opening "Workspace X" from list creates duplicate window (wrong name)

**Options:**
1. **Pre-check existing windows** (Option A from discussion)
   - Check if workspace already open before creating temp window
   - Focus existing if available
   - Only create temp if no existing workspace window

2. **Close/reopen on workspace selection**
   - When user picks workspace in modal, close temp window
   - Open proper workspace window
   - Smooth transition (position new window at same location)

3. **Dynamic window rename** (complex)
   - Change window purpose/name after workspace selection
   - Update window manager tracking
   - Risky, may have side effects

**Recommendation:** Option 1 for workspace picker implementation.

### Performance Considerations

**File Monitoring:**
- Temp mode monitors 1 repository
- Workspace mode monitors N repositories (parallel)
- No performance concerns observed

**Panel Loading:**
- Same panel framework as Dev Workspace
- All panels lazy-loaded
- No performance differences expected

**Memory:**
- Temp workspace object is minimal
- Repository list smaller in temp mode
- Should use less memory than workspace mode

## Related Documentation

- `docs/workspace-integration-plan.md` - Original workspace system design
- `docs/panel-architecture.md` - Panel framework architecture
- `docs/window-opening-performance.md` - Window opening optimization
- `docs/repository-monitoring-git-watching.md` - File monitoring system

## Contact & Context

This enhancement is part of the larger effort to consolidate workspace windows and provide a unified repository/project management experience. The work enables a gradual migration path from Dev Workspace to Alexandria Workspace while maintaining full feature parity.

For questions or follow-up work, refer to this document and the related files listed above.
