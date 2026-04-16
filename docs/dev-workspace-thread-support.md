# Dev Workspace Thread Support

**Status:** Design Document
**Created:** 2026-04-16
**Goal:** Add thread-like functionality to dev workspace windows, allowing multiple repositories to be added and switched between like in Alexandria workspace

## Overview

Currently, the dev workspace window opens for a single repository and provides a focused development environment. This document outlines how to extend it to support "threads" - collections of related repositories that can be managed together, similar to how the Alexandria workspace operates.

## Current Architecture

### Dev Workspace (Single Repository Mode)
- **Entry Point:** `src/renderer/dev-workspace/DevWorkspaceApp.tsx`
- **Initialization:** Parses repository data from URL hash (`#init/{encodedJSON}`)
- **Context:** Single `Repository` object passed to all panels
- **Panel Framework:** `DevWorkspacePanelFramework.tsx` - creates `RepositoryPanelContext` once at mount
- **No Repository Switching:** Entire window context is bound to one repository

Key Code:
```typescript
// DevWorkspaceApp.tsx:59-78
function useWindowData(): AlexandriaEntryData | null {
  const [data, setData] = useState<AlexandriaEntryData | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#init/')) {
      const encodedData = hash.slice(6);
      const parsed = JSON.parse(decodeURIComponent(encodedData));
      setData(parsed);
    }
  }, []);

  return data;
}
```

### Alexandria Workspace (Multi-Repository Mode)
- **Entry Point:** `src/renderer/alexandria-workspace/AlexandriaWorkspaceApp.tsx`
- **Repository List:** `workspaceRepositories` array from `WorkspaceService`
- **Selection State:** `selectedRepository` state drives context updates
- **Panel:** `workspace-repos` (RecentRepositoriesPanel) shows list of repositories
- **Event Handling:**
  - Single-click → `repository:selected` → updates context/panels
  - Double-click → `repository:opened` → opens new dev workspace window

Key Code:
```typescript
// AlexandriaWorkspaceLayout.tsx:398-446
events.on('repository:selected', async (event) => {
  const { repository, repositoryPath } = event.payload;

  // Toggle: if clicking on already selected repo, deselect it
  if (selectedRepository && selectedRepository.path === repositoryPath) {
    onRepositorySelected(undefined);
  } else {
    onRepositorySelected({
      name: repository.name,
      path: repositoryPath,
    });

    // Open File City in right panel
    onLayoutChange({ ...layout, right: 'file-city' });
    // Expand right panel if collapsed
    if (collapsed.right) {
      panelLayoutRef.current.expandPanel('right');
    }
  }
});
```

## Requirements

### Functional Requirements

1. **Add Repositories to Thread**
   - Start with one repository (current behavior)
   - Add more repositories from Alexandria registry or file system
   - Remove repositories from thread

