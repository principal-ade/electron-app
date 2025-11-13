# Alexandria Workspace Manager Window

This window provides a dedicated interface for managing Alexandria workspaces.

## Purpose

Workspaces are cross-repository collections that help organize multiple repositories into logical groups. Unlike the deprecated Palace Rooms (which were per-repository), workspaces operate at a higher level across all repositories.

## Implementation Status

- ✅ **Backend**: Fully implemented (`WorkspaceApiEventHandler`, `WorkspaceService`)
- ✅ **IPC Layer**: Complete with event subscription
- ✅ **Window Scaffolding**: Created with proper webpack configuration
- 🚧 **UI Components**: Starter scaffold in place, needs full implementation

## Key Features to Implement

1. **Workspace List Panel**
   - Display all workspaces
   - Create new workspace button
   - Edit/delete workspace actions
   - Highlight default workspace

2. **Workspace Details Panel**
   - Show workspace metadata (name, description, color, icon)
   - Display member repositories
   - Add/remove repository members
   - Configure suggested clone path

3. **Repository Selection**
   - Browse all registered repositories
   - Filter repositories by workspace membership
   - Drag-and-drop to add repositories to workspaces

4. **Settings**
   - Set default workspace
   - Configure workspace-level preferences

## Available Services

### WorkspaceService
Located at: `src/renderer/main-process-api/WorkspaceService.ts`

Key methods:
- `createWorkspace(data)` - Create new workspace
- `getWorkspaces()` - Get all workspaces
- `updateWorkspace(id, updates)` - Update workspace
- `deleteWorkspace(id)` - Delete workspace
- `addRepositoryToWorkspace(repo, workspaceId)` - Add repo to workspace
- `removeRepositoryFromWorkspace(repo, workspaceId)` - Remove repo from workspace
- `getRepositoriesInWorkspace(workspaceId)` - Get all repos in workspace
- `getDefaultWorkspace()` - Get default workspace
- `setDefaultWorkspace(workspaceId)` - Set default workspace

### Existing UI Components

These can be integrated or referenced:
- `src/renderer/components/CreateWorkspaceModal.tsx` - Modal for creating workspaces
- `src/renderer/panels/components/WorkspacesListPanel.tsx` - List panel component
- `src/renderer/panels/components/WorkspaceEntriesPanel.tsx` - Entries panel component
- `src/renderer/contexts/WorkspaceFilterContext.tsx` - Context for filtering

## Opening the Window

From renderer process:
```typescript
import { WindowEvent } from '@shared/ipc-events/WindowEvents';

window.electron.ipcRenderer.invoke(WindowEvent.OPEN_ALEXANDRIA_WORKSPACE);
```

## Architecture

```
Alexandria Workspace Window
├── Header (title, description)
├── Sidebar (workspace list)
│   ├── Workspace items
│   └── Create button
└── Main Panel (workspace details)
    ├── Metadata section
    ├── Repository members list
    └── Actions (add/remove repos)
```

## Data Model

### Workspace
```typescript
interface Workspace {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  isDefault?: boolean;
  createdAt: number;
  updatedAt: number;
  suggestedClonePath?: string;
  metadata?: Record<string, unknown>;
}
```

### WorkspaceMembership
```typescript
interface WorkspaceMembership {
  repositoryId: string;  // "owner/name" format
  workspaceId: string;
  addedAt: number;
  metadata?: Record<string, unknown>;
}
```

## Migration Notes

This window replaces the old "Palace Room Workspace" concept. Palace Rooms were repository-specific isolation containers, while Workspaces are cross-repository organizational tools.

Key differences:
- Palace Rooms: Per-repository, path-based
- Workspaces: Cross-repository, identity-based
- Workspaces support multi-clone (all local clones share membership)
