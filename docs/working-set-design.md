# Working Set Design

## Overview

This document describes the "Working Set" concept for supporting multiple repositories within a single dev workspace window. The working set is an ephemeral, per-window collection of repositories that can grow organically during a session and optionally be persisted to an Alexandria Workspace.

## Problem Statement

The dev workspace window was originally designed for a single repository. We want to support multiple repositories in a window to enable workflows like:

- Opening a terminal in a different repo and having it become part of the window's context
- Working across related repos (e.g., app + shared library) without multiple windows
- Gradually building up a "working context" that can be saved as a workspace

## Key Concepts

### Alexandria Workspace vs Working Set

```
┌─────────────────────────────────────────────────────────┐
│                    Alexandria Workspace                 │
│                    (persisted, source of truth)         │
│                                                         │
│   • Stored in Alexandria registry                       │
│   • Explicit membership management                      │
│   • Survives across sessions                            │
│   • User-managed collections of repos                   │
└──────────────────────┬──────────────────────────────────┘
                       │ initializes
                       ▼
┌─────────────────────────────────────────────────────────┐
│                      Working Set                        │
│                  (ephemeral, per-window)                │
│                                                         │
│   • Lives in window state (React context or similar)    │
│   • Grows organically (terminal, drag/drop, manual)     │
│   • Quick to add/remove repos                           │
│   • Can "save to workspace" to persist changes          │
│   • Gone when window closes (unless saved)              │
└─────────────────────────────────────────────────────────┘
```

### Relationship

- **Alexandria Workspace** is the persisted, user-curated collection
- **Working Set** is the runtime view that can diverge from the workspace
- Working set initializes from workspace (if opened from one) or starts with a single repo
- Changes to working set are ephemeral until explicitly saved

## Data Model

### Working Set Entry

```typescript
interface WorkingSetEntry {
  repo: AlexandriaEntry;
  source: 'workspace' | 'terminal' | 'manual';  // How it was added
  addedAt: number;                               // Timestamp
}
```

### Working Set

```typescript
interface WorkingSet {
  // The repos currently in this window's context
  entries: WorkingSetEntry[];

  // Optional link to persisted workspace
  workspaceId?: string;

  // Track what's changed vs the workspace
  pendingAdditions: string[];  // repo paths added but not saved
  pendingRemovals: string[];   // repo paths removed but not saved
}

// Helper to check if working set has unsaved changes
function isDirty(workingSet: WorkingSet): boolean {
  return workingSet.pendingAdditions.length > 0 ||
         workingSet.pendingRemovals.length > 0;
}
```

### Working Set Context (React)

```typescript
interface WorkingSetContextValue {
  workingSet: WorkingSet;

  // Currently focused/selected repo (for panel context)
  activeRepo: AlexandriaEntry | null;

  // Actions
  addRepo: (repo: AlexandriaEntry, source: WorkingSetEntry['source']) => void;
  removeRepo: (repoPath: string) => void;
  setActiveRepo: (repoPath: string) => void;

  // Persistence
  saveToWorkspace: () => Promise<void>;
  createWorkspaceFromWorkingSet: (name: string) => Promise<string>;
  discardChanges: () => void;
}
```

## Terminal Integration

### Current Terminal Session Model

Terminal sessions already track repository association:

```typescript
interface TerminalSession {
  id: string;
  directory: string;      // cwd
  repoPath?: string;      // Git root (auto-detected)
  repoId?: string;        // "owner/repo" format
  context?: string;       // 'principal' | 'agent' | custom
  // ...
}
```

### Adding Repos via Terminal

When a terminal session is created or changes directory:

1. Terminal auto-detects git root (`repoPath`)
2. Check if `repoPath` is in working set
3. If not, add it with `source: 'terminal'`
4. Terminal tab shows repo badge for visual association

```typescript
// In terminal session creation or directory change handler
async function handleTerminalRepoDetection(session: TerminalSession) {
  if (!session.repoPath) return;

  const workingSet = getWorkingSet();
  const isInWorkingSet = workingSet.entries.some(
    e => e.repo.path === session.repoPath
  );

  if (!isInWorkingSet) {
    // Look up or create AlexandriaEntry for this repo
    const entry = await getOrCreateAlexandriaEntry(session.repoPath);
    workingSet.addRepo(entry, 'terminal');
  }
}
```

### Terminal Tab UI Enhancement