2. **Switch Active Repository**
   - Click on repository → switch context (don't open new window)
   - All panels update to show data for selected repository
   - Visual indicator of active repository

3. **Thread Persistence** (Optional)
   - Save thread state (list of repositories + selected repo)
   - Restore thread on window reopen
   - "Save Thread as Workspace" functionality

4. **Ephemeral Thread Support**
   - Open empty thread and add repos dynamically
   - Prompt to save before closing if unsaved changes

### Non-Functional Requirements

1. **Performance:** Context switching should be fast (<200ms)
2. **Stability:** Panels must handle context changes gracefully
3. **Backwards Compatible:** Single-repo mode still works

## Design

### 1. State Management

Add thread state to `DevWorkspaceApp.tsx`:

```typescript
// Repository thread state
const [threadRepositories, setThreadRepositories] = useState<AlexandriaEntry[]>([]);
const [selectedRepository, setSelectedRepository] = useState<AlexandriaEntry | undefined>();
const [isEphemeralThread, setIsEphemeralThread] = useState(false);

// Initialize from URL (backwards compatible)
useEffect(() => {
  const alexandriaEntry = useWindowData();

  if (alexandriaEntry) {
    // Single repo mode (existing behavior)
    setThreadRepositories([alexandriaEntry]);
    setSelectedRepository(alexandriaEntry);
  } else {
    // Check for empty thread mode
    const urlParams = new URLSearchParams(window.location.search);
    const emptyThread = urlParams.get('emptyThread') === 'true';

    if (emptyThread) {
      setIsEphemeralThread(true);
      setThreadRepositories([]);
    }
  }
}, []);
```

### 2. Panel Updates

#### Add Repositories Panel

Add new panel ID to dev workspace:

```typescript
// DevWorkspaceApp.tsx:81-101 - Add to PANEL_IDS
const PANEL_IDS = [
  'terminal',
  'terminalSessions',
  'threadRepositories', // NEW
  'principalView',
  'fileCity',
  // ... rest
];
```

Create or adapt panel to show thread repositories:
- Reuse `RecentRepositoriesPanel` or create `ThreadRepositoriesPanel`
- Single-click emits `repository:selected` (not `repository:opened`)
- Add context menu for "Remove from Thread"

#### Update Panel Framework

`DevWorkspacePanelFramework.tsx` needs dynamic context:

```typescript
// Current: Context created once at mount
useEffect(() => {
  const context = createRepositoryPanelContext(repository, ...);
  // ...
}, [repository.path]); // Add dependency on repository

// Need: Re-create context when selectedRepository changes
useEffect(() => {
  if (!selectedRepository) {
    // Show empty state or workspace-level context
    return;
  }

  // Refresh all repository-specific slices
  const context = createRepositoryPanelContext(selectedRepository, ...);
  // Trigger re-render of all panels
}, [selectedRepository?.path]);
```

### 3. Event Handling

Add event listener in `DevWorkspaceApp.tsx`:

```typescript
// DevWorkspaceApp.tsx (new useEffect)
useEffect(() => {
  const unsubscribe = events.on('repository:selected', (event) => {
    const { repository, repositoryPath } = event.payload;

    // Toggle selection
    if (selectedRepository?.path === repositoryPath) {
      setSelectedRepository(undefined);
    } else {
      setSelectedRepository(repository);

      // Update layout to show relevant panels
      setLayout((prev) => ({ ...prev, right: 'fileCity' }));
      if (collapsed.right) {
        panelControlRef.current?.expandPanel('right');
      }
    }
  });

  return unsubscribe;
}, [events, selectedRepository]);
```

### 4. Add Repository UI

Add button to titlebar (`DevWorkspaceTitlebar.tsx`):

```typescript
interface DevWorkspaceTitlebarProps {
  // ... existing props
  threadRepositories: AlexandriaEntry[];
  onAddRepository: () => void;
  onRemoveRepository: (repo: AlexandriaEntry) => void;
}

// In titlebar component
<button onClick={onAddRepository}>
  <Plus size={16} />
  Add Repository
</button>
```

Implementation:

```typescript
// DevWorkspaceApp.tsx
const handleAddRepository = useCallback(async () => {
  // Option 1: Browse Alexandria registry
  const allRepos = await AlexandriaService.getRepositories();
  // Show modal to select repository

  // Option 2: File picker
  const path = await window.mainProcess.dialog.showOpenDialog({
    properties: ['openDirectory'],
  });

  // Add to thread
  setThreadRepositories((prev) => [...prev, newRepo]);
}, []);
```

### 5. Thread Persistence

Add save functionality (similar to Alexandria workspace):

```typescript
// DevWorkspaceApp.tsx
const handleSaveThread = useCallback(async (workspaceName: string) => {
  // Create new workspace
  const workspace = await WorkspaceService.createWorkspace({
    name: workspaceName,
  });

  // Add all repositories
  for (const repo of threadRepositories) {
    await WorkspaceService.addRepositoryToWorkspace(repo, workspace.id);
  }

  console.info('Thread saved as workspace:', workspace.id);
  setIsEphemeralThread(false);
}, [threadRepositories]);

// Prompt before close if ephemeral
useEffect(() => {
  if (!isEphemeralThread || threadRepositories.length === 0) return;

  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    setShowSaveThreadModal(true);
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [isEphemeralThread, threadRepositories]);
```

## Implementation Plan

### Phase 1: Basic Thread Support (Core Functionality)

1. **Add State Management**
   - Add `threadRepositories` and `selectedRepository` state to DevWorkspaceApp
   - Update initialization logic to support both modes
   - Files: `src/renderer/dev-workspace/DevWorkspaceApp.tsx`

2. **Dynamic Context Updates**
   - Make `DevWorkspacePanelFramework` context reactive to selected repository
   - Add dependency tracking for repository changes
   - Files: `src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx`

3. **Add Repository Selection Event Handling**
   - Wire up `repository:selected` event
   - Implement context switching logic
   - Files: `src/renderer/dev-workspace/DevWorkspaceApp.tsx`

4. **Create Thread Repositories Panel**
   - Add `threadRepositories` panel ID
   - Adapt `RecentRepositoriesPanel` or create new panel
   - Update panel definitions
   - Files:
     - `src/renderer/dev-workspace/DevWorkspaceApp.tsx`
     - `src/renderer/panels/thread-repositories/` (new)

### Phase 2: Repository Management

5. **Add Repository UI**
   - Add "Add Repository" button to titlebar
   - Implement repository selection modal
   - Files: `src/renderer/dev-workspace/DevWorkspaceTitlebar.tsx`

6. **Add Repository Implementation**
   - Browse Alexandria registry
   - File system picker
   - Add to thread state
   - Files: `src/renderer/dev-workspace/DevWorkspaceApp.tsx`

7. **Remove Repository**
   - Context menu on repository cards
   - Remove from thread state
   - Handle if selected repo is removed

### Phase 3: Thread Persistence (Optional)

8. **Save Thread as Workspace**
   - Add "Save Thread" modal
   - Create workspace and add repositories
   - Files: `src/renderer/components/SaveThreadModal.tsx` (already exists)

9. **Ephemeral Thread Handling**
   - Detect unsaved threads
   - Prompt before close
   - Files: `src/renderer/dev-workspace/DevWorkspaceApp.tsx`

10. **Empty Thread Mode**
    - Support opening with no initial repositories
    - URL parameter: `?emptyThread=true`
    - Files: Window creation logic

## Technical Challenges

### 1. Context Refresh Performance

**Issue:** Refreshing all repository-specific context slices on repository switch could be slow.

**Solution:**
- Implement selective refresh - only update changed slices
- Use React.memo on panels to prevent unnecessary re-renders
- Consider keeping context for recently-used repos in memory

### 2. Panel State Loss

**Issue:** Panels may lose state (scroll position, expanded items) when context changes.

**Solution:**
- Store panel-specific state outside of context
- Use session storage or local state keyed by repository path
- Implement panel state restoration on context switch

### 3. Terminal Sessions

**Issue:** Terminal sessions are tied to repository - what happens when switching?

**Solution:**
- Keep terminal sessions alive across repository switches
- Tag sessions with repository path
- Show only relevant sessions for selected repository
- Or: Show all sessions across all thread repositories (workspace-wide terminals)

### 4. Backwards Compatibility

**Issue:** Existing single-repo mode must continue to work.

**Solution:**
- Initialize with single repository if URL hash present (existing behavior)
- Thread mode is opt-in via new URL parameter
- Ensure `threadRepositories.length === 1` behaves identically to current

## File Reference

### Files to Modify

| File | Changes | Lines |
|------|---------|-------|
| `src/renderer/dev-workspace/DevWorkspaceApp.tsx` | Add thread state, event handling | ~50-100 lines |
| `src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx` | Dynamic context refresh | ~20-30 lines |
| `src/renderer/dev-workspace/DevWorkspaceTitlebar.tsx` | Add Repository button | ~30-50 lines |
| `src/renderer/dev-workspace/index.tsx` | Export types | ~5 lines |

### Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/renderer/panels/thread-repositories/ThreadRepositoriesPanel.tsx` | Repository list panel | ~200 lines |
| `src/renderer/panels/thread-repositories/index.tsx` | Panel exports | ~10 lines |
| `src/renderer/components/AddRepositoryModal.tsx` | Modal for adding repos | ~150 lines |

### Reference Implementations

- **Alexandria Workspace:** `src/renderer/alexandria-workspace/AlexandriaWorkspaceApp.tsx`
  - Lines 94-621: Multi-repository state management
  - Lines 558-620: Ephemeral thread handling

- **Repository Selection:** `src/renderer/alexandria-workspace/AlexandriaWorkspaceLayout.tsx`
  - Lines 398-446: `repository:selected` event handler
  - Lines 450-481: `repository:opened` event handler

- **Repository Panel:** `src/renderer/panels/recent-repositories/RecentRepositoriesPanel.tsx`
  - Lines 132-441: Full panel implementation with search

## Testing Strategy

### Unit Tests

1. **State Management**
   - Test thread repository addition/removal
   - Test repository selection toggle
   - Test ephemeral thread detection

2. **Event Handling**
   - Mock event bus
   - Verify `repository:selected` triggers context update
   - Verify panel state updates

### Integration Tests

1. **Single Repository Mode**
   - Open dev workspace with URL hash (existing flow)
   - Verify backward compatibility

2. **Thread Mode**
   - Open empty thread
   - Add multiple repositories
   - Switch between repositories
   - Verify panel data updates

3. **Persistence**
   - Create ephemeral thread
   - Add repositories
   - Save as workspace
   - Verify workspace created with all repos

### Manual Testing Checklist

- [ ] Single repo mode still works (backwards compatibility)
- [ ] Can add repository from Alexandria registry
- [ ] Can add repository from file system
- [ ] Can remove repository from thread
- [ ] Repository selection updates File City panel
- [ ] Repository selection updates Terminal context
- [ ] Repository selection updates Git Changes panel
- [ ] Can deselect repository (toggle)
- [ ] Empty thread mode works
- [ ] Save thread modal appears on close
- [ ] Thread saves as workspace correctly
- [ ] Panel state persists across repository switches

## Future Enhancements

1. **Workspace-Wide Terminals**
   - Show terminals from all repositories in thread
   - Tag terminal sessions with repository name

2. **Cross-Repository Search**
   - Search across all repositories in thread
   - Unified file explorer

3. **Thread Templates**
   - Save common repository combinations
   - Quick-start templates for common workflows

4. **Automatic Repository Discovery**
   - Suggest related repositories based on dependencies
   - Auto-add monorepo packages

## Related Documents

- [Panel Implementation Guide](./panel-implementation-guide.md)
- [Workspace Integration Plan](./workspace-integration-plan.md)
- [Alexandria Workspace Enhancements](./alexandria-workspace-enhancements.md)
- [Repository Panel System](./repository-panel-system.md)

## Questions & Decisions

### Open Questions

1. **Should terminals be per-repository or workspace-wide?**
   - Per-repository: Cleaner separation, but lose context on switch
   - Workspace-wide: Keep all terminals, but harder to manage
   - **Decision:** Start with per-repository, add workspace-wide as enhancement

2. **How to handle panel state on repository switch?**
   - Clear state: Simpler, but loses scroll position, etc.
   - Preserve state: Better UX, but more complex
   - **Decision:** Start with clear state, optimize later

3. **Should double-click open dev workspace or just select?**
   - Open window: Consistent with Alexandria workspace
   - Select only: Less confusing in thread context
   - **Decision:** Select only (single-click), no double-click behavior in thread mode

### Resolved Decisions

- ✅ Thread mode is backward compatible with single-repo mode
- ✅ Use existing `RecentRepositoriesPanel` as base for thread panel
- ✅ Reuse `SaveThreadModal` component from Alexandria workspace
- ✅ Context refresh happens on repository selection change

## Appendix: Code Snippets

### A. Initialize Thread from URL

```typescript
// DevWorkspaceApp.tsx
interface ThreadConfig {
  repositories: AlexandriaEntry[];
  selectedIndex?: number;
  ephemeral?: boolean;
}

function useThreadData(): ThreadConfig | null {
  const [data, setData] = useState<ThreadConfig | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);

    // Mode 1: Single repository (existing)
    if (hash.startsWith('#init/')) {
      const encodedData = hash.slice(6);
      const repo = JSON.parse(decodeURIComponent(encodedData));
      setData({
        repositories: [repo],
        selectedIndex: 0,
        ephemeral: false,
      });
      return;
    }

    // Mode 2: Empty ephemeral thread
    if (params.get('emptyThread') === 'true') {
      setData({
        repositories: [],
        ephemeral: true,
      });
      return;
    }

    // Mode 3: Thread with multiple repos
    if (hash.startsWith('#thread/')) {
      const encodedData = hash.slice(8);
      const threadData = JSON.parse(decodeURIComponent(encodedData));
      setData(threadData);
      return;
    }
  }, []);

  return data;
}
```

### B. Dynamic Context Provider

```typescript
// DevWorkspacePanelFramework.tsx
const [contextKey, setContextKey] = useState(0);

// Force context refresh on repository change
useEffect(() => {
  if (!repository) return;

  console.info('[DevWorkspacePanelFramework] Repository changed, refreshing context');
  setContextKey((prev) => prev + 1);
}, [repository?.path]);

// Provide context with key to force unmount/remount
<RepositoryPanelContext key={contextKey} repository={repository}>
  {children}
</RepositoryPanelContext>
```

### C. Repository Selection Handler

```typescript
// DevWorkspaceApp.tsx
const handleRepositorySelected = useCallback((event: PanelEvent) => {
  const { repository, repositoryPath } = event.payload;

  // Find in thread
  const found = threadRepositories.find(r => r.path === repositoryPath);
  if (!found) return;

  // Toggle selection
  if (selectedRepository?.path === repositoryPath) {
    console.info('[DevWorkspace] Deselecting repository:', repository.name);
    setSelectedRepository(undefined);

    // Clear right panel or show workspace-level panel
    setLayout((prev) => ({ ...prev, right: 'event-bus' }));
  } else {
    console.info('[DevWorkspace] Selecting repository:', repository.name);
    setSelectedRepository(found);

    // Update panels to show repository context
    setLayout((prev) => ({ ...prev, right: 'fileCity' }));

    // Expand right panel if collapsed
    if (collapsed.right && panelControlRef.current) {
      panelControlRef.current.expandPanel('right');
    }
  }
}, [threadRepositories, selectedRepository, collapsed, setLayout]);
```

---

**Document Version:** 1.0
**Last Updated:** 2026-04-16