```typescript
interface TerminalTabProps {
  session: TerminalInfo;
  repoLabel?: string;        // Short name for badge
  repoBadgeColor?: string;   // Visual distinction per repo
  isActiveRepo?: boolean;    // Highlight if matches active repo
}
```

### "Open Terminal In..." Action

Add UI for explicitly opening a terminal in a different repo:

1. Click [+] on terminal tabs or menu action
2. Show picker with options:
   - Repos in working set (quick access)
   - All Alexandria repos
   - "Browse..." for arbitrary directory
3. Create terminal with selected cwd
4. Auto-add to working set if not present

## UI Design

### Titlebar Changes

```
┌─────────────────────────────────────────────────────────┐
│ [electron-app ▾]  Working Set: 3 repos  [Save ↑]       │
│  └─ repo selector    └─ click to expand  └─ if dirty   │
└─────────────────────────────────────────────────────────┘
```

**Repo Selector Dropdown:**
- Shows all repos in working set
- Indicates which are from workspace vs added in session
- "Add repository..." option at bottom
- Selecting a repo changes panel context

**Working Set Indicator:**
- Shows count of repos
- Click expands to show list with sources
- Can remove repos from here
- Shows dirty indicator if unsaved changes

### Terminal Tabs

```
┌────────────────┬──────────────────┬─────────────────┬───┐
│ ● electron-app │ ● shared-lib     │ ● design-sys    │ + │
│   npm run dev  │   npm run build  │   npm test      │   │
└────────────────┴──────────────────┴─────────────────┴───┘
     ↑ repo badge with color coding
```

### Panel Context

Panels that are repo-specific should respond to `activeRepo`:

- File City → shows active repo's structure
- Git panel → shows active repo's status
- Code Quality → shows active repo's metrics
- Terminal Sessions → can filter by repo or show all

## Implementation Plan

### Phase 1: Working Set State

1. Create `WorkingSetContext` provider
2. Initialize from URL params (workspaceId or single repo)
3. Store in window-level React state
4. Wire up to existing `RepositoryPanelContext`

### Phase 2: Terminal Integration

1. Add repo detection hook to terminal session lifecycle
2. Auto-add detected repos to working set
3. Add repo badge to terminal tabs
4. Implement "Open terminal in..." action

### Phase 3: UI Polish

1. Add working set indicator to titlebar
2. Add repo selector dropdown
3. Add "Save to Workspace" flow
4. Add "Create Workspace" flow for no-workspace case

### Phase 4: Panel Context Switching

1. Wire up `activeRepo` to panel context
2. Update panels to respond to repo changes
3. Consider per-panel repo override (pin panel to specific repo)

## File Monitoring Considerations

The file monitoring system already supports multiple repos per window:

```typescript
// In window handlers
const watchReferenceId = `dev-workspace:${windowId}`;

// Can acquire watches for multiple repos
for (const entry of workingSet.entries) {
  await monitoringManager.acquireWatch(entry.repo.path, watchReferenceId);
}

// Cleanup on window close
window.once('closed', () => {
  for (const entry of workingSet.entries) {
    monitoringManager.releaseWatch(entry.repo.path, watchReferenceId);
  }
});
```

When repos are added/removed from working set at runtime:
- Call `acquireWatch` for new repos
- Call `releaseWatch` for removed repos

## Open Questions

1. **Confirmation on terminal add?** Should adding a repo via terminal be automatic, or prompt "Add X to working set?"

2. **Panel pinning?** Should panels support being "pinned" to a specific repo while user works in another?

3. **Working set persistence?** Should working set state survive window reload (store in sessionStorage)?

4. **Cross-window awareness?** If same repo is open in another window, show indicator?

5. **Merge with Alexandria Workspace window?** Long-term, should dev workspace and Alexandria workspace converge into one window type with working set as the unifying model?

## Related Files

- `src/renderer/dev-workspace/DevWorkspaceApp.tsx` - Main dev workspace component
- `src/renderer/contexts/RepositoryPanelContext.tsx` - Repository context provider
- `src/renderer/contexts/TerminalContext.tsx` - Terminal state management
- `src/main/window/devWorkspaceWindowHandlers.ts` - Window creation/monitoring
- `src/main/terminal/TerminalSessionManager.ts` - Terminal session lifecycle
- `src/renderer/main-process-api/WorkspaceService.ts` - Workspace persistence API
